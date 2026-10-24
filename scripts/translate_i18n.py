# 보이는 가게 영상 중 videos.i18n이 비어 있는 것을 en/ja/zh-CN/zh-TW로 번역해 바로 DB에 쓴다.
# claude -p(sonnet, 구독)로만 번역한다(API·Codex 금지). 다시 돌려도 이미 번역된 영상은 건너뛴다.
#   set -a && source .env.local && set +a && python3 scripts/translate_i18n.py [동시 실행 수=3] [최대 영상 수]
import concurrent.futures as cf
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

U = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
K = os.environ['SUPABASE_SERVICE_ROLE_KEY']
H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json'}
LANGS = ('en', 'ja', 'zh-CN', 'zh-TW')
BATCH = 6
CLAUDE = os.path.expanduser('~/.local/bin/claude')
# 훅·MCP·도구 없이 글만 받는다
FLAGS = ['--model', 'sonnet', '--tools', '', '--strict-mcp-config', '--no-session-persistence']

PROMPT = """아래 JSON 배열은 한국 맛집 유튜브 영상 요약들이다. 한국 여행 온 외국인용으로 en, ja, zh-CN, zh-TW 네 언어로 번역해라.
규칙:
- 각 항목의 title, menu, price, why, detail 안의 모든 글을 번역한다. 키 구조는 그대로 둔다. null은 null로 둔다.
- detail.dishes[].ts, detail.dishes[].best 값과 detail.recommend 값(강추/추천/보통/아쉬움)은 바꾸지 않는다. recommend 뜻은 detail.recommend_label에 그 언어로 넣는다.
- store(가게 이름)는 번역하지 말고 store_label에 표기: en=로마자, ja=가타카나, zh=한자 음역 또는 의미가 분명하면 의역. category도 category_label로 번역.
- 메뉴 이름은 현지인이 알아듣게: en은 "Bulgogi (marinated beef)"처럼 로마자+괄호 설명, ja·zh는 현지에서 통하는 이름.
- 가격 숫자·원 단위는 유지(예: 12,000원 → ₩12,000).
- 결과에 한글을 남기지 않는다.
- 출력은 {"en":{"<id>":{...}},"ja":{...},"zh-CN":{...},"zh-TW":{...}} 형태 JSON 하나만. 설명·코드블록 없이.

"""


def req(method, path, body=None):
    r = urllib.request.Request(U + '/rest/v1/' + path, method=method, headers=H,
                               data=json.dumps(body, ensure_ascii=False).encode() if body is not None else None)
    # 번역 몇 분 동안 연결이 끊겨 SSL 오류가 난다. 번역은 비싸니 쓰기는 몇 번 다시 한다
    for i in range(5):
        try:
            with urllib.request.urlopen(r, timeout=60) as res:
                t = res.read()
                return json.loads(t) if t else None
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if i == 4:
                raise
            time.sleep(2 ** i)


def todo():
    rows = []
    for off in range(0, 100000, 1000):
        page = req('GET', 'videos?select=id,title,menu,price,why,detail,restaurants!inner(name,category,is_visible)'
                          f'&restaurants.is_visible=eq.true&i18n=is.null&order=id&offset={off}&limit=1000')
        rows += page
        if len(page) < 1000:
            return rows


def run(batch):
    src = [{k: r[k] for k in ('id', 'title', 'menu', 'price', 'why', 'detail')}
           | {'store': r['restaurants']['name'], 'category': r['restaurants']['category']} for r in batch]
    p = subprocess.run([CLAUDE, '-p', PROMPT + json.dumps(src, ensure_ascii=False), *FLAGS],
                       capture_output=True, text=True, timeout=900, cwd='/tmp')
    t = p.stdout.strip()
    d = json.loads(t[t.find('{'):t.rfind('}') + 1])
    n = 0
    for r in batch:
        one = {lang: d.get(lang, {}).get(str(r['id'])) for lang in LANGS}
        if all(one.values()):
            for lang in LANGS:
                one[lang]['store'] = r['restaurants']['name']
            req('PATCH', f"videos?id=eq.{r['id']}", {'i18n': one})
            n += 1
    return n


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    rows = todo()
    if len(sys.argv) > 2:
        rows = rows[:int(sys.argv[2])]
    print('todo', len(rows), flush=True)
    batches = [rows[i:i + BATCH] for i in range(0, len(rows), BATCH)]
    done = 0
    with cf.ThreadPoolExecutor(workers) as ex:
        for f in cf.as_completed([ex.submit(run, b) for b in batches]):
            try:
                done += f.result()
            except Exception as e:
                print('ERR', repr(e)[:200], flush=True)
            print('done', done, '/', len(rows), flush=True)


if __name__ == '__main__':
    main()
