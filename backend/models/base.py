"""
Pydantic Models for Ryan Travel API
Extracted from main.py for better code organization
V23.1 Strict Financial Standard
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


# === 基本請求模型 ===

class UserPreferences(BaseModel):
    """用戶偏好設定（用於行程生成）"""
    destination: str
    days: int
    budget: str
    interests: List[str] = Field(default_factory=list)


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


# === 記帳與財務模型 (V23.1 Standard) ===

class ReceiptDiagnostics(BaseModel):
    """診斷資訊模型"""
    status: str = "pass"        # pass | warning
    source: str = "ai"          # ai | user
    code: Optional[str] = None
    message: Optional[str] = None
    mismatch_amount: float = 0.0


class ExpenseItem(BaseModel):
    """消費細目項目"""
    original_name: str
    translated_name: Optional[str] = None
    amount: float


class ReceiptExtraction(BaseModel):
    """AI 收據解析結果模型 (與 API 保持一致)"""
    title: str
    date: str
    currency: str
    subtotal_amount: float
    tax_amount: float = 0.0
    tip_amount: float = 0.0
    service_charge_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float
    category: str
    items: List[ExpenseItem] = Field(default_factory=list)


class ActuaryRequest(BaseModel):
    """AI 精算師對話請求"""
    expenses: List[dict] = Field(default_factory=list)
    members: List[dict] = Field(default_factory=list)
    message: str
    history: List[dict] = Field(default_factory=list)


class ReceiptRequest(BaseModel):
    """收據解析/匯入請求"""
    imageUrl: Optional[str] = None
    image: Optional[str] = None      # 🆕 Base64 資料
    mime_type: Optional[str] = None  # 🆕 圖片類型
    user_id: Optional[str] = None
    title: Optional[str] = None
    amount_jpy: Optional[float] = None  # Legacy, stores any currency amount
    currency: Optional[str] = "JPY"
    exchange_rate: Optional[float] = None
    payment_method: Optional[str] = None


class ExpenseRequest(BaseModel):
    """新增消費請求"""
    itinerary_id: Optional[str] = None
    title: Optional[str] = None
    amount_jpy: Optional[float] = None   # Legacy compatibility
    total_amount: Optional[float] = None # Modern naming
    subtotal_amount: float = 0.0
    tax_amount: float = 0.0
    tip_amount: float = 0.0
    service_charge_amount: float = 0.0
    discount_amount: float = 0.0
    currency: str = "JPY"
    exchange_rate: Optional[float] = None
    payment_method: Optional[str] = None
    category: str = "其他"
    is_public: bool = True
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    card_name: Optional[str] = None
    cashback_rate: float = 0.0
    image_url: Optional[str] = None
    expense_date: Optional[str] = None
    items: List[ExpenseItem] = Field(default_factory=list) # Detailed breakdown
    diagnostics: Optional[ReceiptDiagnostics] = None     # AI/Manual validation info
    custom_icon: Optional[str] = None                    # Emoji or custom icon
    notes: Optional[str] = None                          # User-provided notes/remarks
    payer_id: Optional[str] = None                       # ID of the person who paid


class UpdateExpenseRequest(BaseModel):
    """更新消費請求"""
    title: Optional[str] = None
    amount_jpy: Optional[float] = None
    total_amount: Optional[float] = None
    subtotal_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    tip_amount: Optional[float] = None
    service_charge_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    currency: Optional[str] = None
    is_public: Optional[bool] = None
    payment_method: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    expense_date: Optional[str] = None
    exchange_rate: Optional[float] = None
    card_name: Optional[str] = None
    cashback_rate: Optional[float] = None
    items: Optional[List[ExpenseItem]] = None
    diagnostics: Optional[ReceiptDiagnostics] = None
    custom_icon: Optional[str] = None
    notes: Optional[str] = None
    payer_id: Optional[str] = None


class ExpenseResponse(BaseModel):
    """消費回應模型 (與前端 API 閉環)"""
    id: str
    itinerary_id: str
    title: str
    total_amount: float     # API Unified Name
    amount: float = 0.0     # Legacy Fallback (v23.1 Sync)
    subtotal_amount: float
    tax_amount: float
    tip_amount: float
    service_charge_amount: float
    discount_amount: float
    currency: str
    category: str
    is_public: bool
    expense_date: Optional[str] = None
    payment_method: Optional[str] = None
    exchange_rate: Optional[float] = None
    items: List[ExpenseItem] = Field(default_factory=list)
    diagnostics: ReceiptDiagnostics
    details_schema_version: int
    created_at: Optional[str] = None
    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    image_url: Optional[str] = None      # Receipt image URL
    card_name: Optional[str] = None      # Credit card identifier
    cashback_rate: float = 0.0           # Cashback percentage
    custom_icon: Optional[str] = None     # Display icon
    notes: Optional[str] = None           # Persistent remarks
    payer_id: Optional[str] = None        # Payer UUID


# === 地理編碼模型 ===

class GeocodeSearchRequest(BaseModel):
    """地理編碼搜尋請求"""
    query: str
    limit: int = 5
    tripTitle: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    country: Optional[str] = None
    region: Optional[str] = None
    zoom: Optional[float] = None


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
    cost_amount: float = 0.0
    tags: List[str] = Field(default_factory=list)
    reservation_code: str = ""
    sub_items: List[dict] = Field(default_factory=list)
    link_url: Optional[str] = None
    website_link: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    preview_metadata: Dict[str, Any] = Field(default_factory=dict)
    hide_navigation: bool = False
    memo: Optional[str] = None
    is_private: bool = False
    is_highlight: bool = False


class SaveItineraryRequest(BaseModel):
    """儲存行程請求"""
    title: str
    creator_name: str
    user_id: str
    items: List[ItineraryItem] = Field(default_factory=list)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    daily_locations: Dict[str, Any] = Field(default_factory=dict)
    day_notes: Dict[str, Any] = Field(default_factory=dict)
    day_costs: Dict[str, Any] = Field(default_factory=dict)
    day_tickets: Dict[str, Any] = Field(default_factory=dict)
    day_checklists: Dict[str, Any] = Field(default_factory=dict)
    ai_review: Optional[str] = None
    public_id: Optional[str] = None


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
    cost_amount: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    memo: Optional[str] = None
    sub_items: Optional[List[dict]] = None
    link_url: Optional[str] = None
    website_link: Optional[str] = None
    reservation_code: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    preview_metadata: Optional[Dict[str, Any]] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    sort_order: Optional[int] = None
    hide_navigation: Optional[bool] = None
    is_private: Optional[bool] = None
    is_highlight: Optional[bool] = None


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
    image_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    memo: Optional[str] = None
    link_url: Optional[str] = None
    website_link: Optional[str] = None
    reservation_code: Optional[str] = None
    cost_amount: float = 0.0
    sub_items: List[dict] = Field(default_factory=list)
    preview_metadata: Dict[str, Any] = Field(default_factory=dict)
    hide_navigation: bool = False
    is_private: bool = False
    is_highlight: bool = False


class ReorderItemRequest(BaseModel):
    """單一項目的排序更新"""
    item_id: str
    sort_order: int
    time_slot: Optional[str] = None


class ReorderRequest(BaseModel):
    """批次排序更新請求"""
    items: List[ReorderItemRequest] = Field(default_factory=list)
    adjust_times: bool = False


class ImportToTripRequest(BaseModel):
    """匯入到現有行程請求學"""
    trip_id: str
    items: List[ItineraryItem] = Field(default_factory=list)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    daily_locations: Dict[str, Any] = Field(default_factory=dict)
    day_notes: Dict[str, Any] = Field(default_factory=dict)
    day_costs: Dict[str, Any] = Field(default_factory=dict)
    day_tickets: Dict[str, Any] = Field(default_factory=dict)
    day_checklists: Dict[str, Any] = Field(default_factory=dict)
    ai_review: Optional[str] = None


class UpdateDayDataRequest(BaseModel):
    """更新每日資訊請求"""
    day: int
    day_notes: Optional[dict] = None
    day_costs: Optional[dict] = None
    day_tickets: Optional[dict] = None
    day_checklists: Optional[dict] = None
    day_ai_reviews: Optional[dict] = None


class AddDayRequest(BaseModel):
    """新增天數請求"""
    position: str = "end"
    clone_content: bool = False


class AppendItemsRequest(BaseModel):
    """追加細項到行程請求"""
    items: List[ItineraryItem] = Field(default_factory=list)


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


class UpdateInfoRequest(BaseModel):
    """更新行程資訊請求（航班/飯店/卡片）"""
    flight_info: Optional[dict] = None
    hotel_info: Optional[Any] = None
    credit_cards: Optional[List[dict]] = None


class RouteStop(BaseModel):
    """路線停靠點"""
    lat: float
    lng: float
    name: Optional[str] = None


class RouteRequest(BaseModel):
    """路線規劃請求"""
    stops: List[RouteStop] = Field(default_factory=list)
    mode: str = "walk"
    optimize: bool = False


class ChatRequest(BaseModel):
    """AI 聊天請求"""
    message: str
    history: List[dict] = Field(default_factory=list)
    thought_signatures: Optional[List[dict]] = None
    image: Optional[str] = None
    location: Optional[dict] = None
    current_itinerary: Optional[dict] = None
    focused_day: Optional[int] = None


class SummarizeRequest(BaseModel):
    """記憶摘要請求"""
    history: List[dict] = Field(default_factory=list)


class POIAIEnrichRequest(BaseModel):
    """POI AI 增強請求"""
    name: str
    type: str
    lat: float
    lng: float
    poi_id: Optional[str] = None
    wikidata_id: Optional[str] = None
    api_key: Optional[str] = None


class POIEnrichRequest(BaseModel):
    """POI 三源整合請求"""
    name: str
    wikidata_id: Optional[str] = None


class POIRecommendRequest(BaseModel):
    """POI AI 推薦請求"""
    pois: List[dict] = Field(default_factory=list)
    user_query: str
    api_key: str
    user_preferences: Optional[dict] = None


class SmartSearchRequest(BaseModel):
    """🧠 智能語意搜尋請求"""
    query: str
    lat: float
    lng: float
    region: Optional[str] = None
    trip_title: Optional[str] = None
    api_key: str
    max_results: int = 3


class SmartSearchRecommendation(BaseModel):
    """單個推薦結果"""
    name: str
    reason: str
    highlights: List[str] = Field(default_factory=list)
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None
    distance: Optional[int] = None


class SmartSearchResponse(BaseModel):
    """智能搜尋回應"""
    query_type: str
    understood_intent: str
    recommendations: List[SmartSearchRecommendation] = Field(default_factory=list)
    source: str


class UpdateProfileRequest(BaseModel):
    """更新使用者資料請求"""
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class ResolveLinkRequest(BaseModel):
    """解析地圖連結請求"""
    url: str


class UpdateTripTitleRequest(BaseModel):
    """更新行程標題請求"""
    title: str
