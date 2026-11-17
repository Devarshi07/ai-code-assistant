package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kitchen.KitchenRun;
import kitchen.Menu;
import kitchen.MenuException;
import kitchen.MenuItem;
import kitchen.Order;
import kitchen.Simulator;
import kitchen.Station;
import kitchen.Tickets;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase2Test {
    static final Path LUNCH_LOG = Path.of("data", "saturday_lunch.txt");

    static final Menu MENU = new Menu(List.of(
            new MenuItem("burger", "grill", 6),
            new MenuItem("steak", "grill", 10),
            new MenuItem("fries", "fryer", 4),
            new MenuItem("rings", "fryer", 5),
            new MenuItem("salad", "salad", 3)));
    static final List<Station> ONE_EACH = List.of(new Station("grill", 1), new Station("fryer", 1), new Station("salad", 1));
    static final int NOON = 12 * 60;

    static Order order(int id, int arrival, String... dishes) {
        return new Order(id, arrival, List.of(dishes));
    }

    static Order app(int id, int arrival, String... dishes) {
        return new Order(id, arrival, List.of(dishes), true, null);
    }

    static Order promised(int id, int arrival, int due, String... dishes) {
        return new Order(id, arrival, List.of(dishes), false, due);
    }

    /** Expected ready minutes from alternating id, minute arguments. */
    static Map<Integer, Integer> ready(int... idsAndMinutes) {
        Map<Integer, Integer> expected = new HashMap<>();
        for (int i = 0; i < idsAndMinutes.length; i += 2) expected.put(idsAndMinutes[i], idsAndMinutes[i + 1]);
        return expected;
    }

    @Nested
    class SimulationTests {
        @Test
        void singleOrderIsReadyWhenItsLastDishFinishes() {
            KitchenRun run = Simulator.simulate(List.of(order(1, NOON, "burger", "fries", "salad")), MENU, ONE_EACH);
            assertEquals(ready(1, NOON + 6), run.ready());
            assertEquals(List.of(), run.late());
        }

        @Test
        void oneCookWorksThroughTheQueueInArrivalOrder() {
            List<Order> orders = List.of(order(1, NOON, "steak"), order(2, NOON + 1, "burger"), order(3, NOON + 2, "burger"));
            assertEquals(ready(1, NOON + 10, 2, NOON + 16, 3, NOON + 22), Simulator.simulate(orders, MENU, ONE_EACH).ready());
        }

        @Test
        void appOrdersJumpTheQueue() {
            List<Order> orders = List.of(order(1, NOON, "steak"), order(2, NOON + 1, "burger"), app(3, NOON + 5, "burger"));
            assertEquals(ready(1, NOON + 10, 2, NOON + 22, 3, NOON + 16), Simulator.simulate(orders, MENU, ONE_EACH).ready());
        }

        @Test
        void sameMinuteTiesGoToTheLowerOrderId() {
            List<Order> orders = List.of(order(7, NOON, "burger"), order(4, NOON, "steak"));
            assertEquals(ready(4, NOON + 10, 7, NOON + 16), Simulator.simulate(orders, MENU, ONE_EACH).ready());
        }

        @Test
        void dishesOnOneTicketCookInTicketOrder() {
            List<Order> orders = List.of(order(7, NOON, "steak", "burger"), app(8, NOON + 5, "burger"));
            assertEquals(ready(7, NOON + 22, 8, NOON + 16), Simulator.simulate(orders, MENU, ONE_EACH).ready());
        }

        @Test
        void cookWhoFinishesCanTakeADishArrivingThatMinute() {
            List<Order> orders = List.of(order(1, NOON, "steak"), order(2, NOON + 2, "burger"), app(3, NOON + 10, "burger"));
            assertEquals(ready(1, NOON + 10, 2, NOON + 22, 3, NOON + 16), Simulator.simulate(orders, MENU, ONE_EACH).ready());
        }

        @Test
        void cooksOnAStationWorkSideBySide() {
            List<Station> line = List.of(new Station("grill", 2), new Station("fryer", 1), new Station("salad", 1));
            List<Order> orders = List.of(order(1, NOON, "steak", "burger", "burger"), order(2, NOON + 1, "burger"));
            assertEquals(ready(1, NOON + 12, 2, NOON + 16), Simulator.simulate(orders, MENU, line).ready());
        }

        @Test
        void kitchenIdlesUntilTheNextOrder() {
            List<Order> orders = List.of(order(3, 23 * 60 + 55, "steak"), order(1, NOON, "burger"), order(2, NOON + 30, "burger", "salad"));
            assertEquals(ready(1, NOON + 6, 2, NOON + 36, 3, 24 * 60 + 5), Simulator.simulate(orders, MENU, ONE_EACH).ready());
        }

        @Test
        void lateOrdersReportMinutesLate() {
            List<Order> orders = List.of(
                    promised(1, NOON, NOON + 10, "steak"),
                    promised(3, NOON + 1, NOON + 3, "fries"),
                    promised(2, NOON, NOON + 12, "burger"),
                    order(4, NOON + 2, "burger"));
            KitchenRun run = Simulator.simulate(orders, MENU, ONE_EACH);
            assertEquals(ready(1, NOON + 10, 2, NOON + 16, 3, NOON + 5, 4, NOON + 22), run.ready());
            assertEquals(List.of(new KitchenRun.Late(2, 4), new KitchenRun.Late(3, 2)), run.late(),
                    "finishing exactly on the due minute is on time");
        }

        @Test
        void unknownDishIsRejected() {
            assertThrows(MenuException.class, () -> Simulator.simulate(List.of(order(1, NOON, "lobster")), MENU, ONE_EACH));
        }
    }

    @Nested
    class ServiceTests {
        @Test
        void saturdayLunch() throws IOException {
            List<Order> orders = Tickets.parseLog(Files.readString(LUNCH_LOG));
            KitchenRun run = Simulator.simulate(orders, Menu.HOUSE_MENU, Menu.HOUSE_LINE);
            assertEquals(ready(
                    101, 707, 102, 709, 103, 715, 104, 721, 105, 749, 106, 728, 107, 736, 108, 753, 109, 736,
                    110, 732, 111, 762, 112, 745, 113, 745, 114, 767, 115, 778, 116, 790, 117, 798, 118, 811), run.ready());
            assertEquals(List.of(new KitchenRun.Late(108, 13), new KitchenRun.Late(111, 7)), run.late());
        }

        @Test
        void busyDinnerService() {
            List<Order> orders = Generator.generate(3, 300, 18 * 60, 240);
            KitchenRun run = Simulator.simulate(orders, Generator.STADIUM_MENU, Generator.stadiumLine(3, 3, 1, 1));
            assertEquals(List.of(1267, 1438, 1174, 1085),
                    List.of(1000, 1001, 1002, 1299).stream().map(run.ready()::get).toList());
            assertEquals(List.of(300L, 390664L, 448924524L, 1556L, 63L, 7199L), Generator.fingerprint(run));
        }
    }
}
