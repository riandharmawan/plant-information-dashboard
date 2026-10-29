-- A refinery day can print two Shift 1 lines for the same bag slot.
-- row_index keeps each printed line. Slot stays the bag number on that line.

BEGIN;

ALTER TABLE production_materials ADD COLUMN row_index INT;

UPDATE production_materials AS m
SET row_index = numbered.n
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY day_id, material ORDER BY id) - 1 AS n
  FROM production_materials
) numbered
WHERE m.id = numbered.id;

ALTER TABLE production_materials ALTER COLUMN row_index SET NOT NULL;

ALTER TABLE production_materials
  DROP CONSTRAINT production_materials_day_id_shift_text_material_slot_key;

ALTER TABLE production_materials
  ADD CONSTRAINT production_materials_day_material_row_slot_key
  UNIQUE (day_id, material, row_index, slot);

COMMIT;
