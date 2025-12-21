#!/usr/bin/env python3
"""
Ryan Travel App - 用量監測腳本
每 3 天執行一次，發送 Email 報告
"""

import os
import requests
from datetime import datetime, timedelta

# ============================================
# 配置
# ============================================

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN")
SUPABASE_ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN")
SUPABASE_PROJECT_ID = os.environ.get("SUPABASE_PROJECT_ID")
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
REPORT_EMAIL = os.environ.get("REPORT_EMAIL")

# 免費額度限制
LIMITS = {
    "vercel_bandwidth_gb": 100,
    "supabase_db_mb": 500,
    "cloudinary_storage_gb": 25,
    "cloudinary_bandwidth_gb": 25,
}


def create_progress_bar(percentage: float, width: int = 20) -> str:
    """創建視覺化進度條"""
    filled = int(width * percentage / 100)
    empty = width - filled
    bar = "▓" * filled + "░" * empty
    return f"{bar} {percentage:.1f}%"


def get_status_emoji(percentage: float) -> str:
    """根據使用量返回狀態 emoji"""
    if percentage >= 90:
        return "🔴"
    elif percentage >= 80:
        return "🟠"
    elif percentage >= 50:
        return "🟡"
    return "🟢"


# ============================================
# Vercel 用量查詢
# ============================================

def get_vercel_usage() -> dict:
    """查詢 Vercel 頻寬使用量"""
    if not VERCEL_TOKEN:
        return {"error": "未設定 VERCEL_TOKEN"}
    
    try:
        # 獲取當前計費週期
        headers = {"Authorization": f"Bearer {VERCEL_TOKEN}"}
        
        # 獲取用量數據
        response = requests.get(
            "https://api.vercel.com/v1/usage",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            # Vercel API 返回的是 bytes，轉換為 GB
            bandwidth_bytes = data.get("bandwidth", {}).get("value", 0)
            bandwidth_gb = bandwidth_bytes / (1024 ** 3)
            percentage = (bandwidth_gb / LIMITS["vercel_bandwidth_gb"]) * 100
            
            return {
                "bandwidth_gb": round(bandwidth_gb, 2),
                "limit_gb": LIMITS["vercel_bandwidth_gb"],
                "percentage": round(percentage, 1),
            }
        else:
            return {"error": f"API 錯誤: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# Supabase 用量查詢
# ============================================

def get_supabase_usage() -> dict:
    """查詢 Supabase 資料庫大小"""
    if not SUPABASE_ACCESS_TOKEN or not SUPABASE_PROJECT_ID:
        return {"error": "未設定 SUPABASE_ACCESS_TOKEN 或 SUPABASE_PROJECT_ID"}
    
    try:
        headers = {"Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}"}
        
        response = requests.get(
            f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT_ID}/database/size",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            db_size_mb = data.get("size_mb", 0)
            percentage = (db_size_mb / LIMITS["supabase_db_mb"]) * 100
            
            return {
                "db_size_mb": round(db_size_mb, 2),
                "limit_mb": LIMITS["supabase_db_mb"],
                "percentage": round(percentage, 1),
            }
        else:
            return {"error": f"API 錯誤: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# Cloudinary 用量查詢
# ============================================

def get_cloudinary_usage() -> dict:
    """查詢 Cloudinary 儲存和頻寬使用量"""
    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
        return {"error": "未設定 Cloudinary 憑證"}
    
    try:
        response = requests.get(
            f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/usage",
            auth=(CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # 儲存空間 (bytes -> GB)
            storage_bytes = data.get("storage", {}).get("usage", 0)
            storage_gb = storage_bytes / (1024 ** 3)
            storage_percentage = (storage_gb / LIMITS["cloudinary_storage_gb"]) * 100
            
            # 頻寬 (bytes -> GB)
            bandwidth_bytes = data.get("bandwidth", {}).get("usage", 0)
            bandwidth_gb = bandwidth_bytes / (1024 ** 3)
            bandwidth_percentage = (bandwidth_gb / LIMITS["cloudinary_bandwidth_gb"]) * 100
            
            return {
                "storage_gb": round(storage_gb, 2),
                "storage_limit_gb": LIMITS["cloudinary_storage_gb"],
                "storage_percentage": round(storage_percentage, 1),
                "bandwidth_gb": round(bandwidth_gb, 2),
                "bandwidth_limit_gb": LIMITS["cloudinary_bandwidth_gb"],
                "bandwidth_percentage": round(bandwidth_percentage, 1),
            }
        else:
            return {"error": f"API 錯誤: {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# 生成報告
# ============================================

def generate_report() -> str:
    """生成完整的用量報告"""
    
    now = datetime.now()
    report_date = now.strftime("%Y-%m-%d")
    
    vercel = get_vercel_usage()
    supabase = get_supabase_usage()
    cloudinary = get_cloudinary_usage()
    
    # 計算整體狀態
    all_percentages = []
    if "percentage" in vercel:
        all_percentages.append(vercel["percentage"])
    if "percentage" in supabase:
        all_percentages.append(supabase["percentage"])
    if "storage_percentage" in cloudinary:
        all_percentages.append(cloudinary["storage_percentage"])
        all_percentages.append(cloudinary["bandwidth_percentage"])
    
    max_percentage = max(all_percentages) if all_percentages else 0
    overall_status = "✅ 所有服務運作正常！" if max_percentage < 80 else "⚠️ 注意：有服務接近額度上限！"
    
    report = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Ryan Travel App 用量報告
📅 報告日期: {report_date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Vercel (前端託管)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    if "error" in vercel:
        report += f"""📍 請手動查看 Dashboard:
   https://vercel.com/tyrantpiper/travel-pwa/usage

💡 什麼是頻寬？
   每次有人訪問你的網站，瀏覽器需要下載網頁檔案，
   這些下載量的總和就是「頻寬」。
   免費額度: 100GB/月 ≈ 10 萬次頁面瀏覽
"""
    
    report += """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 Supabase (資料庫)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    if "error" in supabase:
        report += f"""📍 請手動查看 Dashboard:
   https://supabase.com/dashboard/project/{SUPABASE_PROJECT_ID}

💡 什麼是資料庫大小？
   所有行程、費用、用戶資料加起來的儲存空間。
   免費額度: 500MB ≈ 10 萬筆行程項目
"""
    
    report += """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ Cloudinary (圖片存儲)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    if "error" in cloudinary:
        report += f"❌ 無法取得資料: {cloudinary['error']}\n"
    else:
        storage_emoji = get_status_emoji(cloudinary["storage_percentage"])
        bandwidth_emoji = get_status_emoji(cloudinary["bandwidth_percentage"])
        report += f"""儲存空間: {cloudinary['storage_gb']} GB / {cloudinary['storage_limit_gb']} GB
{create_progress_bar(cloudinary['storage_percentage'])} {storage_emoji}

本月頻寬: {cloudinary['bandwidth_gb']} GB / {cloudinary['bandwidth_limit_gb']} GB
{create_progress_bar(cloudinary['bandwidth_percentage'])} {bandwidth_emoji}

💡 什麼是圖片頻寬？
   每次有人查看收據照片，就會消耗頻寬。
   25GB 大約等於 5000 張圖片被瀏覽。
"""
    
    report += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 狀態總結
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{overall_status}

⚠️ 警告閾值: 當任一服務超過 80% 會特別標註

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 專有名詞小辭典
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• API: 讓程式之間互相溝通的介面，像是餐廳的菜單
• Token: 一串密碼，讓你的程式有權限存取服務
• GB/MB: 資料大小單位，1GB = 1000MB = 約 1000 張照片
• 頻寬: 資料傳輸量，像是水管流過的水量
• 資料庫: 儲存所有資料的地方，像是一個超大的 Excel 表格
• CDN: 分散在全球的伺服器，讓網站載入更快

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 此報告由 GitHub Actions 自動生成
下次報告時間: {(now + timedelta(days=3)).strftime("%Y-%m-%d")}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
    
    return report


# ============================================
# 發送 Email
# ============================================

def send_email(report: str):
    """使用 Resend 發送 Email"""
    if not RESEND_API_KEY or not REPORT_EMAIL:
        print("❌ 未設定 RESEND_API_KEY 或 REPORT_EMAIL")
        return False
    
    import resend
    resend.api_key = RESEND_API_KEY
    
    try:
        # 將純文字報告轉為 HTML (保留格式)
        html_report = f"<pre style='font-family: monospace; font-size: 14px; line-height: 1.5;'>{report}</pre>"
        
        params = {
            "from": "Ryan Travel App <onboarding@resend.dev>",
            "to": [REPORT_EMAIL],
            "subject": f"📊 Ryan Travel App 用量報告 - {datetime.now().strftime('%Y-%m-%d')}",
            "html": html_report,
        }
        
        email = resend.Emails.send(params)
        print(f"✅ Email 發送成功！ID: {email['id']}")
        return True
    except Exception as e:
        print(f"❌ Email 發送失敗: {e}")
        return False


# ============================================
# 主程式
# ============================================

if __name__ == "__main__":
    print("🔍 開始收集用量資料...")
    report = generate_report()
    
    print("\n" + "=" * 50)
    print(report)
    print("=" * 50 + "\n")
    
    print("📧 發送 Email 報告...")
    send_email(report)
