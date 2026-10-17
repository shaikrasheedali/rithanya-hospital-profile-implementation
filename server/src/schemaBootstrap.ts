import {
  prisma,
  isDbOnCooldown,
  reportDbError,
  reportDbSuccess,
  withDbRetry,
  DB_WRITE_MS,
  isTransientDbError,
} from "./db.js";

/**
 * Application-level schema provisioning.
 *
 * The production host (GoDaddy Node.js hosting) attaches a managed MySQL that
 * may be completely empty on the first deploy, and this repo ships no Prisma
 * migration files — running `prisma migrate deploy` from a dashboard is not
 * possible there either. Every statement below is a `CREATE TABLE IF NOT
 * EXISTS`, translated 1:1 from prisma/schema.prisma (column mappings, defaults,
 * unique indexes and foreign keys), so:
 *
 *   - a fresh database gets the complete schema automatically at boot, and
 *   - an existing database (even one partly provisioned by an earlier deploy)
 *     is left untouched — nothing is ever dropped or rewritten.
 *
 * Additive column changes for older databases are handled separately by
 * ensureColumns() in seed.ts.
 */

// Order matters: referenced tables (users, patients, orders, …) come first so
// the foreign keys of dependent tables can always be created.
const TABLE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`username\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL,
    \`password_hash\` VARCHAR(191) NOT NULL,
    \`role\` VARCHAR(191) NOT NULL DEFAULT 'STAFF',
    \`full_name\` VARCHAR(191) NOT NULL,
    \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`created_by_id\` VARCHAR(191) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`users_username_key\` (\`username\`),
    UNIQUE KEY \`users_email_key\` (\`email\`),
    KEY \`users_role_idx\` (\`role\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`user_module_access\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`user_id\` VARCHAR(191) NOT NULL,
    \`can_manage_emr\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_blood_bank\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_cms\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_store\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_hr\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_finance\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_dpdp\` TINYINT(1) NOT NULL DEFAULT 0,
    \`can_manage_settings\` TINYINT(1) NOT NULL DEFAULT 0,
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`user_module_access_user_id_key\` (\`user_id\`),
    CONSTRAINT \`user_module_access_user_id_fkey\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`clinical_categories\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`clinical_categories_name_key\` (\`name\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`patients\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`uhid\` VARCHAR(191) NOT NULL,
    \`full_name\` VARCHAR(191) NOT NULL,
    \`contact_number\` VARCHAR(191) NOT NULL,
    \`age\` INTEGER NOT NULL,
    \`gender\` VARCHAR(191) NOT NULL,
    \`blood_group\` VARCHAR(191) NOT NULL,
    \`patient_type\` VARCHAR(191) NOT NULL,
    \`clinical_condition\` TEXT NOT NULL,
    \`allergies\` TEXT NOT NULL,
    \`consent_photo_url\` TEXT NULL,
    \`category_id\` VARCHAR(191) NULL,
    \`is_discharged\` TINYINT(1) NOT NULL DEFAULT 0,
    \`is_archived\` TINYINT(1) NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`patients_uhid_key\` (\`uhid\`),
    KEY \`patients_patient_type_idx\` (\`patient_type\`),
    KEY \`patients_is_discharged_idx\` (\`is_discharged\`),
    KEY \`patients_category_id_idx\` (\`category_id\`),
    CONSTRAINT \`patients_category_id_fkey\` FOREIGN KEY (\`category_id\`) REFERENCES \`clinical_categories\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`inpatient_stays\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`patient_id\` VARCHAR(191) NOT NULL,
    \`room_bed_number\` VARCHAR(191) NOT NULL,
    \`admission_date\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`discharge_date\` DATETIME(3) NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'ADMITTED',
    \`discharge_notes\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`inpatient_stays_patient_id_idx\` (\`patient_id\`),
    CONSTRAINT \`inpatient_stays_patient_id_fkey\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`vital_logs\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`patient_id\` VARCHAR(191) NOT NULL,
    \`recorded_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`haemoglobin\` DOUBLE NOT NULL,
    \`spo2\` DOUBLE NOT NULL,
    \`pulse\` INTEGER NOT NULL,
    \`fasting_glucose\` DOUBLE NULL,
    \`post_prandial_glucose\` DOUBLE NULL,
    \`hba1c\` DOUBLE NULL,
    \`bp_systolic\` INTEGER NOT NULL,
    \`bp_diastolic\` INTEGER NOT NULL,
    \`serum_ferritin\` DOUBLE NULL,
    \`clinical_notes\` TEXT NULL,
    \`recorded_by_staff\` VARCHAR(191) NULL,
    \`time_slot\` VARCHAR(191) NULL,
    PRIMARY KEY (\`id\`),
    KEY \`vital_logs_patient_id_recorded_at_idx\` (\`patient_id\`, \`recorded_at\`),
    CONSTRAINT \`vital_logs_patient_id_fkey\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`blood_stock\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`blood_group\` VARCHAR(191) NOT NULL,
    \`group_category\` VARCHAR(191) NOT NULL,
    \`color_code\` VARCHAR(191) NOT NULL,
    \`whole_blood_units\` INTEGER NOT NULL DEFAULT 0,
    \`packed_cells_units\` INTEGER NOT NULL DEFAULT 0,
    \`plasma_units\` INTEGER NOT NULL DEFAULT 0,
    \`last_updated\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`blood_stock_blood_group_key\` (\`blood_group\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`media_assets\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`filename\` VARCHAR(191) NOT NULL,
    \`original_name\` VARCHAR(191) NOT NULL,
    \`mime_type\` VARCHAR(191) NOT NULL DEFAULT 'image/webp',
    \`kind\` VARCHAR(191) NOT NULL DEFAULT 'IMAGE',
    \`size_in_bytes\` INTEGER NOT NULL,
    \`url\` TEXT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`media_assets_filename_key\` (\`filename\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`media_links\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`entity_type\` VARCHAR(191) NOT NULL,
    \`entity_id\` VARCHAR(191) NOT NULL,
    \`media_id\` VARCHAR(191) NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`media_links_entity_type_entity_id_media_id_key\` (\`entity_type\`, \`entity_id\`, \`media_id\`),
    KEY \`media_links_entity_type_entity_id_idx\` (\`entity_type\`, \`entity_id\`),
    KEY \`media_links_media_id_idx\` (\`media_id\`),
    CONSTRAINT \`media_links_media_id_fkey\` FOREIGN KEY (\`media_id\`) REFERENCES \`media_assets\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`specialties\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`short_summary\` TEXT NOT NULL,
    \`content_html\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`specialties_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`facilities\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`short_summary\` TEXT NOT NULL,
    \`content_html\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`facilities_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`treatments\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(191) NOT NULL DEFAULT 'General',
    \`is_flagship\` TINYINT(1) NOT NULL DEFAULT 0,
    \`short_summary\` TEXT NOT NULL,
    \`content_html\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`treatments_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`services\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(191) NOT NULL DEFAULT 'Outpatient',
    \`short_summary\` TEXT NOT NULL,
    \`content_html\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`services_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`doctors\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`full_name\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`qualifications\` TEXT NOT NULL,
    \`designation\` VARCHAR(191) NOT NULL,
    \`department\` VARCHAR(191) NOT NULL,
    \`consultation_timings\` VARCHAR(191) NOT NULL DEFAULT '',
    \`is_visiting\` TINYINT(1) NOT NULL DEFAULT 0,
    \`biography_html\` TEXT NOT NULL,
    \`experience_years\` INTEGER NOT NULL DEFAULT 0,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`doctors_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`insurance_providers\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`scheme_type\` VARCHAR(191) NOT NULL,
    \`description_html\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`gallery_items\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`media_type\` VARCHAR(191) NOT NULL DEFAULT 'IMAGE',
    \`embed_code\` TEXT NOT NULL,
    \`caption\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`blog_posts\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`author_name\` VARCHAR(191) NOT NULL DEFAULT 'Rithanya Medical Editorial',
    \`category\` VARCHAR(191) NOT NULL DEFAULT 'Diabetes Management',
    \`excerpt\` TEXT NOT NULL,
    \`content_html\` TEXT NOT NULL,
    \`is_published\` TINYINT(1) NOT NULL DEFAULT 1,
    \`published_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`blog_posts_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`testimonials\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`patient_name\` VARCHAR(191) NOT NULL,
    \`location\` VARCHAR(191) NOT NULL DEFAULT 'Khammam',
    \`treatment\` VARCHAR(191) NOT NULL DEFAULT '',
    \`rating\` INTEGER NOT NULL DEFAULT 5,
    \`quote\` TEXT NOT NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(191) NOT NULL DEFAULT 'Wellness',
    \`description\` TEXT NOT NULL,
    \`price\` DOUBLE NOT NULL,
    \`stock_units\` INTEGER NOT NULL DEFAULT 0,
    \`is_prescription_req\` TINYINT(1) NOT NULL DEFAULT 0,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`products_slug_key\` (\`slug\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`order_number\` VARCHAR(191) NOT NULL,
    \`customer_name\` VARCHAR(191) NOT NULL,
    \`phone_number\` VARCHAR(191) NOT NULL,
    \`shipping_address\` TEXT NOT NULL,
    \`pin_code\` VARCHAR(191) NOT NULL DEFAULT '',
    \`total_amount\` DOUBLE NOT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    \`payment_method\` VARCHAR(191) NOT NULL DEFAULT 'COD',
    \`is_paid\` TINYINT(1) NOT NULL DEFAULT 0,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`orders_order_number_key\` (\`order_number\`),
    KEY \`orders_status_idx\` (\`status\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`order_items\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`order_id\` VARCHAR(191) NOT NULL,
    \`product_id\` VARCHAR(191) NOT NULL,
    \`product_name\` VARCHAR(191) NOT NULL DEFAULT '',
    \`quantity\` INTEGER NOT NULL DEFAULT 1,
    \`unit_price\` DOUBLE NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`order_items_order_id_idx\` (\`order_id\`),
    KEY \`order_items_product_id_idx\` (\`product_id\`),
    CONSTRAINT \`order_items_order_id_fkey\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`order_items_product_id_fkey\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`employees\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`entity\` VARCHAR(191) NOT NULL DEFAULT 'RITHANYA_HOSPITAL',
    \`full_name\` VARCHAR(191) NOT NULL,
    \`designation\` VARCHAR(191) NOT NULL,
    \`department\` VARCHAR(191) NOT NULL,
    \`shift_schedule\` VARCHAR(191) NOT NULL DEFAULT 'General',
    \`contact_number\` VARCHAR(191) NOT NULL DEFAULT '',
    \`monthly_fixed_base_salary\` DOUBLE NOT NULL,
    \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`employees_entity_idx\` (\`entity\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`payroll_records\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`employee_id\` VARCHAR(191) NOT NULL,
    \`month\` INTEGER NOT NULL,
    \`year\` INTEGER NOT NULL,
    \`base_salary\` DOUBLE NOT NULL,
    \`calendar_days\` INTEGER NOT NULL,
    \`lop_days\` INTEGER NOT NULL DEFAULT 0,
    \`paid_days\` INTEGER NOT NULL,
    \`lop_deduction\` DOUBLE NOT NULL,
    \`allowances\` DOUBLE NOT NULL DEFAULT 0,
    \`other_deductions\` DOUBLE NOT NULL DEFAULT 0,
    \`net_payable\` DOUBLE NOT NULL,
    \`authorizer_sign_svg\` MEDIUMTEXT NULL,
    \`authorizer_name\` VARCHAR(191) NULL,
    \`signed_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`payroll_records_employee_id_month_year_key\` (\`employee_id\`, \`month\`, \`year\`),
    KEY \`payroll_records_employee_id_idx\` (\`employee_id\`),
    CONSTRAINT \`payroll_records_employee_id_fkey\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`expense_categories\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`entity\` VARCHAR(191) NOT NULL DEFAULT 'RITHANYA_HOSPITAL',
    \`name\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`expense_categories_entity_name_key\` (\`entity\`, \`name\`),
    KEY \`expense_categories_entity_idx\` (\`entity\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`expense_ledger\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`entity\` VARCHAR(191) NOT NULL DEFAULT 'RITHANYA_HOSPITAL',
    \`type\` VARCHAR(191) NOT NULL,
    \`item_name\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NULL,
    \`category_id\` VARCHAR(191) NULL,
    \`vendor_payee\` VARCHAR(191) NOT NULL,
    \`amount\` DOUBLE NOT NULL,
    \`invoice_ref\` VARCHAR(191) NULL,
    \`method\` VARCHAR(191) NOT NULL,
    \`entry_date\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`expense_ledger_entity_idx\` (\`entity\`),
    KEY \`expense_ledger_entry_date_idx\` (\`entry_date\`),
    KEY \`expense_ledger_category_id_idx\` (\`category_id\`),
    CONSTRAINT \`expense_ledger_category_id_fkey\` FOREIGN KEY (\`category_id\`) REFERENCES \`expense_categories\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`dpdp_erasure_requests\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tracking_code\` VARCHAR(191) NOT NULL,
    \`full_name\` VARCHAR(191) NOT NULL,
    \`phone_number\` VARCHAR(191) NOT NULL,
    \`identification_ref\` VARCHAR(191) NULL,
    \`records_nature\` TEXT NOT NULL,
    \`request_details\` TEXT NOT NULL,
    \`identity_proof_file\` TEXT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    \`resolution_notes\` TEXT NULL,
    \`matched_patient_id\` VARCHAR(191) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`dpdp_erasure_requests_tracking_code_key\` (\`tracking_code\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`appointments\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`full_name\` VARCHAR(191) NOT NULL,
    \`phone\` VARCHAR(191) NOT NULL,
    \`department\` VARCHAR(191) NOT NULL DEFAULT '',
    \`preferred_date\` VARCHAR(191) NOT NULL DEFAULT '',
    \`message\` TEXT NOT NULL,
    \`source\` VARCHAR(191) NOT NULL DEFAULT 'WEBSITE',
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`hospital_settings\` (
    \`id\` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY_CONFIG',
    \`legal_name\` VARCHAR(191) NOT NULL DEFAULT 'Rithanya Hospital',
    \`clinical_tagline\` VARCHAR(191) NOT NULL DEFAULT 'Dedicated Thalassemia Daycare, Diabetology & 24/7 Emergency Care',
    \`emergency_hotline\` VARCHAR(191) NOT NULL DEFAULT '8328581019',
    \`secondary_hotline\` VARCHAR(191) NULL DEFAULT '9054177824',
    \`whatsapp_number\` VARCHAR(191) NOT NULL DEFAULT '918328581019',
    \`email\` VARCHAR(191) NOT NULL DEFAULT 'care@rithanyahospital.com',
    \`critical_blood_alert_threshold\` INTEGER NOT NULL DEFAULT 3,
    \`physical_address\` TEXT NOT NULL,
    \`opd_timings\` VARCHAR(191) NOT NULL DEFAULT 'Open 24 Hours | Daycare & OPD: 9:00 AM - 8:00 PM',
    \`notice_banner\` TEXT NOT NULL,
    \`seo_page_title\` VARCHAR(191) NOT NULL DEFAULT '',
    \`meta_description\` TEXT NOT NULL,
    \`target_keywords\` TEXT NOT NULL,
    \`canonical_url\` VARCHAR(191) NOT NULL DEFAULT 'https://rithanyahospital.com',
    \`robots_index_follow\` TINYINT(1) NOT NULL DEFAULT 1,
    \`favicon_url\` VARCHAR(191) NULL,
    \`social_share_thumbnail_url\` VARCHAR(191) NULL,
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`action\` VARCHAR(191) NOT NULL,
    \`entity\` VARCHAR(191) NOT NULL,
    \`entity_id\` VARCHAR(191) NULL,
    \`details\` TEXT NULL,
    \`user_id\` VARCHAR(191) NULL,
    \`user_name\` VARCHAR(191) NULL,
    \`timestamp\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`audit_logs_timestamp_idx\` (\`timestamp\`),
    KEY \`audit_logs_user_id_idx\` (\`user_id\`),
    CONSTRAINT \`audit_logs_user_id_fkey\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
  ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const g = globalThis as typeof globalThis & { __rhTablesReady?: boolean };

/**
 * Idempotent column fixes for tables created by older releases
 * (`ALTER ... MODIFY` is a metadata no-op when the definition already matches).
 */
const COLUMN_FIXES: string[] = [
  // Early releases created `vital_logs.time_slot` as VARCHAR(16) while Prisma
  // expects VARCHAR(191) — any longer value failed with P2000.
  "ALTER TABLE `vital_logs` MODIFY `time_slot` VARCHAR(191) NULL",
];

/**
 * Idempotently create every table the application needs. Runs at boot (via
 * ensureSeed) and is safe to call repeatedly; a failure never crashes the
 * process — features continue on caches/outbox and the remaining statements
 * retry on the next boot.
 */
export async function ensureTables(): Promise<void> {
  if (g.__rhTablesReady) return;
  if (isDbOnCooldown()) return;

  let ok = 0;
  let failed = 0;
  for (const ddl of TABLE_DDL) {
    const table = /CREATE TABLE IF NOT EXISTS `([^`]+)`/.exec(ddl)?.[1] ?? "?";
    try {
      await withDbRetry(() => prisma.$executeRawUnsafe(ddl), DB_WRITE_MS, 2);
      reportDbSuccess();
      ok += 1;
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (isTransientDbError(err)) reportDbError(err);
      console.warn(`[schema] Could not ensure table \`${table}\`: ${msg.slice(0, 140)}`);
      // Privilege problems affect every remaining statement — stop early with
      // one clear message instead of spamming identical warnings.
      if (/denied|not allowed|not authorized|privilege/i.test(msg)) {
        console.warn(
          "[schema] MySQL user lacks CREATE privileges. Grant CREATE/ALTER/INDEX on the database to the injected DB_USER, then redeploy.",
        );
        break;
      }
      if (isDbOnCooldown()) break;
    }
  }

  for (const ddl of COLUMN_FIXES) {
    try {
      await withDbRetry(() => prisma.$executeRawUnsafe(ddl), DB_WRITE_MS, 1);
      reportDbSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[schema] Column fix skipped: ${msg.slice(0, 140)}`);
      if (isDbOnCooldown()) break;
    }
  }

  if (failed === 0) {
    g.__rhTablesReady = true;
    console.log(`[schema] ${ok}/${TABLE_DDL.length} tables verified (CREATE TABLE IF NOT EXISTS).`);
  } else {
    console.warn(`[schema] ${failed} table(s) not ensured — will retry on next boot.`);
  }
}
