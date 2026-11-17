# Team Task Tracker API

The back end of a small team's task board. A **project** has **members**; a **task** belongs to one project and has a title, an optional assignee (a member), a status, a priority and an optional due date. Members see and change only the tasks of the projects they belong to.

Django REST Framework, SQLite in memory, no login screen: the tests sign in with `APIClient.force_authenticate(user=...)`, and a request without a signed-in user gets `401`.

## Layout

| Path | What lives there |
| --- | --- |
| `config/settings.py`, `config/urls.py` | Settings (authentication, pagination limits, error handler) and the root URLs |
| `board/models.py` | `Project`, `Task` |
| `board/serializers.py` | JSON shapes in and out |
| `board/services.py` | The rules: project access, task changes, the list, the dashboard |
| `board/views.py`, `board/urls.py` | Thin views and routes |
| `board/errors.py` | One error shape for every failure |
| `board/clock.py` | `today()`. Tests pin the date by patching `board.clock.today` |
| `demo.py` | Plays a day on the board and prints it |
| `tests/` | `base.py` sets up Django and an in-memory database; each test is rolled back |

## Endpoints

| Method and path | Result |
| --- | --- |
| `GET /projects/` | `200`, the projects the user belongs to |
| `GET /projects/<id>/tasks/` | `200`, a page of the project's tasks (see below). `404` if the user is not a member |
| `POST /projects/<id>/tasks/` | `201`, creates a task: `{"title", "assignee_id"?, "priority"?, "due_on"?}` |
| `GET /tasks/<id>/` | `200`, one task |
| `PATCH /tasks/<id>/` | `200`, edits `title`, `assignee_id`, `priority` or `due_on`. Status cannot be changed here |
| `POST /tasks/<id>/transition/` | Moves a task to another status (not built yet) |
| `GET /projects/<id>/dashboard/` | `200`, counts for the project page |

A task looks like this:

```json
{"id": 7, "project_id": 1, "title": "Write the launch post", "status": "todo", "priority": 2,
 "due_on": "2026-03-05", "assignee": {"id": 3, "username": "jonah"}, "reopen_reason": ""}
```

`priority` is `1` (low), `2` (normal, the default) or `3` (high). `assignee` is `null` for an unassigned task, and an assignee must be a member of the project.

### The task list

`GET /projects/<id>/tasks/` answers `{"count", "page", "page_size", "results": [task, ...]}`. Today it returns the first 20 tasks, oldest first, and ignores query parameters. The finished version takes:

| Parameter | Meaning |
| --- | --- |
| `status` | `todo`, `in_progress` or `done` |
| `assignee` | A user id |
| `overdue` | `true`: not done and past its due date. `false`: everything else |
| `ordering` | `id` (default), `due_on`, `-due_on`, `priority`, `-priority`. Ties break by `id`; tasks with no due date sort last |
| `page`, `page_size` | Page number from 1 (default 1) and size from 1 to 100 (default 20) |

### The dashboard

```json
{"project_id": 1, "total": 40,
 "by_status": {"todo": 22, "in_progress": 11, "done": 7},
 "by_assignee": [{"assignee": {"id": 3, "username": "jonah"}, "count": 15}, {"assignee": null, "count": 4}],
 "overdue": 6}
```

`by_assignee` is sorted by username with the unassigned count last (left out if zero). A task is overdue when it is not `done` and its `due_on` is before today.

## Status workflow (phase 2)

```
todo  <->  in_progress  ->  done
                ^            |
                +--- reopen -+   (needs a reason)
```

Allowed moves: `todo -> in_progress`, `in_progress -> done`, `in_progress -> todo`, and `done -> in_progress` (a reopen, which needs a non-blank `reason`, stored in `reopen_reason`). Anything else is a `409`.

## Errors

Every error has the shape `{"error": {"code": "...", "message": "..."}}`, sometimes with extra fields.

| Status | `code` | When |
| --- | --- | --- |
| `400` | `validation_error` | The body or query string is invalid; `fields` maps each field to its messages |
| `401` | `not_authenticated` | No signed-in user |
| `404` | `not_found` | The project or task does not exist, or the user is not a member of its project |
| `409` | `invalid_transition` | The status change is not allowed; the body also has `from`, `to` and `allowed` (the statuses the task may move to) |

## Running it

Run the tests from the panel, or `python demo.py` to see a day on the board.
