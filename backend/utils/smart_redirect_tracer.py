"""
Smart Redirect Tracer v35.24 - Anti-Acidosis Protocol

This module implements intelligent redirect chain tracing that:
1. Collects ALL coordinates from every hop (does NOT stop early)
2. Analyzes precision (decimal places) of each coordinate
3. Selects the BEST (most precise) coordinate

Zero-Touch Fidelity: This is a NEW file with no impact on existing code.
"""

import re
import httpx
import asyncio
from typing import Dict, List, Optional
from urllib.parse import urlparse, unquote


class SmartRedirectTracer:
    """
    Smart Redirect Tracer with Anti-Acidosis Protocol.
    
    Prevents low-precision "toxic" coordinates from polluting results
    by collecting ALL coordinates and selecting the most precise one.
    """
    
    def __init__(self, max_hops: int = 10, timeout: float = 5.0):
        self.max_hops = max_hops
        self.timeout = timeout
        
        # Pre-compiled regex patterns for coordinate extraction
        # 🛡️ v35.42: Priority fixed - POI (!3d/!4d) before map center (@)
        self.coord_patterns = [
            (re.compile(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)'), '3d4d_format'),  # 🥇 POI 精確位置
            (re.compile(r'@(-?\d+\.\d+),(-?\d+\.\d+)'), 'at_symbol'),                   # 🥈 地圖中心 (fallback)
            (re.compile(r'[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)'), 'll_parameter'),         # 🥉 ll 參數
        ]
    
    async def trace_full_chain_smart(self, short_url: str) -> Dict:
        """
        Trace the full redirect chain and select the best coordinate.
        
        Anti-Acidosis: Collects ALL coordinates, selects most precise.
        """
        all_coords = []
        current_url = short_url
        visited = set()  # Prevent infinite loops
        
        try:
            # 🛡️ v35.52: Stealth Identity - Spoofing iPhone Safari to bypass Google's bot detection
            headers = {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
            }
            async with httpx.AsyncClient(headers=headers, timeout=httpx.Timeout(self.timeout)) as client:
                for hop in range(self.max_hops):
                    # Loop detection
                    if current_url in visited:
                        print(f"⚠️ Redirect loop detected at hop {hop}")
                        break
                    visited.add(current_url)
                    
                    # Extract coordinates from current URL (but DO NOT STOP)
                    coords = self._extract_coords_from_url(current_url)
                    if coords:
                        coords['hop'] = hop
                        coords['url'] = current_url
                        all_coords.append(coords)
                        print(f"🔍 Hop {hop}: Found coords ({coords['lat']}, {coords['lng']}) - Precision: {coords['precision']}")
                    
                    # Trace next hop (NO auto-follow)
                    try:
                        resp = await client.get(
                            current_url,
                            follow_redirects=False,
                            timeout=2.0
                        )
                        
                        # Non-redirect status: chain ends
                        if resp.status_code not in [301, 302, 303, 307, 308]:
                            break
                        
                        next_url = resp.headers.get('Location')
                        if not next_url:
                            break
                        
                        # Handle relative path redirects
                        if next_url.startswith('/'):
                            parsed = urlparse(current_url)
                            next_url = f"{parsed.scheme}://{parsed.netloc}{next_url}"
                        
                        current_url = next_url
                    
                    except asyncio.TimeoutError:
                        print(f"⚠️ Hop {hop} timeout")
                        break
                    except Exception as e:
                        print(f"⚠️ Hop {hop} error: {e}")
                        break
                
                # Final URL check (if not already checked)
                if current_url not in visited:
                    coords = self._extract_coords_from_url(current_url)
                    if coords and not any(c.get('url') == current_url for c in all_coords):
                        coords['hop'] = hop + 1
                        coords['url'] = current_url
                        all_coords.append(coords)
        
        except Exception as e:
            print(f"⚠️ SmartTracer session error: {e}")
            return {
                'error': str(e),
                'final_url': current_url,
                'fallback_required': True
            }
        
        if not all_coords:
            return {
                'final_url': current_url,
                'requires_parsing': True,
                'coordinates_found': False
            }
        
        # SELECT BEST COORDINATE (Anti-Acidosis Logic)
        best_coord = self._select_best_coordinate(all_coords)
        best_coord['final_url'] = current_url
        best_coord['total_hops'] = len(visited)
        best_coord['candidates_count'] = len(all_coords)
        
        print(f"✅ Best coordinate selected: Hop {best_coord.get('hop')}, Precision {best_coord.get('precision')}")
        
        return best_coord
    
    def _extract_coords_from_url(self, url: str) -> Optional[Dict]:
        """Extract coordinates and calculate precision (decimal places)."""
        # Double-unquote for Protobuf robustness
        processed_url = unquote(unquote(url)).replace('%21', '!')
        
        for pattern, method in self.coord_patterns:
            match = pattern.search(processed_url)
            if match:
                lat_str = match.group(1)
                lng_str = match.group(2)
                
                lat = float(lat_str)
                lng = float(lng_str)
                
                # Calculate precision (decimal places)
                lat_precision = len(lat_str.split('.')[-1]) if '.' in lat_str else 0
                lng_precision = len(lng_str.split('.')[-1]) if '.' in lng_str else 0
                avg_precision = (lat_precision + lng_precision) / 2
                
                # Estimate accuracy in meters
                estimated_accuracy = self._precision_to_meters(avg_precision)
                
                return {
                    'lat': lat,
                    'lng': lng,
                    'method': method,
                    'precision': avg_precision,
                    'estimated_accuracy_meters': estimated_accuracy,
                    'lat_str': lat_str,
                    'lng_str': lng_str
                }
        
        return None
    
    def _precision_to_meters(self, decimal_places: float) -> float:
        """
        Map decimal places to real-world accuracy (meters).
        
        At the equator:
        - 0 decimals ≈ 111 km
        - 1 decimal ≈ 11.1 km
        - 2 decimals ≈ 1.1 km  (TOXIC ZONE)
        - 3 decimals ≈ 110 m   (Street-level)
        - 4 decimals ≈ 11 m    (Building-level) ✅
        - 5 decimals ≈ 1.1 m   (GPS-level)
        - 6 decimals ≈ 0.11 m
        """
        precision_map = {
            0: 111000,
            1: 11100,
            2: 1100,
            3: 110,
            4: 11,
            5: 1.1,
            6: 0.11,
        }
        
        if decimal_places in precision_map:
            return precision_map[decimal_places]
        else:
            return 111000 / (10 ** decimal_places)
    
    def _select_best_coordinate(self, coords_list: List[Dict]) -> Dict:
        """
        Select the best coordinate using Anti-Acidosis strategy.
        
        Priority:
        1. Building-level precision (≥4 decimals)
        2. Most precise available
        3. Latest hop (closest to destination)
        """
        # Strategy 1: Find building-level precision (≥4 decimals)
        building_level = [c for c in coords_list if c['precision'] >= 4.0]
        
        if building_level:
            # Select most precise among building-level
            best = max(building_level, key=lambda x: x['precision'])
            best['selection_reason'] = f'Building-level precision ({best["precision"]} decimals)'
            return best
        
        # Strategy 2: No building-level, select most precise
        best = max(coords_list, key=lambda x: (x['precision'], x.get('hop', 0)))
        
        # Add warning if precision is low
        if best['precision'] < 3.0:
            best['warning'] = f'Low precision ({best["precision"]} decimals, ~{best["estimated_accuracy_meters"]:.0f}m error)'
            best['selection_reason'] = 'Best available (but precision is low)'
        else:
            best['selection_reason'] = f'Street-level precision ({best["precision"]} decimals)'
        
        return best


# Singleton instance for reuse
_tracer_instance = None

def get_smart_tracer() -> SmartRedirectTracer:
    """Get or create the singleton SmartRedirectTracer instance."""
    global _tracer_instance
    if _tracer_instance is None:
        _tracer_instance = SmartRedirectTracer()
    return _tracer_instance
