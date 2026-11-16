-- Write your query below. It runs on SQLite.
-- Return the columns order_id, customer_name and total.

SELECT o.id AS order_id, c.name AS customer_name, o.total
FROM orders AS o
JOIN customers AS c ON c.id = o.customer_id
WHERE c.city = 'Porto'
  AND o.status = 'delivered'
  AND o.total >= 25
ORDER BY o.total DESC, o.id;
