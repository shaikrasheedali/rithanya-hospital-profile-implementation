-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "full_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_module_access" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "can_manage_emr" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_blood_bank" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_cms" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_store" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_hr" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_finance" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_dpdp" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_settings" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_module_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clinical_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uhid" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "blood_group" TEXT NOT NULL,
    "patient_type" TEXT NOT NULL,
    "clinical_condition" TEXT NOT NULL DEFAULT '',
    "allergies" TEXT NOT NULL DEFAULT '',
    "consent_photo_url" TEXT,
    "category_id" TEXT,
    "is_discharged" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patients_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "clinical_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inpatient_stays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "room_bed_number" TEXT NOT NULL,
    "admission_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharge_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ADMITTED',
    "discharge_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inpatient_stays_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vital_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_id" TEXT NOT NULL,
    "recorded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "haemoglobin" REAL NOT NULL,
    "spo2" REAL NOT NULL,
    "pulse" INTEGER NOT NULL,
    "fasting_glucose" REAL,
    "post_prandial_glucose" REAL,
    "hba1c" REAL,
    "bp_systolic" INTEGER NOT NULL,
    "bp_diastolic" INTEGER NOT NULL,
    "serum_ferritin" REAL,
    "clinical_notes" TEXT,
    "recorded_by_staff" TEXT,
    CONSTRAINT "vital_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "blood_stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blood_group" TEXT NOT NULL,
    "group_category" TEXT NOT NULL,
    "color_code" TEXT NOT NULL,
    "whole_blood_units" INTEGER NOT NULL DEFAULT 0,
    "plasma_units" INTEGER NOT NULL DEFAULT 0,
    "last_updated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/webp',
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "size_in_bytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "media_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "media_links_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_summary" TEXT NOT NULL,
    "content_html" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "treatments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "is_flagship" BOOLEAN NOT NULL DEFAULT false,
    "short_summary" TEXT NOT NULL,
    "content_html" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Outpatient',
    "short_summary" TEXT NOT NULL,
    "content_html" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "qualifications" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "consultation_timings" TEXT NOT NULL DEFAULT '',
    "is_visiting" BOOLEAN NOT NULL DEFAULT false,
    "biography_html" TEXT NOT NULL DEFAULT '',
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "insurance_providers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scheme_type" TEXT NOT NULL,
    "description_html" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "media_type" TEXT NOT NULL DEFAULT 'IMAGE',
    "embed_code" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "author_name" TEXT NOT NULL DEFAULT 'Rithanya Medical Editorial',
    "category" TEXT NOT NULL DEFAULT 'Diabetes Management',
    "excerpt" TEXT NOT NULL,
    "content_html" TEXT NOT NULL DEFAULT '',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patient_name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Khammam',
    "treatment" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL DEFAULT 5,
    "quote" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Wellness',
    "description" TEXT NOT NULL DEFAULT '',
    "price" REAL NOT NULL,
    "stock_units" INTEGER NOT NULL DEFAULT 0,
    "is_prescription_req" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "shipping_address" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL DEFAULT '',
    "total_amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT NOT NULL DEFAULT 'COD',
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" REAL NOT NULL,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL DEFAULT 'RITHANYA_HOSPITAL',
    "full_name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "shift_schedule" TEXT NOT NULL DEFAULT 'General',
    "contact_number" TEXT NOT NULL DEFAULT '',
    "monthly_fixed_base_salary" REAL NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "base_salary" REAL NOT NULL,
    "calendar_days" INTEGER NOT NULL,
    "lop_days" INTEGER NOT NULL DEFAULT 0,
    "paid_days" INTEGER NOT NULL,
    "lop_deduction" REAL NOT NULL,
    "allowances" REAL NOT NULL DEFAULT 0,
    "other_deductions" REAL NOT NULL DEFAULT 0,
    "net_payable" REAL NOT NULL,
    "authorizer_sign_svg" TEXT,
    "authorizer_name" TEXT,
    "signed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "expense_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "vendor_payee" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "invoice_ref" TEXT,
    "method" TEXT NOT NULL,
    "entry_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expense_ledger_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dpdp_erasure_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tracking_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "identification_ref" TEXT,
    "records_nature" TEXT NOT NULL DEFAULT '',
    "request_details" TEXT NOT NULL,
    "identity_proof_file" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "matched_patient_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "preferred_date" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'WEBSITE',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "hospital_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'PRIMARY_CONFIG',
    "legal_name" TEXT NOT NULL DEFAULT 'Rithanya Hospital',
    "clinical_tagline" TEXT NOT NULL DEFAULT 'Dedicated Thalassemia Daycare, Diabetology & 24/7 Emergency Care',
    "emergency_hotline" TEXT NOT NULL DEFAULT '8328581019',
    "secondary_hotline" TEXT DEFAULT '9054177824',
    "whatsapp_number" TEXT NOT NULL DEFAULT '918328581019',
    "email" TEXT NOT NULL DEFAULT 'care@rithanyahospital.com',
    "critical_blood_alert_threshold" INTEGER NOT NULL DEFAULT 3,
    "physical_address" TEXT NOT NULL DEFAULT '',
    "opd_timings" TEXT NOT NULL DEFAULT 'Open 24 Hours | Daycare & OPD: 9:00 AM - 8:00 PM',
    "notice_banner" TEXT NOT NULL DEFAULT '',
    "seo_page_title" TEXT NOT NULL DEFAULT '',
    "meta_description" TEXT NOT NULL DEFAULT '',
    "target_keywords" TEXT NOT NULL DEFAULT '',
    "canonical_url" TEXT NOT NULL DEFAULT 'https://rithanyahospital.com',
    "robots_index_follow" BOOLEAN NOT NULL DEFAULT true,
    "favicon_url" TEXT,
    "social_share_thumbnail_url" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" TEXT,
    "user_id" TEXT,
    "user_name" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_module_access_user_id_key" ON "user_module_access"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_categories_name_key" ON "clinical_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "patients_uhid_key" ON "patients"("uhid");

-- CreateIndex
CREATE INDEX "patients_patient_type_idx" ON "patients"("patient_type");

-- CreateIndex
CREATE INDEX "patients_is_discharged_idx" ON "patients"("is_discharged");

-- CreateIndex
CREATE INDEX "inpatient_stays_patient_id_idx" ON "inpatient_stays"("patient_id");

-- CreateIndex
CREATE INDEX "vital_logs_patient_id_recorded_at_idx" ON "vital_logs"("patient_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "blood_stock_blood_group_key" ON "blood_stock"("blood_group");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_filename_key" ON "media_assets"("filename");

-- CreateIndex
CREATE INDEX "media_links_entity_type_entity_id_idx" ON "media_links"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "media_links_media_id_idx" ON "media_links"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_links_entity_type_entity_id_media_id_key" ON "media_links"("entity_type", "entity_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_slug_key" ON "specialties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "treatments_slug_key" ON "treatments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_slug_key" ON "doctors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "employees_entity_idx" ON "employees"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_employee_id_month_year_key" ON "payroll_records"("employee_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_key" ON "expense_categories"("name");

-- CreateIndex
CREATE INDEX "expense_ledger_entry_date_idx" ON "expense_ledger"("entry_date");

-- CreateIndex
CREATE UNIQUE INDEX "dpdp_erasure_requests_tracking_code_key" ON "dpdp_erasure_requests"("tracking_code");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
