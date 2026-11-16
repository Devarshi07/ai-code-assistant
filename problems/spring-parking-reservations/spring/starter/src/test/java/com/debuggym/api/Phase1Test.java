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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 1: bookings on one space never share time, and nothing else is refused. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase1Test {
    static final Instant DAY = Instant.now().plus(Duration.ofDays(20)).truncatedTo(ChronoUnit.DAYS);

    @Autowired
    MockMvc mvc;

    static Instant at(int hour) {
        return DAY.plus(Duration.ofHours(hour));
    }

    long space(String size) throws Exception {
        String body = mvc.perform(post("/spaces").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\": \"B-07\", \"level\": -1, \"size\": \"" + size + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    ResultActions book(long spaceId, String vehicleSize, Instant start, Instant end) throws Exception {
        return mvc.perform(post("/reservations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"spaceId\": " + spaceId + ", \"plate\": \"KD-4471\", \"vehicleSize\": \"" + vehicleSize
                        + "\", \"start\": \"" + start + "\", \"end\": \"" + end + "\"}"));
    }

    @Test
    void backToBackBookingsAreAllowed() throws Exception {
        long space = space("STANDARD");
        book(space, "STANDARD", at(10), at(12)).andExpect(status().isCreated());
        book(space, "STANDARD", at(12), at(14)).andExpect(status().isCreated());
        book(space, "COMPACT", at(8), at(10)).andExpect(status().isCreated());
    }

    @Test
    void overlappingBookingsAreRejected() throws Exception {
        long space = space("STANDARD");
        book(space, "STANDARD", at(10), at(12)).andExpect(status().isCreated());
        book(space, "STANDARD", at(11), at(13)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("space_unavailable"));
        book(space, "STANDARD", at(9), at(11)).andExpect(status().isConflict());
        book(space, "STANDARD", at(9), at(13)).andExpect(status().isConflict());
        book(space, "STANDARD", at(10).plus(Duration.ofMinutes(15)), at(11)).andExpect(status().isConflict());
    }

    @Test
    void theSameTimeOnAnotherSpaceIsFine() throws Exception {
        long first = space("LARGE"), second = space("LARGE");
        book(first, "LARGE", at(10), at(12)).andExpect(status().isCreated());
        book(second, "LARGE", at(10), at(12)).andExpect(status().isCreated());
    }

    @Test
    void invalidBookingsAreRejected() throws Exception {
        long space = space("COMPACT");
        book(space, "COMPACT", at(10), at(10)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("validation_error"))
                .andExpect(jsonPath("$.error.fields.end").exists());
        book(space, "COMPACT", at(10), at(9)).andExpect(status().isUnprocessableEntity());
        book(space, "COMPACT", Instant.now().minus(Duration.ofHours(2)), Instant.now().plus(Duration.ofHours(1)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error.fields.start").exists());
        book(space, "LARGE", at(10), at(11)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("space_too_small"));
        book(987654, "COMPACT", at(10), at(11)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("space_not_found"));
    }

    @Test
    void aReservationCanBeReadBack() throws Exception {
        long space = space("COMPACT");
        String body = book(space, "MOTORCYCLE", at(15), at(17)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(body, "$.id")).longValue();
        mvc.perform(get("/reservations/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spaceId").value(space))
                .andExpect(jsonPath("$.plate").value("KD-4471"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.start").value(at(15).toString()))
                .andExpect(jsonPath("$.end").value(at(17).toString()));
        mvc.perform(get("/reservations/987654")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("reservation_not_found"));
    }
}
