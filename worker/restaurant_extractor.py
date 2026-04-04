import json
import logging
import os
from anthropic import Anthropic

logger = logging.getLogger(__name__)

EXTRACT_PROMPT = """다음은 유튜브 영상의 제목, 설명, 자막입니다.
이 영상에서 유튜버가 **실제로 방문하여 음식을 먹은** 음식점만 추출해주세요.

영상 제목: {title}

영상 설명:
{description}

자막 (타임스탬프 포함):
{transcript}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{"restaurants": [{{"name": "가게명", "address_hint": "주소 힌트(자막/설명에서 언급된 지역명)", "category": "카테고리", "rating": "평가", "summary": "한줄평", "is_ad": false, "timestamp_seconds": 0}}]}}

규칙:
- **실제 방문하여 먹는 장면이 있는 경우만** 추출. 단순 언급/경품/이벤트/회의는 제외
- **프랜차이즈 체인점 제외**: 롯데리아, 맥도날드, 버거킹, KFC, 스타벅스, 이디야, 파리바게뜨, 뚜레쥬르, 배스킨라빈스, 서브웨이, 도미노피자, 피자헛, BBQ, BHC, 교촌, GS25, CU, 세븐일레븐 등 전국 체인점은 제외 (소규모 로컬 체인 2~3개 매장은 포함 가능)
- 영상 설명에 가게 정보(이름, 주소)가 있으면 **설명을 우선 참조**
- 설명에 "광고", "협찬", "유료광고"가 있으면 is_ad=true
- 가게명 맞춤법 교정 (발음대로 적힌 이름을 올바른 이름으로, 예: 성계향→성게향)
- address_hint: 자막/설명에서 언급된 지역 ("전주", "홍대 근처", "예산시장" 등)
- category: 한식/일식/중식/양식/카페/디저트/분식/고기/구이/해산물/기타 중 택1
- rating: 강력추천/추천/보통/비추/언급없음 중 택1 (유튜버의 반응 기반)
- summary: 유튜버가 언급한 핵심 한줄평 (30자 이내)
- timestamp_seconds: 해당 가게가 처음 언급되는 시점(초), 정수
- 맛집 영상이 아닌 경우(노래, 브이로그, 회의, 이벤트 홍보 등) 빈 배열 반환
- 가게가 없으면 빈 배열: {{"restaurants": []}}
- JSON만 응답"""


def extract_restaurants(
    transcript_segments: list[dict],
    title: str = "",
    description: str = "",
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

    # Truncate description if too long
    desc_text = description[:2000] if description else "(설명 없음)"

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": EXTRACT_PROMPT.format(
                        title=title or "(제목 없음)",
                        description=desc_text,
                        transcript=transcript_text,
                    ),
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
