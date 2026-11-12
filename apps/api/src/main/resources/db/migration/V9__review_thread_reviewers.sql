-- Review threads: assigned reviewers and the user who closed a thread.

CREATE TABLE review_reviewers (
    review_id UUID NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    added_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id, user_id)
);

CREATE INDEX review_reviewers_user_idx ON review_reviewers (user_id);

ALTER TABLE reviews
    ADD COLUMN closed_by UUID REFERENCES users (id) ON DELETE SET NULL;
