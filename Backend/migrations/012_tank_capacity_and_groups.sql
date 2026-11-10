-- Tank capacity read from the gauge system, and stock groups for gauged tanks.

BEGIN;

-- The commodity card a gauged tank counts under. It follows the product the gauge assigns to the tank.
-- Logsheet tanks leave it empty and keep using the stock report grouping.
ALTER TABLE tanks ADD COLUMN IF NOT EXISTS stock_group TEXT;

COMMENT ON COLUMN tanks.stock_group IS 'Stock group code (see stock_groups) for a tank read by a gauge system. Follows the gauge product.';

-- What the gauge system says about a tank itself, read from its tank detail page (DATATYPE 31).
-- It changes rarely, so the poller refreshes it about once a week.
CREATE TABLE IF NOT EXISTS tank_gauging_info (
  tank_id TEXT PRIMARY KEY REFERENCES tanks(id) ON DELETE CASCADE,
  max_capacity_litre NUMERIC,
  tank_height_mm NUMERIC,
  tank_location TEXT,
  tank_state TEXT,
  roof_status TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB
);

COMMENT ON COLUMN tank_gauging_info.max_capacity_litre IS 'Max Tank Capacity in litres. 0 means the slot is not in use.';

COMMIT;
