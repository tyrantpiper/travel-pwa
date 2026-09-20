"""
Travel Data Router (Phase 2A)
-----------------------------
Proxy for Travelpayouts Data API.
Provides cached flight price data to the frontend.
Token is server-side only — never exposed to the client.
"""

import os
import time
import logging
from fastapi import APIRouter, HTTPException, Query
import httpx

logger = logging.getLogger("ryan-travel-api")
router = APIRouter(prefix="/api/travel-data", tags=["travel-data"])

TP_BASE = "https://api.travelpayouts.com"
TP_TOKEN = os.getenv("TP_API_TOKEN", "").strip()

# In-memory cache (TTL: 1 hour)
_price_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = 3600  # seconds


def _get_cached(key: str) -> dict | None:
    """Check cache and return data if still valid."""
    if key in _price_cache:
        ts, data = _price_cache[key]
        if time.time() - ts < CACHE_TTL:
            if data.get("prices"):
                return data
        del _price_cache[key]
    return None


@router.get("/flight-prices")
async def get_flight_prices(
    origin: str = Query(..., min_length=2, max_length=4, description="IATA code (e.g. TPE)"),
    destination: str = Query(..., min_length=2, max_length=4, description="IATA code (e.g. NRT)"),
    departure_at: str | None = Query(None, description="YYYY-MM or YYYY-MM-DD"),
    currency: str = Query("twd", max_length=3),
):
    """
    🔍 Query lowest flight prices between two airports.
    Data source: Travelpayouts /aviasales/v3/prices_for_dates
    Results are cached for 1 hour to reduce API calls.
    """
    if not TP_TOKEN:
        raise HTTPException(503, "Travel data API not configured")

    origin = origin.strip().upper()
    destination = destination.strip().upper()

    # 🛡️ 同城起降防衛 (Same-city short circuit): 境內同城無需查詢航班
    if origin == destination:
        return {
            "origin": origin,
            "destination": destination,
            "currency": currency.upper(),
            "prices": [],
            "lowest_price": None,
            "cached": False,
        }

    # Check cache first
    cache_key = f"{origin}-{destination}-{departure_at}-{currency}"
    cached = _get_cached(cache_key)
    if cached:
        logger.info(f"[TP] Cache HIT: {cache_key}")
        return cached

    # Build request params
    params = {
        "origin": origin,
        "destination": destination,
        "currency": currency,
        "sorting": "price",
        "limit": 5,
        "unique": "false",
    }
    if departure_at:
        params["departure_at"] = departure_at

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{TP_BASE}/aviasales/v3/prices_for_dates",
                params=params,
                headers={"X-Access-Token": TP_TOKEN},
            )
            resp.raise_for_status()
            raw = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"[TP] API Error {e.response.status_code}: {e.response.text[:200]}")
        raise HTTPException(502, f"Travelpayouts API error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"[TP] Request failed: {e}")
        raise HTTPException(502, "Failed to fetch flight prices")

    # Transform response
    prices = raw.get("data", [])

    # 🛡️ 彈性降級 (Resilient Fallback): 若特定出發日期無快取報價，自動退回航線近期最優惠報價
    if departure_at and not prices:
        try:
            fallback_params = {
                "origin": origin,
                "destination": destination,
                "currency": currency,
                "sorting": "price",
                "limit": 5,
                "unique": "false",
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                fb_resp = await client.get(
                    f"{TP_BASE}/aviasales/v3/prices_for_dates",
                    params=fallback_params,
                    headers={"X-Access-Token": TP_TOKEN},
                )
                if fb_resp.status_code == 200:
                    prices = fb_resp.json().get("data", [])
                    logger.info(f"[TP] Specific date had no prices, fallback retrieved {len(prices)} general route prices")
        except Exception as fb_err:
            logger.warning(f"[TP] Fallback route query skipped: {fb_err}")

    result = {
        "origin": origin,
        "destination": destination,
        "currency": currency.upper(),
        "prices": [
            {
                "price": p.get("price"),
                "airline": p.get("airline"),
                "gate": p.get("gate"),
                "departure_at": p.get("departure_at"),
                "return_at": p.get("return_at"),
                "transfers": p.get("transfers", 0),
                "flight_number": p.get("flight_number"),
                "duration": p.get("duration"),
            }
            for p in prices[:5]
        ],
        "lowest_price": prices[0].get("price") if prices else None,
        "cached": False,
    }

    # Store in cache only if prices exist
    if prices:
        _price_cache[cache_key] = (time.time(), {**result, "cached": True})
    logger.info(f"[TP] Fetched {len(prices)} prices for {origin}→{destination}")
    return result


@router.get("/airport-search")
async def search_airports(
    query: str = Query(..., min_length=1, max_length=50, description="City, country, or airport name"),
    locale: str = Query("en", max_length=10),
):
    """
    🔍 Autocomplete airports & cities worldwide (Tier 2 Dynamic Fallback).
    Data source: Travelpayouts places2 API
    """
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://autocomplete.travelpayouts.com/places2",
                params={
                    "term": query,
                    "locale": locale,
                    "types[]": ["airport", "city"],
                },
            )
            if resp.status_code == 200:
                raw = resp.json()
                results = []
                for item in raw[:6]:
                    code = item.get("code")
                    if not code:
                        continue
                    name = item.get("name", code)
                    city_name = item.get("city_name")
                    country_name = item.get("country_name")
                    results.append({
                        "code": code.upper(),
                        "name": name,
                        "city_name": city_name,
                        "country_name": country_name,
                    })
                return {"query": query, "airports": results}
    except Exception as e:
        logger.warning(f"[TP] Autocomplete search failed for '{query}': {e}")

    return {"query": query, "airports": []}

