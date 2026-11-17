package com.debuggym.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Phase 2: redemptions (oldest lots first) and the paginated statement. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
class Phase2Test {
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
    void redemptionSpendsTheOldestLotsFirst() throws Exception {
        String id = api.newMember("BRONZE");
        String l1 = api.earn(id, "2025-01-10", "100.00");
        String l2 = api.earn(id, "2025-02-10", "100.00");
        String l3 = api.earn(id, "2025-03-10", "100.00");
        clock.setDate("2025-04-01");

        MockHttpServletResponse response = api.redeem(id, "free-coffee", null, null);
        assertEquals(201, response.getStatus(), response.getContentAsString());
        assertEquals("free-coffee", TestApi.read(response, "$.rewardId"));
        assertEquals(1, (int) TestApi.read(response, "$.quantity"));
        assertEquals(150, (int) TestApi.read(response, "$.pointsSpent"));
        assertEquals(150, (int) TestApi.read(response, "$.balance"));
        assertEquals(2, ((List<?>) TestApi.read(response, "$.lots")).size());
        assertEquals(l1, TestApi.read(response, "$.lots[0].lotId"));
        assertEquals(100, (int) TestApi.read(response, "$.lots[0].points"));
        assertEquals("2026-01-10", TestApi.read(response, "$.lots[0].expiresOn"));
        assertEquals(l2, TestApi.read(response, "$.lots[1].lotId"));
        assertEquals(50, (int) TestApi.read(response, "$.lots[1].points"));

        MockHttpServletResponse member = api.member(id);
        assertEquals(150, (int) TestApi.read(member, "$.balance"));
        assertEquals(2, ((List<?>) TestApi.read(member, "$.lots")).size());
        assertEquals(l2, TestApi.read(member, "$.lots[0].id"));
        assertEquals(50, (int) TestApi.read(member, "$.lots[0].points"));
        assertEquals(l3, TestApi.read(member, "$.lots[1].id"));
    }

    @Test
    void expiredLotsAreNeverSpent() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-01-10", "100.00");
        String live = api.earn(id, "2025-06-01", "200.00");
        clock.setDate("2026-01-10");   // the first lot expires today

        MockHttpServletResponse response = api.redeem(id, "pastry", null, null);
        assertEquals(201, response.getStatus(), response.getContentAsString());
        assertEquals(1, ((List<?>) TestApi.read(response, "$.lots")).size());
        assertEquals(live, TestApi.read(response, "$.lots[0].lotId"));
        assertEquals(100, (int) TestApi.read(response, "$.balance"));
    }

    @Test
    void quantityMultipliesTheCostAndTheLastPointCanBeSpent() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "500.00");
        MockHttpServletResponse response = api.redeem(id, "pastry", 3, null);
        assertEquals(201, response.getStatus());
        assertEquals(300, (int) TestApi.read(response, "$.pointsSpent"));
        assertEquals(3, (int) TestApi.read(response, "$.quantity"));
        assertEquals(200, (int) TestApi.read(response, "$.balance"));
        assertEquals(201, api.redeem(id, "pastry", 2, null).getStatus());
        assertEquals(0, api.balance(id));
        assertEquals(List.of(), TestApi.read(api.member(id), "$.lots"));
    }

    @Test
    void notEnoughPointsIsAConflictAndSpendsNothing() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2025-03-15", "120.00");
        MockHttpServletResponse response = api.redeem(id, "free-coffee", null, null);
        assertEquals(409, response.getStatus(), response.getContentAsString());
        assertEquals("insufficient_points", TestApi.read(response, "$.error.code"));
        assertNotNull(TestApi.read(response, "$.error.message"));
        assertEquals(120, api.balance(id));
        assertEquals(1, (int) TestApi.read(api.statement(id, ""), "$.totalItems"), "a rejected redemption writes nothing");
    }

    @Test
    void expiredPointsDoNotCountTowardsTheBalance() throws Exception {
        String id = api.newMember("BRONZE");
        api.earn(id, "2024-01-01", "100.00");
        api.earn(id, "2025-03-01", "60.00");
        clock.setDate("2025-03-15");   // 160 earned, only 60 left
        MockHttpServletResponse response = api.redeem(id, "pastry", null, null);
        assertEquals(409, response.getStatus());
        assertEquals("insufficient_points", TestApi.read(response, "$.error.code"));
        assertEquals(60, api.balance(id));
    }

    @Test
    void invalidRedemptionsAreRejected() throws Exception {
        String id = api.newMember("GOLD");
        api.earn(id, "2025-03-15", "500.00");
        MockHttpServletResponse unknownReward = api.redeem(id, "yacht", null, null);
        assertEquals(404, unknownReward.getStatus());
        assertEquals("reward_not_found", TestApi.read(unknownReward, "$.error.code"));
        MockHttpServletResponse unknownMember = api.redeem("mem_missing", "pastry", null, null);
        assertEquals(404, unknownMember.getStatus());
        assertEquals("member_not_found", TestApi.read(unknownMember, "$.error.code"));
        for (int quantity : new int[]{0, 11}) {
            MockHttpServletResponse bad = api.redeem(id, "pastry", quantity, null);
            assertEquals(422, bad.getStatus(), "quantity " + quantity);
            assertEquals("validation_error", TestApi.read(bad, "$.error.code"));
            assertTrue(((java.util.Map<?, ?>) TestApi.read(bad, "$.error.fields")).containsKey("quantity"));
        }
        MockHttpServletResponse blank = mvc.perform(post("/members/" + id + "/redemptions")
                .contentType(MediaType.APPLICATION_JSON).content("{\"rewardId\": \"\"}")).andReturn().getResponse();
        assertEquals(422, blank.getStatus());
        MockHttpServletResponse malformed = mvc.perform(post("/members/" + id + "/redemptions")
                .contentType(MediaType.APPLICATION_JSON).content("{")).andReturn().getResponse();
        assertEquals(400, malformed.getStatus());
        assertEquals("malformed_request", TestApi.read(malformed, "$.error.code"));
        assertEquals(750, api.balance(id));
    }

    @Test
    void statementListsEarnRedeemAndExpireEntriesNewestFirst() throws Exception {
        String id = api.newMember("BRONZE");
        String l1 = api.earn(id, "2025-01-10", "100.00");
        String l2 = api.earn(id, "2025-02-01", "50.00");
        clock.setDate("2025-03-01");
        String redemptionId = TestApi.read(api.redeem(id, "pastry", null, null), "$.id");
        clock.setDate("2026-02-15");   // the 50 points of the second lot expired on 2026-02-01

        MockHttpServletResponse response = api.statement(id, "");
        assertEquals(200, response.getStatus(), response.getContentAsString());
        assertEquals(4, (int) TestApi.read(response, "$.totalItems"));
        assertEquals(1, (int) TestApi.read(response, "$.totalPages"));
        assertEquals(0, (int) TestApi.read(response, "$.page"));
        assertEquals(20, (int) TestApi.read(response, "$.size"));

        assertEquals("EXPIRE", TestApi.read(response, "$.items[0].type"));
        assertEquals(50, (int) TestApi.read(response, "$.items[0].points"));
        assertEquals(0, (int) TestApi.read(response, "$.items[0].balanceAfter"));
        assertEquals(l2, TestApi.read(response, "$.items[0].lotId"));
        assertEquals("2026-02-01", TestApi.read(response, "$.items[0].date"));

        assertEquals("REDEEM", TestApi.read(response, "$.items[1].type"));
        assertEquals(100, (int) TestApi.read(response, "$.items[1].points"));
        assertEquals(50, (int) TestApi.read(response, "$.items[1].balanceAfter"));
        assertEquals(redemptionId, TestApi.read(response, "$.items[1].redemptionId"));
        assertEquals("2025-03-01", TestApi.read(response, "$.items[1].date"));

        assertEquals("EARN", TestApi.read(response, "$.items[2].type"));
        assertEquals(50, (int) TestApi.read(response, "$.items[2].points"));
        assertEquals(150, (int) TestApi.read(response, "$.items[2].balanceAfter"));
        assertEquals("EARN", TestApi.read(response, "$.items[3].type"));
        assertEquals(l1, TestApi.read(response, "$.items[3].lotId"));
        assertEquals(100, (int) TestApi.read(response, "$.items[3].balanceAfter"));
    }

    @Test
    void statementIsPaginated() throws Exception {
        String id = api.newMember("BRONZE");
        for (int i = 1; i <= 5; i++) api.earn(id, "2025-03-0" + i, (10 * i) + ".00");   // balances 10, 30, 60, 100, 150

        MockHttpServletResponse first = api.statement(id, "?page=0&size=2");
        assertEquals(5, (int) TestApi.read(first, "$.totalItems"));
        assertEquals(3, (int) TestApi.read(first, "$.totalPages"));
        assertEquals(2, ((List<?>) TestApi.read(first, "$.items")).size());
        assertEquals(150, (int) TestApi.read(first, "$.items[0].balanceAfter"));
        assertEquals(100, (int) TestApi.read(first, "$.items[1].balanceAfter"));
        MockHttpServletResponse second = api.statement(id, "?page=1&size=2");
        assertEquals(60, (int) TestApi.read(second, "$.items[0].balanceAfter"));
        assertEquals(30, (int) TestApi.read(second, "$.items[1].balanceAfter"));
        MockHttpServletResponse last = api.statement(id, "?page=2&size=2");
        assertEquals(1, ((List<?>) TestApi.read(last, "$.items")).size());
        assertEquals(10, (int) TestApi.read(last, "$.items[0].balanceAfter"));
        MockHttpServletResponse beyond = api.statement(id, "?page=3&size=2");
        assertEquals(200, beyond.getStatus());
        assertEquals(List.of(), TestApi.read(beyond, "$.items"));
        assertEquals(3, (int) TestApi.read(beyond, "$.totalPages"));
    }

    @Test
    void badPagingAndUnknownMembersAreRejected() throws Exception {
        String id = api.newMember("SILVER");
        for (String query : List.of("?page=-1", "?size=0", "?size=101", "?size=abc")) {
            MockHttpServletResponse response = api.statement(id, query);
            assertEquals(422, response.getStatus(), query);
            assertEquals("validation_error", TestApi.read(response, "$.error.code"), query);
        }
        MockHttpServletResponse both = api.statement(id, "?page=-1&size=500");
        java.util.Map<?, ?> fields = TestApi.read(both, "$.error.fields");
        assertTrue(fields.containsKey("page") && fields.containsKey("size"), "every problem is reported at once");
        MockHttpServletResponse empty = api.statement(id, "");
        assertEquals(0, (int) TestApi.read(empty, "$.totalItems"));
        assertEquals(0, (int) TestApi.read(empty, "$.totalPages"));
        assertEquals(404, api.statement("mem_missing", "").getStatus());
    }
}
