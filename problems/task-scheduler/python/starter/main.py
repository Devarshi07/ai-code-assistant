"""Prints the critical path and runner plans for the sample pipelines."""
from foundry import load_pipeline, render_gantt, schedule, serial_schedule
from foundry.samples import SAMPLES

RUNNERS = 3


def main():
    for name, text in SAMPLES.items():
        graph = load_pipeline(text)
        minutes, path = graph.critical_path()
        print(f"== {name}: {len(graph)} tasks ==")
        print(f"critical path: {' -> '.join(path)} ({minutes} min)")
        print("\nserial plan (one runner, today's behaviour):")
        print(render_gantt(serial_schedule(graph), graph))
        print(f"\nparallel plan ({RUNNERS} runners):")
        try:
            print(render_gantt(schedule(graph, RUNNERS), graph))
        except NotImplementedError as exc:
            print(f"  {exc}")
        print()


if __name__ == "__main__":
    main()
