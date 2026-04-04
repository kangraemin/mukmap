#!/usr/bin/env python3
"""MukMap data collection script.

Usage:
    python worker/collect.py                    # full run
    python worker/collect.py --dry-run          # no DB writes
    python worker/collect.py --max-per-channel 5
"""

import argparse
import logging
import os
import random
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from googleapiclient.discovery import build

from transcript_fetcher import fetch_transcript
from restaurant_extractor import extract_restaurants
from naver_search import search_restaurant

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Channels to collect from
CHANNELS = [
    {"id": "UCG_drWLe2Z0rf5lwqnsjCBw", "name": "돌시네아"},
    {"id": "UCyn-K7rZLXjGl7VXGweIlcA", "name": "백종원"},
    {"id": "UCl23-Cci_SMqyGXE1T_LYUg", "name": "성시경 먹을텐데"},
    {"id": "UCfpaSruWW3S4dibonKXENjA", "name": "쯔양"},
    {"id": "UCA6KBBX8cLwYZNepxlE_7SA", "name": "히밥"},
]

# Claude Haiku pricing (per million tokens)
HAIKU_INPUT_PRICE = 0.80   # $/M input tokens
HAIKU_OUTPUT_PRICE = 4.00  # $/M output tokens


def load_env():
    """Load environment variables from .env and .env.local."""
    project_root = Path(__file__).resolve().parent.parent
    load_dotenv(project_root / ".env")
    load_dotenv(project_root / ".env.local", override=False)


def get_youtube_service():
    return build("youtube", "v3", developerKey=os.environ["YOUTUBE_API_KEY"])


def fetch_channel_videos(youtube, channel_id: str, max_results: int = 10) -> list[dict]:
    """Fetch recent videos from a YouTube channel."""
    try:
        response = youtube.search().list(
            part="snippet",
            channelId=channel_id,
            maxResults=max_results,
            order="date",
            type="video",
        ).execute()

        videos = []
        for item in response.get("items", []):
            videos.append({
                "video_id": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "thumbnail_url": item["snippet"]["thumbnails"].get("medium", {}).get("url"),
                "published_at": item["snippet"]["publishedAt"],
                "channel_id": channel_id,
            })
        return videos
    except Exception as e:
        logger.error("YouTube API error for channel %s: %s", channel_id, e)
        return []


def process_video(video: dict, dry_run: bool, db_client) -> dict:
    """Process a single video: transcript → Claude → Naver → DB.

    Returns stats dict.
    """
    stats = {
        "restaurants_found": 0,
        "with_coords": 0,
        "needs_review": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "naver_calls": 0,
    }

    video_id = video["video_id"]
    logger.info("Processing: %s (%s)", video["title"], video_id)

    if not dry_run:
        from supabase_client import update_queue_status
        update_queue_status(db_client, video_id, "processing")

    # 1. Fetch transcript
    transcript = fetch_transcript(video_id)
    if not transcript:
        logger.info("  No transcript available")
        if not dry_run:
            from supabase_client import update_queue_status
            update_queue_status(db_client, video_id, "no_transcript")
        return stats

    # 2. Extract restaurants via Claude
    restaurants, token_usage = extract_restaurants(transcript)
    stats["input_tokens"] = token_usage.get("input_tokens", 0)
    stats["output_tokens"] = token_usage.get("output_tokens", 0)

    if not restaurants:
        logger.info("  No restaurants found in transcript")
        if not dry_run:
            from supabase_client import update_queue_status
            update_queue_status(db_client, video_id, "no_restaurant")
        return stats

    stats["restaurants_found"] = len(restaurants)
    logger.info("  Found %d restaurants", len(restaurants))

    # 3. For each restaurant: Naver search → DB
    for rest in restaurants:
        location = search_restaurant(rest.get("name", ""), rest.get("address_hint", ""))
        stats["naver_calls"] += 1

        if location:
            has_coords = location.get("lat") is not None
            if has_coords:
                stats["with_coords"] += 1
            else:
                stats["needs_review"] += 1

            rest_data = {
                "name": location.get("name", rest["name"]),
                "address": location.get("address"),
                "lat": location.get("lat"),
                "lng": location.get("lng"),
                "category": rest.get("category", "기타"),
                "region": location.get("region"),
                "needs_review": not has_coords,
            }
        else:
            stats["needs_review"] += 1
            rest_data = {
                "name": rest["name"],
                "address": None,
                "lat": None,
                "lng": None,
                "category": rest.get("category", "기타"),
                "region": None,
                "needs_review": True,
            }

        if dry_run:
            logger.info(
                "  [DRY-RUN] Restaurant: %s (%s) lat=%s lng=%s",
                rest_data["name"],
                rest_data.get("region", "?"),
                rest_data.get("lat"),
                rest_data.get("lng"),
            )
        else:
            from supabase_client import upsert_restaurant, upsert_video
            rest_id = upsert_restaurant(db_client, rest_data)
            upsert_video(db_client, {
                "video_id": video_id,
                "channel_id": video["channel_id"],
                "restaurant_id": rest_id,
                "title": video.get("title"),
                "thumbnail_url": video.get("thumbnail_url"),
                "rating": rest.get("rating"),
                "summary": rest.get("summary"),
                "is_ad": rest.get("is_ad", False),
                "timestamp_seconds": rest.get("timestamp_seconds"),
                "published_at": video.get("published_at"),
            })

    if not dry_run:
        from supabase_client import update_queue_status
        update_queue_status(db_client, video_id, "done")

    return stats


def main():
    parser = argparse.ArgumentParser(description="MukMap data collector")
    parser.add_argument("--max-per-channel", type=int, default=10)
    parser.add_argument("--dry-run", action="store_true", help="No DB writes")
    args = parser.parse_args()

    load_env()

    # Validate required env vars
    required = ["YOUTUBE_API_KEY", "ANTHROPIC_API_KEY", "NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET"]
    if not args.dry_run:
        required += ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing env vars: %s", ", ".join(missing))
        sys.exit(1)

    # DB client (None in dry-run)
    db_client = None
    if not args.dry_run:
        from supabase_client import get_client, get_existing_video_ids, insert_to_queue
        db_client = get_client()
        existing_ids = get_existing_video_ids(db_client)
    else:
        existing_ids = set()

    youtube = get_youtube_service()

    # Totals
    total_stats = {
        "videos_processed": 0,
        "restaurants_found": 0,
        "with_coords": 0,
        "needs_review": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "naver_calls": 0,
        "youtube_units": 0,
    }

    all_new_videos = []

    # 1. Fetch new videos from each channel
    for channel in CHANNELS:
        logger.info("Fetching videos for: %s", channel["name"])
        videos = fetch_channel_videos(youtube, channel["id"], args.max_per_channel)
        total_stats["youtube_units"] += 100  # search.list = 100 units

        new_videos = [v for v in videos if v["video_id"] not in existing_ids]
        logger.info("  %d new videos (of %d)", len(new_videos), len(videos))

        if not args.dry_run and new_videos:
            for v in new_videos:
                insert_to_queue(db_client, v["video_id"], v["channel_id"])

        all_new_videos.extend(new_videos)

    # 2. Process videos
    for i, video in enumerate(all_new_videos):
        stats = process_video(video, args.dry_run, db_client)

        total_stats["videos_processed"] += 1
        total_stats["restaurants_found"] += stats["restaurants_found"]
        total_stats["with_coords"] += stats["with_coords"]
        total_stats["needs_review"] += stats["needs_review"]
        total_stats["input_tokens"] += stats["input_tokens"]
        total_stats["output_tokens"] += stats["output_tokens"]
        total_stats["naver_calls"] += stats["naver_calls"]

        # Rate limit delay between videos
        if i < len(all_new_videos) - 1:
            delay = random.uniform(2, 5)
            logger.debug("Sleeping %.1fs", delay)
            time.sleep(delay)

    # Summary
    input_cost = total_stats["input_tokens"] * HAIKU_INPUT_PRICE / 1_000_000
    output_cost = total_stats["output_tokens"] * HAIKU_OUTPUT_PRICE / 1_000_000
    total_cost = input_cost + output_cost

    print("\n=== 수집 결과 ===")
    print(f"처리 영상: {total_stats['videos_processed']}개")
    print(
        f"추출 맛집: {total_stats['restaurants_found']}개 "
        f"(좌표 있음: {total_stats['with_coords']}, 보정 필요: {total_stats['needs_review']})"
    )
    print(
        f"Claude Haiku: input {total_stats['input_tokens']} tokens, "
        f"output {total_stats['output_tokens']} tokens (${total_cost:.3f})"
    )
    print(f"네이버 검색: {total_stats['naver_calls']}회")
    print(f"YouTube API: {total_stats['youtube_units']} units")

    if args.dry_run:
        print("\n[DRY-RUN 모드] DB 저장 없음")


if __name__ == "__main__":
    main()
