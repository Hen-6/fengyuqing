#!/bin/bash
git add src/workers/searchWorker.ts
git commit -m "fix(worker): bust browser cache for dataset to ensure clients download the new comprehensive dataset instead of using stale local cache"
git push origin HEAD
