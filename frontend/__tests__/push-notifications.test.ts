import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { usePushNotifications } from "@/lib/hooks/usePushNotifications"

describe("usePushNotifications Hook", () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("should mark as unsupported if window.Notification is missing", async () => {
        const originalNotification = window.Notification
        // @ts-expect-error test unsupported
        delete window.Notification

        const { result } = renderHook(() => usePushNotifications())
        
        await act(async () => {
            await new Promise((r) => setTimeout(r, 10))
        })

        expect(result.current.isSupported).toBe(false)
        expect(result.current.permissionState).toBe("unsupported")

        window.Notification = originalNotification
    })

    it("should respect user opt-out intent and NOT silent subscribe if push_opt_out is true", async () => {
        localStorage.setItem("push_opt_out", "true")

        // Mock Notification.permission as granted
        Object.defineProperty(window, "Notification", {
            value: { permission: "granted" },
            writable: true,
            configurable: true
        })

        // Mock PushManager on window
        Object.defineProperty(window, "PushManager", {
            value: class {},
            writable: true,
            configurable: true
        })

        // Mock navigator.serviceWorker.ready
        const mockPushManager = {
            getSubscription: vi.fn().mockResolvedValue(null),
            subscribe: vi.fn()
        }

        Object.defineProperty(navigator, "serviceWorker", {
            value: {
                ready: Promise.resolve({
                    pushManager: mockPushManager
                })
            },
            writable: true,
            configurable: true
        })

        const { result } = renderHook(() => usePushNotifications())

        await act(async () => {
            await new Promise((r) => setTimeout(r, 20))
        })

        // Because push_opt_out is true, it should NOT have called pushManager.subscribe
        expect(mockPushManager.subscribe).not.toHaveBeenCalled()
        expect(result.current.isSubscribed).toBe(false)
    })

    it("should sync state when tabidachi-push-status-change event is dispatched", async () => {
        const { result } = renderHook(() => usePushNotifications())

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("tabidachi-push-status-change", {
                    detail: { isSubscribed: true, permission: "granted" }
                })
            )
        })

        expect(result.current.isSubscribed).toBe(true)
        expect(result.current.permissionState).toBe("granted")

        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("tabidachi-push-status-change", {
                    detail: { isSubscribed: false }
                })
            )
        })

        expect(result.current.isSubscribed).toBe(false)
    })

    it("should not hang indefinitely and should reset isLoading to false if navigator.serviceWorker.ready hangs", async () => {
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjOJuTl32eQPyEXQ"
        // Mock Notification.requestPermission as granted
        Object.defineProperty(window, "Notification", {
            value: {
                permission: "granted",
                requestPermission: vi.fn().mockResolvedValue("granted"),
            },
            writable: true,
            configurable: true,
        })
        Object.defineProperty(window, "PushManager", {
            value: class {},
            writable: true,
            configurable: true,
        })

        // Hanging ready promise that never resolves
        const hangingReadyPromise = new Promise(() => {})
        const mockRegister = vi.fn().mockResolvedValue({})

        Object.defineProperty(navigator, "serviceWorker", {
            value: {
                ready: hangingReadyPromise,
                getRegistration: vi.fn().mockResolvedValue(null),
                register: mockRegister,
            },
            writable: true,
            configurable: true,
        })

        const { result } = renderHook(() => usePushNotifications())

        let subscribeResult: boolean | undefined
        await act(async () => {
            // Subscribe with short timeout or verify it safely finishes and resets isLoading
            const subscribePromise = result.current.subscribe(100) // allow timeout parameter for testing
            subscribeResult = await subscribePromise
        })

        expect(subscribeResult).toBe(false)
        expect(result.current.isLoading).toBe(false)
        expect(mockRegister).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" })
    })
})

