import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import shipping.Carton;
import shipping.CartonType;
import shipping.Manifest;
import shipping.Order;
import shipping.OrderExport;
import shipping.Packer;
import shipping.Units;

/** Plans cartons for the sample export and prints the bench manifests. */
public class Main {
    private static final Path SAMPLE = Path.of("data", "orders.csv");

    public static void main(String[] args) throws IOException {
        for (Order order : OrderExport.read(SAMPLE)) {
            // Orders that fit one carton get the smallest box that holds them;
            // everything else is split across Large boxes.
            CartonType kind = CartonType.smallestFor(order.totalWeightG(), order.hasFragile()).orElse(CartonType.LARGE);
            System.out.println(order.orderId() + ": " + order.unitCount() + " units, "
                    + Units.formatGrams(order.totalWeightG()) + " -> " + kind.displayName());
            try {
                List<Carton> cartons = Packer.packOrder(order, kind);
                System.out.println(Manifest.format(order.orderId(), cartons));
                System.out.println("  labels: " + String.join("; ", Manifest.carrierLabels(order.orderId(), cartons)));
            } catch (UnsupportedOperationException e) {
                System.out.println("  packing: " + e.getMessage());
            }
            System.out.println();
        }
    }
}
