#!/bin/bash
git add src/workers/searchWorker.ts src/components/games/XunhuaGame.tsx
git commit -m "fix(worker): add fuzzy matching fallback in GET_POEM to gracefully migrate old user progress keys to new dataset titles, fixing learning details and xunhua extraction"
git push origin HEAD
