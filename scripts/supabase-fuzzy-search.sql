-- Run this in your Supabase SQL Editor

-- 1. Enable the pg_trgm extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create an index to make fuzzy searches fast (if the poems table gets large)
-- Note: 'lines' is usually JSONB or array, we need a text column or cast it.
-- Let's create a generated column that combines title, author, and lines for search.
ALTER TABLE poems ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
  title || ' ' || author || ' ' || array_to_string(lines, '')
) STORED;

CREATE INDEX IF NOT EXISTS poems_search_text_trgm_idx ON poems USING GIN (search_text gin_trgm_ops);

-- 3. Create the fuzzy search RPC function
CREATE OR REPLACE FUNCTION search_poems_fuzzy(query_text text, max_results int)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM poems
  WHERE search_text % query_text -- % is the similarity operator
  ORDER BY similarity(search_text, query_text) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
