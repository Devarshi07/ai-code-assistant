# Ledgerline accounts API

Ledgerline is a small business bank. This Spring Boot service owns customer
accounts and their ledgers: the mobile app and the back-office tools call it
to open accounts, take deposits and withdrawals, and (soon) move money between
accounts. Storage is in memory for now; the repositories are the only classes
that know that.

## Accounts

| Type | Overdraft limit |
| --- | --- |
| `SAVINGS` | none: the balance never goes below `0.00` |
| `CHECKING` | may go down to `-500.00` |
| `BUSINESS` | may go down to `-5000.00` |

Money is a `BigDecimal` with exactly two decimal places everywhere. Requests
send amounts as JSON numbers (`"amount": 12.50`); responses return them as
strings with two decimals (`"balance": "12.50"`, `"-3.00"`), so no client ever
parses money into a float. An amount with more than two decimals is rejected,
never rounded.

## Endpoints

| Method and path | Body | Success |
| --- | --- | --- |
| `POST /accounts` | `{"owner", "type", "openingBalance"}` | `201` account |
| `GET /accounts/{id}` | | `200` account |
| `POST /accounts/{id}/deposits` | `{"amount"}` | `200` account |
| `POST /accounts/{id}/withdrawals` | `{"amount"}` | `200` account |
| `GET /accounts/{id}/transactions?page=0&size=20` | | `200` page of ledger entries |
| `POST /transfers` | `{"fromAccountId", "toAccountId", "amount", "memo"?}` | `201` transfer |

An account is `{"id", "owner", "type", "balance"}`. A ledger entry is
`{"id", "type", "amount", "balanceAfter", "transferId", "createdAt"}`, where
`type` is `DEPOSIT`, `WITHDRAWAL`, `TRANSFER_IN` or `TRANSFER_OUT` and
`amount` is always positive. A page is
`{"items", "page", "size", "totalItems", "totalPages"}`.

## Errors

Every error has the same shape:

```json
{"error": {"code": "validation_error", "message": "The request is not valid", "fields": {"amount": "must be greater than 0"}}}
```

| Status | `code` | When |
| --- | --- | --- |
| `400` | `malformed_request` | the body is not valid JSON, or an enum value is unknown |
| `404` | `account_not_found` | an account id does not exist |
| `422` | `validation_error` | a field or query parameter is invalid (`fields` says which) |
| `422` | `insufficient_funds` | a debit would take the account past its overdraft limit |
| `422` | `same_account` | a transfer from an account to itself |
| `501` | `not_implemented` | the endpoint is not built yet |
| `500` | `internal_error` | a bug: the API should never answer this on purpose |

## Layout

```
src/main/java/com/debuggym/api/
  Application.java
  controller/   AccountController, TransferController (HTTP only, no rules)
  service/      AccountService, TransferService, Money (the business rules)
  repository/   AccountRepository, TransactionRepository, TransferRepository (in memory)
  model/        Account, AccountType, Transaction, TransactionType, Transfer
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
