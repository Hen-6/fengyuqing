#!/bin/bash
set -e

if [ ! -d "chinese-poetry" ]; then
  echo "Cloning chinese-poetry repository..."
  git clone --depth 1 https://github.com/chinese-poetry/chinese-poetry.git
else
  echo "chinese-poetry repository already exists."
fi

echo "Parsing poems into data/meilisearch_poems.json..."
python3 scripts/parse_chinese_poetry.py
echo "Done! You can now run scripts/upload_poems_supabase.js to upload to Supabase."
