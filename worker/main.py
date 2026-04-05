#!/usr/bin/env python3
"""MukMap cron job entry point for GitHub Actions.

Unlike collect.py (local/manual), this reads env vars directly from
os.environ (injected by GitHub Actions secrets).
"""

import logging
import os
import random
import sys
import time

# Add worker dir to path for sibling imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from googleapiclient.discovery import build

from transcript_fetcher import fetch_transcript
from restaurant_extractor import extract_restaurants
from naver_search import search_restaurant
from supabase_client import (
    get_client,
    get_existing_video_ids,
    insert_to_queue,
    update_queue_status,
    upsert_restaurant,
    upsert_video,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CHANNELS = [
    {"id": "UCG_drWLe2Z0rf5lwqnsjCBw", "name": "돌시네아"},
    {"id": "UCyn-K7rZLXjGl7VXGweIlcA", "name": "백종원"},
    {"id": "UCl23-Cci_SMqyGXE1T_LYUg", "name": "성시경 먹을텐데"},
    {"id": "UCfpaSruWW3S4dibonKXENjA", "name": "쯔양"},
    {"id": "UCA6KBBX8cLwYZNepxlE_7SA", "name": "히밥"},
]

MAX_PER_CHANNEL = 10

HAIKU_INPUT_PRICE = 0.80
HAIKU_OUTPUT_PRICE = 4.00


def process_video(video: dict, db_client) -> dict:
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

    update_queue_status(db_client, video_id, "processing")

    # 1. Transcript
    transcript = fetch_transcript(video_id)
    if not transcript:
        logger.info("  No transcript")
        update_queue_status(db_client, video_id, "no_transcript")
        return stats

    # 2. Claude extraction
    restaurants, token_usage = extract_restaurants(transcript)
    stats["input_tokens"] = token_usage.get("input_tokens", 0)
    stats["output_tokens"] = token_usage.get("output_tokens", 0)

    if not restaurants:
        logger.info("  No restaurants found")
        update_queue_status(db_client, video_id, "no_restaurant")
        return stats

    stats["restaurants_found"] = len(restaurants)
    logger.info("  Found %d restaurants", len(restaurants))

    # 3. Naver search + DB save
    for rest in restaurants:
        location = search_restaurant(rest.get("name", ""), rest.get("address_hint", ""))
        stats["naver_calls"] += 1

        if location and location.get("lat") is not None:
            stats["with_coords"] += 1
            rest_data = {
                "name": location.get("name", rest["name"]),
                "address": location.get("address"),
                "lat": location.get("lat"),
                "lng": location.get("lng"),
                "category": rest.get("category", "기타"),
                "region": location.get("region"),
                "needs_review": False,
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

    update_queue_status(db_client, video_id, "done")
    return stats


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--video-id", type=str, help="특정 영상 하나만 처리")
    args = parser.parse_args()

    # Validate env vars
    required = [
        "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "YOUTUBE_API_KEY",
        "ANTHROPIC_API_KEY", "NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET",
    ]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.error("Missing env vars: %s", ", ".join(missing))
        sys.exit(1)

    db_client = get_client()
    youtube = build("youtube", "v3", developerKey=os.environ["YOUTUBE_API_KEY"])
    existing_ids = get_existing_video_ids(db_client)

    totals = {
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

    # --video-id: 특정 영상 하나만 처리
    if args.video_id:
        video = {"video_id": args.video_id, "title": "", "description": "", "channel_id": ""}
        try:
            resp = youtube.videos().list(part="snippet", id=args.video_id).execute()
            if resp.get("items"):
                snippet = resp["items"][0]["snippet"]
                video["title"] = snippet["title"]
                video["description"] = snippet.get("description", "")
                video["channel_id"] = snippet["channelId"]
        except Exception as e:
            logger.error("YouTube API error: %s", e)

        logger.info("Processing single video: %s (%s)", video["title"], args.video_id)
        insert_to_queue(db_client, args.video_id, video["channel_id"])
        stats = process_video(video, db_client)
        totals["videos_processed"] += 1
        for k in ["restaurants_found", "with_coords", "needs_review", "input_tokens", "output_tokens", "naver_calls"]:
            totals[k] += stats.get(k, 0)
        # summary
        input_cost = totals["input_tokens"] * HAIKU_INPUT_PRICE / 1_000_000
        output_cost = totals["output_tokens"] * HAIKU_OUTPUT_PRICE / 1_000_000
        print(f"\n=== 수집 결과 ===\n처리 영상: 1개\n추출 맛집: {totals['restaurants_found']}개\nClaude Haiku: ${input_cost + output_cost:.3f}")
        return

    # 1. Fetch new videos
    for channel in CHANNELS:
        logger.info("Fetching: %s", channel["name"])
        try:
            response = youtube.search().list(
                part="snippet",
                channelId=channel["id"],
                maxResults=MAX_PER_CHANNEL,
                order="date",
                type="video",
            ).execute()
            totals["youtube_units"] += 100

            for item in response.get("items", []):
                vid = item["id"]["videoId"]
                if vid not in existing_ids:
                    video = {
                        "video_id": vid,
                        "title": item["snippet"]["title"],
                        "thumbnail_url": item["snippet"]["thumbnails"].get("medium", {}).get("url"),
                        "published_at": item["snippet"]["publishedAt"],
                        "channel_id": channel["id"],
                    }
                    insert_to_queue(db_client, vid, channel["id"])
                    all_new_videos.append(video)
                    existing_ids.add(vid)

            logger.info("  %d new videos", sum(1 for v in all_new_videos if v["channel_id"] == channel["id"]))
        except Exception as e:
            logger.error("YouTube API error for %s: %s", channel["name"], e)

    # 2. Process videos
    for i, video in enumerate(all_new_videos):
        try:
            stats = process_video(video, db_client)
            totals["videos_processed"] += 1
            totals["restaurants_found"] += stats["restaurants_found"]
            totals["with_coords"] += stats["with_coords"]
            totals["needs_review"] += stats["needs_review"]
            totals["input_tokens"] += stats["input_tokens"]
            totals["output_tokens"] += stats["output_tokens"]
            totals["naver_calls"] += stats["naver_calls"]
        except Exception as e:
            logger.error("Failed to process %s: %s", video["video_id"], e)
            try:
                update_queue_status(db_client, video["video_id"], "failed", str(e))
            except Exception:
                pass

        if i < len(all_new_videos) - 1:
            time.sleep(random.uniform(2, 5))

    # Summary
    input_cost = totals["input_tokens"] * HAIKU_INPUT_PRICE / 1_000_000
    output_cost = totals["output_tokens"] * HAIKU_OUTPUT_PRICE / 1_000_000
    total_cost = input_cost + output_cost

    print("\n=== 수집 결과 ===")
    print(f"처리 영상: {totals['videos_processed']}개")
    print(
        f"추출 맛집: {totals['restaurants_found']}개 "
        f"(좌표 있음: {totals['with_coords']}, 보정 필요: {totals['needs_review']})"
    )
    print(
        f"Claude Haiku: input {totals['input_tokens']} tokens, "
        f"output {totals['output_tokens']} tokens (${total_cost:.3f})"
    )
    print(f"네이버 검색: {totals['naver_calls']}회")
    print(f"YouTube API: {totals['youtube_units']} units")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error("Cron job failed: %s", e)
        # Exit 0 to prevent cron failure alerts
        sys.exit(0)
