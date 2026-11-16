-- Write your query below. It runs on SQLite.
-- Return the columns instructor, classes and avg_attendees, in any order.

SELECT i.name AS instructor,
       COUNT(*) AS classes,
       ROUND(AVG(c.attendees), 1) AS avg_attendees
FROM classes AS c
JOIN instructors AS i ON i.id = c.instructor_id
WHERE c.held_on >= '2025-01-01' AND c.held_on <= '2025-12-31'
GROUP BY i.id, i.name
HAVING COUNT(*) >= 3 AND AVG(c.attendees) >= 12;
