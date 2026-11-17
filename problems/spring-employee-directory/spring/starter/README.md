# Hearthwood people directory API

Hearthwood is a mid-sized company with a few hundred people and a growing
intranet. This Spring Boot service is the directory behind it: the intranet and
the Slack bot call it to look people up, list them by department and, soon,
walk the org chart. Storage is in memory for now; `EmployeeRepository` is the
only class that knows that.

## Employees

An employee is `{"id", "name", "email", "department", "title", "managerId"}`.
`managerId` is the id of the person they report to, or `null` for someone at
the top of the org chart (there can be more than one). Everyone except the top
reports to exactly one manager, and the reporting lines never form a loop.

## Endpoints

| Method and path | Body | Success |
| --- | --- | --- |
| `POST /api/employees` | `{"name", "email", "department", "title", "managerId"?}` | `201` employee |
| `GET /api/employees/{id}` | | `200` employee |
| `GET /api/employees?page=1&size=20&department=` | | `200` page of employees, ordered by id |
| `GET /api/employees/{id}/reports` | | `200` array of direct reports |
| `GET /api/employees/{id}/reports?all=true` | | `200` array of everyone under the employee, at any depth |
| `GET /api/employees/{id}/chain` | | `200` array: the manager, their manager, and so on up to the top |
| `PUT /api/employees/{id}/manager` | `{"managerId": 7}` or `{"managerId": null}` | `200` the updated employee |

- **Pages** are **1-based**: `page` defaults to `1`, `size` defaults to `20` and
  must be 1 to 100. A page past the end is `200` with no items. A page is
  `{"items", "page", "size", "totalItems", "totalPages"}`. `department` is an
  optional case-insensitive filter.
- **Reports and chain** are arrays of employees. Reports are sorted by name
  (ignoring case), then id. The chain runs from the nearest manager upwards,
  and is empty for someone at the top.
- **Changing a manager** with `PUT .../manager` and `null` makes the employee a
  top-level person. A manager who is the employee, or who already reports to
  them at any depth, would create a loop and is refused.

## Errors

Every error has the same shape:

```json
{"error": {"code": "validation_error", "message": "The request is not valid", "fields": {"email": "must be a well-formed email address"}}}
```

| Status | `code` | When |
| --- | --- | --- |
| `400` | `validation_error` | a field or query parameter is invalid (`fields` says which), including an email that is not well formed |
| `400` | `malformed_request` | the body is not valid JSON |
| `404` | `employee_not_found` | an employee id, or a `managerId`, does not exist |
| `409` | `manager_cycle` | the new manager would create a reporting loop |
| `501` | `not_implemented` | the endpoint is not built yet |
| `500` | `internal_error` | a bug: the API should never answer this on purpose |

## Layout

```
src/main/java/com/debuggym/api/
  Application.java
  controller/   EmployeeController, OrgChartController (HTTP only, no rules)
  service/      EmployeeService, OrgChartService, Emails (the business rules)
  repository/   EmployeeRepository (in memory; counts the records it scans)
  model/        Employee
  dto/          request and response records, with Bean Validation annotations
  exception/    ApiException and its subclasses, ApiExceptionHandler (the error shape)
src/test/java/com/debuggym/api/
  Phase1Test.java  (later phases add Phase2Test and Phase3Test)
```

## Running the tests

The tests are JUnit 5 with MockMvc, so they exercise the real controllers,
validation and error handler without opening a port. Use **Run tests**, or in
the terminal:

```
mvn -q test -Dtest=Phase1Test
```

The first run compiles the project and starts a Spring context, which takes a
few seconds. Write your own tests in `src/test/java/com/debuggym/api/CustomTest.java`.
