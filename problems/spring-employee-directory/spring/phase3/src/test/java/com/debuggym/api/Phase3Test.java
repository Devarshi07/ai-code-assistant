package com.debuggym.api;

import com.debuggym.api.model.Employee;
import com.debuggym.api.repository.EmployeeRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 3: the org chart of a 50,000-person company. The directory is seeded
 * straight into EmployeeRepository (in its own application context), then the
 * reports endpoints are called for one manager with a few hundred people under
 * them. The checks are deterministic: they count how many employee records the
 * repository had to look at, not how long it took.
 */
@SpringBootTest(properties = "directory.test-context=phase3")
@AutoConfigureMockMvc
class Phase3Test {
    static final int COMPANY = 50_000;

    static long[] ids;
    static int[] parent;
    static List<List<Integer>> children;
    static String[] names;
    static int manager;          // index of the manager whose reports the tests ask for
    static List<Integer> subtree; // indexes of everyone under that manager, in no particular order

    @Autowired
    MockMvc mvc;
    @Autowired
    EmployeeRepository repository;

    @BeforeEach
    void seed() {
        synchronized (Phase3Test.class) {
            if (ids != null) return;
            Random random = new Random(20261116L);
            long[] newIds = new long[COMPANY];
            parent = new int[COMPANY];
            names = new String[COMPANY];
            children = new ArrayList<>();
            for (int i = 0; i < COMPANY; i++) children.add(new ArrayList<>());
            for (int i = 0; i < COMPANY; i++) {
                parent[i] = i == 0 ? -1 : (int) (i * Math.pow(random.nextDouble(), 1.5));
                if (i > 0) children.get(parent[i]).add(i);
                names[i] = (random.nextBoolean() ? "Alex " : "alex ") + Integer.toString(random.nextInt(1_000_000), 36);
                newIds[i] = repository.nextId();
                Long managerId = i == 0 ? null : newIds[parent[i]];
                repository.save(new Employee(newIds[i], names[i], "e" + i + "@hearthwood.example", "Dept " + (i % 40), "Staff", managerId));
            }
            int[] size = new int[COMPANY];
            java.util.Arrays.fill(size, 1);
            for (int i = COMPANY - 1; i > 0; i--) size[parent[i]] += size[i];
            // The manager the tests ask about: the one whose team is closest to 400 people.
            int best = -1;
            for (int i = 1; i < COMPANY; i++) {
                if (size[i] >= 150 && (best < 0 || Math.abs(size[i] - 400) < Math.abs(size[best] - 400))) best = i;
            }
            assertTrue(best > 0, "the seeded company has no suitable manager");
            manager = best;
            subtree = new ArrayList<>();
            List<Integer> stack = new ArrayList<>(children.get(manager));
            while (!stack.isEmpty()) {
                int next = stack.remove(stack.size() - 1);
                subtree.add(next);
                stack.addAll(children.get(next));
            }
            ids = newIds;
        }
    }

    /** The expected response order: by name ignoring case, then id. */
    List<Long> expected(List<Integer> indexes) {
        return indexes.stream()
                .sorted((a, b) -> {
                    int byName = String.CASE_INSENSITIVE_ORDER.compare(names[a], names[b]);
                    return byName != 0 ? byName : Long.compare(ids[a], ids[b]);
                })
                .map(i -> ids[i]).toList();
    }

    List<Long> idsIn(String body) {
        List<Number> raw = JsonPath.read(body, "$[*].id");
        return raw.stream().map(Number::longValue).toList();
    }

    String fetch(String path) throws Exception {
        return mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    @Test
    void everyoneUnderAManagerIsListedInOrder() throws Exception {
        assertTrue(subtree.size() >= 150 && subtree.size() <= 1500, "unexpected team size " + subtree.size());
        List<Long> actual = idsIn(fetch("/api/employees/" + ids[manager] + "/reports?all=true"));
        assertEquals(subtree.size(), actual.size(), "number of people under the manager");
        assertEquals(expected(subtree), actual, "all reports, sorted by name then id");
    }

    @Test
    void listingEveryoneUnderAManagerDoesNotScanTheDirectory() throws Exception {
        repository.resetRecordsRead();
        fetch("/api/employees/" + ids[manager] + "/reports?all=true");
        long reads = repository.recordsRead();
        long allowed = 2L * subtree.size() + 100;
        assertTrue(reads <= allowed, "listing " + subtree.size() + " reports read " + reads
                + " employee records; expected at most " + allowed + " (is the directory scanned once per manager?)");
    }

    @Test
    void directReportsDoNotScanTheDirectory() throws Exception {
        List<Integer> direct = children.get(manager);
        repository.resetRecordsRead();
        List<Long> actual = idsIn(fetch("/api/employees/" + ids[manager] + "/reports"));
        long reads = repository.recordsRead();
        assertEquals(expected(direct), actual, "direct reports, sorted by name then id");
        long allowed = 2L * direct.size() + 100;
        assertTrue(reads <= allowed, "listing " + direct.size() + " direct reports read " + reads
                + " employee records; expected at most " + allowed);
    }

    @Test
    void reportsFollowAManagerChange() throws Exception {
        String created = mvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Newhire Nora\", \"email\": \"nora@hearthwood.example\", \"department\": \"Dept 1\", "
                                + "\"title\": \"Staff\", \"managerId\": " + ids[manager] + "}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long newcomer = ((Number) JsonPath.read(created, "$.id")).longValue();
        assertTrue(idsIn(fetch("/api/employees/" + ids[manager] + "/reports")).contains(newcomer), "new hire under the manager");
        assertTrue(idsIn(fetch("/api/employees/" + ids[manager] + "/reports?all=true")).contains(newcomer), "new hire in the whole team");

        mvc.perform(put("/api/employees/" + newcomer + "/manager").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"managerId\": " + ids[0] + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").value(ids[0]));

        repository.resetRecordsRead();
        assertFalse(idsIn(fetch("/api/employees/" + ids[manager] + "/reports")).contains(newcomer), "moved away from the old manager");
        assertFalse(idsIn(fetch("/api/employees/" + ids[manager] + "/reports?all=true")).contains(newcomer), "moved out of the old team");
        long reads = repository.recordsRead();
        assertTrue(reads <= 4L * subtree.size() + 200, "reading the team after a move read " + reads + " employee records");
        assertTrue(idsIn(fetch("/api/employees/" + ids[0] + "/reports")).contains(newcomer), "moved under the new manager");
    }

    @Test
    void cyclesAreStillRefusedInALargeCompany() throws Exception {
        int deepest = subtree.get(subtree.size() - 1);
        mvc.perform(put("/api/employees/" + ids[manager] + "/manager").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"managerId\": " + ids[deepest] + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("manager_cycle"));
        mvc.perform(get("/api/employees/" + ids[manager])).andExpect(jsonPath("$.managerId").value(ids[parent[manager]]));
    }
}
