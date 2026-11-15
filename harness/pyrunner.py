"""Runs practice tests or an entry point and reports structured results.

Usage (from the project root):
    python pyrunner.py tests tests/test_phase1.py [tests/test_phase2.py ...]
    python pyrunner.py main main.py

Program output passes through unchanged. Each test result is written as a
single line prefixed with MARK so the server can separate results from output.
"""
import importlib.util
import json
import os
import runpy
import signal
import sys
import time
import traceback
import unittest

MARK = "@@DGRESULT@@"
TEST_TIMEOUT = float(os.environ.get("DG_TEST_TIMEOUT", "12"))


class Tracker:
    """Wraps stdout to know whether the last write ended a line."""

    def __init__(self, stream):
        self.stream = stream
        self.last = "\n"

    def write(self, text):
        if text:
            self.last = text[-1]
        return self.stream.write(text)

    def flush(self):
        self.stream.flush()

    def __getattr__(self, name):
        return getattr(self.stream, name)


stdout = Tracker(sys.stdout)
sys.stdout = stdout


def emit(record):
    sys.stderr.flush()
    if stdout.last != "\n":
        stdout.stream.write("\n")
    stdout.stream.write(MARK + json.dumps(record) + "\n")
    stdout.stream.flush()
    stdout.last = "\n"


class TestTimeout(Exception):
    pass


def _alarm(signum, frame):
    raise TestTimeout(f"Test exceeded the {TEST_TIMEOUT:g}s limit")


HAS_ALARM = hasattr(signal, "setitimer") and hasattr(signal, "SIGALRM")
if HAS_ALARM:
    signal.signal(signal.SIGALRM, _alarm)

HARNESS_FILE = os.path.abspath(__file__)
FAILED_TEST = getattr(unittest.loader, "_FailedTest", None)


def project_frames(exc_type, exc, tb):
    frames = [f for f in traceback.extract_tb(tb)
              if os.path.abspath(f.filename) != HARNESS_FILE
              and "unittest" + os.sep not in f.filename
              and os.sep + "unittest" + os.sep not in f.filename
              and not f.filename.startswith("<frozen")]
    lines = []
    for frame in frames[-8:]:
        name = os.path.relpath(frame.filename) if os.path.isabs(frame.filename) else frame.filename
        name = name.replace("\\", "/")
        lines.append(f'File "{name}", line {frame.lineno}, in {frame.name}')
        if frame.line:
            lines.append("    " + frame.line.strip())
    return "\n".join(lines)


def describe(exc_info):
    exc_type, exc, tb = exc_info
    if exc_type is AssertionError or isinstance(exc, AssertionError):
        message = str(exc) or "AssertionError"
    else:
        message = "".join(traceback.format_exception_only(exc_type, exc)).strip()
    return message, project_frames(exc_type, exc, tb)


class Result(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.outcome = None

    def addSuccess(self, test):
        self.outcome = ("pass", None, None)

    def addFailure(self, test, err):
        message, stack = describe(err)
        self.outcome = ("fail", message, stack)

    def addError(self, test, err):
        if isinstance(err[1], TestTimeout):
            self.outcome = ("error", str(err[1]), project_frames(*err))
        else:
            message, stack = describe(err)
            self.outcome = ("error", message, stack)

    def addSkip(self, test, reason):
        self.outcome = ("skip", reason, None)

    def addExpectedFailure(self, test, err):
        self.outcome = ("pass", None, None)

    def addUnexpectedSuccess(self, test):
        self.outcome = ("fail", "Unexpected success", None)

    def addSubTest(self, test, subtest, err):
        if err is not None and (self.outcome is None or self.outcome[0] == "pass"):
            message, stack = describe(err)
            label = subtest._subDescription()
            status = "fail" if issubclass(err[0], AssertionError) else "error"
            self.outcome = (status, f"{label}: {message}", stack)


def iterate(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from iterate(item)
        else:
            yield item


def test_name(test):
    method = getattr(test, "_testMethodName", str(test))
    doc = test.shortDescription() if hasattr(test, "shortDescription") else None
    label = method.replace("test_", "", 1).replace("_", " ") if method.startswith("test_") else method
    return f"{type(test).__name__} › {doc or label}"


def load_module(path):
    name = os.path.splitext(path.replace("\\", "/"))[0].replace("/", ".")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def run_fixture(fn):
    """Runs a class or module fixture; returns (message, stack) if it fails."""
    if HAS_ALARM:
        signal.setitimer(signal.ITIMER_REAL, TEST_TIMEOUT)
    try:
        fn()
        return None
    except Exception:
        return describe(sys.exc_info())
    finally:
        if HAS_ALARM:
            signal.setitimer(signal.ITIMER_REAL, 0)


def run_tests(paths):
    passed = failed = 0
    started = time.perf_counter()
    for path in paths:
        try:
            module = load_module(path)
            suite = unittest.defaultTestLoader.loadTestsFromModule(module)
        except Exception:
            message, stack = describe(sys.exc_info())
            emit({"type": "test", "file": path, "name": "Could not load test file", "status": "error", "ms": 0, "message": message, "stack": stack})
            failed += 1
            continue
        module_error = run_fixture(module.setUpModule) if hasattr(module, "setUpModule") else None
        current, class_error = None, None

        def close_class():
            if current is not None and class_error is None:
                run_fixture(current.tearDownClass)
                if hasattr(current, "doClassCleanups"):
                    run_fixture(current.doClassCleanups)

        for test in iterate(suite):
            if FAILED_TEST and isinstance(test, FAILED_TEST):
                result = Result()
                test.run(result)
                status, message, stack = result.outcome or ("error", "Could not load test", None)
                emit({"type": "test", "file": path, "name": "Could not load test file", "status": "error", "ms": 0, "message": message, "stack": stack})
                failed += 1
                continue
            # Running tests one at a time bypasses unittest's class fixtures, so run them here.
            if type(test) is not current:
                close_class()
                current = type(test)
                class_error = module_error or (run_fixture(current.setUpClass) if hasattr(current, "setUpClass") else None)
            if class_error:
                message, stack = class_error
                emit({"type": "test", "file": path, "name": test_name(test), "status": "error", "ms": 0, "message": "setUpClass failed: " + message, "stack": stack})
                failed += 1
                continue
            result = Result()
            begin = time.perf_counter()
            if HAS_ALARM:
                signal.setitimer(signal.ITIMER_REAL, TEST_TIMEOUT)
            try:
                test.run(result)
            except TestTimeout as exc:
                result.outcome = ("error", str(exc), None)
            finally:
                if HAS_ALARM:
                    signal.setitimer(signal.ITIMER_REAL, 0)
            ms = round((time.perf_counter() - begin) * 1000)
            status, message, stack = result.outcome or ("error", "Test did not report a result", None)
            if status == "pass":
                passed += 1
            elif status != "skip":
                failed += 1
            record = {"type": "test", "file": path, "name": test_name(test), "status": status, "ms": ms}
            if message:
                record["message"] = message
            if stack:
                record["stack"] = stack
            emit(record)
        close_class()
        if hasattr(module, "tearDownModule") and module_error is None:
            run_fixture(module.tearDownModule)
    emit({"type": "done", "mode": "tests", "passed": passed, "failed": failed, "ms": round((time.perf_counter() - started) * 1000)})


def run_main(path):
    started = time.perf_counter()
    code = 0
    sys.argv = [path]
    try:
        runpy.run_path(path, run_name="__main__")
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else (0 if exc.code is None else 1)
    except BaseException:
        code = 1
        message, stack = describe(sys.exc_info())
        sys.stdout.flush()
        sys.stderr.write("Traceback (most recent call last):\n" + stack + "\n" + message + "\n")
    emit({"type": "done", "mode": "main", "exitCode": code, "ms": round((time.perf_counter() - started) * 1000)})


def main():
    sys.path.insert(0, os.getcwd())
    sys.dont_write_bytecode = True
    if len(sys.argv) < 3 or sys.argv[1] not in ("tests", "main"):
        print(__doc__)
        sys.exit(2)
    if sys.argv[1] == "tests":
        run_tests(sys.argv[2:])
    else:
        run_main(sys.argv[2])


if __name__ == "__main__":
    main()
