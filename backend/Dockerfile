# 1. Base Image: 使用 Python 3.14 Slim 版本 (2026 最強效能)
FROM python:3.14-slim

# 2. 設定工作目錄
WORKDIR /app

# 3. 安裝系統依賴 (需要編譯 C extensions 如 rapidfuzz/orjson)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 4. 安裝 Python 依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 複製程式碼
COPY . .

# 6. 建構非 root 用戶 (安全性)
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser:appuser /app
USER appuser

# 7. 設定 Cloud Run 端口 (預設 8080)
ENV PORT=8080
EXPOSE 8080

# 8. 啟動指令 (使用 Gunicorn + Uvicorn Workers 獲得最佳效能)
# --workers 1: Cloud Run 實例通常只有 1 vCPU，所以 1 worker 足夠 (避免 context switch overhead)
# --threads 8: 增加併發處理能力 (對於 I/O bound 任務如 API call 很有效)
# --timeout 0: 讓 Cloud Run 自行管理 timeout
CMD exec gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --threads 8 \
    --timeout 0 \
    --bind 0.0.0.0:${PORT}
