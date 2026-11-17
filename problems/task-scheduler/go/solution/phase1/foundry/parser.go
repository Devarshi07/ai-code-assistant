// Parser for pipeline files.
//
// Pipeline files use a small YAML-like format. Each task is a top-level key
// followed by indented settings:
//
//	# comments run to the end of the line
//	compile:
//	  duration: 4            # minutes on one runner
//	  resource: linux        # optional runner label
//
//	package:
//	  duration: 2
//	  after: compile, lint   # inline list; [compile, lint] also works
//
//	deploy:
//	  duration: 3
//	  after:                 # block list, one dependency per line
//	    - package
//	    - smoke-tests
//
// ParsePipeline only checks syntax. LoadPipeline (graph.go) also checks that
// every dependency exists and that there are no cycles.
package foundry

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

var wholeNumber = regexp.MustCompile(`^[0-9]+$`)

func isSetting(key string) bool {
	return key == "duration" || key == "after" || key == "resource"
}

// SyntaxError means a line of a pipeline file could not be understood.
type SyntaxError struct {
	Lineno  int
	Message string
}

func (e *SyntaxError) Error() string { return fmt.Sprintf("line %d: %s", e.Lineno, e.Message) }

// Unwrap lets errors.As find the PipelineError a syntax error is a kind of.
func (e *SyntaxError) Unwrap() error { return &PipelineError{Message: e.Error()} }

func syntaxErrorf(lineno int, format string, args ...any) *SyntaxError {
	return &SyntaxError{Lineno: lineno, Message: fmt.Sprintf(format, args...)}
}

// ParsePipeline parses pipeline text into a slice of tasks, in file order.
func ParsePipeline(text string) ([]*Task, error) {
	reader := &reader{}
	for i, raw := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		if err := reader.feed(i+1, raw); err != nil {
			return nil, err
		}
	}
	return reader.finish()
}

// splitNames turns "a, b" or "[a, b]" into ["a", "b"].
func splitNames(value string, lineno int) ([]string, error) {
	if strings.HasPrefix(value, "[") && strings.HasSuffix(value, "]") {
		value = value[1 : len(value)-1]
	}
	parts := strings.Split(value, ",")
	names := make([]string, len(parts))
	for i, part := range parts {
		names[i] = strings.TrimSpace(part)
		if names[i] == "" {
			return nil, syntaxErrorf(lineno, "empty name in list '%s'", value)
		}
	}
	return names, nil
}

// fields are the settings collected for the task being read.
type fields struct {
	name        string
	lineno      int
	seen        map[string]bool
	duration    string
	after       []string
	resource    string
	hasDuration bool
}

// reader is the line-by-line state machine behind ParsePipeline.
type reader struct {
	tasks  []*Task
	fields *fields  // settings of the task being read
	inList bool     // whether "- item" lines are being collected for `after`
	items  []string // the collected items
}

func (r *reader) feed(lineno int, raw string) error {
	line, _, _ := strings.Cut(raw, "#")
	line = strings.TrimRightFunc(line, unicode.IsSpace)
	text := strings.TrimSpace(line)
	if text == "" {
		return nil
	}
	indented := unicode.IsSpace([]rune(line)[0])
	switch {
	case !indented: // task header: "compile:"
		r.closeList()
		if err := r.closeTask(); err != nil {
			return err
		}
		colon := strings.Index(text, ":")
		if colon < 0 || strings.TrimSpace(text[colon+1:]) != "" {
			return syntaxErrorf(lineno, "expected a task header like 'compile:', got '%s'", text)
		}
		r.fields = &fields{name: strings.TrimSpace(text[:colon]), lineno: lineno, seen: map[string]bool{}}
	case r.fields == nil:
		return syntaxErrorf(lineno, "indented line before the first task")
	case strings.HasPrefix(text, "-"): // block list item: "- package"
		if !r.inList {
			return syntaxErrorf(lineno, "list item outside a list setting")
		}
		r.items = append(r.items, strings.TrimSpace(text[1:]))
	default: // setting: "duration: 4"
		r.closeList()
		colon := strings.Index(text, ":")
		key, value := text, ""
		if colon >= 0 {
			key, value = strings.TrimSpace(text[:colon]), strings.TrimSpace(text[colon+1:])
		}
		if colon < 0 || !isSetting(key) {
			return syntaxErrorf(lineno, "unknown setting '%s'", key)
		}
		if r.fields.seen[key] {
			return syntaxErrorf(lineno, "'%s' is set twice", key)
		}
		r.fields.seen[key] = true
		switch {
		case key == "after" && value == "":
			r.inList = true
			r.items = nil
		case key == "after":
			names, err := splitNames(value, lineno)
			if err != nil {
				return err
			}
			r.fields.after = names
		case value == "":
			return syntaxErrorf(lineno, "'%s' needs a value", key)
		case key == "duration":
			r.fields.duration, r.fields.hasDuration = value, true
		default:
			r.fields.resource = value
		}
	}
	return nil
}

func (r *reader) finish() ([]*Task, error) {
	r.closeList()
	if err := r.closeTask(); err != nil {
		return nil, err
	}
	return r.tasks, nil
}

// closeList stores the collected block-list items on the current task.
func (r *reader) closeList() {
	if r.inList {
		r.fields.after = r.items
		r.inList = false
		r.items = nil
	}
}

func (r *reader) closeTask() error {
	if r.fields == nil {
		return nil
	}
	f := r.fields
	r.fields = nil
	if !f.hasDuration {
		return syntaxErrorf(f.lineno, "task '%s' has no duration", f.name)
	}
	if !wholeNumber.MatchString(f.duration) {
		return syntaxErrorf(f.lineno, "task '%s': duration must be whole minutes, got '%s'", f.name, f.duration)
	}
	minutes, err := strconv.Atoi(f.duration)
	if err != nil {
		return syntaxErrorf(f.lineno, "task '%s': duration must be whole minutes, got '%s'", f.name, f.duration)
	}
	task, err := NewTask(f.name, minutes, f.after, f.resource)
	if err != nil {
		return syntaxErrorf(f.lineno, "%s", err.Error())
	}
	r.tasks = append(r.tasks, task)
	return nil
}
