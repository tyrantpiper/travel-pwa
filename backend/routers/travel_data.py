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

    origin = origin.upper()
    destination = destination.upper()

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

    # Store in cache
    _price_cache[cache_key] = (time.time(), {**result, "cached": True})
    logger.info(f"[TP] Fetched {len(prices)} prices for {origin}→{destination}")
    return result
