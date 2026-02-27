-- =============================================
-- Migration 022: Create notifications table
-- =============================================
-- Run this in your Supabase SQL editor.
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = broadcast to all users
    title       VARCHAR(255) NOT NULL,
    message     TEXT NOT NULL,
    type        VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    link        TEXT,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable Row-Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users see their own notifications plus global broadcasts (user_id IS NULL)
CREATE POLICY "Users can read own and broadcast notifications"
    ON notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Any authenticated user (or system) can create notifications
CREATE POLICY "Authenticated users can create notifications"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Users can mark their own (and broadcasts) as read
CREATE POLICY "Users can update own and broadcast notifications"
    ON notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can delete their own and broadcast notifications
CREATE POLICY "Users can delete own and broadcast notifications"
    ON notifications FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR user_id IS NULL);

GRANT ALL ON notifications TO authenticated;
