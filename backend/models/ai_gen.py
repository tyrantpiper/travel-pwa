from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class AICategory(str, Enum):
    food = "food"
    transport = "transport"
    sightseeing = "sightseeing"
    shopping = "shopping"
    nightlife = "nightlife"
    hotel = "hotel"
    rest = "rest"

class AIActivityItem(BaseModel):
    time: str = Field(description="Time slot (e.g., 08:30)", min_length=5, max_length=5)
    name: str = Field(description="Place name or activity title")
    desc: str = Field(max_length=50, description="Brief professional insight, strictly under 50 chars")
    category: AICategory
    link: Optional[str] = Field(None, description="Optional map or reference link")

class AIDayPlan(BaseModel):
    day: int = Field(description="Day number")
    activities: List[AIActivityItem] = Field(min_items=6, max_items=10, description="Mandatory 6-10 items per day")

class AITripItinerary(BaseModel):
    title: str = Field(description="Thematic trip title")
    days: List[AIDayPlan] = Field(min_items=1)
    ai_review: str = Field(description="A professional summary of the itinerary")
