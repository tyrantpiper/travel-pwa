import { describe, it, expect } from 'vitest'
import { getLeanItinerary, formatLeanItineraryForAI } from '../lib/getLeanItinerary'

describe('Semantic Itinerary Neural Connections', () => {
    const mockTrip = { title: 'Test Trip', start_date: '2026-01-01', end_date: '2026-01-02' }
    const mockItems = [
        {
            day_number: 1,
            time_slot: '09:00',
            place_name: 'Place A',
            category: 'sightseeing',
            desc: 'Guide info for A',
            memo: 'Public note\n[PRIVATE] Secret code 123',
            sub_items: [{ name: 'Sub A1', desc: 'Sub detail' }],
            is_highlight: true
        },
        {
            day_number: 2,
            time_slot: '10:00',
            place_name: 'Place B',
            category: 'food',
            desc: 'Guide info for B',
            memo: 'Day 2 public note',
            sub_items: [{ name: 'Sub B1' }]
        }
    ]

    const mockChecklists = {
        1: [{ text: 'Task 1', checked: false }, { text: 'Task 2', checked: true }]
    }
    const mockTickets = {
        1: [{ name: 'Ticket A', price: '$10', note: 'Bring ID' }]
    }

    it('should apply Privacy Shield to memos', () => {
        const lean = getLeanItinerary(mockTrip, mockItems, {}, {}, mockChecklists, mockTickets, 1)
        const formatted = formatLeanItineraryForAI(lean!)

        expect(formatted).toContain('Public note')
        expect(formatted).not.toContain('[PRIVATE]')
        expect(formatted).not.toContain('Secret code 123')
    })

    it('should expand details ONLY for the focused day (Adaptive Resolution)', () => {
        // Focus on Day 1
        const leanDay1 = getLeanItinerary(mockTrip, mockItems, {}, {}, mockChecklists, mockTickets, 1)
        const formattedDay1 = formatLeanItineraryForAI(leanDay1!)

        // Day 1 should have details
        expect(formattedDay1).toContain('👉 **Day 1**')
        expect(formattedDay1).toContain('[Guide] Guide info for A')
        expect(formattedDay1).toContain('[User Note] Public note')
        expect(formattedDay1).toContain('- Sub A1: Sub detail')
        expect(formattedDay1).toContain('✅ **當日清單:**')
        expect(formattedDay1).toContain('🎟️ **門票/預約資訊:**')

        // Day 2 should be summarized (no Guide/User Note/Sub-items)
        expect(formattedDay1).toContain('**Day 2**')
        expect(formattedDay1).not.toContain('Guide info for B')
        expect(formattedDay1).not.toContain('Day 2 public note')
        expect(formattedDay1).not.toContain('Sub B1')

        // Now focus on Day 2
        const leanDay2 = getLeanItinerary(mockTrip, mockItems, {}, {}, mockChecklists, mockTickets, 2)
        const formattedDay2 = formatLeanItineraryForAI(leanDay2!)

        expect(formattedDay2).toContain('👉 **Day 2**')
        expect(formattedDay2).toContain('[Guide] Guide info for B')
        expect(formattedDay2).toContain('[User Note] Day 2 public note')
        expect(formattedDay2).toContain('- Sub B1')

        // Day 1 details should now be hidden
        expect(formattedDay2).not.toContain('Guide info for A')
    })

    it('should include highlight markers', () => {
        const lean = getLeanItinerary(mockTrip, mockItems, {}, {}, {}, {}, 1)
        const formatted = formatLeanItineraryForAI(lean!)
        expect(formatted).toContain('⭐ Place A')
    })
})
