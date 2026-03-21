from typing import Dict, Any, Optional

def create_mock_wiki_result(
    status: str = "SUCCESS",
    cultural_desc: Optional[str] = "Wikipedia cultural insights.",
    travel_tips: Optional[str] = "Morning visit is best.",
    warnings: Optional[list] = None,
    official_url: str = "https://example.com"
) -> Dict[str, Any]:
    """
    獲取 POI Wiki 抓取結果的標準 Mock 對象。
    
    💼 合約規則 (Contract Rules):
    1. 如果 warnings 包含 {"WIKIPEDIA_NOT_FOUND", "WIKIPEDIA_TIMEOUT", "WIKIDATA_NOT_FOUND"}，
       status 必須自動降級為 "PARTIAL_SUCCESS" (除非原本是 FAILED)。
    2. 如果所有內容皆為空且 status 為 SUCCESS，自動降級為 FAILED。
    """
    final_warnings = warnings or []
    final_status = status
    
    # 規則 1: 降級判定
    critical_warnings = {"WIKIPEDIA_NOT_FOUND", "WIKIPEDIA_TIMEOUT", "WIKIDATA_NOT_FOUND"}
    if any(w in critical_warnings for w in final_warnings):
        if final_status == "SUCCESS":
            final_status = "PARTIAL_SUCCESS"
            
    # 規則 2: 敗部判定
    if final_status == "SUCCESS" and not cultural_desc and not travel_tips:
        final_status = "FAILED"
            
    return {
        "status": final_status,
        "cultural_desc": cultural_desc,
        "travel_tips": travel_tips,
        "resolved_language": "zh-TW",
        "warnings": final_warnings,
        "official_url": official_url
    }

def create_mock_ai_result(
    summary: str = "AI summary for Test POI.",
    rating: float = 4.5,
    must_try: Optional[list] = None
) -> Dict[str, Any]:
    """
    獲取 AI 摘要結果的標準 Mock 對象。
    """
    return {
        "summary": summary,
        "must_try": must_try or ["Local specialty"],
        "rating": rating,
        "business_status": "OPERATIONAL"
    }

def get_contract_combination_rules():
    """
    返回狀態組合的合約規則矩陣 (用於驗證 Router 層)
    """
    return [
        {"ai": True,  "wiki": "SUCCESS",         "expected": "SUCCESS"},
        {"ai": True,  "wiki": "PARTIAL_SUCCESS", "expected": "PARTIAL_SUCCESS"},
        {"ai": False, "wiki": "SUCCESS",         "expected": "PARTIAL_SUCCESS"},
        {"ai": False, "wiki": "FAILED",          "expected": "FAILED"}
    ]
