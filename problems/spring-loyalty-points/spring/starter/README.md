# Bean and Brew loyalty API

Bean and Brew is a coffee chain with a loyalty programme. This Spring Boot
service keeps each member's points: the till reports a purchase, the service
awards points, and members later spend them on rewards. Storage is in memory
for now; the repositories are the only classes that know that.

## Earning points

Every member has a tier, and a purchase earns points at the tier's rate:

| Tier | Points per currency unit |
| --- | --- |
| `BRONZE` | 1.00 |
| `SILVER` | 1.25 |
| `GOLD` | 1.50 |

Points for a purchase are `amount x rate`, **rounded down to a whole number
per purchase**. The fraction is dropped, not carried over to the next purchase
(a Silver member paying `19.90` earns 24 points, not 25). A purchase worth less
than one point earns nothing and creates no lot.

## Lots and expiry

Each purchase that earns points creates one **lot**: its points, the day it was
earned, and its expiry date. Points **expire 12 months after the day they were
earned**: a lot earned on `2025-03-15` expires on `2026-03-15`; a lot earned on
`2024-02-29` expires on `2025-02-28`.

Expiry is a date, not a time, and a lot is gone **on** its expiry date. The
last day its points can be spent is the day before: on `2026-03-14` the lot
above still counts, on `2026-03-15` it does not. Whatever was left of an
expired lot is written to the statement as one `EXPIRE` entry dated on the
expiry date.

A member's **balance** is the sum of the points left in their lots that have
not expired. "Today" always comes from the injected `Clock`, never from
`LocalDate.now()` directly, so tests can move time.

## Rewards

| `rewardId` | Cost in points |
| --- | --- |
| `pastry` | 100 |
| `free-coffee` | 150 |
| `tote-bag` | 400 |

A redemption costs `reward cost x quantity`. It spends the **oldest unexpired
lots first** (the lot that expires soonest), taking a lot completely before
moving to the next, and the last lot it touches may be spent partially.

## Endpoints

| Method and path | Body | Success |
| --- | --- | --- |
| `POST /members` | `{"name", "tier"}` | `201` member |
| `GET /members/{id}` | | `200` member |
| `POST /members/{id}/purchases` | `{"amount"}` | `201` purchase result |
| `POST /members/{id}/redemptions` | `{"rewardId", "quantity"?}` | `201` redemption |
| `GET /members/{id}/statement?page=0&size=20` | | `200` page of statement entries |

- A member is `{"id", "name", "tier", "balance", "lots"}`; `lots` are the spendable
  lots, soonest expiry first, as `{"id", "points", "earnedOn", "expiresOn"}` where
  `points` is what is left in the lot.
- `amount` is a JSON number with at most two decimals, greater than 0.
- A purchase result is `{"pointsEarned", "balance", "lotId", "expiresOn"}`
  (`lotId` and `expiresOn` are `null` when no points were earned).
- `quantity` is an integer from 1 to 10 and defaults to 1.
- A redemption is `{"id", "memberId", "rewardId", "quantity", "pointsSpent",
  "balance", "lots", "date"}`, where `balance` is what is left afterwards and
  `lots` lists what it consumed as `{"lotId", "points", "expiresOn"}`, oldest first.
- A statement is newest entry first. An entry is `{"id", "type", "points",
  "balanceAfter", "lotId", "redemptionId", "date"}`, where `type` is `EARN`,
  `REDEEM` or `EXPIRE`, `points` is always positive and `date` is the day the
  entry belongs to. A page is `{"items", "page", "size", "totalItems", "totalPages"}`
  with `page` starting at 0; `size` is 1 to 100. A page past the end is `200`
  with no items.
- Some phase-2 endpoints answer `501 not_implemented` until they are built.

## Errors

Every error has the same shape:

```json
{"error": {"code": "validation_error", "message": "The request is not valid", "fields": {"amount": "must be greater than 0"}}}
```

| Status | `code` | When |
| --- | --- | --- |
| `400` | `malformed_request` | the body is not valid JSON, or an enum value is unknown |
| `404` | `member_not_found` | a member id does not exist |
| `404` | `reward_not_found` | a `rewardId` is not in the catalogue |
| `409` | `insufficient_points` | the spendable balance is lower than the cost of the redemption |
| `422` | `validation_error` | a field, query parameter or header is invalid (`fields` says which) |
| `501` | `not_implemented` | the endpoint is not built yet |
| `500` | `internal_error` | a bug: the API should never answer this on purpose |

## Layout

```
src/main/java/com/debuggym/api/
  Application.java          (also defines the system Clock)
  controller/   MemberController, RedemptionController (HTTP only, no rules)
  service/      PointsService (members, earning, expiry, redemptions, statement),
                PointsPolicy (earning and expiry rules), RewardCatalog
  repository/   MemberRepository, LotRepository, LedgerRepository (in memory)
  model/        Member, Tier, PointsLot, LedgerEntry, Redemption
  dto/          request and response records, with Bean Validation annotations
  exception/    ApiException and its subclasses, ApiExceptionHandler (the error shape)
src/test/java/com/debuggym/api/
  Phase1Test.java  (later phases add Phase2Test and Phase3Test)
  TestApi, MutableClock, TestClockConfig  (test helpers; the clock is replaceable)
```

## Running the tests

The tests are JUnit 5 with MockMvc, so they exercise the real controllers,
validation and error handler without opening a port. Use **Run tests**, or in
the terminal:

```
mvn -q test -Dtest=Phase1Test
```

The first run compiles the project and starts a Spring context, which takes a
few seconds. Write your own tests in `src/test/java/com/debuggym/api/CustomTest.java`;
the `TestApi` helper and `MutableClock` in the same folder show how to move the date.
