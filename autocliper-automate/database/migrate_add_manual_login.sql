-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add 'manual' to login_type ENUM
-- Allows users to login manually without storing credentials
-- ═══════════════════════════════════════════════════════════════════════════

USE autocliper;

-- Add 'manual' to login_type ENUM
ALTER TABLE tiktok_accounts 
MODIFY COLUMN login_type ENUM('email', 'username', 'phone', 'manual') NOT NULL DEFAULT 'manual';

-- Verify the change
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'autocliper' 
  AND TABLE_NAME = 'tiktok_accounts' 
  AND COLUMN_NAME = 'login_type';

SELECT 'Migration completed: manual login type added' AS status;
