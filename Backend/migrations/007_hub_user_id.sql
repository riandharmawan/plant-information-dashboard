ALTER TABLE users ADD COLUMN IF NOT EXISTS hub_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_hub_user_id_key
  ON users (hub_user_id)
  WHERE hub_user_id IS NOT NULL;
