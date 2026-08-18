# -*- coding: utf-8 -*-
"""
Antigravity Agent Router (System 2: Deep Travel Researcher)
----------------------------------------------------------
Handles long-running autonomous research tasks, algorithmic constraint
optimization, and live booking/pricing data mesh using Google's
Interactions API with automated Gemini 3.7 Flash fallback defense.
"""

import os
import time
import uuid
import logging
import asyncio
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import httpx
from google import genai
from google.genai import types

from utils.deps import get_gemini_key
from utils.limiter import limiter

logger = logging.getLogger("ryan-travel-api")
router = APIRouter(prefix="/api/agents", tags=["agents"])

# In-memory store for fallback tasks
_FALLBACK_TASKS: Dict[str, Dict[str, Any]] = {}

TP_BASE = "https://api.travelpayouts.com"
TP_TOKEN = os.getenv("TP_API_TOKEN", "").strip()
TP_MARKER = os.getenv("NEXT_PUBLIC_TP_MARKER", os.getenv("TP_MARKER", "602410")).strip()


class AgentResearchRequest(BaseModel):
    prompt: str = Field(..., description="深度研究主題或複雜計算需求")
    destination: Optional[str] = Field(None, description="目的地城市或機場代碼 (如 NRT / TYO)")
    origin: Optional[str] = Field("TPE", description="出發地機場代碼")
    booking_context: Optional[str] = Field(None, description="用戶已確認的訂單/機票/住宿時間")
    environment: str = Field("remote", description="沙盒環境類型 (remote/local)")
    max_total_tokens: Optional[int] = Field(50000, description="Token 預算上限以防止循環死鎖")


async def _fetch_live_pricing_context(origin: str, destination: str) -> str:
    """
    從 Travelpayouts 抓取即時票價數據以注入 Agent 上下文
    """
    if not TP_TOKEN or not destination:
        return ""
    try:
        dest_clean = destination.strip().upper()[:3]
        orig_clean = origin.strip().upper()[:3]
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                f"{TP_BASE}/aviasales/v3/prices_for_dates",
                params={
                    "origin": orig_clean,
                    "destination": dest_clean,
                    "currency": "TWD",
                    "sorting": "price",
                    "limit": 3,
                    "unique": "false",
                },
                headers={"X-Access-Token": TP_TOKEN},
            )
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                if data:
                    lines = [f"【Travelpayouts 即時票價參考 ({orig_clean} ➔ {dest_clean})】:"]
                    for p in data[:3]:
                        price = p.get("price")
                        airline = p.get("airline", "航空")
                        dep = p.get("departure_at", "")
                        lines.append(f"- {airline} 出發日:{dep} 最低票價約 NT${price:,}")
                    lines.append(f"（分潤標記追蹤碼: {TP_MARKER}）")
                    return "\n".join(lines)
    except Exception as e:
        logger.warning(f"[Agents] Travelpayouts live pricing fetch skipped: {e}")
    return ""


async def _execute_flash_fallback_task(task_id: str, prompt: str, api_key: str):
    """
    沙盒排隊/不可用時的 3.7 Flash 64K 自動熔斷降級處理器
    """
    try:
        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            system_instruction=(
                "你是一位極致嚴謹的 AI 深度旅遊研究副官 (Deep Travel Researcher)。"
                "請針對使用者的複雜行程、預算精算、交通動線進行深度演算與真實性研究。"
                "如果提及機票或住宿，請標記即時預估價格與推薦預訂平台。"
                "請以 Markdown 結構化輸出（包含表格與分析），生成完畢後立即結束，嚴禁贅述。"
            )
        )
        # 非同步生成
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-3.7-flash",
            contents=prompt,
            config=config
        )
        _FALLBACK_TASKS[task_id] = {
            "status": "completed",
            "output_text": response.text or "",
            "engine": "gemini-3.7-flash-fallback",
            "completed_at": time.time()
        }
    except Exception as e:
        logger.error(f"[Agents] Flash fallback execution error: {e}")
        _FALLBACK_TASKS[task_id] = {
            "status": "failed",
            "error": str(e),
            "engine": "gemini-3.7-flash-fallback"
        }


@router.post("/research")
async def start_deep_research(
    body: AgentResearchRequest,
    api_key: str = Depends(get_gemini_key)
):
    """
    啟動 Antigravity 代理人沙盒或 3.7 Flash 降級引擎進行背景深度研究
    """
    # 1. 構建包含即時訂單與 Travelpayouts 票價的強化 Prompt
    live_pricing = ""
    if body.destination:
        live_pricing = await _fetch_live_pricing_context(body.origin or "TPE", body.destination)

    context_blocks = []
    if body.booking_context:
        context_blocks.append(f"【用戶已確認訂單/住宿資料】:\n{body.booking_context}")
    if live_pricing:
        context_blocks.append(live_pricing)

    # 注入 Ralph Loop 防死鎖終止錨點
    termination_anchor = (
        "\n【系統指令】：請自主在 Linux 沙盒中計算最佳解或爬取真實資料。"
        "生成完結構化 Markdown 旅遊精算報告後立即結束任務，請勿進行重複循環測試。"
    )

    enhanced_prompt = (
        ("\n\n".join(context_blocks) + "\n\n" if context_blocks else "")
        + f"【研究任務需求】：\n{body.prompt}"
        + termination_anchor
    )

    # 2. 嘗試調用 Antigravity Interactions API
    try:
        client = genai.Client(api_key=api_key)
        # 🛡️ 遵循 NotebookLM 規範：嚴禁傳遞 temperature 等取樣參數以免 400 錯誤
        interaction = client.interactions.create(
            agent="antigravity-preview-05-2026",
            input=enhanced_prompt,
            environment=body.environment,
            background=True,
            store=True
        )
        return {
            "status": "started",
            "interaction_id": interaction.id,
            "engine": "antigravity",
            "message": "Antigravity Linux 沙盒已成功啟動"
        }
    except Exception as e:
        logger.warning(f"[Agents] Antigravity interactions.create failed ({e}). Falling back to Gemini 3.7 Flash...")
        # 🛡️ 關鍵 0.5 分自動熔斷降級：建立背景 Flash 任務
        task_id = f"fallback_{uuid.uuid4().hex[:12]}"
        _FALLBACK_TASKS[task_id] = {
            "status": "running",
            "output_text": None,
            "engine": "gemini-3.7-flash-fallback",
            "started_at": time.time()
        }
        asyncio.create_task(_execute_flash_fallback_task(task_id, enhanced_prompt, api_key))
        return {
            "status": "started",
            "interaction_id": task_id,
            "engine": "gemini-3.7-flash-fallback",
            "message": "Antigravity 沙盒排隊中，已自動無縫切換至 Gemini 3.7 Flash 深度推論引擎"
        }


@router.get("/interactions/{interaction_id}")
async def get_interaction_status(
    interaction_id: str,
    api_key: str = Depends(get_gemini_key)
):
    """
    獲取或輪詢 Antigravity 代理人任務進度與研究成果
    """
    # 檢查是否為降級任務
    if interaction_id.startswith("fallback_"):
        task = _FALLBACK_TASKS.get(interaction_id)
        if not task:
            raise HTTPException(status_code=404, detail="Fallback 任務不存在")
        return {
            "id": interaction_id,
            "status": task.get("status", "unknown"),
            "output_text": task.get("output_text"),
            "engine": task.get("engine", "gemini-3.7-flash-fallback")
        }

    # 正常 Antigravity 查詢
    try:
        client = genai.Client(api_key=api_key)
        interaction = client.interactions.get(id=interaction_id)
        raw_status = str(getattr(interaction, "status", getattr(interaction, "state", "completed"))).lower()
        if "progress" in raw_status or "running" in raw_status:
            normalized_status = "running"
        elif "fail" in raw_status:
            normalized_status = "failed"
        elif "cancel" in raw_status:
            normalized_status = "cancelled"
        else:
            normalized_status = "completed"

        out_text = (
            getattr(interaction, "output_text", None) or
            getattr(interaction, "text", None) or
            getattr(interaction, "output", None)
        )
        return {
            "id": interaction.id,
            "status": normalized_status,
            "output_text": out_text,
            "engine": "antigravity"
        }
    except Exception as e:
        logger.error(f"[Agents] Failed to get interaction {interaction_id}: {e}")
        raise HTTPException(status_code=500, detail=f"獲取任務狀態失敗: {str(e)}")


@router.post("/interactions/{interaction_id}/cancel")
async def cancel_interaction(
    interaction_id: str,
    api_key: str = Depends(get_gemini_key)
):
    """
    🛑 主動取消正在執行的 Antigravity 沙盒任務以節省 Token
    """
    if interaction_id.startswith("fallback_"):
        if interaction_id in _FALLBACK_TASKS:
            _FALLBACK_TASKS[interaction_id]["status"] = "cancelled"
            return {"status": "cancelled", "id": interaction_id}
        raise HTTPException(status_code=404, detail="任務不存在")

    try:
        client = genai.Client(api_key=api_key)
        client.interactions.cancel(id=interaction_id)
        return {"status": "cancelled", "id": interaction_id}
    except Exception as e:
        logger.error(f"[Agents] Failed to cancel interaction {interaction_id}: {e}")
        raise HTTPException(status_code=500, detail=f"取消任務失敗: {str(e)}")
