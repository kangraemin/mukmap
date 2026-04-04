import logging
import os
import re
import requests

logger = logging.getLogger(__name__)

REGION_MAP = {
    "서울": "서울", "경기": "경기", "인천": "인천",
    "부산": "부산", "대구": "대구", "대전": "대전",
    "광주": "광주", "울산": "울산", "세종": "세종",
    "강원": "강원", "충북": "충북", "충남": "충남",
    "전북": "전북", "전남": "전남", "경북": "경북",
    "경남": "경남", "제주": "제주",
}

API_URL = "https://openapi.naver.com/v1/search/local.json"


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def _extract_region(address: str) -> str | None:
    for keyword, region in REGION_MAP.items():
        if keyword in address:
            return region
    return None


def _search(query: str) -> dict | None:
    """Single Naver Local search call. Returns first item or None."""
    headers = {
        "X-Naver-Client-Id": os.environ["NAVER_SEARCH_CLIENT_ID"],
        "X-Naver-Client-Secret": os.environ["NAVER_SEARCH_CLIENT_SECRET"],
    }
    try:
        resp = requests.get(
            API_URL, headers=headers, params={"query": query, "display": 1}, timeout=10
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        return items[0] if items else None
    except Exception as e:
        logger.warning("Naver search failed for '%s': %s", query, e)
        return None


def search_restaurant(name: str, address_hint: str = "") -> dict | None:
    """Search for a restaurant using 3-stage fallback.

    Returns dict with keys: name, address, lat, lng, region, naver_place_id
    or None if all searches fail.
    """
    queries = []
    if address_hint:
        queries.append(f"{address_hint} {name}")
    queries.append(name)
    queries.append(f"{name} 맛집")

    for query in queries:
        item = _search(query)
        if item:
            try:
                lat = int(item["mapy"]) / 10_000_000
                lng = int(item["mapx"]) / 10_000_000
            except (ValueError, KeyError):
                lat, lng = None, None

            road_address = item.get("roadAddress", "")
            address = road_address or item.get("address", "")
            region = _extract_region(address)

            return {
                "name": _strip_html(item.get("title", name)),
                "address": address,
                "lat": lat,
                "lng": lng,
                "region": region,
                "naver_place_id": None,  # Naver local API doesn't return place ID
            }

    return None
