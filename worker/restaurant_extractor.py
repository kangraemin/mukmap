import json
import logging
import os
from anthropic import Anthropic

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """다음은 먹방/맛집 유튜브 영상의 자막입니다. 타임스탬프(초)와 함께 제공됩니다.
이 영상에서 실제로 방문한 음식점 정보를 추출해주세요.

자막:
{transcript}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{"restaurants": [{{"name": "가게명", "address_hint": "주소 힌트(자막에서 언급된 지역명)", "category": "카테고리", "rating": "평가", "summary": "한줄평", "is_ad": false, "timestamp_seconds": 0}}]}}

규칙:
- 가게명이 명확히 언급된 경우만 추출
- 맞춤법 교정 (발음대로 적힌 가게명을 올바른 이름으로)
- address_hint: 자막에서 언급된 지역 정보 ("전주", "홍대 근처", "강남역" 등)
- category: 한식/일식/중식/양식/카페/디저트/분식/고기/구이/해산물/기타 중 택1
- rating: 강력추천/추천/보통/비추/언급없음 중 택1 (유튜버의 반응 기반)
- summary: 유튜버가 언급한 핵심 한줄평 (30자 이내)
- is_ad: 광고/협찬 여부
- timestamp_seconds: 해당 가게가 처음 언급되는 시점(초), 정수
- 가게가 없으면 빈 배열: {{"restaurants": []}}
- JSON만 응답"""


def extract_restaurants(
    transcript_segments: list[dict],
) -> tuple[list[dict], dict]:
    """Extract restaurant info from transcript using Claude Haiku.

    Returns (restaurants_list, token_usage_dict).
    token_usage_dict: {"input_tokens": int, "output_tokens": int}
    """
    # Format transcript with timestamps
    lines = []
    for seg in transcript_segments:
        minutes = int(seg["start"] // 60)
        seconds = int(seg["start"] % 60)
        lines.append(f"[{minutes:02d}:{seconds:02d}] {seg['text']}")
    transcript_text = "\n".join(lines)

    # Truncate if too long (roughly 15k chars ~ 4k tokens)
    if len(transcript_text) > 15000:
        transcript_text = transcript_text[:15000] + "\n... (자막 생략)"

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACT_PROMPT.format(transcript=transcript_text),
                }
            ],
        )

        token_usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }

        text = response.content[0].text.strip()

        # Try to extract JSON from response
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        data = json.loads(text)
        restaurants = data.get("restaurants", [])
        return restaurants, token_usage

    except json.JSONDecodeError as e:
        logger.error("JSON parse failed: %s / response: %s", e, text[:200])
        return [], {"input_tokens": 0, "output_tokens": 0}
    except Exception as e:
        logger.error("Claude API error: %s", e)
        return [], {"input_tokens": 0, "output_tokens": 0}
