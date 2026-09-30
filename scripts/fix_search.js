const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
-- Enable pg_trgm for fast text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create an aggregated text column for ultra-fast indexing
ALTER TABLE poems ADD COLUMN IF NOT EXISTS search_text TEXT;
UPDATE poems SET search_text = title || ' ' || author || ' ' || array_to_string(lines, ' ') WHERE search_text IS NULL;

-- Create a GIN trgm index on the aggregated text
CREATE INDEX IF NOT EXISTS idx_poems_search_text_trgm ON poems USING gin (search_text gin_trgm_ops);

-- Rewrite the search function to aggressively use the GIN index
CREATE OR REPLACE FUNCTION search_poems_fuzzy(query_text TEXT, max_results INT DEFAULT 20)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM poems p
  WHERE 
    -- pg_trgm similarity operator utilizes the GIN index perfectly
    p.search_text % query_text
    OR p.search_text ILIKE '%' || query_text || '%'
  ORDER BY 
    (p.search_text ILIKE '%' || query_text || '%') DESC,
    p.search_text <-> query_text ASC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_poems(query_text TEXT, max_results INT DEFAULT 20)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY SELECT * FROM search_poems_fuzzy(query_text, max_results);
END;
$$ LANGUAGE plpgsql;
`;
// ...
