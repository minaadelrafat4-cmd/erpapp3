/*
# Enterprise Security Hardening

1. Server-side login attempt tracking + account lockout
2. Login history table (device, IP, user agent)
3. Active session tracking with revocation
4. Password policy enforcement function
5. Password history to prevent reuse
6. Security event logging
7. Indexes for security queries
*/

-- =========================================================
-- 1. Login attempts table (server-side lockout)
-- =========================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  ip_address inet,
  user_agent text,
  failure_reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time ON login_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. Login history table
-- =========================================================
CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  ip_address inet,
  user_agent text,
  device_id text,
  session_token_hash text,
  successful boolean NOT NULL DEFAULT true,
  failure_reason text,
  location_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(email, created_at DESC);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_login_history" ON login_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 3. Active sessions table (revocation + concurrent limit)
-- =========================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  device_id text,
  device_name text,
  ip_address inet,
  user_agent text,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_reason text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id) WHERE is_revoked = false;

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sessions" ON user_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "delete_own_sessions" ON user_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 4. Password history (prevent reuse)
-- =========================================================
CREATE TABLE IF NOT EXISTS password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id, created_at DESC);

ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5. Security events table
-- =========================================================
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  ip_address inet,
  user_agent text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity, created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. Password policy validation function
-- =========================================================
CREATE OR REPLACE FUNCTION validate_password_policy(p_password text, p_email text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_lower boolean := false;
  v_has_upper boolean := false;
  v_has_digit boolean := false;
  v_has_special boolean := false;
  v_common_passwords text[] := ARRAY[
    'password','password123','12345678','qwerty123','welcome1',
    'admin123','letmein','monkey','dragon','sunshine',
    'password1','iloveyou','football','baseball','master'
  ];
BEGIN
  IF length(p_password) < 10 THEN
    RETURN 'Password must be at least 10 characters long';
  END IF;
  IF length(p_password) > 128 THEN
    RETURN 'Password must be at most 128 characters long';
  END IF;

  SELECT regexp_match(p_password, '[a-z]') IS NOT NULL INTO v_has_lower;
  SELECT regexp_match(p_password, '[A-Z]') IS NOT NULL INTO v_has_upper;
  SELECT regexp_match(p_password, '[0-9]') IS NOT NULL INTO v_has_digit;
  v_has_digit := v_has_digit IS NOT NULL;
  SELECT regexp_match(p_password, '[^a-zA-Z0-9]') IS NOT NULL INTO v_has_special;

  IF NOT (v_has_lower AND v_has_upper AND v_has_digit AND v_has_special) THEN
    RETURN 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
  END IF;

  IF p_password = ANY(v_common_passwords) THEN
    RETURN 'This password is too common and easily guessed';
  END IF;

  IF p_email IS NOT NULL AND length(split_part(p_email, '@', 1)) > 3
     AND position(split_part(p_email, '@', 1) IN lower(p_password)) > 0 THEN
    RETURN 'Password must not contain your email address';
  END IF;

  RETURN NULL;
END;
$$;

-- =========================================================
-- 7. Record login attempt (server-side lockout)
-- =========================================================
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email text,
  p_success boolean,
  p_user_id uuid DEFAULT NULL,
  p_failure_reason text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fail_count integer;
  v_lockout_threshold integer := 5;
  v_lockout_window interval := '15 minutes';
BEGIN
  INSERT INTO login_attempts (email, user_id, success, failure_reason, ip_address, user_agent)
  VALUES (p_email, p_user_id, p_success, p_failure_reason,
    CASE WHEN p_ip IS NOT NULL AND p_ip != '' THEN p_ip::inet ELSE NULL END,
    p_user_agent);

  IF NOT p_success THEN
    SELECT count(*) INTO v_fail_count
    FROM login_attempts
    WHERE email = p_email
      AND success = false
      AND attempted_at > now() - v_lockout_window;

    IF v_fail_count >= v_lockout_threshold THEN
      INSERT INTO security_events (event_type, user_id, email, ip_address, user_agent, severity, details)
      VALUES ('account_lockout', p_user_id, p_email,
        CASE WHEN p_ip IS NOT NULL AND p_ip != '' THEN p_ip::inet ELSE NULL END,
        p_user_agent, 'warning',
        jsonb_build_object('fail_count', v_fail_count, 'window', v_lockout_window));
    END IF;
  END IF;
END;
$$;

-- =========================================================
-- 8. Check if account is locked (server-side)
-- =========================================================
CREATE OR REPLACE FUNCTION is_account_locked_server(p_email text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM login_attempts
    WHERE email = p_email
      AND success = false
      AND attempted_at > now() - interval '15 minutes'
    HAVING count(*) >= 5
  );
$$;

-- =========================================================
-- 9. Clear login failures on successful login
-- =========================================================
CREATE OR REPLACE FUNCTION clear_login_failures(p_email text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM login_attempts WHERE email = p_email AND success = false;
END;
$$;

-- =========================================================
-- 10. Record login history entry
-- =========================================================
CREATE OR REPLACE FUNCTION record_login_history(
  p_user_id uuid,
  p_email text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_successful boolean DEFAULT true,
  p_failure_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO login_history (user_id, email, ip_address, user_agent, device_id, successful, failure_reason)
  VALUES (p_user_id, p_email,
    CASE WHEN p_ip IS NOT NULL AND p_ip != '' THEN p_ip::inet ELSE NULL END,
    p_user_agent, p_device_id, p_successful, p_failure_reason);
END;
$$;

-- =========================================================
-- 11. Enforce concurrent session limit
-- =========================================================
CREATE OR REPLACE FUNCTION enforce_session_limit(
  p_user_id uuid,
  p_max_sessions integer DEFAULT 5
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM user_sessions
  WHERE user_id = p_user_id AND is_revoked = false AND expires_at > now();

  IF v_count >= p_max_sessions THEN
    UPDATE user_sessions
    SET is_revoked = true, revoked_at = now(), revoked_reason = 'concurrent_session_limit'
    WHERE user_id = p_user_id AND is_revoked = false
      AND id IN (
        SELECT id FROM user_sessions
        WHERE user_id = p_user_id AND is_revoked = false
        ORDER BY created_at ASC
        LIMIT GREATEST(v_count - p_max_sessions + 1, 0)
      );
  END IF;
END;
$$;

-- =========================================================
-- 12. Revoke a user session
-- =========================================================
CREATE OR REPLACE FUNCTION revoke_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_sessions
  SET is_revoked = true, revoked_at = now(), revoked_reason = 'user_revoke'
  WHERE id = p_session_id AND user_id = auth.uid();
END;
$$;

-- =========================================================
-- 13. Revoke all sessions for a user (force logout)
-- =========================================================
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_sessions
  SET is_revoked = true, revoked_at = now(), revoked_reason = 'force_revoke'
  WHERE user_id = p_user_id AND is_revoked = false;
END;
$$;

-- =========================================================
-- 14. Get login history for current user
-- =========================================================
CREATE OR REPLACE FUNCTION get_my_login_history(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  email text,
  ip_address text,
  user_agent text,
  device_id text,
  successful boolean,
  failure_reason text,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, email, host(ip_address), user_agent, device_id, successful, failure_reason, created_at
  FROM login_history
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- =========================================================
-- 15. Get active sessions for current user
-- =========================================================
CREATE OR REPLACE FUNCTION get_my_active_sessions()
RETURNS TABLE (
  id uuid,
  device_id text,
  device_name text,
  ip_address text,
  user_agent text,
  last_active_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, device_id, device_name, host(ip_address), user_agent, last_active_at, expires_at, created_at
  FROM user_sessions
  WHERE user_id = auth.uid() AND is_revoked = false AND expires_at > now()
  ORDER BY last_active_at DESC;
$$;

-- =========================================================
-- 16. Get security events for staff audit (GM+ only)
-- =========================================================
CREATE OR REPLACE FUNCTION get_security_events(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  event_type text,
  user_id uuid,
  email text,
  ip_address text,
  severity text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_staff() OR current_staff_rank() < 80 THEN
    RAISE EXCEPTION 'Insufficient privileges to view security events';
  END IF;
  RETURN QUERY
  SELECT id, event_type, user_id, email, host(ip_address), severity, details, created_at
  FROM security_events
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

-- =========================================================
-- 17. Log security event
-- =========================================================
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'info',
  p_user_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO security_events (event_type, severity, user_id, email, ip_address, user_agent, details)
  VALUES (p_event_type, p_severity, p_user_id, p_email,
    CASE WHEN p_ip IS NOT NULL AND p_ip != '' THEN p_ip::inet ELSE NULL END,
    p_user_agent, p_details);
END;
$$;

-- =========================================================
-- 18. Get failed login count for an email
-- =========================================================
CREATE OR REPLACE FUNCTION get_failed_login_count(p_email text)
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM login_attempts
  WHERE email = p_email AND success = false
    AND attempted_at > now() - interval '15 minutes';
$$;

-- =========================================================
-- 19. Check password reuse
-- =========================================================
CREATE OR REPLACE FUNCTION check_password_reuse(p_user_id uuid, p_password_hash text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM password_history
    WHERE user_id = p_user_id AND password_hash = p_password_hash
  );
$$;

-- =========================================================
-- 20. Record password in history
-- =========================================================
CREATE OR REPLACE FUNCTION record_password_history(p_user_id uuid, p_password_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO password_history (user_id, password_hash) VALUES (p_user_id, p_password_hash);
  DELETE FROM password_history
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM password_history
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 10
    );
END;
$$;