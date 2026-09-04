import os
import sys
import time
import json
import asyncio
import argparse
import subprocess
import shutil
from datetime import datetime, timedelta

def safe_print(*args, **kwargs):
    """Safely print messages, ignoring errors if sys.stdout is detached."""
    if sys.stdout and hasattr(sys.stdout, 'write'):
        try:
            print(*args, **kwargs)
        except Exception:
            pass

# Fix Windows cp950 encoding issues with emojis
if sys.stdout and hasattr(sys.stdout, 'encoding') and sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# AGY IDE 官方規範對齊：使用 .agents (複數) 作為自訂化根目錄
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS_DIR = os.path.join(PROJECT_ROOT, ".agents")
HISTORY_LOG_PATH = os.path.join(AGENTS_DIR, "session_history.log")
DREAM_MEMORY_PATH = os.path.join(AGENTS_DIR, "memory.md")
IDLE_THRESHOLD_SECONDS = 15 * 60  # 15 分鐘 (900秒)

# 為了抵消「Instruction Rot」(指令腐爛) 的風險，加入自動 GC (垃圾回收)
GC_THRESHOLD_DAYS = 7

# 解析 agy 執行檔路徑
AGY_CMD = os.environ.get("AGY_BIN", "agy")
if not shutil.which(AGY_CMD):
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    fallback_agy = os.path.join(local_app_data, "agy", "bin", "agy.exe")
    if os.path.exists(fallback_agy):
        AGY_CMD = fallback_agy

def get_last_interaction_time():
    if not os.path.exists(HISTORY_LOG_PATH):
        return None
    return os.path.getmtime(HISTORY_LOG_PATH)

def read_history(path=HISTORY_LOG_PATH):
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def read_existing_memory():
    if not os.path.exists(DREAM_MEMORY_PATH):
        return "無舊有記憶。"
    with open(DREAM_MEMORY_PATH, "r", encoding="utf-8") as f:
        return f.read()

def clean_stale_memory():
    """清理超過 7 天未更新的舊記憶，防止 Instruction Rot"""
    if not os.path.exists(DREAM_MEMORY_PATH):
        return
    
    safe_print(f"[{datetime.now()}] 🧹 執行記憶垃圾回收 (GC)...")
    # AI 融合模式已隱含垃圾回收能力，此處僅作為保留
    pass

async def trigger_llm_compaction(history_content):
    safe_print(f"[{datetime.now()}] 🧠 [Brain] 正在進行神經壓縮與融合，請稍候...")
    
    old_memory = read_existing_memory()
    
    prompt = f"""
你現在處於 Auto Dream 狀態。請執行 [AI Recombination]。
輸入 1 (舊有大腦記憶):
{old_memory}

輸入 2 (今日新增日誌):
{history_content}

請將兩者融合，剔除冗餘，產出極度精煉的全新 Markdown 記憶，必須嚴格包含以下四個區塊：
1. [Decisions]: 最終生效的架構決策。
2. [Failed Paths]: 踩過的坑與絕對不用的方法。
3. [Technical Debt]: 專案中留下的技術債與待辦。
4. [Vocabulary]: 領域術語。

請只輸出 Markdown 內容，不要包含任何開場白。
    """
    
    try:
        # 使用 Antigravity CLI 進行壓縮 (非同步執行，帶 --print 與 30 秒安全停損)
        process = await asyncio.create_subprocess_exec(
            AGY_CMD,
            "--print",
            prompt[:8000],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=30)
        
        stdout = stdout_bytes.decode('utf-8') if stdout_bytes else ""
        stderr = stderr_bytes.decode('utf-8') if stderr_bytes else ""
        
        if process.returncode == 0 and stdout.strip() and ("[Decisions]" in stdout or "##" in stdout):
            final_result = stdout.strip()
            # 寫入融合後的新記憶 (完全覆寫，因為是 AI Recombination)
            with open(DREAM_MEMORY_PATH, "w", encoding="utf-8") as f:
                f.write(final_result)
            safe_print(f"[{datetime.now()}] 💾 Auto Dream 完成！神經重組已寫入 {DREAM_MEMORY_PATH}")
            return True
        else:
            safe_print(f"[{datetime.now()}] ⚠️ 壓縮未達標或返回異常 ({stderr})，維持既有記憶結構。")
            return False
            
    except asyncio.TimeoutError:
        safe_print(f"[{datetime.now()}] ⚠️ Auto Dream 呼叫逾時 (30s)，觸發安全防護機制，維持既有記憶結構。")
        return False
    except Exception as e:
        safe_print(f"[{datetime.now()}] ❌ 核心引擎發生例外錯誤: {e}")
        return False

async def daemon_loop():
    safe_print(f"[{datetime.now()}] 🌙 Auto Dream 守護進程已啟動。監控路徑: {HISTORY_LOG_PATH}")
    
    while True:
        last_time = get_last_interaction_time()
        
        if last_time:
            idle_time = time.time() - last_time
            if idle_time >= IDLE_THRESHOLD_SECONDS:
                history_content = read_history()
                if len(history_content.strip()) > 50:  # 確保有實質內容
                    success = await trigger_llm_compaction(history_content)
                    if success:
                        # 只有成功才清空
                        with open(HISTORY_LOG_PATH, "w", encoding="utf-8") as f:
                            f.write("")
                    clean_stale_memory()
        
        await asyncio.sleep(60)  # 每分鐘檢查一次

if __name__ == "__main__":
    if not os.path.exists(AGENTS_DIR):
        os.makedirs(AGENTS_DIR)
        
    parser = argparse.ArgumentParser(description="Tabidachi Tiered Memory Consolidation")
    parser.add_argument("--trigger", help="手動觸發名稱 (例如 'Daily Wrap-up')")
    parser.add_argument("--inject-report", help="實體報告路徑 (注入神經)")
    parser.add_argument("--daemon", action="store_true", help="強制啟動背景監控")
    
    args = parser.parse_args()
    
    try:
        if args.trigger or args.inject_report:
            safe_print(f"[{datetime.now()}] 🚀 接收到手動神經注入觸發: {args.trigger or 'Report Injection'}")
            content_to_inject = ""
            
            if args.inject_report:
                if os.path.exists(args.inject_report):
                    with open(args.inject_report, "r", encoding="utf-8") as f:
                        content_to_inject += f"\n--- [手動注入報告: {args.inject_report}] ---\n"
                        content_to_inject += f.read()
                else:
                    safe_print(f"[{datetime.now()}] ❌ 找不到指定的注入報告: {args.inject_report}")
                    sys.exit(1)
            else:
                # 如果沒有指定實體報告，則讀取目前的 history log
                content_to_inject = read_history()
            
            if len(content_to_inject.strip()) > 50:
                success = asyncio.run(trigger_llm_compaction(content_to_inject))
                if success and not args.inject_report:
                    # 只有未指定注入報告且成功時，才清空 history
                    with open(HISTORY_LOG_PATH, "w", encoding="utf-8") as f:
                        f.write("")
            else:
                safe_print(f"[{datetime.now()}] ℹ️ 沒有足夠的內容可供壓縮。")
                
        else:
            # 預設為 Daemon 模式
            asyncio.run(daemon_loop())
    except KeyboardInterrupt:
        safe_print("\nAuto Dream 進程已手動停止。")
