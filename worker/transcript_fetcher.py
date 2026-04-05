import json
import logging
import subprocess
import tempfile
import os

logger = logging.getLogger(__name__)


def fetch_transcript(video_id: str) -> list[dict] | None:
    """Fetch transcript for a YouTube video using yt-dlp.

    Returns list of {"text": str, "start": float} or None if unavailable.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, "sub")

        # Try Korean subs first, then auto-generated
        for sub_args in [
            ["--write-sub", "--sub-lang", "ko"],
            ["--write-auto-sub", "--sub-lang", "ko"],
            ["--write-auto-sub"],  # any language
        ]:
            cmd = [
                "yt-dlp",
                "--skip-download",
                "--sub-format", "json3",
                *sub_args,
                "-o", output_template,
                url,
            ]

            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
            except subprocess.TimeoutExpired:
                logger.warning("yt-dlp timeout for %s", video_id)
                continue

            # Find the generated subtitle file
            sub_files = [
                f for f in os.listdir(tmpdir)
                if f.endswith(".json3")
            ]

            if sub_files:
                sub_path = os.path.join(tmpdir, sub_files[0])
                try:
                    with open(sub_path) as f:
                        data = json.load(f)
                    segments = _parse_json3(data)
                    if segments:
                        return segments
                except (json.JSONDecodeError, KeyError) as e:
                    logger.warning("Failed to parse subtitle for %s: %s", video_id, e)
                    continue

            # Clean up for next attempt
            for f in os.listdir(tmpdir):
                os.remove(os.path.join(tmpdir, f))

    logger.warning("No transcript for %s", video_id)
    return None


def _parse_json3(data: dict) -> list[dict] | None:
    """Parse JSON3 timedtext format into list of {text, start}."""
    events = data.get("events", [])
    segments = []
    for event in events:
        t_start_ms = event.get("tStartMs")
        segs = event.get("segs")
        if t_start_ms is None or not segs:
            continue
        text_parts = [s.get("utf8", "") for s in segs]
        text = "".join(text_parts).strip()
        if not text:
            continue
        segments.append({
            "text": text,
            "start": t_start_ms / 1000.0,
        })
    return segments if segments else None


# yt-dlp 방식에서는 브라우저 관리 불필요 — 호환성을 위해 no-op 함수 유지
def setup_browser():
    pass


def teardown_browser():
    pass


def get_browser():
    return None
