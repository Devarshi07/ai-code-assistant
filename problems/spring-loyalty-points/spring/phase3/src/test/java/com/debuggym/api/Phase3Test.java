package com.debuggym.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Phase 3: Idempotency-Key retries and redemptions that run in parallel. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class Phase3Test {
    @Autowired
    MockMvc mvc;
    @Autowired
    MutableClock clock;
    TestApi api;

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, clock);
        clock.setDate("2025-03-15");
    }

    static String key() {
        return "test-" + UUID.randomUUID();
    }

    int statementSize(String memberId) throws Exception {
        return TestApi.read(api.statement(memberId, "?size=1"), "$.totalItems");
    }

    /** Runs every task on its own thread, released together, and returns the results in order. */
    <T> List<T> parallel(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch start = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        for (Callable<T> task : tasks) futures.add(pool.submit(() -> {
            start.await();
            return task.call();
        }));
        start.countDown();
        List<T> results = new ArrayList<>();
        for (Future<T> future : futures) results.add(future.get(60, TimeUnit.SECONDS));
        pool.shutdownNow();
        return results;
    }

    @Test
    void retryWithTheSameKeyReplaysTheRedemption() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "400.00");
        String key = key();
        MockHttpServletResponse first = api.redeem(id, "free-coffee", null, key);
        assertEquals(201, first.getStatus(), first.getContentAsString());
        assertEquals("false", first.getHeader("Idempotent-Replayed"));
        MockHttpServletResponse retry = api.redeem(id, "free-coffee", null, key);
        assertEquals(201, retry.getStatus(), retry.getContentAsString());
        assertEquals("true", retry.getHeader("Idempotent-Replayed"));
        assertEquals(first.getContentAsString(), retry.getContentAsString(), "a retry gets the original response");
        assertEquals(250, api.balance(id), "the points were spent once");
        assertEquals(2, statementSize(id));
    }

    @Test
    void reusingAKeyForADifferentRequestIsUnprocessable() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "400.00");
        String key = key();
        assertEquals(201, api.redeem(id, "pastry", null, key).getStatus());
        MockHttpServletResponse other = api.redeem(id, "free-coffee", null, key);
        assertEquals(422, other.getStatus(), other.getContentAsString());
        assertEquals("idempotency_key_reuse", TestApi.read(other, "$.error.code"));
        MockHttpServletResponse otherQuantity = api.redeem(id, "pastry", 2, key);
        assertEquals(422, otherQuantity.getStatus());
        assertEquals(300, api.balance(id));
    }

    @Test
    void malformedKeysAreRejected() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "400.00");
        for (String bad : List.of("has space", "bad!key", "x".repeat(65))) {
            MockHttpServletResponse response = api.redeem(id, "pastry", null, bad);
            assertEquals(422, response.getStatus(), bad);
            assertEquals("validation_error", TestApi.read(response, "$.error.code"));
            assertTrue(((Map<?, ?>) TestApi.read(response, "$.error.fields")).containsKey("Idempotency-Key"));
        }
        assertEquals(400, api.balance(id));
    }

    @Test
    void aFailedAttemptCanBeRetriedWithItsKey() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "100.00");
        String key = key();
        assertEquals(409, api.redeem(id, "free-coffee", null, key).getStatus());
        api.earn(id, "2025-03-15", "100.00");
        MockHttpServletResponse retry = api.redeem(id, "free-coffee", null, key);
        assertEquals(201, retry.getStatus(), "only successful redemptions are remembered");
        assertEquals("false", retry.getHeader("Idempotent-Replayed"));
        assertEquals(50, api.balance(id));
    }

    @Test
    void concurrentRetriesRedeemOnce() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "1000.00");
        String key = key();
        List<Callable<MockHttpServletResponse>> tasks = new ArrayList<>();
        for (int i = 0; i < 16; i++) tasks.add(() -> api.redeem(id, "tote-bag", null, key));
        Set<String> ids = new HashSet<>();
        for (MockHttpServletResponse response : parallel(tasks)) {
            assertEquals(201, response.getStatus(), response.getContentAsString());
            ids.add(TestApi.read(response, "$.id"));
        }
        assertEquals(1, ids.size(), "every retry gets the same redemption");
        assertEquals(600, api.balance(id));
        assertEquals(2, statementSize(id));
    }

    @Test
    void parallelRedemptionsNeverSpendTheSamePointsTwice() throws Exception {
        for (int round = 0; round < 12; round++) {
            String id = api.newMember("BRONZE");
            for (int i = 0; i < 50; i++) api.earn(id, "2025-03-15", "20.00");   // fifty lots of 20 points
            List<Callable<MockHttpServletResponse>> tasks = new ArrayList<>();
            for (int i = 0; i < 40; i++) tasks.add(() -> api.redeem(id, "pastry", null, null));

            int succeeded = 0;
            Map<String, Integer> spentPerLot = new HashMap<>();
            for (MockHttpServletResponse response : parallel(tasks)) {
                if (response.getStatus() == 201) {
                    succeeded++;
                    List<String> lotIds = TestApi.read(response, "$.lots[*].lotId");
                    List<Integer> points = TestApi.read(response, "$.lots[*].points");
                    assertEquals(100, points.stream().mapToInt(Integer::intValue).sum(), "the lots must add up to the cost");
                    for (int i = 0; i < lotIds.size(); i++) spentPerLot.merge(lotIds.get(i), points.get(i), Integer::sum);
                } else {
                    assertEquals(409, response.getStatus(), response.getContentAsString());
                }
            }
            assertEquals(10, succeeded, "1000 points buy exactly ten pastries");
            assertEquals(50, spentPerLot.size());
            for (Map.Entry<String, Integer> lot : spentPerLot.entrySet())
                assertEquals(20, lot.getValue(), lot.getKey() + " was spent more or less than its 20 points");
            assertEquals(0, api.balance(id));
            assertEquals(60, statementSize(id), "fifty earns and ten redemptions");
            assertEquals(0, (int) TestApi.read(api.statement(id, "?size=1"), "$.items[0].balanceAfter"));
        }
    }

    @Test
    void mixedParallelTrafficKeepsTheBooksBalanced() throws Exception {
        String id = api.newMember("BRONZE");
        for (int i = 0; i < 4; i++) api.earn(id, "2025-03-15", "500.00");
        clock.setDate("2025-04-01");
        String[] rewards = {"pastry", "free-coffee", "tote-bag"};
        int threads = 8, perThread = 40;
        List<Callable<Integer>> tasks = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            Random random = new Random(104729L * (t + 1));
            tasks.add(() -> {
                int redeemed = 0;
                for (int i = 0; i < perThread; i++) {
                    if (random.nextInt(10) < 7) {
                        MockHttpServletResponse response = api.redeem(id, rewards[random.nextInt(3)], 1 + random.nextInt(2), null);
                        assertTrue(response.getStatus() == 201 || response.getStatus() == 409, "unexpected " + response.getStatus());
                        if (response.getStatus() == 201) {
                            int spent = TestApi.read(response, "$.pointsSpent");
                            List<Integer> points = TestApi.read(response, "$.lots[*].points");
                            assertEquals(spent, points.stream().mapToInt(Integer::intValue).sum(), "lots must add up to the cost");
                            redeemed++;
                        }
                    } else {
                        String amount = BigDecimal.valueOf(500 + random.nextInt(5500), 2).toPlainString();
                        assertEquals(201, api.purchase(id, amount).getStatus());
                    }
                }
                return redeemed;
            });
        }
        int redeemed = 0;
        for (int n : parallel(tasks)) redeemed += n;

        long earned = 0, spent = 0, redeemEntries = 0;
        int balance = api.balance(id);
        for (int page = 0; ; page++) {
            MockHttpServletResponse response = api.statement(id, "?size=100&page=" + page);
            List<String> types = TestApi.read(response, "$.items[*].type");
            List<Integer> points = TestApi.read(response, "$.items[*].points");
            if (types.isEmpty()) break;
            if (page == 0) assertEquals(balance, (int) TestApi.read(response, "$.items[0].balanceAfter"),
                    "the newest statement entry disagrees with the balance");
            for (int i = 0; i < types.size(); i++) {
                if (types.get(i).equals("EARN")) earned += points.get(i);
                if (types.get(i).equals("REDEEM")) { spent += points.get(i); redeemEntries++; }
            }
        }
        assertTrue(balance >= 0, "balance went negative: " + balance);
        assertEquals(earned - spent, balance, "points were created or destroyed");
        assertEquals(redeemed, redeemEntries, "every successful redemption writes exactly one entry");
        List<Integer> lotPoints = TestApi.read(api.member(id), "$.lots[*].points");
        assertEquals(balance, lotPoints.stream().mapToInt(Integer::intValue).sum(), "the lots disagree with the balance");
    }
}
