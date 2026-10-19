#!/bin/bash
# 프로덕션 배포 후 IndexNow로 sitemap 주소를 네이버·빙에 알린다(키 파일: public/<32자 hex>.txt)
set -e
cd "$(dirname "$0")/.."
vercel --prod --yes
KEY=$(ls public | sed -nE 's/^([0-9a-f]{32})\.txt$/\1/p' | head -1)
python3 ~/.claude/skills/site-launch/scripts/indexnow.py mukmap.kr "$KEY" https://mukmap.kr/sitemap.xml || echo "indexnow 실패(배포는 완료)"
