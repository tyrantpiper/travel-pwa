import os
import time
import json
import asyncio
from datetime import datetime, timedelta

# AGY IDE 官方規範對齊：使用 .agents (複數) 作為自訂化根目錄
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS_DIR = os.path.join(PROJECT_ROOT, ".agents")
HISTORY_LOG_PATH = os.path.join(AGENTS_DIR, "session_history.log")
DREAM_MEMORY_PATH = os.path.join(AGENTS_DIR, "memory.md")
IDLE_THRESHOLD_SECONDS = 15 * 60  # 15 分鐘 (900秒)

# 依使用者決策：使用完全自動 (模式 A) 與便宜高速的 Gemini Flash
# 為了抵消「Instruction Rot」(指令腐爛) 的風險，加入自動 GC (垃圾回收)
GC_THRESHOLD_DAYS = 7

def get_last_interaction_time():
    if not os.path.exists(HISTORY_LOG_PATH):
        return None
    return os.path.getmtime(HISTORY_LOG_PATH)

def read_history():
    if not os.path.exists(HISTORY_LOG_PATH):
        return ""
    with open(HISTORY_LOG_PATH, "r", encoding="utf-8") as f:
        return f.read()

def clean_stale_memory():
    """清理超過 7 天未更新的舊記憶，防止 Instruction Rot"""
    if not os.path.exists(DREAM_MEMORY_PATH):
        return
    
    print(f"[{datetime.now()}] 🧹 執行記憶垃圾回收 (GC)...")
    # 實作：解析 memory.md 中的區塊，將超過 GC_THRESHOLD_DAYS 的 [STALE] 移除
    # 此處保留實作骨架，依實際 memory.md 格式延伸
    pass

async def trigger_llm_compaction(history_content):
    print(f"[{datetime.now()}] 🧠 Agent 進入睡眠狀態 (Auto Dream 啟動)...")
    
    # Semantic Deconstruction Prompt (已移除 No-ops)
    prompt = """
你現在處於 Auto Dream 狀態。對以下對話日誌進行 [Semantic Deconstruction]。

產出 < 5K 的 [Memory Gist]，包含三個區塊：
1. [Decisions]: 最終生效的架構決策與程式碼 Diffs。
2. [Failed Paths]: 嘗試過但失敗的路徑。格式：嘗試 X 解決 Y → 導致 Z。結論：專案中不使用 X。
3. [Vocabulary]: 本次新確認的領域術語 (同步至 CONTEXT.md)。

精簡的 Markdown。剔除所有 "I will now..." 等 Chain-of-Thought 碎念。
    """
    
    import subprocess
    
    print(f"[{datetime.now()}] 呼叫系統 mcp CLI 進行語意解構 (無金鑰模式)...")
    
    try:
        # 使用 MCP CLI 呼叫 LLM 算力
        process = subprocess.Popen(
            ["mcp", "invoke", "mcp_notebooklm_notebook_query"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8"
        )
        stdout, stderr = process.communicate(input=f"{prompt}\n\n{history_content}")
        
        if process.returncode == 0 and stdout.strip():
            final_result = stdout.strip()
        else:
            print(f"[{datetime.now()}] ⚠️ MCP CLI 呼叫失敗，進入備用模式。錯誤: {stderr}")
            final_result = f"## Auto Dream 壓縮摘要 (Fallback)\n\n### [Decisions]\n(MCP 呼叫失敗，請確保 `mcp` CLI 已安裝於環境中)"
    except Exception as e:
        print(f"[{datetime.now()}] ❌ CLI 呼叫發生例外錯誤: {e}")
        final_result = f"## Auto Dream 壓縮摘要 (Error)\n\n### [Decisions]\n(發生系統錯誤: {e})"
    
    # 直接覆寫正式記憶 (模式 A 完全自動)
    with open(DREAM_MEMORY_PATH, "w", encoding="utf-8") as f:
        f.write(final_result)
        
    print(f"[{datetime.now()}] 💾 Auto Dream 完成！記憶已寫入 {DREAM_MEMORY_PATH}")
    
    # 清空歷史日誌以備下一輪
    with open(HISTORY_LOG_PATH, "w", encoding="utf-8") as f:
        f.write("")

async def daemon_loop():
    print(f"[{datetime.now()}] 🌙 Auto Dream 守護進程已啟動。監控路徑: {HISTORY_LOG_PATH}")
    
    while True:
        last_time = get_last_interaction_time()
        
        if last_time:
            idle_time = time.time() - last_time
            if idle_time >= IDLE_THRESHOLD_SECONDS:
                history_content = read_history()
                if len(history_content.strip()) > 50:  # 確保有實質內容
                    await trigger_llm_compaction(history_content)
                    clean_stale_memory()
        
        await asyncio.sleep(60)  # 每分鐘檢查一次

if __name__ == "__main__":
    if not os.path.exists(AGENTS_DIR):
        os.makedirs(AGENTS_DIR)
    
    try:
        asyncio.run(daemon_loop())
    except KeyboardInterrupt:
        print("\nAuto Dream 守護進程已手動停止。")
