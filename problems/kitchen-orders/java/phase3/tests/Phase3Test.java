package tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import kitchen.KitchenRun;
import kitchen.Order;
import kitchen.Simulator;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class Phase3Test {
    @Nested
    class ScaleTests {
        @Test
        void stadiumAfternoonMatchesReference() {
            List<Order> orders = Generator.generate(11, 4000, 16 * 60, 720);
            KitchenRun run = Simulator.simulate(orders, Generator.STADIUM_MENU, Generator.stadiumLine(8, 10, 3, 2));
            assertEquals(List.of(1309, 2342, 2288, 1261),
                    List.of(1000, 1001, 1002, 4999).stream().map(run.ready()::get).toList());
            assertEquals(List.of(4000L, 7669837L, 23035378252L, 2918L, 1099L, 792208L), Generator.fingerprint(run));
        }

        @Test
        void burstOfSimultaneousOrders() {
            // 60 one-burger orders land in the same minute; every 7th is an app order.
            // Four grill cooks plate them four at a time, strictly in rank order.
            List<Integer> ids = new ArrayList<>();
            for (int id = 60; id >= 1; id--) ids.add(id);
            List<Order> orders = new ArrayList<>();
            for (int id : ids) orders.add(new Order(id, 1200, List.of("smash burger"), id % 7 == 0, null));
            KitchenRun run = Simulator.simulate(orders, Generator.STADIUM_MENU, Generator.stadiumLine(4, 1, 1, 1));
            List<Integer> ranked = new ArrayList<>(ids);
            ranked.sort((a, b) -> {
                int byApp = Integer.compare(a % 7 == 0 ? 0 : 1, b % 7 == 0 ? 0 : 1);
                return byApp != 0 ? byApp : Integer.compare(a, b);
            });
            Map<Integer, Integer> expected = new HashMap<>();
            for (int k = 0; k < ranked.size(); k++) expected.put(ranked.get(k), 1200 + 6 * (k / 4 + 1));
            assertEquals(expected, run.ready());
        }

        @Test
        void quietServiceMatchesTheQuote() {
            // Orders 30 minutes apart never queue, so each is ready at its quote.
            List<Order> generated = Generator.generate(5, 500, 0, 1);
            List<Order> orders = new ArrayList<>();
            for (int k = 0; k < generated.size(); k++) {
                Order o = generated.get(k);
                orders.add(new Order(o.id(), 600 + 30 * k, o.dishes(), o.priority(), 600 + 30 * k + 5));
            }
            KitchenRun run = Simulator.simulate(orders, Generator.STADIUM_MENU, Generator.stadiumLine(4, 4, 4, 4));
            Map<Integer, Integer> expected = new HashMap<>();
            List<KitchenRun.Late> expectedLate = new ArrayList<>();
            for (Order o : orders) {
                int quote = o.quote(Generator.STADIUM_MENU);
                expected.put(o.id(), quote);
                if (quote > o.due()) expectedLate.add(new KitchenRun.Late(o.id(), quote - o.due()));
            }
            assertEquals(expected, run.ready());
            assertEquals(expectedLate, run.late());
        }

        @Test
        void gameDayRushIsFast() {
            List<Order> orders = Generator.generate(7, 72000, 16 * 60, 3 * 24 * 60);
            var line = Generator.stadiumLine(42, 50, 14, 11);
            // Warm up on a smaller service, so JIT compilation isn't timed.
            List<Order> warmUp = Generator.generate(3, 8000, 16 * 60, 3 * 24 * 60);
            for (int i = 0; i < 3; i++) Simulator.simulate(warmUp, Generator.STADIUM_MENU, Generator.stadiumLine(5, 6, 2, 2));
            long start = System.nanoTime();
            KitchenRun run = Simulator.simulate(orders, Generator.STADIUM_MENU, line);
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            assertEquals(List.of(72000L, 303724922L, 11226866561866L, 7536L, 19922L, 26675248L), Generator.fingerprint(run));
            assertTrue(elapsed < 900, "took " + elapsed + "ms; a 72,000-order game day must simulate in under 900ms");
        }
    }
}
