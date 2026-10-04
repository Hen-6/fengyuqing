#!/bin/bash
git add package.json pnpm-lock.yaml next.config.ts capacitor.config.ts ios
git commit -m "chore(ios): add Capacitor for iOS static export and native wrapper"
git push origin HEAD
