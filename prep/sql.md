# SQL questions

SQL questions show a schema and a task, and you write one query. The query runs against the visible sample data and then against hidden datasets, and it usually scores all or nothing on each. Whether the row order matters depends on the question, so read the expected output carefully.

## A routine that avoids most mistakes

1. **Read the schema.** Note the keys, which columns can be NULL, and where duplicates are possible.
2. **Work out the expected output by hand** for the sample data. If you can't, you don't yet understand the question.
3. **Build the query in the order SQL runs it**: FROM and JOINs, then WHERE, GROUP BY, HAVING, SELECT and finally ORDER BY and LIMIT.
4. **Check the traps**: NULLs, duplicates from joins, ties, empty groups.
5. **Match the output exactly**: column names and order, sort order, rounding and date formats.

## Patterns worth knowing cold

- **Inner and left joins.** A LEFT JOIN keeps every row from the left table, padded with NULLs when nothing matches.
- **Anti-joins.** "Customers with no orders": `LEFT JOIN ... WHERE o.id IS NULL`, or `NOT EXISTS`.
- **Aggregation.** GROUP BY with HAVING for conditions on groups. Know the difference between `COUNT(*)` (rows), `COUNT(col)` (non-NULL values) and `COUNT(DISTINCT col)`.
- **Window functions.** `ROW_NUMBER`, `RANK` and `DENSE_RANK`; `PARTITION BY` to restart per group; running totals with `SUM(x) OVER (ORDER BY ...)`; `LAG` and `LEAD` for day-over-day changes.
- **Top N per group.** `ROW_NUMBER() OVER (PARTITION BY g ORDER BY x DESC)` in a subquery or CTE, then keep rows numbered N or less.
- **Nth highest value.** `DENSE_RANK`, or `MAX` below a subquery's `MAX`; decide what to return when there's no such row (usually NULL).
- **Conditional aggregation.** `SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)` turns rows into columns.
- **Dates.** Grouping by day or month, and the "gaps and islands" trick for streaks: a date minus its row number is constant within a run of consecutive days.
- **CTEs.** `WITH` clauses make multi-step queries readable, and readable queries have fewer bugs.

## NULL traps

- `x <> 5` silently drops rows where x is NULL, because the comparison is unknown, not true.
- `NOT IN (subquery)` returns no rows at all if the subquery contains a NULL; prefer `NOT EXISTS`.
- `COUNT(col)`, `AVG` and `SUM` skip NULLs, and `AVG` over a mix of values and NULLs is not the same as treating NULL as zero.
- `NULL = NULL` is unknown; use `IS NULL`, `IS NOT NULL` or `COALESCE`.
- A LEFT JOIN followed by a WHERE condition on the right table's column turns it back into an inner join; put that condition in the ON clause instead.

## Joins that multiply rows

Joining a customer to both their orders and their support tickets produces every order paired with every ticket. Totals computed after such a join are inflated. Aggregate each child table in its own subquery first, then join the results.

## Performance questions

- A B-tree index helps equality, ranges and ORDER BY on a leading prefix of its columns.
- An index on `(a, b)` helps filters on `a`, or on `a` and `b`, but not on `b` alone.
- Wrapping a column in a function, such as `LOWER(email)`, stops a plain index from being used; use an expression index instead.
- `LIKE 'abc%'` can use an index in many engines; `LIKE '%abc'` cannot.
- `EXPLAIN` shows whether the plan uses an index or scans the whole table.
- Low-selectivity filters (a column with two values) often aren't worth an index at all.

## Checklist before you submit

- [ ] The sample output matches exactly, including column names and order.
- [ ] You've thought about NULLs in every column you compare, join or aggregate.
- [ ] Joins don't duplicate rows you then count or sum.
- [ ] Ties are handled the way the question asks (RANK, DENSE_RANK or ROW_NUMBER).
- [ ] An empty result, or a group with no rows, behaves sensibly.
- [ ] ORDER BY is present if the expected output is sorted.

## Practising in this app

- **Coding questions** with the SQL skill.
- **Multiple choice:** the SQL and Databases topics.
- **Practice tests:** the API and SQL back-end assessment.
