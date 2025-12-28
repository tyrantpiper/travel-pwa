"""
Shared Constants
----------------
Centralized constants for use across all routers.
"""

# 需要處理日程資料的 Map 欄位
# 用於 delete_day, add_day 等函數中的 Deep Content Shift
DAY_MAP_FIELDS = [
    "daily_locations", 
    "day_notes", 
    "day_costs", 
    "day_tickets", 
    "day_checklists"
]

# Smart Clone 允許複製的欄位
# 排除花費 (day_costs) 與票券 (day_tickets)，因為這些應該是每天獨立的
CLONEABLE_FIELDS = [
    "daily_locations", 
    "day_notes", 
    "day_checklists"
]
