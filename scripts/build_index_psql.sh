export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
echo "Testing connection..."
psql "postgresql://postgres:20070529_Henry\!@db.fpaaepzooyjeeevloiyb.supabase.co:5432/postgres" -c "SELECT 1;"

echo "Building index..."
psql "postgresql://postgres:20070529_Henry\!@db.fpaaepzooyjeeevloiyb.supabase.co:5432/postgres" -c "SET statement_timeout = 0; CREATE INDEX CONCURRENTLY IF NOT EXISTS poems_lines_trgm_idx ON poems USING gin (array_to_string_immutable(lines) gin_trgm_ops);"

echo "Index built! Verifying..."
psql "postgresql://postgres:20070529_Henry\!@db.fpaaepzooyjeeevloiyb.supabase.co:5432/postgres" -c "\d poems"
