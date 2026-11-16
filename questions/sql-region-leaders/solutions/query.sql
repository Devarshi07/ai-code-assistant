-- Write your query below. It runs on SQLite.
-- Return the columns region, rep, total and sales_rank.

WITH totals AS (
  SELECT region, rep, SUM(amount) AS total
  FROM sales
  GROUP BY region, rep
), ranked AS (
  SELECT region, rep, total,
         RANK() OVER (PARTITION BY region ORDER BY total DESC) AS sales_rank
  FROM totals
)
SELECT region, rep, total, sales_rank
FROM ranked
WHERE sales_rank <= 2
ORDER BY region, sales_rank, rep;
