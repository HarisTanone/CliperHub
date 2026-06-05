-- ═══════════════════════════════════════════════════════════════════════════
-- Browser Fingerprints Seed Data
-- Koleksi fingerprint browser untuk rotasi anti-detection
-- ═══════════════════════════════════════════════════════════════════════════

USE autocliper;

INSERT INTO browser_fingerprints 
  (fingerprint_id, name, user_agent, viewport_width, viewport_height, 
   device_scale_factor, is_mobile, has_touch, platform, timezone, locale,
   color_depth, webgl_vendor, webgl_renderer) 
VALUES

-- ═══════════════════════════════════════════════════════════════════════════
-- DESKTOP FINGERPRINTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Windows 10 - Chrome
('win10-chrome-1080p', 
 'Windows 10 Chrome 1080p', 
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
 1920, 1080, 1.0, FALSE, FALSE, 'Win32', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc. (NVIDIA)', 'ANGLE (NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)'),

('win10-chrome-1440p',
 'Windows 10 Chrome 1440p',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
 2560, 1440, 1.0, FALSE, FALSE, 'Win32', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc. (NVIDIA)', 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)'),

('win10-chrome-laptop',
 'Windows 10 Chrome Laptop',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
 1366, 768, 1.0, FALSE, FALSE, 'Win32', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc. (Intel)', 'ANGLE (Intel UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)'),

-- Windows 11 - Chrome
('win11-chrome-1080p',
 'Windows 11 Chrome 1080p',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
 1920, 1080, 1.25, FALSE, FALSE, 'Win32', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc. (AMD)', 'ANGLE (AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)'),

-- Windows - Edge
('win10-edge-1080p',
 'Windows 10 Edge 1080p',
 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
 1920, 1080, 1.0, FALSE, FALSE, 'Win32', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc. (NVIDIA)', 'ANGLE (NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)'),

-- macOS - Chrome
('mac-chrome-retina',
 'macOS Chrome Retina',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
 1440, 900, 2.0, FALSE, FALSE, 'MacIntel', 'Asia/Jakarta', 'id-ID',
 30, 'Apple Inc.', 'Apple M1'),

('mac-chrome-imac',
 'macOS Chrome iMac',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
 2560, 1440, 2.0, FALSE, FALSE, 'MacIntel', 'Asia/Jakarta', 'id-ID',
 30, 'Apple Inc.', 'Apple M2 Pro'),

-- macOS - Safari
('mac-safari-retina',
 'macOS Safari Retina',
 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
 1440, 900, 2.0, FALSE, FALSE, 'MacIntel', 'Asia/Jakarta', 'id-ID',
 30, 'Apple Inc.', 'Apple M1'),

-- Linux - Chrome
('linux-chrome-1080p',
 'Linux Chrome 1080p',
 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
 1920, 1080, 1.0, FALSE, FALSE, 'Linux x86_64', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc. (AMD)', 'ANGLE (AMD Radeon RX 580 on AMD RADV POLARIS10)'),

-- ═══════════════════════════════════════════════════════════════════════════
-- MOBILE FINGERPRINTS (untuk simulasi mobile browser)
-- ═══════════════════════════════════════════════════════════════════════════

-- iPhone - Safari
('iphone-14-safari',
 'iPhone 14 Safari',
 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
 390, 844, 3.0, TRUE, TRUE, 'iPhone', 'Asia/Jakarta', 'id-ID',
 32, 'Apple Inc.', 'Apple GPU'),

('iphone-15-safari',
 'iPhone 15 Pro Safari',
 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
 393, 852, 3.0, TRUE, TRUE, 'iPhone', 'Asia/Jakarta', 'id-ID',
 32, 'Apple Inc.', 'Apple GPU'),

-- Android - Chrome
('samsung-s23-chrome',
 'Samsung S23 Chrome',
 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
 360, 780, 3.0, TRUE, TRUE, 'Linux armv8l', 'Asia/Jakarta', 'id-ID',
 24, 'Qualcomm', 'Adreno (TM) 740'),

('pixel-8-chrome',
 'Google Pixel 8 Chrome',
 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
 412, 915, 2.625, TRUE, TRUE, 'Linux armv8l', 'Asia/Jakarta', 'id-ID',
 24, 'Google Inc.', 'Mali-G715'),

('xiaomi-14-chrome',
 'Xiaomi 14 Chrome',
 'Mozilla/5.0 (Linux; Android 14; 2311DRK48G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
 393, 873, 2.75, TRUE, TRUE, 'Linux armv8l', 'Asia/Jakarta', 'id-ID',
 24, 'Qualcomm', 'Adreno (TM) 750'),

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLET FINGERPRINTS
-- ═══════════════════════════════════════════════════════════════════════════

('ipad-pro-safari',
 'iPad Pro Safari',
 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
 1024, 1366, 2.0, TRUE, TRUE, 'iPad', 'Asia/Jakarta', 'id-ID',
 32, 'Apple Inc.', 'Apple GPU'),

('samsung-tab-s9-chrome',
 'Samsung Tab S9 Chrome',
 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
 800, 1280, 2.0, TRUE, TRUE, 'Linux armv8l', 'Asia/Jakarta', 'id-ID',
 24, 'Qualcomm', 'Adreno (TM) 740')

ON DUPLICATE KEY UPDATE name = VALUES(name);

SELECT CONCAT('Inserted ', ROW_COUNT(), ' fingerprints') AS status;
