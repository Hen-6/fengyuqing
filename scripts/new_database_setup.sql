-- 1. Wipe out old tables
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS poems CASCADE;
DROP FUNCTION IF EXISTS search_poems_fuzzy;

-- 2. Enable fuzzystrmatch extension for typo tolerance (edit distance)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- 3. Create the poems table
CREATE TABLE poems (
    id VARCHAR(32) PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    dynasty VARCHAR(50) DEFAULT '',
    lines TEXT[] NOT NULL
);

-- 4. Create user progress table
CREATE TABLE user_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    poem_id VARCHAR(255) NOT NULL,
    level INT NOT NULL DEFAULT 1,
    next_review DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, poem_id)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own progress" ON user_progress
    FOR ALL USING (auth.uid() = user_id);

-- 5. Create the exact typo-tolerant search RPC
CREATE OR REPLACE FUNCTION search_poems_fuzzy(query_text TEXT, max_results INT DEFAULT 20)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.*
  FROM poems p
  -- Check if there's a match in the lines
  LEFT JOIN LATERAL unnest(p.lines) AS line ON true
  WHERE 
    -- 1. Exact or partial match in Title or Author (fast)
    p.title LIKE '%' || query_text || '%'
    OR p.author LIKE '%' || query_text || '%'
    
    -- 2. Line-level Typo Tolerance: 
    -- If the length is similar, allow up to 2 typos/missing characters!
    OR (
        length(line) BETWEEN length(query_text) - 2 AND length(query_text) + 2
        AND levenshtein(line, query_text) <= 2
    )
    
    -- 3. Just in case they type a valid substring of a line perfectly
    OR line LIKE '%' || query_text || '%'
    
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
