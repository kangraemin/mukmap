"""YouTube 자막 추출 API — Groq Whisper."""
import os
import subprocess
import tempfile

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from transcript_fetcher import fetch_transcript

app = FastAPI(title="YouTube Transcript API")


@app.get("/transcript")
def get_transcript(video_id: str = Query(..., description="YouTube 영상 ID")):
    segments = fetch_transcript(video_id)
    if segments is None:
        return JSONResponse(
            status_code=404,
            content={"error": "No transcript found", "video_id": video_id},
        )
    return {"video_id": video_id, "segments": segments, "count": len(segments)}


@app.get("/debug")
def debug(video_id: str = Query(...)):
    """디버그: yt-dlp 오디오 다운로드 테스트."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    with tempfile.TemporaryDirectory() as tmpdir:
        cmd = [
            "yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "5",
            "-o", os.path.join(tmpdir, "audio.%(ext)s"), url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        files = os.listdir(tmpdir)
        return {
            "returncode": result.returncode,
            "stdout": result.stdout[-500:] if result.stdout else "",
            "stderr": result.stderr[-500:] if result.stderr else "",
            "files": files,
        }


@app.get("/health")
def health():
    return {"status": "ok"}
