-- Write your query below. It runs on SQLite.
-- Return the columns device, status, recorded_at and copies.

WITH valid AS (
  SELECT id, device, status, recorded_at
  FROM readings
  WHERE status IS NOT NULL
), ranked AS (
  SELECT device, status, recorded_at,
         ROW_NUMBER() OVER (PARTITION BY device ORDER BY recorded_at DESC, id DESC) AS position
  FROM valid
), copies AS (
  SELECT device, status, recorded_at, COUNT(*) AS copies
  FROM valid
  GROUP BY device, status, recorded_at
)
SELECT r.device, r.status, r.recorded_at, c.copies
FROM ranked AS r
JOIN copies AS c
  ON c.device = r.device AND c.status = r.status AND c.recorded_at = r.recorded_at
WHERE r.position = 1 AND r.status <> 'retired'
ORDER BY r.device;
