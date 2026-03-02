/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { HtmlLangSync } from '@/components/ui/html-lang-sync'

// Mock the LanguageContext
const mockLang = { lang: 'en' }
vi.mock('@/lib/LanguageContext', () => ({
    useLanguage: () => mockLang,
}))

describe('HtmlLangSync', () => {
    beforeEach(() => {
        // Reset to default
        document.documentElement.lang = 'en'
    })

    it('should set lang to "en" when language is English', () => {
        mockLang.lang = 'en'
        render(<HtmlLangSync />)
        expect(document.documentElement.lang).toBe('en')
    })

    it('should set lang to "zh-Hant" when language is Chinese', () => {
        mockLang.lang = 'zh'
        render(<HtmlLangSync />)
        expect(document.documentElement.lang).toBe('zh-Hant')
    })

    it('should render nothing (null)', () => {
        mockLang.lang = 'en'
        const { container } = render(<HtmlLangSync />)
        expect(container.innerHTML).toBe('')
    })
})
