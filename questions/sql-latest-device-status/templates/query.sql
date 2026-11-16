-- Write your query below. It runs on SQLite.
-- Return the columns device, status, recorded_at and copies.

SELECT device, status, recorded_at, 1 AS copies
FROM readings
LIMIT 0;
