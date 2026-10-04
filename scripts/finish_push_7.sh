#!/bin/bash
git add src/workers/searchWorker.ts
git commit -m "fix(build): resolve pako type errors and import issues causing vercel deployment failure"
git push origin HEAD
