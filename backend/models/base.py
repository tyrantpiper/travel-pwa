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
    # 🆕 結構化過濾參數 (取代字串拼接)
    country: Optional[str] = None   # 國家名稱 (如 "Japan", "Taiwan")
    region: Optional[str] = None    # 區域名稱 (如 "Tokyo 東京")
    zoom: Optional[float] = None    # 🆕 P1: 地圖縮放層級 (用於動態 bias)


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
    day_checklists: Optional[dict] = {}
    ai_review: Optional[str] = None


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
    image_url: Optional[str] = None      # 向後相容
    image_urls: Optional[List[str]] = None  # 🆕 多圖片 URLs
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    sort_order: Optional[int] = None  # 🆕 拖曳排序


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
    image_url: Optional[str] = None       # 向後相容
    image_urls: Optional[List[str]] = None  # 🆕 多圖片 URLs
    tags: Optional[List[str]] = None


# 🆕 拖曳排序請求
class ReorderItemRequest(BaseModel):
    """單一項目的排序更新"""
    item_id: str
    sort_order: int
    time_slot: Optional[str] = None  # 可選：同時更新時間

class ReorderRequest(BaseModel):
    """批次排序更新請求"""
    items: List[ReorderItemRequest]
    adjust_times: bool = False  # 是否自動重分配時間


class ImportToTripRequest(BaseModel):
    """匯入到現有行程請求"""
    trip_id: str
    items: List[ItineraryItem]
    daily_locations: Optional[dict] = {}
    day_notes: Optional[dict] = {}
    day_costs: Optional[dict] = {}
    day_tickets: Optional[dict] = {}
    day_checklists: Optional[dict] = {}
    ai_review: Optional[str] = None


# === Day 管理模型 ===

class UpdateDayDataRequest(BaseModel):
    """更新每日資訊請求"""
    day: int
    day_notes: Optional[dict] = None
    day_costs: Optional[dict] = None
    day_tickets: Optional[dict] = None
    day_checklists: Optional[dict] = None  # 🆕 行前清單
    day_ai_reviews: Optional[dict] = None  # 🆕 AI 深度審核報告


class AddDayRequest(BaseModel):
    """新增天數請求"""
    position: str = "end"  # "end" 或 "before:N"
    clone_content: bool = False  # 🆕 是否移植鄰近天數的內容


class AppendItemsRequest(BaseModel):
    """追加細項到行程請求"""
    items: List[ItineraryItem]


class CloneTripRequest(BaseModel):
    """複製行程請求"""
    user_id: str
    new_title: str


class UpdateCoverRequest(BaseModel):
    """更新封面圖請求"""
    cover_image: str


class UpdateLocationRequest(BaseModel):
    """更新每日地點請求"""
    day: int
    name: str
    lat: float
    lng: float


# === 行程資訊模型 ===

class UpdateInfoRequest(BaseModel):
    """更新行程資訊請求（航班/飯店/卡片）"""
    flight_info: Optional[dict] = None
    hotel_info: Optional[Any] = None  # 🔧 FIX: Accept both dict and list
    credit_cards: Optional[list[dict]] = None  # 🆕 v3.8: 信用卡回饋資訊


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
    amount_jpy: Optional[float] = None  # Note: Field named amount_jpy for legacy, stores any currency amount
    currency: Optional[str] = "JPY"  # 🆕 Multi-currency support (default JPY for backward compat)
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
    currency: Optional[str] = None  # 🆕 Multi-currency support
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


# === Smart Search 模型 ===

class SmartSearchRequest(BaseModel):
    """🧠 智能語意搜尋請求"""
    query: str                          # 用戶自然語言輸入
    lat: float                          # 當前位置
    lng: float
    region: Optional[str] = None        # 區域名（如 "新宿"）
    trip_title: Optional[str] = None    # 行程標題（推斷國家）
    api_key: str                        # BYOK
    max_results: int = 3


class SmartSearchRecommendation(BaseModel):
    """單個推薦結果"""
    name: str
    reason: str
    highlights: List[str] = []
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None
    distance: Optional[int] = None      # 公尺


class SmartSearchResponse(BaseModel):
    """智能搜尋回應"""
    query_type: str                     # recommendation, nearby, specific
    understood_intent: str              # AI 理解的意圖
    recommendations: List[SmartSearchRecommendation]
    source: str                         # gemma, poi_fallback, geocode_fallback


class UpdateProfileRequest(BaseModel):
    """更新使用者資料請求"""
    name: Optional[str] = None
    avatar_url: Optional[str] = None
