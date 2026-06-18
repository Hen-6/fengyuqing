-- 1. Enable pg_trgm extension for fast fuzzy text searching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create the poems table
CREATE TABLE IF NOT EXISTS poems (
    id VARCHAR(32) PRIMARY KEY, -- MD5 hash of "title:author"
    key VARCHAR(255) UNIQUE NOT NULL, -- "title:author"
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    dynasty VARCHAR(50) DEFAULT '',
    lines TEXT[] NOT NULL
);

-- 3. Create GIN indices on title and author for fast trigram search
CREATE INDEX IF NOT EXISTS idx_poems_title_trgm ON poems USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_poems_author_trgm ON poems USING gin (author gin_trgm_ops);

-- 4. Create user progress table
CREATE TABLE IF NOT EXISTS user_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    poem_id VARCHAR(255) NOT NULL, -- "title:author"
    level INT NOT NULL DEFAULT 1,
    next_review DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, poem_id)
);

-- 5. Enable Row Level Security (RLS) on user_progress
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policy for user_progress (users can only see and manage their own progress)
CREATE POLICY "Users can manage their own progress" ON user_progress
    FOR ALL USING (auth.uid() = user_id);

-- 7. Create search_poems RPC function for fast title, author, and line search
CREATE OR REPLACE FUNCTION search_poems(query_text TEXT, max_results INT DEFAULT 20)
RETURNS TABLE (
    id VARCHAR(32),
    key VARCHAR(255),
    title VARCHAR(255),
    author VARCHAR(255),
    dynasty VARCHAR(50),
    lines TEXT[]
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.key, p.title, p.author, p.dynasty, p.lines
    FROM poems p
    WHERE p.title ILIKE '%' || query_text || '%'
       OR p.author ILIKE '%' || query_text || '%'
       OR EXISTS (
           SELECT 1 FROM unnest(p.lines) line 
           WHERE line ILIKE '%' || query_text || '%'
       )
    LIMIT max_results;
END;
$$;
