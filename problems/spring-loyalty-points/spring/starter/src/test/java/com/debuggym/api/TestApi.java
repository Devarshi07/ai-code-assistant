package com.debuggym.api;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Small helpers shared by the phase tests: each call is one HTTP request through MockMvc. */
class TestApi {
    final MockMvc mvc;
    final MutableClock clock;

    TestApi(MockMvc mvc, MutableClock clock) {
        this.mvc = mvc;
        this.clock = clock;
    }

    static <T> T read(MockHttpServletResponse response, String path) throws Exception {
        return JsonPath.read(response.getContentAsString(), path);
    }

    String newMember(String tier) throws Exception {
        MockHttpServletResponse response = mvc.perform(post("/members").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Ines Duarte\", \"tier\": \"" + tier + "\"}")).andReturn().getResponse();
        assertEquals(201, response.getStatus(), response.getContentAsString());
        return read(response, "$.id");
    }

    MockHttpServletResponse purchase(String memberId, String amount) throws Exception {
        return mvc.perform(post("/members/" + memberId + "/purchases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\": " + amount + "}")).andReturn().getResponse();
    }

    /** Moves the clock to the date, makes a purchase and returns the id of the lot it earned. */
    String earn(String memberId, String date, String amount) throws Exception {
        clock.setDate(date);
        MockHttpServletResponse response = purchase(memberId, amount);
        assertEquals(201, response.getStatus(), response.getContentAsString());
        return read(response, "$.lotId");
    }

    MockHttpServletResponse redeem(String memberId, String rewardId, Integer quantity, String key) throws Exception {
        String body = "{\"rewardId\": \"" + rewardId + "\"" + (quantity == null ? "" : ", \"quantity\": " + quantity) + "}";
        MockHttpServletRequestBuilder request = post("/members/" + memberId + "/redemptions")
                .contentType(MediaType.APPLICATION_JSON).content(body);
        if (key != null) request.header("Idempotency-Key", key);
        return mvc.perform(request).andReturn().getResponse();
    }

    MockHttpServletResponse member(String memberId) throws Exception {
        return mvc.perform(get("/members/" + memberId)).andReturn().getResponse();
    }

    int balance(String memberId) throws Exception {
        return read(member(memberId), "$.balance");
    }

    MockHttpServletResponse statement(String memberId, String query) throws Exception {
        return mvc.perform(get("/members/" + memberId + "/statement" + query)).andReturn().getResponse();
    }
}
