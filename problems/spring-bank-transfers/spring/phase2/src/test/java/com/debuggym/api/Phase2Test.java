package com.debuggym.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 2: transfers, overdraft limits and paginated history. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase2Test {
    @Autowired
    MockMvc mvc;

    String open(String type, String openingBalance) throws Exception {
        String body = mvc.perform(post("/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"owner\": \"Tomas Brandt\", \"type\": \"" + type + "\", \"openingBalance\": " + openingBalance + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    String balance(String id) throws Exception {
        return JsonPath.read(mvc.perform(get("/accounts/" + id)).andReturn().getResponse().getContentAsString(), "$.balance");
    }

    ResultActions transfer(String from, String to, String amount) throws Exception {
        return mvc.perform(post("/transfers").contentType(MediaType.APPLICATION_JSON)
                .content("{\"fromAccountId\": \"" + from + "\", \"toAccountId\": \"" + to + "\", \"amount\": " + amount + ", \"memo\": \"rent\"}"));
    }

    ResultActions move(String id, String kind, String amount) throws Exception {
        return mvc.perform(post("/accounts/" + id + "/" + kind).contentType(MediaType.APPLICATION_JSON).content("{\"amount\": " + amount + "}"));
    }

    @Test
    void transferMovesMoneyAndRecordsBothSides() throws Exception {
        String a = open("SAVINGS", "300.00"), b = open("SAVINGS", "0.00");
        String body = transfer(a, b, "120.50")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fromAccountId").value(a))
                .andExpect(jsonPath("$.toAccountId").value(b))
                .andExpect(jsonPath("$.amount").value("120.50"))
                .andExpect(jsonPath("$.memo").value("rent"))
                .andReturn().getResponse().getContentAsString();
        String transferId = JsonPath.read(body, "$.id");
        assertEquals("179.50", balance(a));
        assertEquals("120.50", balance(b));

        mvc.perform(get("/accounts/" + a + "/transactions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].type").value("TRANSFER_OUT"))
                .andExpect(jsonPath("$.items[0].amount").value("120.50"))
                .andExpect(jsonPath("$.items[0].balanceAfter").value("179.50"))
                .andExpect(jsonPath("$.items[0].transferId").value(transferId))
                .andExpect(jsonPath("$.items[1].type").value("DEPOSIT"));
        mvc.perform(get("/accounts/" + b + "/transactions"))
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].type").value("TRANSFER_IN"))
                .andExpect(jsonPath("$.items[0].balanceAfter").value("120.50"))
                .andExpect(jsonPath("$.items[0].transferId").value(transferId));
    }

    @Test
    void overdraftLimitsDependOnTheAccountType() throws Exception {
        String target = open("SAVINGS", "0.00");
        String checking = open("CHECKING", "100.00");
        transfer(checking, target, "600.00").andExpect(status().isCreated());
        assertEquals("-500.00", balance(checking));
        transfer(checking, target, "0.01").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("insufficient_funds"));
        assertEquals("-500.00", balance(checking));

        String business = open("BUSINESS", "0.00");
        move(business, "withdrawals", "5000.00").andExpect(status().isOk()).andExpect(jsonPath("$.balance").value("-5000.00"));
        move(business, "withdrawals", "0.01").andExpect(status().isUnprocessableEntity());

        String savings = open("SAVINGS", "10.00");
        transfer(savings, target, "10.01").andExpect(status().isUnprocessableEntity());
        transfer(savings, target, "10.00").andExpect(status().isCreated());
        assertEquals("0.00", balance(savings));
        assertEquals("610.00", balance(target));
    }

    @Test
    void invalidTransfersAreRejected() throws Exception {
        String a = open("SAVINGS", "50.00");
        mvc.perform(post("/transfers").contentType(MediaType.APPLICATION_JSON).content("{\"fromAccountId\": \"" + a + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("validation_error"))
                .andExpect(jsonPath("$.error.fields.toAccountId").exists())
                .andExpect(jsonPath("$.error.fields.amount").exists());
        transfer(a, a, "5.00").andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error.code").value("same_account"));
        transfer(a, "acc_missing", "5.00").andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("account_not_found"));
        transfer("acc_missing", a, "5.00").andExpect(status().isNotFound());
        transfer(a, open("SAVINGS", "0.00"), "-1").andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.error.fields.amount").exists());
        assertEquals("50.00", balance(a));
    }

    @Test
    void historyIsPaginatedNewestFirst() throws Exception {
        String id = open("SAVINGS", "0.00");
        for (int i = 1; i <= 25; i++) move(id, "deposits", i + ".00").andExpect(status().isOk());
        mvc.perform(get("/accounts/" + id + "/transactions").param("page", "0").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(10))
                .andExpect(jsonPath("$.items[0].amount").value("25.00"))
                .andExpect(jsonPath("$.items[9].amount").value("16.00"))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalItems").value(25))
                .andExpect(jsonPath("$.totalPages").value(3));
        mvc.perform(get("/accounts/" + id + "/transactions").param("page", "2").param("size", "10"))
                .andExpect(jsonPath("$.items.length()").value(5))
                .andExpect(jsonPath("$.items[0].amount").value("5.00"))
                .andExpect(jsonPath("$.items[4].amount").value("1.00"))
                .andExpect(jsonPath("$.items[4].balanceAfter").value("1.00"));
        mvc.perform(get("/accounts/" + id + "/transactions").param("page", "3").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.totalItems").value(25));
        mvc.perform(get("/accounts/" + id + "/transactions"))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.items.length()").value(20));
    }

    @Test
    void historyRejectsBadPagingAndUnknownAccounts() throws Exception {
        String id = open("SAVINGS", "1.00");
        String url = "/accounts/" + id + "/transactions";
        mvc.perform(get(url).param("size", "0")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("validation_error"))
                .andExpect(jsonPath("$.error.fields.size").exists());
        mvc.perform(get(url).param("size", "101")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get(url).param("page", "-1")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.fields.page").exists());
        mvc.perform(get(url).param("size", "ten")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/accounts/acc_missing/transactions")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("account_not_found"));
    }
}
