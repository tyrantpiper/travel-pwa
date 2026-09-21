import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act, fireEvent } from "@testing-library/react"
import { ThemeProvider, useTheme, VALID_FONT_SCALES, FONT_SCALE_TIERS, FontScale } from "@/lib/ThemeContext"

function TestConsumer() {
    const { fontScale, setFontScale } = useTheme()
    return (
        <div>
            <span data-testid="current-scale">{fontScale}</span>
            {VALID_FONT_SCALES.map(scale => (
                <button
                    key={scale}
                    data-testid={`btn-${scale}`}
                    onClick={() => setFontScale(scale)}
                >
                    Set {scale}
                </button>
            ))}
            <button
                data-testid="btn-invalid"
                onClick={() => setFontScale(999 as FontScale)}
            >
                Set Invalid
            </button>
        </div>
    )
}

describe("ThemeContext Font Scaling", () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.style.fontSize = ""
        document.documentElement.removeAttribute("data-font-scale")
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it("TC-1: should initialize with default 100% when no localStorage value exists", async () => {
        render(
            <ThemeProvider>
                <TestConsumer />
            </ThemeProvider>
        )

        // 等待 mounted effect
        await act(async () => {
            await new Promise(r => setTimeout(r, 10))
        })

        expect(screen.getByTestId("current-scale").textContent).toBe("100")
        expect(document.documentElement.style.fontSize).toBe("100%")
        expect(document.documentElement.getAttribute("data-font-scale")).toBe("100")
    })

    it("TC-2: should restore saved valid font scale from localStorage", async () => {
        localStorage.setItem("app_font_scale", "120")

        render(
            <ThemeProvider>
                <TestConsumer />
            </ThemeProvider>
        )

        await act(async () => {
            await new Promise(r => setTimeout(r, 10))
        })

        expect(screen.getByTestId("current-scale").textContent).toBe("120")
        expect(document.documentElement.style.fontSize).toBe("120%")
        expect(document.documentElement.getAttribute("data-font-scale")).toBe("120")
    })

    it("TC-3: should reject corrupted or invalid scale and fallback safely to 100%", async () => {
        localStorage.setItem("app_font_scale", "invalid_value")

        render(
            <ThemeProvider>
                <TestConsumer />
            </ThemeProvider>
        )

        await act(async () => {
            await new Promise(r => setTimeout(r, 10))
        })

        expect(screen.getByTestId("current-scale").textContent).toBe("100")
        expect(document.documentElement.style.fontSize).toBe("100%")
    })

    it("TC-4: should change scale, update DOM style, and write to localStorage when setFontScale called", async () => {
        render(
            <ThemeProvider>
                <TestConsumer />
            </ThemeProvider>
        )

        await act(async () => {
            await new Promise(r => setTimeout(r, 10))
        })

        act(() => {
            fireEvent.click(screen.getByTestId("btn-130"))
        })

        expect(screen.getByTestId("current-scale").textContent).toBe("130")
        expect(document.documentElement.style.fontSize).toBe("130%")
        expect(document.documentElement.getAttribute("data-font-scale")).toBe("130")
        expect(localStorage.getItem("app_font_scale")).toBe("130")
    })

    it("TC-5: should ignore invalid scales passed to setFontScale", async () => {
        render(
            <ThemeProvider>
                <TestConsumer />
            </ThemeProvider>
        )

        await act(async () => {
            await new Promise(r => setTimeout(r, 10))
        })

        act(() => {
            fireEvent.click(screen.getByTestId("btn-invalid"))
        })

        // Remains 100
        expect(screen.getByTestId("current-scale").textContent).toBe("100")
        expect(document.documentElement.style.fontSize).toBe("100%")
    })

    it("TC-6: should sync scale across tabs when storage event fires", async () => {
        render(
            <ThemeProvider>
                <TestConsumer />
            </ThemeProvider>
        )

        await act(async () => {
            await new Promise(r => setTimeout(r, 10))
        })

        // Simulate storage event from another tab
        act(() => {
            window.dispatchEvent(
                new StorageEvent("storage", {
                    key: "app_font_scale",
                    newValue: "110",
                })
            )
        })

        expect(screen.getByTestId("current-scale").textContent).toBe("110")
        expect(document.documentElement.style.fontSize).toBe("110%")
        expect(document.documentElement.getAttribute("data-font-scale")).toBe("110")
    })

    it("TC-7: should have complete de-stigmatized tier definitions for all valid scales", () => {
        expect(VALID_FONT_SCALES).toEqual([100, 110, 120, 130])
        expect(FONT_SCALE_TIERS[100]).toEqual({
            scale: 100,
            labelZh: "標準",
            labelEn: "Standard",
            descZh: "原始黃金比例",
            descEn: "Original golden ratio",
        })
        expect(FONT_SCALE_TIERS[110]).toEqual({
            scale: 110,
            labelZh: "適讀",
            labelEn: "Readable",
            descZh: "舒適閱讀",
            descEn: "Comfortable reading",
        })
        expect(FONT_SCALE_TIERS[120]).toEqual({
            scale: 120,
            labelZh: "清晰",
            labelEn: "Clear",
            descZh: "戶外與行進易讀",
            descEn: "Outdoor & on-the-go",
        })
        expect(FONT_SCALE_TIERS[130]).toEqual({
            scale: 130,
            labelZh: "醒目",
            labelEn: "Prominent",
            descZh: "最大字級醒目無礙",
            descEn: "Maximum visibility",
        })

        // 🛡️ 防倒退測試：確保任何檔位標籤與描述皆不包含「關懷」與「老花」等刻板詞彙
        VALID_FONT_SCALES.forEach(scale => {
            const tier = FONT_SCALE_TIERS[scale]
            expect(tier.labelZh).not.toContain("關懷")
            expect(tier.descZh).not.toContain("關懷")
            expect(tier.descZh).not.toContain("老花")
        })
    })
})
