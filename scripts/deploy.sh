#!/bin/bash
# 프로덕션 배포 후 IndexNow로 sitemap 주소를 네이버·빙에 알린다(키 파일: public/<32자 hex>.txt)
set -e
cd "$(dirname "$0")/.."
vercel --prod --yes
# 배포하면 캐시가 비어 첫 손님(토스 첫 실행)이 몇 초를 기다린다. 미리 한 번씩 불러 둔다
for u in /api/pins /api/channels /; do curl -s -o /dev/null --compressed "https://mukmap.kr$u" || true; done
KEY=$(ls public | sed -nE 's/^([0-9a-f]{32})\.txt$/\1/p' | head -1)
python3 ~/.claude/skills/site-launch/scripts/indexnow.py mukmap.kr "$KEY" https://mukmap.kr/sitemap.xml || echo "indexnow 실패(배포는 완료)"
