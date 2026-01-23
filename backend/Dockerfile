# 1. Builder Stage: 安裝編譯工具並構建相依項目
FROM python:3.14-slim AS builder

WORKDIR /build

# 安裝系統依賴 (需要編譯 C extensions 如 rapidfuzz/orjson)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安裝 Python 依賴到用戶目錄 (--user)
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt


# 2. Final Runner Stage: 乾淨的運行環境
FROM python:3.14-slim

WORKDIR /app

# 建立非 root 用戶
RUN adduser --disabled-password --gecos '' appuser

# 從 Builder 階段搬運編譯好的套件
COPY --from=builder /root/.local /home/appuser/.local
# 複製程式碼並設定權限
COPY . .
RUN chown -R appuser:appuser /app

# 設定環境變數
ENV PATH="/home/appuser/.local/bin:${PATH}"
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# 切換到非 root 用戶
USER appuser

EXPOSE 8080

# 啟動指令 (維持原有 Gunicorn + Uvicorn 配置，保證穩定性)
CMD exec gunicorn main:app \
    --workers 1 \
    --worker-class uvicorn.workers.UvicornWorker \
    --threads 8 \
    --timeout 0 \
    --bind 0.0.0.0:${PORT}
