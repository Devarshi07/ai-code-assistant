package com.debuggym.api;

import com.debuggym.api.model.Reservation;
import com.debuggym.api.model.Space;
import com.debuggym.api.model.VehicleSize;
import com.debuggym.api.repository.ReservationRepository;
import com.debuggym.api.repository.SpaceRepository;
import com.debuggym.api.service.AvailabilityService;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 3: availability search on a large garage. The lot is seeded straight
 * into SpaceRepository and ReservationRepository (through save), in its own
 * application context, and searched through AvailabilityService.
 */
@SpringBootTest(properties = "parkwise.test-context=phase3")
@AutoConfigureMockMvc
class Phase3Test {
    static final int SPACES = 600, PER_SPACE = 400, SEARCHES = 3000;
    static final long LIMIT_MS = 4000;
    static final Duration SLOT = Duration.ofMinutes(30);
    static final Instant BASE = Instant.now().plus(Duration.ofDays(30)).truncatedTo(ChronoUnit.HOURS);
    static final Comparator<Space> BEST_FIT = Comparator.comparing(Space::size).thenComparingInt(Space::level).thenComparingLong(Space::id);

    record Search(Instant start, Instant end, VehicleSize size) {
    }

    static List<Space> seeded;
    static final Map<Long, List<Reservation>> active = new HashMap<>();
    static long lastSlot;

    @Autowired
    MockMvc mvc;
    @Autowired
    SpaceRepository spaceRepository;
    @Autowired
    ReservationRepository reservationRepository;
    @Autowired
    AvailabilityService availability;

    static Instant slot(long n) {
        return BASE.plus(SLOT.multipliedBy(n));
    }

    /** 600 spaces with 400 reservations each, back to back with gaps; one in twenty is cancelled. */
    synchronized void seed() {
        if (seeded != null) return;
        Random random = new Random(20261116L);
        List<Space> spaces = new ArrayList<>();
        for (int i = 0; i < SPACES; i++) {
            int roll = random.nextInt(100);
            VehicleSize size = roll < 10 ? VehicleSize.MOTORCYCLE : roll < 40 ? VehicleSize.COMPACT : roll < 85 ? VehicleSize.STANDARD : VehicleSize.LARGE;
            Space space = spaceRepository.save(new Space(spaceRepository.nextId(), "Z" + i, random.nextInt(6) - 2, size));
            spaces.add(space);
            List<Reservation> kept = new ArrayList<>();
            long at = random.nextInt(10);
            for (int k = 0; k < PER_SPACE; k++) {
                long length = 1 + random.nextInt(8);
                Reservation r = new Reservation(reservationRepository.nextId(), space.id(), "SEED" + (k % 100), size, slot(at), slot(at + length), BASE);
                if (random.nextInt(20) == 0) {
                    // A cancelled booking; the next one reuses its time.
                    r.cancel(BASE);
                } else {
                    kept.add(r);
                    at += length + random.nextInt(4);
                }
                reservationRepository.save(r);
            }
            active.put(space.id(), kept);
            lastSlot = Math.max(lastSlot, at);
        }
        seeded = spaces;
    }

    static List<Search> searches(long seed, int count, VehicleSize... sizes) {
        Random random = new Random(seed);
        List<Search> out = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            long start = random.nextInt((int) lastSlot - 12);
            out.add(new Search(slot(start), slot(start + 1 + random.nextInt(12)), sizes[random.nextInt(sizes.length)]));
        }
        return out;
    }

    /** The answer, computed the slow and obvious way from what was seeded. */
    static List<Long> bruteForce(Instant start, Instant end, VehicleSize size) {
        return seeded.stream()
                .filter(s -> size.fitsIn(s.size()))
                .filter(s -> active.get(s.id()).stream().noneMatch(r -> r.getStart().isBefore(end) && start.isBefore(r.getEnd())))
                .sorted(BEST_FIT).map(Space::id).toList();
    }

    List<Long> search(Instant start, Instant end, VehicleSize size) {
        return availability.findAvailable(start, end, size).stream().map(Space::id).toList();
    }

    static Space firstLarge(int skip) {
        return seeded.stream().filter(s -> s.size() == VehicleSize.LARGE).skip(skip).findFirst().orElseThrow();
    }

    ResultActions book(long spaceId, Instant start, Instant end) throws Exception {
        return mvc.perform(post("/reservations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"spaceId\": " + spaceId + ", \"plate\": \"RT-118\", \"vehicleSize\": \"LARGE\", \"start\": \"" + start + "\", \"end\": \"" + end + "\"}"));
    }

    @Test
    void searchStaysFastOnTheBigLot() {
        seed();
        List<Search> searches = searches(1, SEARCHES, VehicleSize.values());
        long started = System.nanoTime(), found = 0;
        int done = 0;
        for (Search s : searches) {
            found += availability.findAvailable(s.start(), s.end(), s.size()).size();
            done++;
            if ((System.nanoTime() - started) / 1_000_000 > LIMIT_MS) break;
        }
        long ms = (System.nanoTime() - started) / 1_000_000;
        assertTrue(done == SEARCHES && ms <= LIMIT_MS, String.format("%d of %d searches over %d spaces and %d reservations took %d ms; the limit is %d ms for all of them",
                done, SEARCHES, SPACES, SPACES * PER_SPACE, ms, LIMIT_MS));
        assertTrue(found > 0, "some searches should find free spaces");
    }

    @Test
    void searchStillMatchesBruteForce() {
        seed();
        for (Search s : searches(2, 10, VehicleSize.STANDARD, VehicleSize.LARGE))
            assertEquals(bruteForce(s.start(), s.end(), s.size()), search(s.start(), s.end(), s.size()), "search for " + s);

        Space space = firstLarge(0);
        Reservation r = active.get(space.id()).get(100);
        List<Search> edges = List.of(
                new Search(r.getStart(), r.getEnd(), VehicleSize.LARGE),
                new Search(r.getEnd(), r.getEnd().plus(SLOT), VehicleSize.LARGE),
                new Search(r.getStart().minus(SLOT), r.getStart(), VehicleSize.LARGE),
                new Search(r.getStart().minus(SLOT), r.getStart().plus(Duration.ofMinutes(1)), VehicleSize.LARGE));
        for (Search s : edges)
            assertEquals(bruteForce(s.start(), s.end(), s.size()), search(s.start(), s.end(), s.size()), "search for " + s);
        assertFalse(search(r.getStart(), r.getEnd(), VehicleSize.LARGE).contains(space.id()));
    }

    @Test
    void bookingAndCancellingKeepTheSearchCurrent() throws Exception {
        seed();
        Space space = firstLarge(1);
        Reservation r = active.get(space.id()).get(200);
        book(space.id(), r.getStart(), r.getEnd()).andExpect(status().isConflict());
        assertFalse(search(r.getStart(), r.getEnd(), VehicleSize.LARGE).contains(space.id()));

        mvc.perform(post("/reservations/" + r.getId() + "/cancel")).andExpect(status().isOk());
        assertTrue(search(r.getStart(), r.getEnd(), VehicleSize.LARGE).contains(space.id()), "a cancelled booking frees its space");

        book(space.id(), r.getStart(), r.getEnd()).andExpect(status().isCreated());
        assertFalse(search(r.getStart(), r.getEnd(), VehicleSize.LARGE).contains(space.id()), "a new booking takes the space");
    }
}
