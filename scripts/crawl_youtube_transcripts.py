#!/usr/bin/env python3
"""YouTube transcript crawler using Playwright.

Usage:
    python scripts/crawl_youtube_transcripts.py --channel dulcinea_studio --days 7 --max-videos 5
    python scripts/crawl_youtube_transcripts.py --channel all --headless
"""
import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

CHANNELS = [
    {"id": "UCehQiKylaW68H_OtRS36wGQ", "slug": "dulcinea_studio", "name": "둘시네아"},
    {"id": "UCfpaSruWW3S4dibonKXENjA", "slug": "tzuyang",          "name": "쯔양"},
    {"id": "UCzgpOnor-MzT-1iflZil2GQ", "slug": "jaesunrang",       "name": "재선랑"},
    {"id": "UC-OAmhcFgX9t_OF6fQ-4B1w", "slug": "kimjjamppong",     "name": "김쨈뽕"},
    {"id": "UC-x55HF1-IilhxZOzwJm7JA", "slug": "kimsawon",         "name": "김사원"},
]


def parse_args():
    p = argparse.ArgumentParser(description="YouTube transcript crawler (Playwright)")
    p.add_argument("--channel", default="all",
                   help="Channel slug(s), comma-separated, or 'all' (default: all)")
    p.add_argument("--days", type=int, default=0,
                   help="Only collect videos uploaded within N days (0 = no limit)")
    p.add_argument("--max-videos", type=int, default=0,
                   help="Max videos per channel (0 = no limit)")
    p.add_argument("--headless", action="store_true",
                   help="Run in headless mode (default: show browser window)")
    p.add_argument("--output-dir", default="rawdata/transcripts",
                   help="Output directory (default: rawdata/transcripts)")
    p.add_argument("--no-skip-existing", action="store_true",
                   help="Re-collect even if transcript txt already exists")
    return p.parse_args()


def filter_channels(channel_arg: str) -> list[dict]:
    if channel_arg == "all":
        return CHANNELS
    slugs = [s.strip() for s in channel_arg.split(",")]
    result = []
    slug_set = {ch["slug"] for ch in CHANNELS}
    for slug in slugs:
        if slug not in slug_set:
            print(f"[ERROR] Unknown channel slug: '{slug}'", file=sys.stderr)
            print(f"  Available: {', '.join(sorted(slug_set))}", file=sys.stderr)
            sys.exit(1)
        result.append(next(ch for ch in CHANNELS if ch["slug"] == slug))
    return result


def parse_age_days(meta: str) -> int | None:
    """Parse Korean age strings like '3일 전', '2주 전' -> approximate days."""
    m = re.search(r"(\d+)\s*(초|분|시간|일|주|개월|년)\s*전", meta)
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    return {"초": 0, "분": 0, "시간": 0, "일": n, "주": n * 7, "개월": n * 30, "년": n * 365}[unit]


def get_channel_videos(page, channel_id: str, max_videos: int, days_limit: int) -> list[dict]:
    """Scroll channel /videos page and collect video entries."""
    url = f"https://www.youtube.com/channel/{channel_id}/videos"
    page.goto(url, wait_until="networkidle", timeout=30000)
    time.sleep(2)

    videos = []
    seen_vids: set[str] = set()
    last_count = 0
    cutoff_reached = False

    while not cutoff_reached:
        items = page.query_selector_all("ytd-rich-item-renderer")
        for item in items:
            try:
                a = item.query_selector("a#video-title-link")
                if not a:
                    continue
                href = a.get_attribute("href") or ""
                vid_match = re.search(r"[?&]v=([\w-]{11})", href)
                if not vid_match:
                    continue
                vid = vid_match.group(1)
                if vid in seen_vids:
                    continue
                seen_vids.add(vid)

                title = (a.get_attribute("title") or a.inner_text()).strip()
                url_full = f"https://www.youtube.com/watch?v={vid}"
                meta_el = item.query_selector("#metadata-line")
                meta = meta_el.inner_text().strip() if meta_el else ""

                if days_limit > 0:
                    age = parse_age_days(meta)
                    if age is not None and age > days_limit:
                        cutoff_reached = True
                        break

                videos.append({"url": url_full, "vid": vid, "title": title, "meta": meta})
                if max_videos > 0 and len(videos) >= max_videos:
                    return videos
            except Exception:
                continue

        if cutoff_reached:
            break
        current_count = len(items)
        if current_count == last_count:
            break
        last_count = current_count
        page.evaluate("window.scrollBy(0, 2000)")
        time.sleep(1.5)

    return videos


def get_transcript(page, vid: str) -> list[dict] | None:
    """Open video, click transcript button, extract segments."""
    page.goto(f"https://www.youtube.com/watch?v={vid}", wait_until="networkidle", timeout=30000)
    time.sleep(2)

    # Expand description
    try:
        expand = page.query_selector("tp-yt-paper-button#expand, ytd-text-inline-expander #expand")
        if expand:
            expand.click()
            time.sleep(0.5)
    except Exception:
        pass

    # Click transcript button
    clicked = False
    for selector in [
        "button[aria-label*='스크립트']",
        "button[aria-label*='transcript']",
        "button[aria-label*='Transcript']",
    ]:
        try:
            btn = page.query_selector(selector)
            if btn:
                btn.click()
                clicked = True
                break
        except Exception:
            continue

    if not clicked:
        try:
            page.click("ytd-video-description-transcript-section-renderer button", timeout=3000)
            clicked = True
        except Exception:
            pass

    if not clicked:
        return None

    try:
        page.wait_for_selector("ytd-transcript-segment-renderer", timeout=10000)
    except PlaywrightTimeout:
        return None

    segments = page.query_selector_all("ytd-transcript-segment-renderer")
    result = []
    for seg in segments:
        try:
            ts_el = seg.query_selector(".segment-timestamp")
            text_el = seg.query_selector(".segment-text")
            if not ts_el or not text_el:
                continue
            ts = ts_el.inner_text().strip()
            text = text_el.inner_text().strip()
            if text:
                result.append({"timestamp": ts, "text": text})
        except Exception:
            continue
    return result or None


def save_transcript(out_dir: str, slug: str, vid: str, title: str, url: str, segments: list[dict]):
    path = Path(out_dir) / slug / f"{vid}.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    collected_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    lines = [title, url, f"video_id: {vid}", f"collected_at: {collected_at}", ""]
    for s in segments:
        lines.append(f"{s['timestamp']} {s['text']}")
    path.write_text("\n".join(lines), encoding="utf-8")


def save_list_json(out_dir: str, slug: str, videos: list[dict]):
    path = Path(out_dir) / slug / "_list.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    collected_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    entries = [{**v, "collected_at": collected_at} for v in videos]
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    args = parse_args()
    channels = filter_channels(args.channel)
    skip_existing = not args.no_skip_existing

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})

        for ch in channels:
            print(f"\n===== {ch['name']} ({ch['slug']}) =====")
            videos = get_channel_videos(page, ch["id"], args.max_videos, args.days)
            print(f"  수집 영상: {len(videos)}개")
            save_list_json(args.output_dir, ch["slug"], videos)

            ok = skip = fail = 0
            for v in videos:
                out_path = Path(args.output_dir) / ch["slug"] / f"{v['vid']}.txt"
                if skip_existing and out_path.exists():
                    skip += 1
                    continue
                segments = get_transcript(page, v["vid"])
                if segments:
                    save_transcript(args.output_dir, ch["slug"], v["vid"], v["title"], v["url"], segments)
                    ok += 1
                    print(f"  ✅ {v['vid']} ({len(segments)} segments)")
                else:
                    fail += 1
                    print(f"  ❌ {v['vid']} (transcript unavailable)")

            print(f"  완료: ok={ok} skip={skip} fail={fail}")

        browser.close()


if __name__ == "__main__":
    main()
