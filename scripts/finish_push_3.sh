#!/bin/bash
git add src/components/games/XunhuaGame.tsx
git commit -m "fix(xunhua): add resilient fallback to demo keys if user's learned poems contain deprecated keys that no longer exist in the new dataset"
git push origin HEAD
