-- =========================
-- MATCHING TABLE
-- =========================
CREATE TABLE IF NOT EXISTS matching_members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    team TEXT,
    matching_interviews INTEGER DEFAULT 0,
    acceptance INTEGER DEFAULT 0,
    approvals INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE matching_members
DROP CONSTRAINT IF EXISTS matching_members_name_team_key;

ALTER TABLE matching_members
ADD CONSTRAINT matching_members_name_team_key UNIQUE (name, team);


-- =========================
-- IR TABLE
-- =========================
CREATE TABLE IF NOT EXISTS ir_members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    team TEXT,
    ir_calls INTEGER DEFAULT 0,
    ir_application INTEGER DEFAULT 0,
    ir_approvals INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE ir_members
DROP CONSTRAINT IF EXISTS ir_members_name_team_key;

ALTER TABLE ir_members
ADD CONSTRAINT ir_members_name_team_key UNIQUE (name, team);


-- =========================
-- MARCOM TABLE
-- =========================
CREATE TABLE IF NOT EXISTS marcom_members (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    flyers INTEGER DEFAULT 0,
    videos INTEGER DEFAULT 0,
    presentations INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE marcom_members
DROP CONSTRAINT IF EXISTS marcom_members_name_key;

ALTER TABLE marcom_members
ADD CONSTRAINT marcom_members_name_key UNIQUE (name);

-- =========================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================
-- TRIGGERS
-- =========================
DROP TRIGGER IF EXISTS trg_matching_members_updated_at ON matching_members;
CREATE TRIGGER trg_matching_members_updated_at
BEFORE UPDATE ON matching_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ir_members_updated_at ON ir_members;
CREATE TRIGGER trg_ir_members_updated_at
BEFORE UPDATE ON ir_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_marcom_members_updated_at ON marcom_members;
CREATE TRIGGER trg_marcom_members_updated_at
BEFORE UPDATE ON marcom_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
