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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 2: the org chart. Each test builds its own little company. */
@SpringBootTest
@AutoConfigureMockMvc
class Phase2Test {
    @Autowired
    MockMvc mvc;

    /** Creates an employee, with a manager when managerId is not null, and returns the new id. */
    long hire(String name, Long managerId) throws Exception {
        String manager = managerId == null ? "" : ", \"managerId\": " + managerId;
        String body = mvc.perform(post("/api/employees").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"" + name + "\", \"email\": \"" + name.toLowerCase().replace(' ', '.')
                                + "@hearthwood.example\", \"department\": \"Org\", \"title\": \"Staff\"" + manager + "}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    ResultActions setManager(long id, String managerJson) throws Exception {
        return mvc.perform(put("/api/employees/" + id + "/manager").contentType(MediaType.APPLICATION_JSON)
                .content("{\"managerId\": " + managerJson + "}"));
    }

    @Test
    void directReportsAreSortedByName() throws Exception {
        long boss = hire("Zed Boss", null);
        long ben = hire("ben Reid", boss);
        long amy = hire("Amy Kato", boss);
        long cho = hire("Cho Lund", boss);
        hire("Dee Grandchild", amy);
        mvc.perform(get("/api/employees/" + boss + "/reports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(amy))
                .andExpect(jsonPath("$[1].id").value(ben))
                .andExpect(jsonPath("$[2].id").value(cho));
    }

    @Test
    void someoneWithoutReportsGetsAnEmptyList() throws Exception {
        long loner = hire("Lone Worker", null);
        mvc.perform(get("/api/employees/" + loner + "/reports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/employees/" + loner + "/reports?all=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void reportsOfAnUnknownEmployeeReturnNotFound() throws Exception {
        mvc.perform(get("/api/employees/987654/reports"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("employee_not_found"));
        mvc.perform(get("/api/employees/987654/chain")).andExpect(status().isNotFound());
    }

    @Test
    void allReportsIncludeEveryLevelSortedByName() throws Exception {
        long ceo = hire("Cora Ceo", null);
        long vp = hire("Vik Prasad", ceo);
        long dir = hire("Dana Ortiz", vp);
        long eng1 = hire("Zoe Engineer", dir);
        long eng2 = hire("Abe Engineer", dir);
        long other = hire("Mo Other", ceo);
        mvc.perform(get("/api/employees/" + ceo + "/reports?all=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5))
                .andExpect(jsonPath("$[0].id").value(eng2))
                .andExpect(jsonPath("$[1].id").value(dir))
                .andExpect(jsonPath("$[2].id").value(other))
                .andExpect(jsonPath("$[3].id").value(vp))
                .andExpect(jsonPath("$[4].id").value(eng1));
        mvc.perform(get("/api/employees/" + vp + "/reports?all=true"))
                .andExpect(jsonPath("$.length()").value(3));
        mvc.perform(get("/api/employees/" + ceo + "/reports?all=maybe")).andExpect(status().isBadRequest());
    }

    @Test
    void chainRunsFromTheManagerUpToTheTop() throws Exception {
        long ceo = hire("Chain Ceo", null);
        long vp = hire("Chain Vp", ceo);
        long lead = hire("Chain Lead", vp);
        long dev = hire("Chain Dev", lead);
        mvc.perform(get("/api/employees/" + dev + "/chain"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(lead))
                .andExpect(jsonPath("$[1].id").value(vp))
                .andExpect(jsonPath("$[2].id").value(ceo));
        mvc.perform(get("/api/employees/" + ceo + "/chain"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void changingTheManagerMovesTheEmployee() throws Exception {
        long first = hire("Move First", null);
        long second = hire("Move Second", null);
        long worker = hire("Move Worker", first);
        setManager(worker, String.valueOf(second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(worker))
                .andExpect(jsonPath("$.managerId").value(second));
        mvc.perform(get("/api/employees/" + first + "/reports")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/employees/" + second + "/reports")).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/employees/" + worker)).andExpect(jsonPath("$.managerId").value(second));
    }

    @Test
    void anEmployeeCanBeMadeTopLevel() throws Exception {
        long boss = hire("Detach Boss", null);
        long worker = hire("Detach Worker", boss);
        setManager(worker, "null")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.managerId").doesNotExist());
        mvc.perform(get("/api/employees/" + boss + "/reports")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void unknownEmployeeOrManagerReturnsNotFound() throws Exception {
        long worker = hire("Lost Worker", null);
        setManager(worker, "987654")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("employee_not_found"));
        setManager(987654, String.valueOf(worker))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("employee_not_found"));
    }

    @Test
    void aManagerCycleIsRefusedAndChangesNothing() throws Exception {
        long ceo = hire("Loop Ceo", null);
        long vp = hire("Loop Vp", ceo);
        long dev = hire("Loop Dev", vp);
        setManager(ceo, String.valueOf(ceo))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("manager_cycle"));
        setManager(ceo, String.valueOf(dev))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("manager_cycle"));
        setManager(vp, String.valueOf(dev)).andExpect(status().isConflict());
        mvc.perform(get("/api/employees/" + ceo)).andExpect(jsonPath("$.managerId").doesNotExist());
        mvc.perform(get("/api/employees/" + dev + "/chain")).andExpect(jsonPath("$.length()").value(2));
    }
}
