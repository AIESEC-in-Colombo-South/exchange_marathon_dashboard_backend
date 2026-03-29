CREATE TABLE IF NOT EXISTS igt_ir_members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    ir_calls_scheduled INTEGER NOT NULL DEFAULT 0,
    ir_cvs_collected INTEGER NOT NULL DEFAULT 0,
    ir_calls_participated INTEGER NOT NULL DEFAULT 0,
    points NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE igt_ir_members
ADD CONSTRAINT igt_ir_members_name_key UNIQUE (name);


CREATE TABLE IF NOT EXISTS igt_matching_members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    eps_reached_out_to INTEGER NOT NULL DEFAULT 0,
    interviews_scheduled INTEGER NOT NULL DEFAULT 0,
    interviews_successful INTEGER NOT NULL DEFAULT 0,
    apds INTEGER NOT NULL DEFAULT 0,
    points NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE igt_matching_members
ADD CONSTRAINT igt_matching_members_name_key UNIQUE (name);
