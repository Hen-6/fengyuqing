CREATE OR REPLACE FUNCTION search_poems_body_rough(query_text TEXT, max_results INT DEFAULT 5)
RETURNS SETOF poems AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM poems p
  WHERE array_to_string(p.lines, '') LIKE query_text
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
