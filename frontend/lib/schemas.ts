import { z } from "zod";

/**
 * 🛡️ Ryan Travel App - Global Zod Schema Registry
 * 
 * This registry acts as a "Data Firewall" for the frontend.
 * It ensures that data coming from the backend matches expected formats before hits the state.
 */

// === Basic Components ===
export const LatLngSchema = z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
});

export const UserProfileSchema = z.object({
    id: z.string(),
    name: z.string().default("Traveler"),
    avatar_url: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
});

// === Itinerary & Items ===
export const SubItemSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    checked: z.boolean().default(false),
    desc: z.string().optional().nullable(),
});

export const ItineraryItemSchema = z.object({
    id: z.string(),
    itinerary_id: z.string(),
    day_number: z.number(),
    time_slot: z.string().default("00:00"),
    place_name: z.string(),
    category: z.string().default("activity"),
    notes: z.string().optional().nullable(),
    memo: z.string().optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    tags: z.array(z.string()).default([]),
    image_urls: z.array(z.string()).default([]),
    sub_items: z.array(SubItemSchema).default([]),
    link_url: z.string().optional().nullable(),
    reservation_code: z.string().optional().nullable(),
    cost_amount: z.number().nullable().default(0).transform(v => v ?? 0),
    sort_order: z.number().default(0),
    hide_navigation: z.boolean().default(false),
});

export const TripDaySchema = z.object({
    day_number: z.number(),
    date: z.string().optional(),
    items: z.array(ItineraryItemSchema).default([]),
});

export const TripSchema = z.object({
    id: z.string(),
    title: z.string(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    creator_id: z.string().optional(),
    creator_name: z.string().default("Creator"),
    cover_image: z.string().optional().nullable(),
    total_days: z.number().default(1),
    days: z.array(TripDaySchema).default([]),
    share_code: z.string().optional(),
    public_id: z.string().optional(),
    // Extended data
    day_notes: z.record(z.string(), z.array(z.any())).default({}),
    day_costs: z.record(z.string(), z.array(z.any())).default({}),
    day_tickets: z.record(z.string(), z.array(z.any())).default({}),
    day_checklists: z.record(z.string(), z.array(z.any())).default({}),
    flight_info: z.any().optional().nullable(),
    hotel_info: z.any().optional().nullable(),
});

// === Expenses ===
export const ExpenseSchema = z.object({
    id: z.string(),
    itinerary_id: z.string(),
    title: z.string().default("Expense"),
    amount_jpy: z.number().default(0),
    currency: z.string().default("JPY"),
    category: z.string().default("other"),
    payment_method: z.string().optional().nullable(),
    expense_date: z.string().optional().nullable(),
    created_by: z.string().optional(),
    creator_name: z.string().optional(),
});

// === API Responses ===
export const GeocodeResultSchema = z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    name: z.string().default("Unknown Place"),
    address: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
});

export const GeocodeResponseSchema = z.object({
    results: z.array(GeocodeResultSchema).default([]),
});

// === Types derived from Schemas ===
export type LatLng = z.infer<typeof LatLngSchema>;
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
