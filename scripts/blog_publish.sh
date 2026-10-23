#!/usr/bin/env bash
# 블로그 글 하나를 검사하고 그 파일만 커밋·푸시·배포한다. 사용: bash scripts/blog_publish.sh content/blog/<slug>.md
set -euo pipefail
cd "$(dirname "$0")/.."
f="${1:?사용: bash scripts/blog_publish.sh content/blog/<slug>.md}"
node scripts/blog_check.mjs "$f"
slug="$(basename "$f" .md)"
git add -- "$f"
if git diff --cached --quiet -- "$f"; then
  echo "바뀐 내용 없음: $f"
else
  git commit -m "feat: 블로그 글 $slug" -- "$f"
fi
git push
bash scripts/deploy.sh
echo "PUBLISHED https://mukmap.kr/blog/$slug"
