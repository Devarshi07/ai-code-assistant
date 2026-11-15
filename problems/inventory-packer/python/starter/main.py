"""Plans cartons for the sample export and prints the bench manifests."""
import os

from shipping import (CARTON_TYPES, carrier_labels, format_grams, format_manifest,
                      pack_order, read_orders, smallest_carton_for)

SAMPLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "orders.csv")


def main():
    for order in read_orders(SAMPLE):
        # Orders that fit one carton get the smallest box that holds them;
        # everything else is split across Large boxes.
        kind = smallest_carton_for(order.total_weight_g, order.has_fragile) or CARTON_TYPES["L"]
        print(f"{order.order_id}: {order.unit_count} units, {format_grams(order.total_weight_g)}"
              f" -> {kind.name}")
        try:
            cartons = pack_order(order, kind)
        except NotImplementedError as exc:
            print(f"  packing: {exc}")
        else:
            print(format_manifest(order.order_id, cartons))
            print("  labels: " + "; ".join(carrier_labels(order.order_id, cartons)))
        print()


if __name__ == "__main__":
    main()
