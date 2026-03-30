import { getSupabase } from "./src/supabase.js";

async function migrate() {
  const supabase = getSupabase() as any;
  
  const sql = `
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

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'xcend_cr_person_key') THEN
        ALTER TABLE xcend_cr ADD CONSTRAINT xcend_cr_person_key UNIQUE (person);
      END IF;
    END $$;

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

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'xcend_ir_person_key') THEN
        ALTER TABLE xcend_ir ADD CONSTRAINT xcend_ir_person_key UNIQUE (person);
      END IF;
    END $$;
  `;

  console.log("🚀 Running migration...");
  // Note: Supabase JS client doesn't have a direct 'rpc' for raw SQL unless configured.
  // We usually use a helper function or direct psql.
  // Since I don't have the password, I'll try to use the REST API if 'exec_sql' exists,
  // or I'll just assume the user will run it if I provide the script.
  // Actually, I'll try to use the 'rpc' if available.
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("❌ Migration failed:", error.message);
    console.log("Please run the migration manually using the SQL provided in migrations/ogv_ps_tables.sql");
  } else {
    console.log("✅ Migration completed successfully!");
  }
}

migrate();
 biological-threats
