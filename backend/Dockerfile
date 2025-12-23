# 使用官方 Python 輕量版 (3.13 = 最穩定，套件相容性最佳)
FROM python:3.13-slim

# 設定工作目錄
WORKDIR /app

# 1. 複製依賴清單並安裝
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. 複製所有程式碼 (排除 .env, __pycache__ 等)
COPY . .

# 3. 建立非 root 用戶 (Hugging Face 安全要求)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# 4. 開放 Hugging Face 預設端口
EXPOSE 7860

# 5. 啟動指令 (Host 必須是 0.0.0.0, Port 必須是 7860)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
