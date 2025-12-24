"use client"

/**
 * SSE Parser - 解析 Server-Sent Events 串流
 * 
 * 處理跨 chunk 分割的事件，提供穩定的事件回調
 */

export interface SSEEvent {
    event: string
    data: string
}

export interface SSEHandlers {
    onStart?: () => void
    onThinking?: (status: string) => void
    onText?: (text: string) => void
    onTool?: (toolCall: { name: string; args: Record<string, unknown> }) => void
    onSignature?: (thought: string) => void
    onDone?: (data: { model_used: string; raw_parts: { text: string }[] }) => void
    onError?: (error: { message: string; code: number }) => void
    onHeartbeat?: () => void
}

/**
 * 解析 SSE 格式的字串
 * 處理跨 chunk 的事件分割
 */
export function parseSSE(chunk: string, buffer: string): { events: SSEEvent[]; remaining: string } {
    const fullData = buffer + chunk
    const events: SSEEvent[] = []

    // SSE 事件以 \n\n 分隔
    const parts = fullData.split("\n\n")

    // 最後一個可能是不完整的，保留
    const remaining = parts.pop() || ""

    for (const part of parts) {
        if (!part.trim()) continue

        // 心跳訊號
        if (part.startsWith(":")) {
            events.push({ event: "heartbeat", data: "" })
            continue
        }

        // 解析事件
        const lines = part.split("\n")
        let eventName = "message"
        let eventData = ""

        for (const line of lines) {
            if (line.startsWith("event:")) {
                eventName = line.slice(6).trim()
            } else if (line.startsWith("data:")) {
                eventData = line.slice(5).trim()
            }
        }

        events.push({ event: eventName, data: eventData })
    }

    return { events, remaining }
}

/**
 * 處理 SSE 事件，呼叫對應的 handler
 */
export function handleSSEEvent(event: SSEEvent, handlers: SSEHandlers): void {
    try {
        switch (event.event) {
            case "start":
                handlers.onStart?.()
                break

            case "thinking":
                const thinkingData = JSON.parse(event.data)
                handlers.onThinking?.(thinkingData.status)
                break

            case "text":
                const textData = JSON.parse(event.data)
                handlers.onText?.(textData.text)
                break

            case "tool":
                const toolData = JSON.parse(event.data)
                handlers.onTool?.(toolData.function_call)
                break

            case "signature":
                const sigData = JSON.parse(event.data)
                handlers.onSignature?.(sigData.thought)
                break

            case "done":
                const doneData = JSON.parse(event.data)
                handlers.onDone?.(doneData)
                break

            case "error":
                const errorData = JSON.parse(event.data)
                handlers.onError?.(errorData)
                break

            case "heartbeat":
                handlers.onHeartbeat?.()
                break
        }
    } catch (e) {
        console.error("SSE event parse error:", e, event)
    }
}

/**
 * 串流聊天請求
 * 使用 fetch POST + ReadableStream (支援 BYOK Headers)
 */
export async function streamChat(
    apiUrl: string,
    message: string,
    history: Array<{ role: string; displayContent?: string; rawParts?: unknown[] }>,
    apiKey: string,
    handlers: SSEHandlers,
    signal?: AbortSignal,
    // 🆕 新增行程上下文參數
    itinerary?: unknown
): Promise<void> {
    const response = await fetch(`${apiUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Gemini-API-Key": apiKey,
        },
        body: JSON.stringify({
            message,
            history: history.map(msg => ({
                role: msg.role,
                rawParts: msg.rawParts,
                displayContent: msg.displayContent
            })),
            thought_signatures: [],  // Round-trip signatures if needed
            // 🆕 帶入行程上下文
            current_itinerary: itinerary
        }),
        signal
    })

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
        throw new Error("No response body")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
        while (true) {
            // 🆕 v3.7: 檢查是否已被 abort
            if (signal?.aborted) {
                console.log("🛑 SSE 已被用戶中斷")
                break
            }

            const { done, value } = await reader.read()
            if (done) break

            // 🆕 再次檢查 abort（在 read 等待期間可能被 abort）
            if (signal?.aborted) {
                console.log("🛑 SSE 在讀取時被中斷")
                break
            }

            const chunk = decoder.decode(value, { stream: true })
            const { events, remaining } = parseSSE(chunk, buffer)
            buffer = remaining

            for (const event of events) {
                // 🆕 處理事件前也檢查 abort
                if (signal?.aborted) break
                handleSSEEvent(event, handlers)
            }
        }

        // 處理最後剩餘的 buffer（只在未 abort 時）
        if (buffer.trim() && !signal?.aborted) {
            const { events } = parseSSE(buffer + "\n\n", "")
            for (const event of events) {
                handleSSEEvent(event, handlers)
            }
        }
    } finally {
        reader.releaseLock()
    }
}
