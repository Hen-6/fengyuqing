-- 1. Wipe ONLY the poems table so we get a clean slate for the 314k poems
-- (User progress remains untouched)
DELETE FROM poems;

-- 2. Enable fuzzystrmatch extension for typo tolerance
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 3. Create the exact typo-tolerant search RPC
CREATE OR REPLACE FUNCTION search_poems_fuzzy(query_text TEXT, max_results INT DEFAULT 20)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.*
  FROM poems p
  LEFT JOIN LATERAL unnest(p.lines) AS line ON true
  WHERE 
    p.title LIKE '%' || query_text || '%'
    OR p.author LIKE '%' || query_text || '%'
    OR (
        length(line) BETWEEN length(query_text) - 2 AND length(query_text) + 2
        AND levenshtein(line, query_text) <= 2
    )
    OR line LIKE '%' || query_text || '%'
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
