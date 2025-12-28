"""
Route Router
------------
Handles route calculation endpoints with ArcGIS primary and OSRM fallback.
"""

import os
from typing import List

import httpx
from fastapi import APIRouter, HTTPException

from models.base import RouteStop, RouteRequest

router = APIRouter(prefix="/api", tags=["route"])

# 載入 ArcGIS API Key
ARCGIS_API_KEY = os.getenv("ARCGIS_API_KEY")


async def route_with_arcgis(stops: List[RouteStop], mode: str, optimize: bool) -> dict:
    """使用 ArcGIS Routing API 計算路線"""
    if not ARCGIS_API_KEY:
        raise Exception("ArcGIS API Key 未設定")
    
    # ArcGIS stops 格式: lng,lat;lng,lat
    stops_str = ";".join([f"{s.lng},{s.lat}" for s in stops])
    
    # 交通模式對應
    travel_mode = "Walking" if mode == "walk" else "Driving"
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            "https://route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve",
            params={
                "f": "json",
                "stops": stops_str,
                "returnDirections": "true",
                "directionsLengthUnits": "esriNAUKilometers",
                "findBestSequence": "true" if optimize else "false",
                "travelMode": travel_mode,
                "token": ARCGIS_API_KEY
            }
        )
        data = res.json()
        
        if "error" in data:
            raise Exception(f"ArcGIS Error: {data['error'].get('message', 'Unknown error')}")
        
        if not data.get("routes") or not data["routes"].get("features"):
            raise Exception("No route found")
        
        route_feature = data["routes"]["features"][0]
        geometry = route_feature.get("geometry", {})
        attributes = route_feature.get("attributes", {})
        
        # 轉換成 GeoJSON 格式
        geojson = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [[p[0], p[1]] for p in geometry.get("paths", [[]])[0]]
            }
        }
        
        distance_km = round(attributes.get("Total_Kilometers", 0), 1)
        duration_min = round(attributes.get("Total_TravelTime", 0))
        
        return {
            "source": "arcgis",
            "route": geojson,
            "distance": f"{distance_km} km",
            "duration": f"{duration_min} 分鐘" if duration_min < 60 else f"{duration_min // 60}h {duration_min % 60}m"
        }


async def route_with_osrm(stops: List[RouteStop], mode: str) -> dict:
    """備援：使用 OSRM 計算路線"""
    coords = ";".join([f"{s.lng},{s.lat}" for s in stops])
    profile = "foot" if mode == "walk" else "car" if mode == "drive" else "foot"
    
    url = f"https://router.project-osrm.org/route/v1/{profile}/{coords}"
    print(f"   🔍 OSRM Request URL (前100字元): {url[:100]}...")
    print(f"   🔍 OSRM Stops count: {len(stops)}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:  # 增加 timeout 到 30 秒
        try:
            res = await client.get(
                url,
                params={"overview": "full", "geometries": "geojson"}
            )
            print(f"   🔍 OSRM Response status: {res.status_code}")
            
            if res.status_code != 200:
                print(f"   ❌ OSRM HTTP Error: {res.text[:200]}")
                raise Exception(f"OSRM HTTP {res.status_code}")
            
            data = res.json()
            
            if data.get("code") != "Ok":
                print(f"   ❌ OSRM API Error: {data.get('code')}, {data.get('message', 'no message')}")
                raise Exception(f"OSRM error: {data.get('code')}")
            
            if not data.get("routes"):
                print(f"   ❌ OSRM No routes in response")
                raise Exception("OSRM no routes")
            
            route = data["routes"][0]
            distance_km = round(route["distance"] / 1000, 1)
            duration_min = round(route["duration"] / 60)
            
            return {
                "source": "osrm",
                "route": {
                    "type": "Feature",
                    "properties": {},
                    "geometry": route["geometry"]
                },
                "distance": f"{distance_km} km",
                "duration": f"{duration_min} 分鐘" if duration_min < 60 else f"{duration_min // 60}h {duration_min % 60}m"
            }
        except httpx.TimeoutException:
            print(f"   ❌ OSRM Timeout after 30s")
            raise Exception("OSRM timeout")
        except Exception as e:
            print(f"   ❌ OSRM Exception: {type(e).__name__}: {e}")
            raise


@router.post("/route")
async def calculate_route(request: RouteRequest):
    """🛣️ 計算路線 (ArcGIS 優先，OSRM 備援)"""
    if len(request.stops) < 2:
        raise HTTPException(status_code=400, detail="至少需要 2 個停靠點")
    
    print(f"🛣️ 計算路線: {len(request.stops)} 個點, 模式={request.mode}, 優化={request.optimize}")
    
    # 1. 嘗試 ArcGIS
    if ARCGIS_API_KEY:
        try:
            result = await route_with_arcgis(request.stops, request.mode, request.optimize)
            print(f"   ✅ ArcGIS 路線成功: {result['distance']}, {result['duration']}")
            return result
        except Exception as e:
            print(f"   ⚠️ ArcGIS 失敗: {e}, 切換到 OSRM")
    
    # 2. 備援到 OSRM
    try:
        result = await route_with_osrm(request.stops, request.mode)
        print(f"   ✅ OSRM 路線成功: {result['distance']}, {result['duration']}")
        return result
    except Exception as e:
        print(f"   ❌ OSRM 也失敗: {e}")
        raise HTTPException(status_code=500, detail="無法計算路線")
