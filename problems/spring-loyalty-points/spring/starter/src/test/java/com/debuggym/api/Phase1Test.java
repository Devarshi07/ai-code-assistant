package com.debuggym.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Phase 1: earning and expiry behave as the README says. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class Phase1Test {
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

    @Test
    void bronzeMembersEarnOnePointPerCurrencyUnit() throws Exception {
        String id = api.newMember("BRONZE");
        MockHttpServletResponse response = api.purchase(id, "12.00");
        assertEquals(201, response.getStatus());
        assertEquals(12, (int) TestApi.read(response, "$.pointsEarned"));
        assertEquals(12, api.balance(id));
    }

    @Test
    void silverPurchaseRoundsDown() throws Exception {
        String id = api.newMember("SILVER");
        MockHttpServletResponse response = api.purchase(id, "19.90");   // 24.875 points
        assertEquals(24, (int) TestApi.read(response, "$.pointsEarned"));
        assertEquals(24, api.balance(id));
    }

    @Test
    void goldPurchaseRoundsDown() throws Exception {
        String id = api.newMember("GOLD");
        MockHttpServletResponse response = api.purchase(id, "3.99");    // 5.985 points
        assertEquals(5, (int) TestApi.read(response, "$.pointsEarned"));
    }

    @Test
    void purchaseBelowOnePointEarnsNothing() throws Exception {
        String id = api.newMember("BRONZE");
        MockHttpServletResponse response = api.purchase(id, "0.40");
        assertEquals(201, response.getStatus());
        assertEquals(0, (int) TestApi.read(response, "$.pointsEarned"));
        assertEquals(0, api.balance(id));
        assertEquals(List.of(), TestApi.read(api.member(id), "$.lots"));
    }

    @Test
    void pointsAreSpendableUntilTheDayBeforeTheyExpire() throws Exception {
        String id = api.newMember("BRONZE");
        MockHttpServletResponse response = api.purchase(id, "100.00");
        assertEquals("2026-03-15", TestApi.read(response, "$.expiresOn"));
        clock.setDate("2026-03-14");
        assertEquals(100, api.balance(id));
    }

    @Test
    void pointsExpireOnTheirExpiryDate() throws Exception {
        String id = api.newMember("BRONZE");
        api.purchase(id, "100.00");
        clock.setDate("2026-03-15");
        MockHttpServletResponse response = api.member(id);
        assertEquals(0, (int) TestApi.read(response, "$.balance"), "points expire on the day they are 12 months old");
        assertEquals(List.of(), TestApi.read(response, "$.lots"));
    }

    @Test
    void onlyTheExpiredLotsAreRemoved() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "100.00");
        String later = api.earn(id, "2025-09-01", "40.00");
        clock.setDate("2026-03-15");
        MockHttpServletResponse response = api.member(id);
        assertEquals(40, (int) TestApi.read(response, "$.balance"));
        assertEquals(later, TestApi.read(response, "$.lots[0].id"));
    }

    @Test
    void leapDayPurchasesExpireOnTheLastDayOfFebruary() throws Exception {
        String id = api.newMember("BRONZE");
        clock.setDate("2024-02-29");
        MockHttpServletResponse response = api.purchase(id, "10.00");
        assertEquals("2025-02-28", TestApi.read(response, "$.expiresOn"));
    }

    @Test
    void invalidPurchasesAndUnknownMembersAreRejected() throws Exception {
        String id = api.newMember("GOLD");
        for (String amount : List.of("-5", "0", "1.005")) {
            MockHttpServletResponse response = api.purchase(id, amount);
            assertEquals(422, response.getStatus(), amount);
            assertEquals("validation_error", TestApi.read(response, "$.error.code"));
            assertTrue(((java.util.Map<?, ?>) TestApi.read(response, "$.error.fields")).containsKey("amount"));
        }
        MockHttpServletResponse missing = api.member("mem_missing");
        assertEquals(404, missing.getStatus());
        assertEquals("member_not_found", TestApi.read(missing, "$.error.code"));
    }
}
