-- Consolidation View for Dashboard Optimization
-- This view merges itineraries where a user is either the creator or a member.
-- It eliminates the need for multiple backend round-trips.

CREATE OR REPLACE VIEW user_trips_view AS
SELECT DISTINCT ON (user_id, id)
    sub.user_id,
    sub.id,
    sub.title,
    sub.creator_name,
    sub.created_by,
    sub.share_code,
    sub.public_id,
    sub.start_date,
    sub.end_date,
    sub.status,
    sub.content,
    sub.flight_info,
    sub.hotel_info,
    sub.cover_image,
    sub.created_at
FROM (
    -- Case 1: User is an explicit member
    SELECT 
        tm.user_id::text AS user_id,
        i.id,
        i.title,
        i.creator_name,
        i.created_by,
        i.share_code,
        i.public_id,
        i.start_date,
        i.end_date,
        i.status,
        i.content,
        i.flight_info,
        i.hotel_info,
        i.cover_image,
        i.created_at
    FROM itineraries i
    JOIN trip_members tm ON i.id = tm.itinerary_id
    
    UNION ALL
    
    -- Case 2: User is the creator
    SELECT 
        i.created_by::text AS user_id,
        i.id,
        i.title,
        i.creator_name,
        i.created_by,
        i.share_code,
        i.public_id,
        i.start_date,
        i.end_date,
        i.status,
        i.content,
        i.flight_info,
        i.hotel_info,
        i.cover_image,
        i.created_at
    FROM itineraries i
) sub;

-- Performance Note: DISTINCT ON handles deduplication efficiently.
-- Index on trip_members(user_id) and itineraries(created_by) recommended for large datasets.
