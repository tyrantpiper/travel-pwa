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
        print("   ❌ ArcGIS API Key is MISSING")
        raise Exception("ArcGIS API Key 未設定")
    
    print(f"   🔍 Using ArcGIS API Key: {ARCGIS_API_KEY[:6]}...{ARCGIS_API_KEY[-4:]}")
    
    # ArcGIS stops 格式: lng,lat;lng,lat
    stops_str = ";".join([f"{s.lng},{s.lat}" for s in stops])
    
    # 交通模式對應 (ArcGIS 官方名稱，必須完全匹配)
    # 參考: https://developers.arcgis.com/rest/network/api-reference/route-synchronous-service.htm
    ARCGIS_TRAVEL_MODES = {
        "walk": "Walking Time",
        "drive": "Driving Time",
        "transit": "Driving Time"  # ArcGIS 不支援 transit，暫用開車模式
    }
    travel_mode = ARCGIS_TRAVEL_MODES.get(mode, "Driving Time")
    print(f"   🚶 ArcGIS travelMode: {travel_mode} (mode={mode})")
    
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
            err_msg = data['error'].get('message', 'Unknown error')
            print(f"   ❌ ArcGIS API Error: {err_msg}")
            # 🆕 寫入偵錯日誌
            with open("route_error_debug.log", "a", encoding="utf-8") as f:
                f.write(f"--- ArcGIS ERROR ---\n")
                f.write(f"Stops: {stops_str}\n")
                f.write(f"Error: {err_msg}\n\n")
            raise Exception(f"ArcGIS Error: {err_msg}")
        
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
    """備援：使用 OSRM 計算路線 (FOSSGIS 伺服器)"""
    coords = ";".join([f"{s.lng},{s.lat}" for s in stops])
    
    # 🆕 FOSSGIS 伺服器（真正支援步行路線）
    # 參考: https://routing.openstreetmap.de
    # 重要：使用專用子域名 routed-foot / routed-car
    if mode == "walk":
        server = "https://routing.openstreetmap.de/routed-foot"
        profile = "foot"
    elif mode == "drive":
        server = "https://routing.openstreetmap.de/routed-car"
        profile = "driving"
    else:  # transit 或其他
        server = "https://routing.openstreetmap.de/routed-car"
        profile = "driving"
    
    url = f"{server}/route/v1/{profile}/{coords}"
    print(f"   🌐 FOSSGIS Server: {server.split('/')[-1]}, Profile: {profile}, Mode: {mode}")
    print(f"   🔍 OSRM Request URL (前100字元): {url[:100]}...")
    print(f"   🔍 OSRM Stops count: {len(stops)}")
    
    # 🆕 User-Agent 必須設定，否則會被 FOSSGIS 封鎖
    headers = {
        "User-Agent": "RyanTravelPWA/1.0 (https://github.com/ryan-travel-app)",
        "Accept": "application/json"
    }
    
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
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
                "source": "osrm-fossgis",  # 🆕 標明使用 FOSSGIS 伺服器
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
            # 🆕 寫入偵錯日誌
            with open("route_error_debug.log", "a", encoding="utf-8") as f:
                f.write(f"--- OSRM ERROR ---\n")
                f.write(f"URL: {url}\n")
                f.write(f"Error: {str(e)}\n\n")
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
    
    # 2. 嘗試 OSRM
    try:
        result = await route_with_osrm(request.stops, request.mode)
        print(f"   ✅ OSRM 路線成功: {result['distance']}, {result['duration']}")
        return result
    except Exception as e:
        print(f"   ⚠️ OSRM 也失敗: {e}, 使用直線連接作為最終備援")
        
        # 3. 最終備援：直線連接 (防止前端 500 崩潰)
        # 計算簡單的歐幾里得距離作為估計 (不精確但比崩潰好)
        total_dist = 0
        for i in range(len(request.stops) - 1):
            s1 = request.stops[i]
            s2 = request.stops[i+1]
            # 粗略估算: 1度約 111km
            d = ((s1.lat - s2.lat)**2 + (s1.lng - s2.lng)**2)**0.5 * 111
            total_dist += d
        
        return {
            "source": "fallback-straight",
            "route": {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[s.lng, s.lat] for s in request.stops]
                }
            },
            "distance": f"{round(total_dist, 1)} km (估計)",
            "duration": "未知 (跨區)"
        }
