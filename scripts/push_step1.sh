#!/bin/bash
git add package.json pnpm-lock.yaml src/workers/searchWorker.ts src/lib/dbSearch.ts
git commit -m "feat(offline): migrate search engine to frontend Web Worker with pako decompression for offline support"
git push origin HEAD
