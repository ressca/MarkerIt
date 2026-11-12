-- A pending e-mail change is verified with a one-time code sent to the new
-- address. Only one request per user is kept; a new request replaces it.
CREATE TABLE email_change_requests (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    new_email VARCHAR(320) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_sent_at TIMESTAMPTZ NOT NULL,
    send_window_started_at TIMESTAMPTZ NOT NULL,
    sends_in_window INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 0
);
