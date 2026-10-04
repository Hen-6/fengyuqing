#!/bin/bash
git add src/app/progress/page.tsx src/app/api
git commit -m "fix(build): remove deprecated /api/poem endpoint and replace its usage in progress page with offline web worker to support capacitor static export"
git push origin HEAD
