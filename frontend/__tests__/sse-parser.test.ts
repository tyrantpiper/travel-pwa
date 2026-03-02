import { describe, it, expect, vi } from 'vitest'
import { parseSSE, handleSSEEvent } from '@/lib/sse-parser'
import type { SSEHandlers } from '@/lib/sse-parser'

describe('parseSSE', () => {
    it('should parse a complete SSE event', () => {
        const chunk = 'event: text\ndata: {"text":"Hello"}\n\n'
        const { events, remaining } = parseSSE(chunk, '')

        expect(events).toHaveLength(1)
        expect(events[0].event).toBe('text')
        expect(events[0].data).toBe('{"text":"Hello"}')
        expect(remaining).toBe('')
    })

    it('should parse multiple events in one chunk', () => {
        const chunk = 'event: start\ndata: {}\n\nevent: text\ndata: {"text":"Hi"}\n\n'
        const { events, remaining } = parseSSE(chunk, '')

        expect(events).toHaveLength(2)
        expect(events[0].event).toBe('start')
        expect(events[1].event).toBe('text')
    })

    it('should handle cross-chunk splitting (buffer carry-over)', () => {
        // First chunk: incomplete event
        const chunk1 = 'event: text\ndata: {"te'
        const result1 = parseSSE(chunk1, '')
        expect(result1.events).toHaveLength(0)
        expect(result1.remaining).toBe('event: text\ndata: {"te')

        // Second chunk: completes the event
        const chunk2 = 'xt":"Hello"}\n\n'
        const result2 = parseSSE(chunk2, result1.remaining)
        expect(result2.events).toHaveLength(1)
        expect(result2.events[0].data).toBe('{"text":"Hello"}')
    })

    it('should handle heartbeat signals', () => {
        const chunk = ': heartbeat\n\n'
        const { events } = parseSSE(chunk, '')

        expect(events).toHaveLength(1)
        expect(events[0].event).toBe('heartbeat')
    })

    it('should handle empty chunks', () => {
        const { events, remaining } = parseSSE('', '')
        expect(events).toHaveLength(0)
        expect(remaining).toBe('')
    })
})

describe('handleSSEEvent', () => {
    it('should call onText for text events', () => {
        const handlers: SSEHandlers = {
            onText: vi.fn()
        }
        handleSSEEvent({ event: 'text', data: '{"text":"Hello!"}' }, handlers)
        expect(handlers.onText).toHaveBeenCalledWith('Hello!')
    })

    it('should call onStart for start events', () => {
        const handlers: SSEHandlers = {
            onStart: vi.fn()
        }
        handleSSEEvent({ event: 'start', data: '' }, handlers)
        expect(handlers.onStart).toHaveBeenCalled()
    })

    it('should call onDone with parsed data', () => {
        const handlers: SSEHandlers = {
            onDone: vi.fn()
        }
        const doneData = { model_used: 'gemini-2.5-flash', raw_parts: [{ text: 'response' }] }
        handleSSEEvent({ event: 'done', data: JSON.stringify(doneData) }, handlers)
        expect(handlers.onDone).toHaveBeenCalledWith(doneData)
    })

    it('should call onThinking with status', () => {
        const handlers: SSEHandlers = {
            onThinking: vi.fn()
        }
        handleSSEEvent({ event: 'thinking', data: '{"status":"Analyzing..."}' }, handlers)
        expect(handlers.onThinking).toHaveBeenCalledWith('Analyzing...')
    })

    it('should call onError for error events', () => {
        const handlers: SSEHandlers = {
            onError: vi.fn()
        }
        handleSSEEvent({ event: 'error', data: '{"message":"Rate limited","code":429}' }, handlers)
        expect(handlers.onError).toHaveBeenCalledWith({ message: 'Rate limited', code: 429 })
    })

    it('should not crash on invalid JSON data', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { })
        const handlers: SSEHandlers = {
            onText: vi.fn()
        }
        // Should not throw
        expect(() => {
            handleSSEEvent({ event: 'text', data: 'not-json' }, handlers)
        }).not.toThrow()
        spy.mockRestore()
    })

    it('should call onHeartbeat for heartbeat events', () => {
        const handlers: SSEHandlers = {
            onHeartbeat: vi.fn()
        }
        handleSSEEvent({ event: 'heartbeat', data: '' }, handlers)
        expect(handlers.onHeartbeat).toHaveBeenCalled()
    })
})
