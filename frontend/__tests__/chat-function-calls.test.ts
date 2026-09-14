import { describe, it, expect } from "vitest"
import { extractItineraryFunctionCalls, extractFunctionCall } from "@/components/chat/POIPreviewCard"
import { extractRemoveFunctionCall } from "@/components/chat/RemoveItemPreviewCard"

describe("Chat Tool Function Calling Normalizer", () => {
    it("should extract single POI item from functionCall", () => {
        const rawParts = [
            {
                functionCall: {
                    name: "add_itinerary_item",
                    args: {
                        place_name: "淺草寺",
                        category: "sightseeing",
                        day: 2,
                        time_slot: "09:30",
                        desc: "東京最古老的寺廟"
                    }
                }
            }
        ]

        const items = extractItineraryFunctionCalls(rawParts)
        expect(items).toHaveLength(1)
        expect(items[0].place_name).toBe("淺草寺")
        expect(items[0].day_number).toBe(2)
        expect(items[0].time_slot).toBe("09:30")

        // 驗證向後相容 extractFunctionCall
        const single = extractFunctionCall(rawParts)
        expect(single?.place_name).toBe("淺草寺")
    })

    it("should extract batch POI items from args.items array", () => {
        const rawParts = [
            {
                functionCall: {
                    name: "add_itinerary_item",
                    args: {
                        items: [
                            { place_name: "淺草寺", category: "sightseeing", day: 2, time_slot: "09:00" },
                            { place_name: "晴空塔", category: "sightseeing", day: 2, time_slot: "11:30" },
                            { place_name: "一蘭拉麵", category: "food", day: 2, time_slot: "13:00" }
                        ]
                    }
                }
            }
        ]

        const items = extractItineraryFunctionCalls(rawParts)
        expect(items).toHaveLength(3)
        expect(items[0].place_name).toBe("淺草寺")
        expect(items[1].place_name).toBe("晴空塔")
        expect(items[2].place_name).toBe("一蘭拉麵")
    })

    it("should extract multiple POI items from Parallel Tool Calls (multiple raw parts)", () => {
        const rawParts = [
            {
                functionCall: {
                    name: "add_itinerary_item",
                    args: { place_name: "築地市場", day: 1, time_slot: "08:00" }
                }
            },
            {
                functionCall: {
                    name: "add_itinerary_item",
                    args: { place_name: "銀座", day: 1, time_slot: "11:00" }
                }
            }
        ]

        const items = extractItineraryFunctionCalls(rawParts)
        expect(items).toHaveLength(2)
        expect(items[0].place_name).toBe("築地市場")
        expect(items[1].place_name).toBe("銀座")
    })

    it("should extract remove_itinerary_item function call", () => {
        const rawParts = [
            {
                functionCall: {
                    name: "remove_itinerary_item",
                    args: {
                        place_name: "淺草寺",
                        day: 2,
                        reason: "用戶想改去晴空塔"
                    }
                }
            }
        ]

        const removeData = extractRemoveFunctionCall(rawParts)
        expect(removeData).not.toBeNull()
        expect(removeData?.place_name).toBe("淺草寺")
        expect(removeData?.day).toBe(2)
        expect(removeData?.reason).toBe("用戶想改去晴空塔")
    })

    it("should safely return empty or null for non-matching parts", () => {
        const rawParts = [{ text: "今天天氣真好！" }]
        expect(extractItineraryFunctionCalls(rawParts)).toEqual([])
        expect(extractFunctionCall(rawParts)).toBeNull()
        expect(extractRemoveFunctionCall(rawParts)).toBeNull()
    })
})

import { extractAllActivities, matchTargetItem } from "@/components/chat/RemoveItemPreviewCard"

describe("RemoveItemPreviewCard Matching & Extraction Closed-Loop", () => {
    const mockTripFromBackend = {
        id: "trip-test-123",
        title: "東京 5 日遊",
        days: [
            {
                day: 1,
                activities: [
                    { id: "act-1", place: "成田機場", time: "14:00" },
                    { id: "act-2", place: "新宿格拉斯麗飯店", time: "17:00" }
                ]
            },
            {
                day: 2,
                activities: [
                    { id: "act-3", place: "雷門 (淺草寺)", original_name: "浅草寺", time: "09:30" },
                    { id: "act-4", place: "東京晴空塔展望台", original_name: "Tokyo Skytree", time: "13:00" }
                ]
            }
        ]
    }

    it("should correctly flatten days[].activities from backend structure", () => {
        const items = extractAllActivities(mockTripFromBackend)
        expect(items).toHaveLength(4)
        expect(items[0].place).toBe("成田機場")
        expect(items[0].day).toBe(1)
        expect(items[2].place).toBe("雷門 (淺草寺)")
        expect(items[2].day).toBe(2)
        expect(items[2].original_name).toBe("浅草寺")
    })

    it("should match item by substring and punctuation normalization", () => {
        const items = extractAllActivities(mockTripFromBackend)
        
        // AI 傳來 "淺草寺"，行程是 "雷門 (淺草寺)"
        const matched1 = matchTargetItem(items, { place_name: "淺草寺", day: 2 })
        expect(matched1).not.toBeNull()
        expect(matched1?.id).toBe("act-3")

        // AI 傳來 "晴空塔"，行程是 "東京晴空塔展望台"
        const matched2 = matchTargetItem(items, { place_name: "晴空塔" })
        expect(matched2).not.toBeNull()
        expect(matched2?.id).toBe("act-4")
    })

    it("should match item with Japanese Kanji / Simplified Kanji variants", () => {
        const items = extractAllActivities(mockTripFromBackend)
        
        // 用日文新字體 "浅草寺" 尋找繁體 "淺草寺"
        const matched = matchTargetItem(items, { place_name: "浅草寺" })
        expect(matched).not.toBeNull()
        expect(matched?.id).toBe("act-3")
    })

    it("should match by direct item_id if provided", () => {
        const items = extractAllActivities(mockTripFromBackend)
        const matched = matchTargetItem(items, { place_name: "隨便名稱", item_id: "act-2" })
        expect(matched).not.toBeNull()
        expect(matched?.id).toBe("act-2")
        expect(matched?.place).toBe("新宿格拉斯麗飯店")
    })

    it("should return null gracefully if item truly does not exist", () => {
        const items = extractAllActivities(mockTripFromBackend)
        const matched = matchTargetItem(items, { place_name: "大阪環球影城" })
        expect(matched).toBeNull()
    })
})

