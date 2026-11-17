package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import kitchen.Clock;
import kitchen.ClockException;
import kitchen.KitchenRun;
import kitchen.Menu;
import kitchen.Order;
import kitchen.Report;
import kitchen.TicketException;
import kitchen.Tickets;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase1Test {
    static final Path LUNCH_LOG = Path.of("data", "saturday_lunch.txt");

    static final String RUSH = """

            # printed in the order the tickets came in
            11:50am order 1: burger
            12:05pm order 2: fries
            12:40pm order 3: house salad
            1:10pm order 4: margherita
            """;

    @Nested
    class ClockTests {
        @Test
        void morningStamps() {
            assertEquals(420, Clock.parseClock("7:00am"));
            assertEquals(545, Clock.parseClock("9:05am"));
            assertEquals(719, Clock.parseClock("11:59am"));
        }

        @Test
        void afternoonAndEveningStamps() {
            assertEquals(795, Clock.parseClock("1:15pm"));
            assertEquals(1110, Clock.parseClock("6:30PM"));
            assertEquals(1425, Clock.parseClock("11:45pm"));
        }

        @Test
        void noonHourIsMidday() {
            assertEquals(720, Clock.parseClock("12:00pm"));
            assertEquals(761, Clock.parseClock("12:41pm"));
        }

        @Test
        void everyMinuteOfTheDayRoundTrips() {
            for (int minute = 0; minute < 24 * 60; minute++) {
                String stamp = Clock.formatClock(minute);
                assertEquals(minute, Clock.parseClock(stamp), stamp + " should parse back to minute " + minute);
            }
        }

        @Test
        void malformedStampsAreRejected() {
            for (String stamp : List.of("13:05pm", "9:5am", "12:60pm", "0:30am", "noon", "1205")) {
                assertThrows(ClockException.class, () -> Clock.parseClock(stamp), stamp);
            }
        }
    }

    @Nested
    class TicketTests {
        @Test
        void ticketWithPortionsAndFlags() {
            Order order = Tickets.parseTicket("11:31am order 15: Caesar Salad, 2x fries | app | due 11:55am");
            assertEquals(15, order.id());
            assertEquals(691, order.arrival());
            assertEquals(List.of("caesar salad", "fries", "fries"), order.dishes());
            assertEquals(true, order.priority());
            assertEquals(715, order.due());
        }

        @Test
        void railIsInArrivalOrder() {
            List<Order> orders = Tickets.parseLog(RUSH);
            assertEquals(List.of(1, 2, 3, 4), orders.stream().map(Order::id).toList());
            assertEquals(List.of(710, 725, 760, 790), orders.stream().map(Order::arrival).toList());
        }

        @Test
        void sameMinuteTicketsKeepPrinterOrder() {
            List<Order> orders = Tickets.parseLog("10:15am order 9: fries\n10:15am order 3: burger\n10:05am order 5: wings\n");
            assertEquals(List.of(5, 9, 3), orders.stream().map(Order::id).toList());
        }

        @Test
        void badLinesReportTheirLineNumber() {
            TicketException error = assertThrows(TicketException.class,
                    () -> Tickets.parseLog("10:15am order 1: fries\n10:16am order 2: burger | rush\n"));
            assertEquals(2, error.lineNumber());
            assertThrows(TicketException.class, () -> Tickets.parseLog("10:15am order 1: fries\n10:20am order 1: burger\n"));
        }
    }

    @Nested
    class QuoteTests {
        @Test
        void quoteIsArrivalPlusSlowestDish() {
            Order order = new Order(7, 600, List.of("fries", "steak frites", "house salad"));
            assertEquals(614, order.quote(Menu.HOUSE_MENU));
        }

        @Test
        void lunchQuotesStayOnTheSameDay() throws IOException {
            List<Order> orders = Tickets.parseLog(Files.readString(LUNCH_LOG));
            assertEquals(18, orders.size());
            for (Order order : orders) {
                int wait = order.quote(Menu.HOUSE_MENU) - order.arrival();
                assertTrue(order.arrival() >= 660 && order.arrival() <= 840,
                        "order " + order.id() + " was rung in at " + Clock.formatClock(order.arrival()) + ", not during lunch");
                assertTrue(wait <= 14, "order " + order.id() + " quotes a " + wait + "-minute wait");
                if (order.due() != null) {
                    assertTrue(order.due() - order.arrival() < 60, "order " + order.id() + " has an odd due time");
                }
            }
        }
    }

    @Nested
    class ReportTests {
        @Test
        void reportShowsLatenessAndStationLoad() {
            List<Order> orders = List.of(
                    new Order(1, 600, List.of("burger", "fries")),
                    new Order(2, 602, List.of("house salad"), true, 610),
                    new Order(3, 603, List.of("burger"), false, 612));
            KitchenRun run = new KitchenRun(Map.of(1, 607, 2, 605, 3, 616), List.of(new KitchenRun.Late(3, 4)));
            String text = Report.serviceReport("Test", orders, Menu.HOUSE_MENU, Menu.HOUSE_LINE, run);
            assertTrue(text.contains("3 orders, 4 dishes"), text);
            assertTrue(text.contains("LATE 4m"), text);
            assertTrue(text.contains("on time, app"), text);
            assertTrue(text.contains("1 of 2 promised orders late"), text);
            assertTrue(java.util.regex.Pattern.compile("grill\\s+2\\s+2\\s+14m\\s+44%").matcher(text).find(), text);
        }
    }
}
