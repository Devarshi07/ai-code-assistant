package com.debuggym.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 2: availability search and cancellation. Runs in its own application context. */
@SpringBootTest(properties = "parkwise.test-context=phase2")
@AutoConfigureMockMvc
class Phase2Test {
    static final Instant DAY = Instant.now().plus(Duration.ofDays(40)).truncatedTo(ChronoUnit.DAYS);

    @Autowired
    MockMvc mvc;

    /** Hour h of test day d, so each test books its own stretch of time. */
    static Instant at(int day, int hour) {
        return DAY.plus(Duration.ofDays(day)).plus(Duration.ofHours(hour));
    }

    long space(String label, int level, String size) throws Exception {
        String body = mvc.perform(post("/spaces").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\": \"" + label + "\", \"level\": " + level + ", \"size\": \"" + size + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    ResultActions book(long spaceId, String vehicleSize, Instant start, Instant end) throws Exception {
        return mvc.perform(post("/reservations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"spaceId\": " + spaceId + ", \"plate\": \"MX 2290\", \"vehicleSize\": \"" + vehicleSize
                        + "\", \"start\": \"" + start + "\", \"end\": \"" + end + "\"}"));
    }

    long bookId(long spaceId, String vehicleSize, Instant start, Instant end) throws Exception {
        String body = book(spaceId, vehicleSize, start, end).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    ResultActions search(Instant start, Instant end, String vehicleSize) throws Exception {
        return mvc.perform(get("/availability").param("start", start.toString()).param("end", end.toString()).param("vehicleSize", vehicleSize));
    }

    /** The ids the search returned, in order, keeping only the given spaces (other tests add spaces too). */
    List<Long> found(Instant start, Instant end, String vehicleSize, Set<Long> mine) throws Exception {
        String body = search(start, end, vehicleSize).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Number> ids = JsonPath.read(body, "$.spaces[*].id");
        int count = JsonPath.read(body, "$.count");
        assertEquals(ids.size(), count, "count is the number of spaces returned");
        return ids.stream().map(Number::longValue).filter(mine::contains).toList();
    }

    @Test
    void searchReturnsFreeSpacesThatFitBestFirst() throws Exception {
        long moto = space("M-01", 1, "MOTORCYCLE");
        long compactHigh = space("C-21", 2, "COMPACT");
        long compactLow = space("C-11", 1, "COMPACT");
        long standard = space("S-01", 1, "STANDARD");
        long large = space("L-01", 0, "LARGE");
        Set<Long> mine = Set.of(moto, compactHigh, compactLow, standard, large);
        bookId(compactLow, "COMPACT", at(1, 10), at(1, 12));

        assertEquals(List.of(compactHigh, standard, large), found(at(1, 11), at(1, 13), "COMPACT", mine),
                "the booked space is left out, and the smallest spaces that fit come first");
        assertEquals(List.of(compactLow, compactHigh, standard, large), found(at(1, 12), at(1, 14), "COMPACT", mine),
                "a window that starts when a booking ends is free");
        assertEquals(List.of(moto, compactHigh, standard, large), found(at(1, 9), at(1, 11), "MOTORCYCLE", mine));
        assertEquals(List.of(large), found(at(1, 9), at(1, 11), "LARGE", mine));
    }

    @Test
    void searchValidatesItsParameters() throws Exception {
        mvc.perform(get("/availability").param("start", at(2, 9).toString()).param("end", at(2, 11).toString()))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("validation_error"))
                .andExpect(jsonPath("$.error.fields.vehicleSize").exists());
        search(at(2, 11), at(2, 9), "COMPACT").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.fields.end").exists());
        search(at(2, 9), at(2, 11), "TRUCK").andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/availability").param("start", "tomorrow").param("end", at(2, 11).toString()).param("vehicleSize", "COMPACT"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.fields.start").exists());
    }

    @Test
    void cancellingFreesTheSpace() throws Exception {
        long space = space("S-31", 3, "STANDARD");
        long id = bookId(space, "STANDARD", at(3, 10), at(3, 12));
        assertEquals(List.of(), found(at(3, 10), at(3, 12), "STANDARD", Set.of(space)));

        mvc.perform(post("/reservations/" + id + "/cancel"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancelledAt").exists());
        assertEquals(List.of(space), found(at(3, 10), at(3, 12), "STANDARD", Set.of(space)));
        book(space, "STANDARD", at(3, 11), at(3, 13)).andExpect(status().isCreated());
        mvc.perform(get("/reservations/" + id)).andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void cancellationRules() throws Exception {
        long space = space("C-41", 4, "COMPACT");
        long id = bookId(space, "COMPACT", at(4, 10), at(4, 12));
        mvc.perform(post("/reservations/" + id + "/cancel")).andExpect(status().isOk());
        mvc.perform(post("/reservations/" + id + "/cancel")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("already_cancelled"));
        mvc.perform(post("/reservations/987654/cancel")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("reservation_not_found"));

        Instant now = Instant.now();
        long soon = bookId(space, "COMPACT", now.plus(Duration.ofMinutes(20)), now.plus(Duration.ofMinutes(80)));
        mvc.perform(post("/reservations/" + soon + "/cancel")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("cancellation_closed"));
        mvc.perform(get("/reservations/" + soon)).andExpect(jsonPath("$.status").value("ACTIVE"));
        long later = bookId(space, "COMPACT", now.plus(Duration.ofHours(2)), now.plus(Duration.ofHours(3)));
        mvc.perform(post("/reservations/" + later + "/cancel")).andExpect(status().isOk());
    }
}
