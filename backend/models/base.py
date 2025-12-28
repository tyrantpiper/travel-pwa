"""
Pydantic Models for Ryan Travel API
Extracted from main.py for better code organization
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any


# === 基本請求模型 ===

class UserPreferences(BaseModel):
    """用戶偏好設定（用於行程生成）"""
    destination: str
    days: int
    budget: str
    interests: List[str]


class MarkdownImportRequest(BaseModel):
    """Markdown 匯入請求"""
    markdown_text: str
    itinerary_id: Optional[str] = None


class GenerateTripRequest(BaseModel):
    """AI 生成行程請求"""
    origin: str
    destination: str
    days: int
    interests: str


class SimplePromptRequest(BaseModel):
    """簡化版 AI 生成請求"""
    prompt: str


# === 地理編碼模型 ===

class GeocodeSearchRequest(BaseModel):
    """地理編碼搜尋請求"""
    query: str
    limit: int = 5
    tripTitle: str = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class GeocodeReverseRequest(BaseModel):
    """反向地理編碼請求"""
    lat: float
    lng: float


# === 行程相關模型 ===

class ItineraryItem(BaseModel):
    """行程項目"""
    day_number: int
    time_slot: str
    place_name: str
    original_name: Optional[str] = None
    category: str
    desc: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    cost_amount: Optional[float] = 0
    tags: Optional[List[str]] = []
    reservation_code: Optional[str] = ""
    sub_items: List[dict] = []
    link_url: Optional[str] = None


class SaveItineraryRequest(BaseModel):
    """儲存行程請求"""
    title: str
    creator_name: str
    user_id: str
    items: List[ItineraryItem]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    daily_locations: Optional[dict] = {}
    day_notes: Optional[dict] = {}
    day_costs: Optional[dict] = {}
    day_tickets: Optional[dict] = {}


class JoinTripRequest(BaseModel):
    """加入行程請求"""
    share_code: str
    user_id: str
    user_name: str


class CreateManualTripRequest(BaseModel):
    """手動建立行程請求"""
    title: str
    start_date: str
    end_date: str
    creator_name: str
    user_id: str
    cover_image: Optional[str] = None


class UpdateItemRequest(BaseModel):
    """更新行程項目請求"""
    time_slot: Optional[str] = None
    place_name: Optional[str] = None
    notes: Optional[str] = None
    cost_amount: Optional[float] = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    memo: Optional[str] = None
    sub_items: Optional[List[dict]] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


class CreateItemRequest(BaseModel):
    """新增行程項目請求"""
    itinerary_id: str
    day_number: int
    time_slot: str
    place_name: str
    category: str
    notes: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ImportToTripRequest(BaseModel):
    """匯入到現有行程請求"""
    trip_id: str
    items: List[ItineraryItem]
    daily_locations: Optional[dict] = {}
    day_notes: Optional[dict] = {}
    day_costs: Optional[dict] = {}
    day_tickets: Optional[dict] = {}


# === Day 管理模型 ===

class UpdateDayInfoRequest(BaseModel):
    """更新每日資訊請求"""
    day_notes: Optional[dict] = None
    day_costs: Optional[dict] = None
    day_tickets: Optional[dict] = None


class AddDayRequest(BaseModel):
    """新增天數請求"""
    position: str  # "start" or "end"


class CloneTripRequest(BaseModel):
    """複製行程請求"""
    user_id: str
    new_title: str


class UpdateCoverRequest(BaseModel):
    """更新封面圖請求"""
    cover_image: str


# === 行程資訊模型 ===

class UpdateInfoRequest(BaseModel):
    """更新行程資訊請求（航班/飯店）"""
    flight_info: dict
    hotel_info: dict


# === 路線規劃模型 ===

class RouteStop(BaseModel):
    """路線停靠點"""
    lat: float
    lng: float
    name: Optional[str] = None


class RouteRequest(BaseModel):
    """路線規劃請求"""
    stops: List[RouteStop]
    mode: str = "walk"
    optimize: bool = False


# === 記帳模型 ===

class ExpenseRequest(BaseModel):
    """新增消費請求"""
    itinerary_id: Optional[str] = None
    title: Optional[str] = None
    amount_jpy: Optional[float] = None
    exchange_rate: Optional[float] = None
    payment_method: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    card_name: Optional[str] = None
    cashback_rate: Optional[float] = 0
    image_url: Optional[str] = None
    expense_date: Optional[str] = None


class UpdateTripTitleRequest(BaseModel):
    """更新行程標題請求"""
    title: str


class UpdateExpenseRequest(BaseModel):
    """更新消費請求"""
    title: Optional[str] = None
    amount_jpy: Optional[float] = None
    is_public: Optional[bool] = None
    payment_method: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    expense_date: Optional[str] = None


# === AI 聊天模型 ===

class ChatRequest(BaseModel):
    """AI 聊天請求"""
    message: str
    history: List[dict] = []
    thought_signatures: Optional[List[dict]] = None
    image: Optional[str] = None
    location: Optional[dict] = None
    current_itinerary: Optional[dict] = None
    focused_day: Optional[int] = None


class SummarizeRequest(BaseModel):
    """記憶摘要請求"""
    history: List[Dict]


# === POI 模型 ===

class POIAIEnrichRequest(BaseModel):
    """POI AI 增強請求"""
    name: str
    type: str
    lat: float
    lng: float
    api_key: Optional[str] = None


class POIEnrichRequest(BaseModel):
    """POI 三源整合請求"""
    name: str
    wikidata_id: Optional[str] = None


class POIRecommendRequest(BaseModel):
    """POI AI 推薦請求"""
    pois: List[dict]
    user_query: str
    api_key: str
    user_preferences: Optional[dict] = None
