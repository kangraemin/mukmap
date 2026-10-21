"""전국 철도·지하철역 목록(lib/stations.json)을 만든다. 역 검색이 서버를 거치지 않고 바로 뜨게 하려고 앱에 넣는다.

- 역 위치: OpenStreetMap(© OpenStreetMap contributors, ODbL) railway=station
- 이름이 같은 역이 멀리 떨어져 있으면(부산 시청·서울 시청) 가까운 가게의 지역을 붙여 가른다
- 다시 만들기: python3 scripts/build_stations.py
"""
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'lib' / 'stations.json'
UA = {'User-Agent': 'mukmap-station-build/1.0 (https://mukmap.kr)'}
QUERY = '[out:json][timeout:150];area["ISO3166-1"="KR"][admin_level=2]->.k;node["railway"="station"](area.k);out;'
# 같은 역의 노선별 점은 수백 m 안에 있다. 이보다 멀면 다른 역으로 본다
SAME_KM = 3


def get(url, data=None, tries=4):
    req = urllib.request.Request(url, data=data, headers=UA)
    for n in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=200) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            # Overpass는 붐비면 502·504·429를 준다
            if n == tries - 1 or e.code not in (429, 502, 503, 504):
                raise
            time.sleep(20)


def km(a, b):
    dy = (a[0] - b[0]) * 111
    dx = (a[1] - b[1]) * 111 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def main():
    osm = get('https://overpass-api.de/api/interpreter', urllib.parse.urlencode({'data': QUERY}).encode())['elements']
    pins = [(p['lat'], p['lng'], p['region'] or '', p['city'] or '')
            for p in get('https://mukmap.kr/api/pins')['pins']]

    groups = defaultdict(list)
    for e in osm:
        name = (e['tags'].get('name:ko') or e['tags'].get('name') or '').strip()
        # '서울역'처럼 이미 역이 붙은 이름, '총신대입구(이수)' 같은 다른 이름은 앞 이름만 쓴다
        name = name.split('(')[0].strip().removesuffix('역')
        if not name:
            continue
        here = (round(e['lat'], 5), round(e['lon'], 5))
        if not any(km(here, s) < SAME_KM for s in groups[name]):
            groups[name].append(here)

    rows = []
    for name, spots in sorted(groups.items()):
        if len(spots) == 1:
            rows.append([name, *spots[0]])
            continue
        # 시도로 가르고, 시도까지 같으면 시군구를 붙인다
        near = []
        for s in spots:
            p = min(pins, key=lambda p: km(s, p[:2]))
            near.append(p[2:] if km(s, p[:2]) < 15 else ('', ''))
        for s, (region, city) in zip(spots, near):
            twin = sum(r == region for r, _ in near) > 1
            hint = ' '.join(x for x in (region, city if twin else '') if x)
            rows.append([name, *s, hint] if hint else [name, *s])
    OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(rows)}개 역 → {OUT}')


if __name__ == '__main__':
    main()
