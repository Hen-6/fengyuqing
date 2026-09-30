-- 1. Enable pg_trgm for ultra-fast text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create an aggregated text column to index
ALTER TABLE poems ADD COLUMN IF NOT EXISTS search_text TEXT;

-- 3. Populate the column (This might take ~10 seconds)
UPDATE poems 
SET search_text = title || ' ' || author || ' ' || array_to_string(lines, ' ') 
WHERE search_text IS NULL;

-- 4. Create a GIN trgm index on the aggregated text (This might take ~30 seconds)
CREATE INDEX IF NOT EXISTS idx_poems_search_text_trgm ON poems USING gin (search_text gin_trgm_ops);

-- 5. Set the similarity threshold
SET pg_trgm.similarity_threshold = 0.2;

-- 6. Rewrite the search function to aggressively use the GIN index
CREATE OR REPLACE FUNCTION search_poems_fuzzy(query_text TEXT, max_results INT DEFAULT 20)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM poems p
  WHERE 
    p.search_text % query_text
    OR p.search_text ILIKE '%' || query_text || '%'
  ORDER BY 
    (p.search_text ILIKE '%' || query_text || '%') DESC,
    p.search_text <-> query_text ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- 7. Also recreate search_poems as a fallback for old frontend calls
CREATE OR REPLACE FUNCTION search_poems(query_text TEXT, max_results INT DEFAULT 20)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY SELECT * FROM search_poems_fuzzy(query_text, max_results);
END;
$$ LANGUAGE plpgsql;
