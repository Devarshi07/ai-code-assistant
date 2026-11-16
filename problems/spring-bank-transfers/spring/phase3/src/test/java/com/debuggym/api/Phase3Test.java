package com.debuggym.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Phase 3: Idempotency-Key retries and transfers that run in parallel. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase3Test {
    @Autowired
    MockMvc mvc;

    String open(String type, String openingBalance) throws Exception {
        String body = mvc.perform(post("/accounts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"owner\": \"Amara Osei\", \"type\": \"" + type + "\", \"openingBalance\": " + openingBalance + "}"))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    String balance(String id) throws Exception {
        return JsonPath.read(mvc.perform(get("/accounts/" + id)).andReturn().getResponse().getContentAsString(), "$.balance");
    }

    int ledgerSize(String id) throws Exception {
        return JsonPath.read(mvc.perform(get("/accounts/" + id + "/transactions").param("size", "1")).andReturn().getResponse().getContentAsString(), "$.totalItems");
    }

    MockHttpServletResponse transfer(String from, String to, String amount, String key) throws Exception {
        MockHttpServletRequestBuilder request = post("/transfers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fromAccountId\": \"" + from + "\", \"toAccountId\": \"" + to + "\", \"amount\": " + amount + "}");
        if (key != null) request.header("Idempotency-Key", key);
        return mvc.perform(request).andReturn().getResponse();
    }

    static String key() {
        return "test-" + UUID.randomUUID();
    }

    @Test
    void retryWithTheSameKeyReplaysTheTransfer() throws Exception {
        String a = open("SAVINGS", "100.00"), b = open("SAVINGS", "0.00");
        String key = key();
        MockHttpServletResponse first = transfer(a, b, "30.00", key);
        assertEquals(201, first.getStatus(), first.getContentAsString());
        MockHttpServletResponse retry = transfer(a, b, "30.00", key);
        assertEquals(201, retry.getStatus(), retry.getContentAsString());
        assertEquals((String) JsonPath.read(first.getContentAsString(), "$.id"), JsonPath.read(retry.getContentAsString(), "$.id"), "a retry returns the original transfer");
        assertEquals("true", retry.getHeader("Idempotent-Replayed"));
        assertEquals("70.00", balance(a), "the money moved once");
        assertEquals("30.00", balance(b));
        assertEquals(2, ledgerSize(a));
    }

    @Test
    void reusingKeyForDifferentTransferIsConflict() throws Exception {
        String a = open("SAVINGS", "100.00"), b = open("SAVINGS", "0.00");
        String key = key();
        assertEquals(201, transfer(a, b, "10.00", key).getStatus());
        MockHttpServletResponse other = transfer(a, b, "11.00", key);
        assertEquals(409, other.getStatus(), other.getContentAsString());
        assertEquals("idempotency_conflict", JsonPath.read(other.getContentAsString(), "$.error.code"));
        assertEquals("90.00", balance(a));
    }

    @Test
    void failedAttemptCanBeRetriedWithItsKey() throws Exception {
        String a = open("SAVINGS", "5.00"), b = open("SAVINGS", "0.00");
        String key = key();
        assertEquals(422, transfer(a, b, "10.00", key).getStatus());
        mvc.perform(post("/accounts/" + a + "/deposits").contentType(MediaType.APPLICATION_JSON).content("{\"amount\": 10.00}"));
        assertEquals(201, transfer(a, b, "10.00", key).getStatus(), "only successful transfers are remembered");
        assertEquals("5.00", balance(a));
    }

    @Test
    void concurrentRetriesMoveMoneyOnce() throws Exception {
        String a = open("SAVINGS", "1000.00"), b = open("SAVINGS", "0.00");
        String key = key();
        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<MockHttpServletResponse>> calls = new ArrayList<>();
        for (int i = 0; i < threads; i++) calls.add(pool.submit(() -> {
            start.await();
            return transfer(a, b, "25.00", key);
        }));
        start.countDown();
        Set<String> ids = new HashSet<>();
        for (Future<MockHttpServletResponse> call : calls) {
            MockHttpServletResponse response = call.get(30, TimeUnit.SECONDS);
            assertEquals(201, response.getStatus(), response.getContentAsString());
            ids.add(JsonPath.read(response.getContentAsString(), "$.id"));
        }
        pool.shutdownNow();
        assertEquals(1, ids.size(), "every retry gets the same transfer");
        assertEquals("975.00", balance(a));
        assertEquals("25.00", balance(b));
    }

    @Test
    void parallelTransfersConserveMoney() throws Exception {
        int accounts = 8, threads = 8, perThread = 150;
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < accounts; i++) ids.add(open("CHECKING", "1000.00"));
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> workers = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            Random random = new Random(7919L * (t + 1));
            Callable<Integer> worker = () -> {
                start.await();
                int moved = 0;
                for (int i = 0; i < perThread; i++) {
                    int from = random.nextInt(accounts), to = (from + 1 + random.nextInt(accounts - 1)) % accounts;
                    String amount = BigDecimal.valueOf(1 + random.nextInt(40000), 2).toPlainString();
                    int status = transfer(ids.get(from), ids.get(to), amount, null).getStatus();
                    assertTrue(status == 201 || status == 422, "unexpected status " + status);
                    if (status == 201) moved++;
                }
                return moved;
            };
            workers.add(pool.submit(worker));
        }
        start.countDown();
        int moved = 0;
        for (Future<Integer> worker : workers) moved += worker.get(60, TimeUnit.SECONDS);
        pool.shutdownNow();

        BigDecimal total = BigDecimal.ZERO;
        int entries = 0;
        for (String id : ids) {
            BigDecimal balance = new BigDecimal(balance(id));
            assertTrue(balance.compareTo(new BigDecimal("-500.00")) >= 0, id + " went past its overdraft: " + balance);
            String newest = JsonPath.read(mvc.perform(get("/accounts/" + id + "/transactions").param("size", "1"))
                    .andReturn().getResponse().getContentAsString(), "$.items[0].balanceAfter");
            assertEquals(balance.toPlainString(), newest, id + ": the newest ledger entry disagrees with the balance");
            total = total.add(balance);
            entries += ledgerSize(id);
        }
        assertEquals("8000.00", total.toPlainString(), "money was created or destroyed (" + moved + " transfers succeeded)");
        assertEquals(accounts + 2 * moved, entries, "every successful transfer writes exactly two ledger entries");
    }
}
