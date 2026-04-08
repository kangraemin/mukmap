"""Lambda handler for YouTube subtitle extraction via Groq Whisper."""
import json
import os
import tempfile

import requests
import yt_dlp


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}
    video_id = params.get("video_id", "")

    if not video_id:
        return _response(400, {"error": "video_id is required"})

    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        return _response(500, {"error": "GROQ_API_KEY not configured"})

    try:
        segments = fetch_transcript(video_id, groq_key)
        if not segments:
            return _response(404, {"error": "No transcript found", "video_id": video_id})
        return _response(200, {
            "video_id": video_id,
            "segments": segments,
            "count": len(segments),
        })
    except Exception as e:
        return _response(500, {"error": str(e), "video_id": video_id})


def fetch_transcript(video_id, groq_key):
    """yt-dlp 오디오 다운 → Groq Whisper Turbo → 자막."""
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")

        ydl_opts = {
            "format": "bestaudio[ext=webm]/bestaudio/best",
            "outtmpl": os.path.join(tmpdir, "audio.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception:
            return None

        # 다운된 오디오 파일 찾기 (확장자 다를 수 있음)
        audio_files = [f for f in os.listdir(tmpdir) if f.startswith("audio.")]
        if not audio_files:
            return None
        audio_path = os.path.join(tmpdir, audio_files[0])

        with open(audio_path, "rb") as f:
            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_key}"},
                files={"file": (os.path.basename(audio_path), f)},
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "ko",
                    "response_format": "verbose_json",
                },
                timeout=120,
            )

        if resp.status_code != 200:
            return None

        segments = []
        for seg in resp.json().get("segments", []):
            text = seg.get("text", "").strip()
            if text:
                segments.append({"text": text, "start": seg.get("start", 0.0)})

        return segments or None


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }
