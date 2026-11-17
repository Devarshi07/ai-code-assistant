package com.debuggym.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 1: creating, looking up and listing employees behave as the README says. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase1Test {
    @Autowired
    MockMvc mvc;

    ResultActions create(String name, String email, String department) throws Exception {
        return mvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"" + name + "\", \"email\": \"" + email + "\", \"department\": \"" + department
                        + "\", \"title\": \"Engineer\"}"));
    }

    /** Creates count employees named Person 01, Person 02, ... in a department no other test uses. */
    String populate(int count) throws Exception {
        String department = "Dept-" + UUID.randomUUID();
        for (int i = 1; i <= count; i++) {
            String name = String.format("Person %02d", i);
            create(name, "person" + i + "@hearthwood.example", department).andExpect(status().isCreated());
        }
        return department;
    }

    @Test
    void createReturnsTheEmployee() throws Exception {
        String body = create("Ines Duarte", "ines@hearthwood.example", "Platform")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Ines Duarte"))
                .andExpect(jsonPath("$.department").value("Platform"))
                .andExpect(jsonPath("$.managerId").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        int id = JsonPath.read(body, "$.id");
        mvc.perform(get("/api/employees/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("ines@hearthwood.example"));
    }

    @Test
    void unknownEmployeeReturnsNotFound() throws Exception {
        mvc.perform(get("/api/employees/987654"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("employee_not_found"));
    }

    @Test
    void unknownManagerOnCreateReturnsNotFound() throws Exception {
        mvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Ola\", \"email\": \"ola@hearthwood.example\", \"department\": \"Sales\", "
                                + "\"title\": \"Rep\", \"managerId\": 987654}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("employee_not_found"));
    }

    @Test
    void blankNameIsABadRequest() throws Exception {
        create("  ", "blank@hearthwood.example", "Sales")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("validation_error"))
                .andExpect(jsonPath("$.error.fields.name").exists());
    }

    @Test
    void malformedEmailIsABadRequest() throws Exception {
        for (String email : new String[]{"not-an-email", "ines@localhost", "in es@hearthwood.example"}) {
            create("Ines Duarte", email, "Platform")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("validation_error"))
                    .andExpect(jsonPath("$.error.fields.email").exists());
        }
    }

    @Test
    void firstPageStartsWithTheFirstEmployee() throws Exception {
        String department = populate(25);
        mvc.perform(get("/api/employees?page=1&size=10&department=" + department))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.totalItems").value(25))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.items.length()").value(10))
                .andExpect(jsonPath("$.items[0].name").value("Person 01"))
                .andExpect(jsonPath("$.items[9].name").value("Person 10"));
    }

    @Test
    void lastPageHoldsTheRemainingEmployees() throws Exception {
        String department = populate(25);
        mvc.perform(get("/api/employees?page=3&size=10&department=" + department))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(5))
                .andExpect(jsonPath("$.items[0].name").value("Person 21"))
                .andExpect(jsonPath("$.items[4].name").value("Person 25"));
        mvc.perform(get("/api/employees?page=4&size=10&department=" + department))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void badPagingIsABadRequest() throws Exception {
        mvc.perform(get("/api/employees?page=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.page").exists());
        mvc.perform(get("/api/employees?size=101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.size").exists());
    }
}
