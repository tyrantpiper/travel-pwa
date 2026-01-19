# Cloudflare Workers (2026) 註冊與環境建置指南

歡迎來到 Serverless 的世界！本指南將協助您完成 Cloudflare 帳號註冊並設定開發環境 (Wrangler CLI)。

## 第一步：註冊 Cloudflare 帳號

1.  **前往註冊頁面**：
    *   開啟瀏覽器前往 [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2.  **填寫資訊**：
    *   輸入您的 Email 和設定密碼。
    *   點擊 **Create Account**。
3.  **驗證 Email**：
    *   前往您的信箱收取來自 Cloudflare 的驗證信，點擊連結啟用帳號。
4.  **無需信用卡**：
    *   對於 Workers 的免費方案 (Free Plan)，通常**不需要**綁定信用卡即可開始使用。
    *   如果在某個步驟被要求選擇方案，請務必選擇 **Free** 方案（通常在頁面下方或方案列表的最左側）。

## 第二步：安裝 Wrangler CLI

Wrangler 是 Cloudflare 的官方命令行工具，用於建立、測試和佈署 Workers。它是基於 Node.js 的工具。

1.  **開啟終端機 (Terminal)**：
    *   在 VS Code 中按下 `` Ctrl+` `` 開啟終端機。
2.  **安裝 Wrangler**：
    執行以下指令：
    ```bash
    npm install -g wrangler
    ```
3.  **驗證安裝**：
    ```bash
    wrangler --version
    ```
    *   應顯示類似 `wrangler 3.x.x` (或更新版本) 的訊息。

## 第三步：登入 Wrangler

這一步將把您的本機環境與 Cloudflare 帳號連結。

1.  **執行登入指令**：
    ```bash
    npx wrangler login
    ```
2.  **瀏覽器授權**：
    *   終端機可能會顯示一個網址，並自動開啟瀏覽器。
    *   如果瀏覽器沒有自動開啟，請複製網址並手動貼上。
    *   在瀏覽器中點擊 **Allow** 授權 Wrangler 存取您的帳號。
3.  **確認成功**：
    *   瀏覽器會顯示 "Successfully logged in"。
    *   回到終端機，您應該會看到：
        `Successfully logged in. You can now publish your worker to Cloudflare.`

## 第四步：下一步做什麼？ (Next Steps)

完成上述步驟後，請回到 AI 對話視窗告知我，我們將進行以下操作：

1.  **建立 `wrangler.toml`**：設定您的 Project。
2.  **設定 API Key**：安全地將 Gemini Key 存入 Cloudflare Secret。
3.  **一鍵發布**：將您的 Python 後端推送到全球邊緣節點。
