-- AI Adaptive Memory: User Preferences Table
-- Stores extracted user preferences (e.g., dietary, interests, pacing)
-- to provide personal contextual awareness in AI interactions.

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'diet', 'pace', 'interest', 'accommodation', 'other'
    preference TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0, -- AI confidence in this preference
    last_detected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Unique constraint to prevent duplicate preferences of same category for same user
-- AI will update existing preference if category matches or handle merging in service layer
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_pref_cat ON public.user_preferences(user_id, category, preference);
