"""Parser for pipeline files.

Pipeline files use a small YAML-like format. Each task is a top-level key
followed by indented settings:

    # comments run to the end of the line
    compile:
      duration: 4            # minutes on one runner
      resource: linux        # optional runner label

    package:
      duration: 2
      after: compile, lint   # inline list; [compile, lint] also works

    deploy:
      duration: 3
      after:                 # block list, one dependency per line
        - package
        - smoke-tests

parse_pipeline() only checks syntax. graph.load_pipeline() also checks that
every dependency exists and that there are no cycles.
"""
import re

from .task import PipelineError, Task

SETTINGS = ("duration", "after", "resource")
WHOLE_NUMBER = re.compile(r"[0-9]+")


class PipelineSyntaxError(PipelineError):
    """A line of a pipeline file could not be understood."""

    def __init__(self, lineno, message):
        super().__init__(f"line {lineno}: {message}")
        self.lineno = lineno


def parse_pipeline(text):
    """Parse pipeline text into a list of Task objects, in file order."""
    reader = _Reader()
    for lineno, raw in enumerate(text.splitlines(), start=1):
        reader.feed(lineno, raw)
    return reader.finish()


def split_names(value, lineno):
    """'a, b' or '[a, b]' -> ['a', 'b']."""
    if value.startswith("[") and value.endswith("]"):
        value = value[1:-1]
    names = [part.strip() for part in value.split(",")]
    if not all(names):
        raise PipelineSyntaxError(lineno, f"empty name in list {value!r}")
    return names


class _Reader:
    """Line-by-line state machine behind parse_pipeline."""

    def __init__(self):
        self.tasks = []
        self.fields = None     # settings of the task being read
        self.list_key = None   # setting whose "- item" lines are being collected
        self.items = []

    def feed(self, lineno, raw):
        line = raw.split("#", 1)[0].rstrip()
        text = line.strip()
        if not text:
            return
        if not line[0].isspace():                      # task header: "compile:"
            self._close_list()
            self._close_task()
            name, sep, rest = text.partition(":")
            if not sep or rest.strip():
                raise PipelineSyntaxError(lineno, f"expected a task header like 'compile:', got {text!r}")
            self.fields = {"name": name.strip(), "lineno": lineno}
        elif self.fields is None:
            raise PipelineSyntaxError(lineno, "indented line before the first task")
        elif text.startswith("-"):                     # block list item: "- package"
            if self.list_key is None:
                raise PipelineSyntaxError(lineno, "list item outside a list setting")
            self.items.append(text[1:].strip())
        else:                                          # setting: "duration: 4"
            self._close_list()
            key, sep, value = (part.strip() for part in text.partition(":"))
            if not sep or key not in SETTINGS:
                raise PipelineSyntaxError(lineno, f"unknown setting {key!r}")
            if key in self.fields:
                raise PipelineSyntaxError(lineno, f"{key!r} is set twice")
            if key == "after" and not value:
                self.list_key, self.items = key, []
            elif key == "after":
                self.fields[key] = split_names(value, lineno)
            elif value:
                self.fields[key] = value
            else:
                raise PipelineSyntaxError(lineno, f"{key!r} needs a value")

    def finish(self):
        self._close_task()
        return self.tasks

    def _close_list(self):
        """Store the collected block-list items on the current task."""
        if self.list_key is not None:
            self.fields[self.list_key] = self.items
            self.list_key, self.items = None, []

    def _close_task(self):
        if self.fields is None:
            return
        fields, self.fields = self.fields, None
        lineno, name = fields["lineno"], fields["name"]
        duration = fields.get("duration")
        if duration is None:
            raise PipelineSyntaxError(lineno, f"task {name!r} has no duration")
        if not WHOLE_NUMBER.fullmatch(duration):
            raise PipelineSyntaxError(lineno, f"task {name!r}: duration must be whole minutes, got {duration!r}")
        try:
            task = Task(name, int(duration), tuple(fields.get("after", ())), fields.get("resource"))
        except PipelineError as exc:
            raise PipelineSyntaxError(lineno, str(exc)) from None
        self.tasks.append(task)
