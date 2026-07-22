-- Fix foreign key constraint to include ON DELETE CASCADE
-- This will allow diagrams to be deleted without violating the constraint

-- Drop the existing constraint
ALTER TABLE diagram_versions
DROP CONSTRAINT IF EXISTS diagram_versions_user_sub_diagram_id_fkey;

-- Recreate with ON DELETE CASCADE
ALTER TABLE diagram_versions
ADD CONSTRAINT diagram_versions_user_sub_diagram_id_fkey
FOREIGN KEY (user_sub, diagram_id)
REFERENCES diagrams(user_sub, id)
ON DELETE CASCADE;
