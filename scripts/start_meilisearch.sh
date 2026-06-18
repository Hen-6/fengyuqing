#!/bin/bash
set -e

MEILI_VERSION="v1.43.0"
MEILI_FILE="meilisearch-macos-apple-silicon"
DATA_DIR="./data/meilisearch_data"
API_KEY="fengyuqing_dev"

mkdir -p "$DATA_DIR"

if [ ! -f "./meilisearch" ]; then
  echo "下载 Meilisearch $MEILI_VERSION..."
  curl -L "https://github.com/meilisearch/meilisearch/releases/download/${MEILI_VERSION}/${MEILI_FILE}" -o ./meilisearch
  chmod +x ./meilisearch
else
  echo "Meilisearch 二进制已存在，跳过下载"
fi

# 检查是否已经在运行
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7700/health -H "Authorization: Bearer $API_KEY" | grep -q "200"; then
  echo "Meilisearch 已在运行，跳过启动"
else
  echo "启动 Meilisearch（数据目录: $DATA_DIR）..."
  ./meilisearch --http-addr 127.0.0.1:7700 --master-key="$API_KEY" --db-path="$DATA_DIR" &
  MEILI_PID=$!
  echo "Meilisearch 已启动 (PID: $MEILI_PID)"
  echo "等待服务就绪..."
  sleep 5
fi

# 检查索引是否存在
INDEX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  http://127.0.0.1:7700/indexes/poems \
  -H "Authorization: Bearer $API_KEY")

if [ "$INDEX_STATUS" = "200" ]; then
  echo "poems 索引已存在，跳过创建"
else
  echo "创建 poems 索引..."
  curl -X POST 'http://127.0.0.1:7700/indexes' \
    -H "Authorization: Bearer $API_KEY" \
    -H 'Content-Type: application/json' \
    --data '{"uid":"poems","primaryKey":"id"}' \
    > /dev/null 2>&1
  sleep 1

  echo "配置 poems 索引（searchableAttributes, filterableAttributes）..."
  curl -X PATCH 'http://127.0.0.1:7700/indexes/poems/settings' \
    -H "Authorization: Bearer $API_KEY" \
    -H 'Content-Type: application/json' \
    --data '{
      "searchableAttributes": ["titleAuthor", "lines"],
      "filterableAttributes": ["dynasty", "author", "inLibrary"],
      "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"]
    }' \
    > /dev/null 2>&1
  echo "索引配置完成"
fi

echo ""
echo "=== Meilisearch 启动完成 ==="
echo "API 地址: http://127.0.0.1:7700"
echo "API Key:  $API_KEY"
echo "索引名:    poems"
echo ""
echo "下一步："
echo "  python3 scripts/index_meilisearch.py"
echo ""
