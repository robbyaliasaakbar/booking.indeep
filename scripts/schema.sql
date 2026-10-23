-- Skema database indeep_booking (PRD Bab 15)
-- Engine InnoDB, charset utf8mb4. Hapus permanen dilarang bila data pernah dipakai
-- booking (guard di level aplikasi, bukan di DB).
-- Dipakai oleh scripts/seed.php — bisa juga dijalankan manual via phpMyAdmin Hostinger.

-- ============================================================
-- 1. users (PRD Bab 15.1)
-- phone_primary NULL sampai profil lengkap (login Google bikin row
-- dulu, wajib isi WA + alamat baru bisa booking -> profile_complete).
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('customer','admin','superadmin') NOT NULL DEFAULT 'customer',
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NULL,
  username VARCHAR(100) NULL,
  email_verified_at DATETIME NULL,
  password_hash VARCHAR(255) NULL,
  google_id VARCHAR(190) NULL,
  phone_primary VARCHAR(30) NULL,
  phone_secondary VARCHAR(30) NULL,
  photo_path VARCHAR(255) NULL,
  preferred_time VARCHAR(5) NULL, -- 09.00 | 13.00 | NULL (PRD Bab 10.3)
  profile_complete TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_google_id (google_id),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. addresses (PRD Bab 15.2)
-- Alamat default wajib ada sebelum booking (guard aplikasi).
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(50) NULL,
  street_no VARCHAR(190) NOT NULL,
  village VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  postal VARCHAR(10) NULL,
  note VARCHAR(255) NULL,
  maps_url VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. pricelist (PRD Bab 15.3) — sumber tunggal harga (BR07)
-- sku_id 1..44 stabil, tidak boleh berubah walau nama berubah.
-- ============================================================
CREATE TABLE IF NOT EXISTS pricelist (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku_id INT UNSIGNED NOT NULL,
  service VARCHAR(50) NOT NULL DEFAULT 'wet clean',
  name VARCHAR(100) NOT NULL,
  size VARCHAR(50) NOT NULL,
  price INT UNSIGNED NOT NULL,
  unit ENUM('pcs','m2','anak tangga') NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pricelist_sku (sku_id),
  KEY idx_pricelist_category (category),
  KEY idx_pricelist_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. surcharges (PRD Bab 15.4) — 3 aturan biaya tambahan
-- ============================================================
CREATE TABLE IF NOT EXISTS surcharges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  title VARCHAR(100) NOT NULL,
  note VARCHAR(255) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  per ENUM('pcs','seat') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_surcharges_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. slots (PRD Bab 15.5) — anti tumpang tindih (Bab 11)
-- slot_time disimpan '09.00' / '13.00' sesuai PRD (BR02).
-- Update booked WAJIB dalam transaksi InnoDB + kunci baris.
-- ============================================================
CREATE TABLE IF NOT EXISTS slots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_time VARCHAR(5) NOT NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 1,
  booked INT UNSIGNED NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_slots_date_time (slot_date, slot_time),
  KEY idx_slots_date (slot_date),
  KEY idx_slots_time (slot_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. bookings (PRD Bab 15.6)
-- Snapshot alamat + harga biar riwayat tetap jujur walau data asli berubah.
-- version buat optimistic concurrency (Bab 11 poin 7).
-- idempotency_key unik anti double klik (Bab 11 poin 8).
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  name_snapshot VARCHAR(100) NOT NULL,
  phone_primary_snapshot VARCHAR(30) NOT NULL,
  phone_secondary_snapshot VARCHAR(30) NULL,
  address_snapshot_label VARCHAR(50) NULL,
  address_snapshot_street_no VARCHAR(190) NOT NULL,
  address_snapshot_village VARCHAR(100) NOT NULL,
  address_snapshot_district VARCHAR(100) NOT NULL,
  address_snapshot_city VARCHAR(100) NOT NULL,
  address_snapshot_province VARCHAR(100) NOT NULL,
  address_snapshot_postal VARCHAR(10) NULL,
  address_snapshot_note VARCHAR(255) NULL,
  address_snapshot_maps_url VARCHAR(255) NULL,
  subtotal INT UNSIGNED NOT NULL DEFAULT 0,
  surcharge_total INT UNSIGNED NOT NULL DEFAULT 0,
  total INT UNSIGNED NOT NULL DEFAULT 0,
  slot_date DATE NOT NULL,
  slot_time VARCHAR(5) NOT NULL,
  status ENUM('pending','confirmed','in_progress','completed','cancelled','rejected','expired')
    NOT NULL DEFAULT 'pending',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  idempotency_key VARCHAR(64) NOT NULL,
  cancel_reason TEXT NULL,
  admin_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bookings_code (code),
  UNIQUE KEY uq_bookings_idempotency (idempotency_key),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_slot (slot_date, slot_time),
  KEY idx_bookings_status (status),
  KEY idx_bookings_created (created_at),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7a. booking_items (PRD Bab 15.7)
-- qty DECIMAL biar dukung m2 desimal bila perlu.
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  sku_id INT UNSIGNED NOT NULL,
  name_snapshot VARCHAR(100) NOT NULL,
  size_snapshot VARCHAR(50) NOT NULL,
  price_snapshot INT UNSIGNED NOT NULL,
  qty DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit VARCHAR(20) NOT NULL,
  line_total INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_booking_items_booking (booking_id),
  KEY idx_booking_items_sku (sku_id),
  CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7b. booking_surcharges (PRD Bab 15.7)
-- Rincian centangan customer + koreksi admin, buat audit.
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_surcharges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  title_snapshot VARCHAR(100) NOT NULL,
  amount_snapshot INT UNSIGNED NOT NULL,
  qty_affected DECIMAL(10,2) NOT NULL DEFAULT 1,
  line_total INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_booking_surcharges_booking (booking_id),
  CONSTRAINT fk_booking_surcharges_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8a. otps (PRD Bab 15.8) — hash, bukan plain (Bab 10.4)
-- Cron hPanel hapus baris kedaluwarsa tiap 10 menit (Tidak ada TTL otomatis).
-- ============================================================
CREATE TABLE IF NOT EXISTS otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consumed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otps_email (email),
  KEY idx_otps_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8b. audit_logs (PRD Bab 15.8)
-- created_at UTC diisi aplikasi (PRD Bab 15: audit UTC).
-- Tanpa FK supaya log tetap utuh walau row terkait berubah.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  booking_id BIGINT UNSIGNED NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_audit_logs_booking (booking_id),
  KEY idx_audit_logs_actor (actor_id),
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8c. login_attempts (PRD Bab 10.2)
-- Rate limit login admin: 5 kali per 10 menit per IP.
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  username VARCHAR(100) NOT NULL,
  attempted_at DATETIME NOT NULL,
  KEY idx_login_attempts_ip (ip),
  KEY idx_login_attempts_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
