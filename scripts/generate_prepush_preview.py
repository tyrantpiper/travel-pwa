import os
import re
import subprocess

# 類別定義
CATEGORIES = {
    "1. 🚀 生產環境核心 (Production Core)": [],
    "2. 🗄️ 資料庫遷移與結構 (Migrations & Schema)": [],
    "3. 🧪 測試套件 (Testing Suite)": [],
    "4. 🤖 AI 功能開發/審核專區 (AI & Audit Research)": [],
    "5. 🛠️ 系統維護與自動化工具 (DevOps & Tools)": [],
    "6. ⚠️ 遺留備份與暫存 (Backups & Staging)": [],
    "7. 🧹 應清理的垃圾與日誌 (To be Junked/Logs)": [],
    "8. ❓ 未知/需人工審閱 (UNKNOWN / REVIEW REQUIRED)": []
}

def classify_file(line):
    # 解析 git status --porcelain 輸出
    status = line[:2]
    path = line[3:].strip().replace('"', '')
    
    # 邏輯 7: 垃圾與日誌
    if any(x in path for x in ["pytest_", "lint_output.txt", "audit_results.txt", "sim_out.txt", "tmp/"]):
        return "7. 🧹 應清理的垃圾與日誌 (To be Junked/Logs)", path
    
    # 邏輯 6: 備份與暫存
    if any(path.endswith(ext) for ext in [".bak", ".pre_restore", ".bak", "git_status_clean.txt"]):
        return "6. ⚠️ 遺留備份與暫存 (Backups & Staging)", path
    if ".py.bak" in path or ".bak" in path:
         return "6. ⚠️ 遺留備份與暫存 (Backups & Staging)", path

    # 邏輯 2: 資料庫遷移
    if "backend/migrations/" in path and path.endswith(".sql"):
        return "2. 🗄️ 資料庫遷移與結構 (Migrations & Schema)", path
    if "backend/models/" in path:
        return "2. 🗄️ 資料庫遷移與結構 (Migrations & Schema)", path

    # 邏輯 3: 測試套件
    if "backend/tests/" in path or "frontend/__tests__/" in path or "test_" in os.path.basename(path) or ".test." in path:
        if not path.endswith(".bak"): # 排除備份
            return "3. 🧪 測試套件 (Testing Suite)", path

    # 邏輯 4: AI 研究與審計 (高敏感度匹配)
    ai_patterns = [
        r"v1[\d]_", r"simulate_ai", r"parse-receipt", r"parse_receipt", 
        r"ai_snippet", r"ai_circuit", r"receipt_logic", r"rethink_ai",
        r"test_ai_endpoints", r"test_v15_final"
    ]
    if any(re.search(p, path) for p in ai_patterns):
        return "4. 🤖 AI 功能開發/審核專區 (AI & Audit Research)", path

    # 邏輯 5: 系統工具
    if path.startswith("scripts/") or path.endswith(".ps1"):
        # 排除已分類的 AI 腳本
        return "5. 🛠️ 系統維護與自動化工具 (DevOps & Tools)", path

    # 邏輯 1: 生產核心
    prod_paths = ["backend/main.py", "backend/routers/", "backend/services/", "backend/utils/", "backend/requirements.txt",
                  "frontend/components/", "frontend/lib/", "frontend/hooks/", "frontend/package-lock.json", "frontend/app/"]
    if any(path.startswith(p) or p in path for p in prod_paths):
        # 二次排除：確保不是備份或測試
        if not any(x in path for x in [".bak", "tests", "test_"]):
            return "1. 🚀 生產環境核心 (Production Core)", path

    # 兜底：未知類別
    return "8. ❓ 未知/需人工審閱 (UNKNOWN / REVIEW REQUIRED)", path

def main():
    try:
        result = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split('\n')
        lines = [line for line in lines if line.strip()]
        
        total_items = len(lines)
        print(f"Detected {total_items} items in Git status.")

        for line in lines:
            category, path = classify_file(line)
            CATEGORIES[category].append(path)

        # 生成報告
        with open("pre_push_preview.md", "w", encoding="utf-8-sig") as f:
            f.write("# 🛡️ Pre-push Preview: Source Control 項目嚴密分類報告\n\n")
            f.write(f"**總計項目數**: {total_items}\n\n")
            f.write("> [!IMPORTANT]\n")
            f.write("> 本報告由高精度腳本生成。請特別留意「生產核心」與「未知」類別。\n\n")
            
            for cat, files in CATEGORIES.items():
                if files:
                    f.write(f"## {cat} ({len(files)})\n")
                    for file in sorted(files):
                        f.write(f"- [ ] `{file}`\n")
                    f.write("\n")

        print("Successfully generated pre_push_preview.md")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
