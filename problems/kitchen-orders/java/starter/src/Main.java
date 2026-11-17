import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import kitchen.KitchenRun;
import kitchen.Menu;
import kitchen.Order;
import kitchen.Report;
import kitchen.Simulator;
import kitchen.Tickets;

/** Replays Saturday's lunch log through the kitchen model. */
public class Main {
    private static final Path LOG = Path.of("data", "saturday_lunch.txt");

    public static void main(String[] args) throws IOException {
        List<Order> orders = Tickets.parseLog(Files.readString(LOG));
        System.out.println("Ticket rail with host-stand quotes");
        System.out.println(String.join("\n", Report.rail(orders, Menu.HOUSE_MENU)));
        System.out.println();
        KitchenRun run;
        try {
            run = Simulator.simulate(orders, Menu.HOUSE_MENU, Menu.HOUSE_LINE);
        } catch (UnsupportedOperationException error) {
            System.out.println("Service simulation unavailable: " + error.getMessage());
            return;
        }
        System.out.println(Report.serviceReport("Saturday lunch", orders, Menu.HOUSE_MENU, Menu.HOUSE_LINE, run));
    }
}
