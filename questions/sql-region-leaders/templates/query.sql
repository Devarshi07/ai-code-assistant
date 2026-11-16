-- Write your query below. It runs on SQLite.
-- Return the columns region, rep, total and sales_rank.

SELECT region, rep, amount AS total, 1 AS sales_rank
FROM sales
LIMIT 0;
