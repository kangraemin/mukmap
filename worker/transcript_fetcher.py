import json
import logging
import os
import subprocess
import tempfile

import requests

logger = logging.getLogger(__name__)


def fetch_transcript(video_id: str) -> list[dict] | None:
    """Fetch transcript for a YouTube video.

    1차: yt-dlp로 자막 다운로드
    2차: Groq Whisper fallback (오디오 다운 → 음성인식)

    Returns list of {"text": str, "start": float} or None if unavailable.
    """
    result = _fetch_via_ytdlp(video_id)
    if result:
        return result

    logger.info("yt-dlp 자막 실패, Groq Whisper fallback 시도: %s", video_id)
    return _fetch_via_whisper(video_id)


def _fetch_via_ytdlp(video_id: str) -> list[dict] | None:
    """yt-dlp로 자막 다운로드."""
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, "sub")

        for sub_args in [
            ["--write-sub", "--sub-lang", "ko"],
            ["--write-auto-sub", "--sub-lang", "ko"],
            ["--write-auto-sub"],
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
                subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            except subprocess.TimeoutExpired:
                continue

            sub_files = [f for f in os.listdir(tmpdir) if f.endswith(".json3")]

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

            for f in os.listdir(tmpdir):
                os.remove(os.path.join(tmpdir, f))

    return None


def _fetch_via_whisper(video_id: str) -> list[dict] | None:
    """yt-dlp 오디오 다운 → Groq Whisper Turbo → 자막 변환."""
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        logger.warning("GROQ_API_KEY 없음, Whisper fallback 스킵")
        return None

    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        output_template = os.path.join(tmpdir, "audio.%(ext)s")
        audio_path = os.path.join(tmpdir, "audio.mp3")

        cmd = [
            "yt-dlp", "-x",
            "--audio-format", "mp3",
            "--audio-quality", "5",
            "-o", output_template,
            url,
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        except subprocess.TimeoutExpired:
            logger.warning("오디오 다운로드 타임아웃: %s", video_id)
            return None

        if not os.path.exists(audio_path):
            logger.warning("오디오 파일 없음: %s", video_id)
            return None

        try:
            with open(audio_path, "rb") as f:
                resp = requests.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {groq_key}"},
                    files={"file": ("audio.mp3", f, "audio/mpeg")},
                    data={
                        "model": "whisper-large-v3-turbo",
                        "language": "ko",
                        "response_format": "verbose_json",
                    },
                    timeout=120,
                )
        except requests.RequestException as e:
            logger.warning("Groq API 요청 실패: %s", e)
            return None

        if resp.status_code != 200:
            logger.warning("Groq Whisper 실패 (%s): %s", resp.status_code, resp.text[:200])
            return None

        data = resp.json()
        segments = []
        for seg in data.get("segments", []):
            text = seg.get("text", "").strip()
            if text:
                segments.append({"text": text, "start": seg.get("start", 0.0)})

        if segments:
            logger.info("Groq Whisper 성공: %s (%d segments)", video_id, len(segments))
            return segments

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


def setup_browser():
    pass


def teardown_browser():
    pass


def get_browser():
    return None
