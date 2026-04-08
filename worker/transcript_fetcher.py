import json
import logging
import os
import subprocess
import tempfile

import requests

logger = logging.getLogger(__name__)


def fetch_transcript(video_id: str) -> list[dict] | None:
    """Fetch transcript for a YouTube video via Groq Whisper.

    yt-dlp로 오디오 다운로드 → Groq Whisper Turbo로 음성인식.

    Returns list of {"text": str, "start": float} or None if unavailable.
    """
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        logger.warning("GROQ_API_KEY 없음, 자막 추출 불가")
        return None

    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")

        cmd = [
            "yt-dlp", "-x",
            "--audio-format", "mp3",
            "--audio-quality", "5",
            "-o", os.path.join(tmpdir, "audio.%(ext)s"),
            url,
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                logger.warning("yt-dlp 오디오 다운 실패: %s\nstderr: %s", video_id, result.stderr[:500])
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


def setup_browser():
    pass


def teardown_browser():
    pass


def get_browser():
    return None
