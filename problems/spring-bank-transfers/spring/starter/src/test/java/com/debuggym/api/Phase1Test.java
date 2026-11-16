package com.debuggym.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 1: balances and withdrawals behave as the README says. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase1Test {
    @Autowired
    MockMvc mvc;

    String open(String type, String openingBalance) throws Exception {
        String body = mvc.perform(post("/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"owner\": \"Ines Duarte\", \"type\": \"" + type + "\", \"openingBalance\": " + openingBalance + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    ResultActions move(String id, String kind, String amount) throws Exception {
        return mvc.perform(post("/accounts/" + id + "/" + kind).contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\": " + amount + "}"));
    }

    @Test
    void openingBalanceHasTwoDecimals() throws Exception {
        String id = open("SAVINGS", "100.00");
        mvc.perform(get("/accounts/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("SAVINGS"))
                .andExpect(jsonPath("$.balance").value("100.00"));
    }

    @Test
    void depositsKeepTheCents() throws Exception {
        String id = open("SAVINGS", "200.00");
        move(id, "deposits", "50.50").andExpect(status().isOk()).andExpect(jsonPath("$.balance").value("250.50"));
        move(id, "deposits", "0.50").andExpect(status().isOk()).andExpect(jsonPath("$.balance").value("251.00"));
    }

    @Test
    void withdrawalReducesTheBalance() throws Exception {
        String id = open("SAVINGS", "80.25");
        move(id, "withdrawals", "20.13").andExpect(status().isOk()).andExpect(jsonPath("$.balance").value("60.12"));
    }

    @Test
    void overdrawingSavingsIsUnprocessable() throws Exception {
        String id = open("SAVINGS", "40.00");
        move(id, "withdrawals", "40.01")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("insufficient_funds"));
        mvc.perform(get("/accounts/" + id)).andExpect(jsonPath("$.balance").value("40.00"));
    }

    @Test
    void invalidAmountsAreRejected() throws Exception {
        String id = open("SAVINGS", "10.25");
        move(id, "deposits", "-5").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("validation_error"))
                .andExpect(jsonPath("$.error.fields.amount").exists());
        move(id, "deposits", "1.005").andExpect(status().isUnprocessableEntity());
        move(id, "withdrawals", "0").andExpect(status().isUnprocessableEntity());
    }

    @Test
    void unknownAccountReturnsNotFound() throws Exception {
        mvc.perform(get("/accounts/acc_missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("account_not_found"));
    }
}
