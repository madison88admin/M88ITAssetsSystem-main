-- Migration 032: Add password link tracking columns
-- Tracks when invite/reset links were sent and when password was actually set,
-- enabling 3-minute link expiry and single-use validation.

-- Add columns to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS password_link_sent_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS password_set_at timestamptz DEFAULT NULL;

-- Add an index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_password_link_sent_at 
ON user_profiles(password_link_sent_at) 
WHERE password_link_sent_at IS NOT NULL;

-- RPC function to mark the password link as used (sets password_set_at)
-- Uses SECURITY DEFINER so the newly authenticated user can update their own profile
-- even if RLS would otherwise block it.
CREATE OR REPLACE FUNCTION mark_password_set(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE user_profiles
    SET password_set_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- RPC function to check link validity
-- Returns: 'valid', 'expired', 'already_used', or 'no_link'
CREATE OR REPLACE FUNCTION check_password_link_status(p_user_id uuid, p_expiry_minutes int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link_sent_at timestamptz;
    v_password_set_at timestamptz;
    v_minutes_elapsed double precision;
BEGIN
    SELECT password_link_sent_at, password_set_at
    INTO v_link_sent_at, v_password_set_at
    FROM user_profiles
    WHERE id = p_user_id;

    -- No link was ever sent (or user not found)
    IF v_link_sent_at IS NULL THEN
        RETURN jsonb_build_object('status', 'no_link', 'message', 'No password link has been sent for this account.');
    END IF;

    -- Check if link was already used (password_set_at is after link_sent_at)
    IF v_password_set_at IS NOT NULL AND v_password_set_at > v_link_sent_at THEN
        RETURN jsonb_build_object('status', 'already_used', 'message', 'This link has already been used to set a password.');
    END IF;

    -- Check if link has expired
    v_minutes_elapsed := EXTRACT(EPOCH FROM (NOW() - v_link_sent_at)) / 60.0;
    IF v_minutes_elapsed > p_expiry_minutes THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'message', 'This link has expired. Password links are valid for ' || p_expiry_minutes || ' minutes. Please contact your administrator to send a new one.',
            'minutes_elapsed', round(v_minutes_elapsed::numeric, 1)
        );
    END IF;

    -- Link is valid
    RETURN jsonb_build_object(
        'status', 'valid',
        'message', 'Link is valid.',
        'minutes_remaining', round((p_expiry_minutes - v_minutes_elapsed)::numeric, 1)
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_password_link_status(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_password_set(uuid) TO authenticated;
