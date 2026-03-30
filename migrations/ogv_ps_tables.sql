CREATE TABLE IF NOT EXISTS xcend_cr (
    id BIGSERIAL PRIMARY KEY,
    person TEXT NOT NULL,
    role TEXT,
    number_of_sign_ups INTEGER NOT NULL DEFAULT 0,
    number_of_applications INTEGER NOT NULL DEFAULT 0,
    number_of_approvals INTEGER NOT NULL DEFAULT 0,
    points NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE xcend_cr
ADD CONSTRAINT xcend_cr_person_key UNIQUE (person);

CREATE TABLE IF NOT EXISTS xcend_ir (
    id BIGSERIAL PRIMARY KEY,
    person TEXT NOT NULL,
    role TEXT,
    number_of_ir_scheduled INTEGER NOT NULL DEFAULT 0,
    number_of_ir_calls_taken INTEGER NOT NULL DEFAULT 0,
    matching INTEGER NOT NULL DEFAULT 0,
    points NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE xcend_ir
ADD CONSTRAINT xcend_ir_person_key UNIQUE (person);
