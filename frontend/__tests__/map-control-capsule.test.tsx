import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import React from "react"
import { MapControlCapsule } from "@/components/MapControlCapsule"

// Mock LanguageContext
vi.mock("@/lib/LanguageContext", () => ({
    useLanguage: () => ({ lang: "zh", t: (k: string) => k })
}))

describe("🧭 MapControlCapsule", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const defaultProps = {
        isGlobe: false,
        onToggleGlobe: vi.fn(),
        isLocating: false,
        onLocateMe: vi.fn(),
        onCompassReset: vi.fn()
    }

    it("renders 3 control buttons properly with correct icons and titles", () => {
        render(<MapControlCapsule {...defaultProps} />)
        expect(screen.getByLabelText("Toggle Globe Projection")).toBeInTheDocument()
        expect(screen.getByLabelText("Locate Me")).toBeInTheDocument()
        expect(screen.getByLabelText("Fit Bounds and Reset North")).toBeInTheDocument()
    })

    it("mounts in full brightness (opacity-100) and dims to ghost mode (opacity-25) after 3s idle", () => {
        const { container } = render(<MapControlCapsule {...defaultProps} />)
        const capsule = container.firstChild as HTMLElement

        // Initially mounted: full brightness
        expect(capsule.className).toContain("opacity-100")
        expect(capsule.className).not.toContain("opacity-25")

        // Fast-forward 3 seconds
        act(() => {
            vi.advanceTimersByTime(3000)
        })

        // Now in ghost mode
        expect(capsule.className).toContain("opacity-25")
    })

    it("wakes up immediately when isMapMoving becomes true", () => {
        const { container, rerender } = render(<MapControlCapsule {...defaultProps} isMapMoving={false} />)
        const capsule = container.firstChild as HTMLElement

        // Idle after 3s
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(capsule.className).toContain("opacity-25")

        // Map starts moving -> wake up
        rerender(<MapControlCapsule {...defaultProps} isMapMoving={true} />)
        expect(capsule.className).toContain("opacity-100")
    })

    it("stays awake when hovered by mouse and dims 3s after mouse leave", () => {
        const { container } = render(<MapControlCapsule {...defaultProps} />)
        const capsule = container.firstChild as HTMLElement

        // Advance 3s to dim
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(capsule.className).toContain("opacity-25")

        // Pointer enter with mouse
        fireEvent.pointerEnter(capsule, { pointerType: "mouse" })
        expect(capsule.className).toContain("opacity-100")

        // Advance 5 seconds while still hovered -> must remain awake
        act(() => {
            vi.advanceTimersByTime(5000)
        })
        expect(capsule.className).toContain("opacity-100")

        // Pointer leave
        fireEvent.pointerLeave(capsule, { pointerType: "mouse" })

        // After 3s from leave -> dims back
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(capsule.className).toContain("opacity-25")
    })

    it("wakes up on touch down and resets idle timer", () => {
        const { container } = render(<MapControlCapsule {...defaultProps} />)
        const capsule = container.firstChild as HTMLElement

        // Advance 3s to dim
        act(() => {
            vi.advanceTimersByTime(3000)
        })
        expect(capsule.className).toContain("opacity-25")

        // Touch start
        fireEvent.touchStart(capsule)
        expect(capsule.className).toContain("opacity-100")
    })

    it("completely hides (opacity-0 pointer-events-none) when isTouring is true", () => {
        const { container } = render(<MapControlCapsule {...defaultProps} isTouring={true} />)
        const capsule = container.firstChild as HTMLElement

        expect(capsule.className).toContain("opacity-0")
        expect(capsule.className).toContain("pointer-events-none")
    })

    it("triggers callbacks when buttons are clicked", () => {
        const onToggleGlobe = vi.fn()
        const onLocateMe = vi.fn()
        const onCompassReset = vi.fn()

        render(
            <MapControlCapsule
                {...defaultProps}
                onToggleGlobe={onToggleGlobe}
                onLocateMe={onLocateMe}
                onCompassReset={onCompassReset}
            />
        )

        fireEvent.click(screen.getByLabelText("Toggle Globe Projection"))
        expect(onToggleGlobe).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByLabelText("Locate Me"))
        expect(onLocateMe).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByLabelText("Fit Bounds and Reset North"))
        expect(onCompassReset).toHaveBeenCalledTimes(1)
    })
})
