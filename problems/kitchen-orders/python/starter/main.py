"""Replays Saturday's lunch log through the kitchen model."""
from pathlib import Path

from kitchen import HOUSE_LINE, HOUSE_MENU, parse_log, simulate
from kitchen.report import rail, service_report

LOG = Path(__file__).parent / "data" / "saturday_lunch.txt"


def main():
    orders = parse_log(LOG.read_text())
    print("Ticket rail with host-stand quotes")
    print("\n".join(rail(orders, HOUSE_MENU)))
    print()
    try:
        run = simulate(orders, HOUSE_MENU, HOUSE_LINE)
    except NotImplementedError as exc:
        print(f"Service simulation unavailable: {exc}")
        return
    print(service_report("Saturday lunch", orders, HOUSE_MENU, HOUSE_LINE, run))


if __name__ == "__main__":
    main()
