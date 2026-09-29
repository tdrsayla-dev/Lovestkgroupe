-- ============================================================================
-- SQL SCRIPT: CREATE WAREHOUSE & LOT MANAGEMENT TABLES
-- LOVE STK GROUPE SYSTEM
-- สามารถคัดลอกคำสั่งด้านล่างนี้ไปรันใน Supabase -> SQL Editor ได้ทันที
-- ============================================================================

-- 1. ตารางคลังสินค้า (Warehouses)
CREATE TABLE IF NOT EXISTS public.stk_warehouses (
    warehouse_id text PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL, -- 'SUPPLEMENT', 'PHARMACY', 'MEDICAL_DEVICE'
    location text,
    description text,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- เพิ่มข้อมูลเริ่มต้นของคลังสินค้า
INSERT INTO public.stk_warehouses (warehouse_id, name, type, location, description)
VALUES 
    ('MAIN_WH', 'คลังใหญ่ (Main Warehouse)', 'SUPPLEMENT', 'ชั้น 2 อาคารหลัก', 'คลังเก็บสินค้าล็อตใหญ่ / ศูนย์กระจายสินค้า'),
    ('FRONT_STORE', 'ห้องขายหน้าร้าน (Front Store)', 'SUPPLEMENT', 'ชั้น 1 แผนกขาย', 'คลังหน้าร้านสำหรับตัดขายตามบิล'),
    ('PHARMA_MAIN', 'คลังยาใหญ่ (Pharmacy Storage)', 'PHARMACY', 'ห้องควบคุมอุณหภูมิ', 'คลังเก็บยาหลวงและเวชภัณฑ์ยา'),
    ('PHARMA_FRONT', 'ห้องจ่ายยาหน้าร้าน (Dispensary)', 'PHARMACY', 'เคาน์เตอร์เภสัช', 'ห้องจ่ายยาตามใบสั่งแพทย์'),
    ('MED_DEVICE_MAIN', 'คลังอุปกรณ์การแพทย์ (Medical Store)', 'MEDICAL_DEVICE', 'สโตร์เครื่องมือแพทย์', 'คลังเก็บเครื่องมือและเวชภัณฑ์สิ้นเปลือง')
ON CONFLICT (warehouse_id) DO NOTHING;

-- 2. ตารางล็อตสินค้าและวันหมดอายุ (Lots & Expiration)
CREATE TABLE IF NOT EXISTS public.stk_lots (
    lot_id text PRIMARY KEY,
    product_id text NOT NULL,
    domain_type text NOT NULL DEFAULT 'SUPPLEMENT', -- 'SUPPLEMENT', 'PHARMACY', 'MEDICAL_DEVICE'
    warehouse_id text NOT NULL DEFAULT 'MAIN_WH',
    mfg_date date,
    expiry_date date NOT NULL,
    initial_qty numeric DEFAULT 0,
    remaining_qty numeric DEFAULT 0,
    cost_price numeric DEFAULT 0,
    notes text,
    status text DEFAULT 'ACTIVE', -- 'ACTIVE', 'NEAR_EXPIRY', 'EXPIRED', 'DEPLETED'
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_stk_lots_product ON public.stk_lots (product_id);
CREATE INDEX IF NOT EXISTS idx_stk_lots_expiry ON public.stk_lots (expiry_date);
CREATE INDEX IF NOT EXISTS idx_stk_lots_warehouse ON public.stk_lots (warehouse_id);

-- 3. ตารางประวัติการเบิกย้ายสินค้าข้ามคลัง (Warehouse Transfers)
CREATE TABLE IF NOT EXISTS public.stk_warehouse_transfers (
    transfer_id text PRIMARY KEY,
    transfer_date date NOT NULL,
    from_warehouse text NOT NULL,
    to_warehouse text NOT NULL,
    domain_type text NOT NULL DEFAULT 'SUPPLEMENT',
    items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    total_items numeric DEFAULT 0,
    status text DEFAULT 'COMPLETED', -- 'PENDING', 'COMPLETED', 'CANCELLED'
    requested_by text,
    received_by text,
    notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_stk_transfers_date ON public.stk_warehouse_transfers (transfer_date);

-- 4. ตารางบันทึกการกระทบยอดและตรวจนับสต๊อกประจำวัน (Daily Stock Balance & Audit)
CREATE TABLE IF NOT EXISTS public.stk_daily_balance (
    id text PRIMARY KEY,
    balance_date date NOT NULL,
    warehouse_id text NOT NULL,
    product_id text NOT NULL,
    domain_type text NOT NULL DEFAULT 'SUPPLEMENT',
    opening_qty numeric DEFAULT 0,
    transfer_in_qty numeric DEFAULT 0,
    transfer_out_qty numeric DEFAULT 0,
    sales_qty numeric DEFAULT 0,
    adjust_qty numeric DEFAULT 0,
    system_closing_qty numeric DEFAULT 0,
    physical_count_qty numeric,
    diff_qty numeric DEFAULT 0,
    audited_by text,
    audit_status text DEFAULT 'PENDING', -- 'BALANCED', 'DISCREPANCY', 'PENDING'
    audit_notes text,
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_stk_daily_bal_date ON public.stk_daily_balance (balance_date);
CREATE INDEX IF NOT EXISTS idx_stk_daily_bal_wh ON public.stk_daily_balance (warehouse_id);

-- 5. ตารางทะเบียนยาหลวง (Pharmacy Drugs Master)
CREATE TABLE IF NOT EXISTS public.pharma_drugs (
    drug_id text PRIMARY KEY,
    trade_name text NOT NULL,
    generic_name text,
    reg_number text, -- เลขทะเบียนยา อย.
    dosage_form text DEFAULT 'เม็ด', -- เม็ด, แคปซูล, ครีม, ยาน้ำ, ยาฉีด
    strength text, -- เช่น 500 mg, 10 mg/ml
    drug_category text DEFAULT 'ยาทั่วไป', -- 'ยาทั่วไป', 'ยาอันตราย', 'ยาควบคุมพิเศษ'
    unit_dispense text DEFAULT 'กล่อง',
    price_retail numeric DEFAULT 0,
    price_cost numeric DEFAULT 0,
    description text,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 6. ตารางทะเบียนอุปกรณ์และเครื่องมือแพทย์ (Medical Equipment Master)
CREATE TABLE IF NOT EXISTS public.med_equipment (
    item_id text PRIMARY KEY,
    name text NOT NULL,
    item_type text DEFAULT 'CONSUMABLE', -- 'CONSUMABLE' (สิ้นเปลือง), 'DURABLE' (ครุภัณฑ์)
    brand text,
    model_no text,
    unit text DEFAULT 'ชิ้น',
    price_cost numeric DEFAULT 0,
    description text,
    status text DEFAULT 'ACTIVE',
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);
