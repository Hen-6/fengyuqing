#!/bin/bash
git add public/data/SUPER_DATASET_DEDUPED.json.gz
git commit -m "fix(dataset): rewrite parser to recursively unroll nested anthologies (e.g. 唐诗三百首) so poems aren't mashed into a single giant JSON string"
git push origin HEAD
