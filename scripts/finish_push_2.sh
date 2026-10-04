#!/bin/bash
git add src/lib/dbSearch.ts
git commit -m "fix(performance): rip out redundant Supabase 'hydration' queries from dbSearch.ts which were causing 10-15s timeouts on every step of the game"
git push origin HEAD
