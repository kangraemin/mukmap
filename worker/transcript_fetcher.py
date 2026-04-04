import logging
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)


def fetch_transcript(video_id: str) -> list[dict] | None:
    """Fetch Korean transcript for a YouTube video.

    Returns list of {"text": str, "start": float} or None if unavailable.
    """
    ytt_api = YouTubeTranscriptApi()

    for lang in [["ko"], ["ko-auto"]]:
        try:
            transcript = ytt_api.fetch(video_id, languages=lang)
            segments = [
                {"text": snippet.text, "start": snippet.start}
                for snippet in transcript.snippets
            ]
            if segments:
                return segments
        except Exception:
            continue

    # last resort: any available language
    try:
        transcript = ytt_api.fetch(video_id)
        segments = [
            {"text": snippet.text, "start": snippet.start}
            for snippet in transcript.snippets
        ]
        if segments:
            return segments
    except Exception as e:
        logger.warning("No transcript for %s: %s", video_id, e)

    return None
