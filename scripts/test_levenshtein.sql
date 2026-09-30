CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
SELECT id, title, levenshtein(title, '床前看月光') as dist
FROM poems
ORDER BY dist ASC
LIMIT 10;
