-- ==========================================================================
-- Clinic System: Security Fix (2026-11-02)
-- รันทั้งไฟล์ใน Supabase SQL Editor (project fpmstumpobbjozflkola) ครั้งเดียว
-- รันซ้ำได้ (idempotent)
--
-- สิ่งที่ไฟล์นี้ทำ:
--   1. สร้าง/อัปเดต helper functions สำหรับ RLS
--   2. ย้ายรหัสผ่านพนักงานทุกคนเข้า Supabase Auth (bcrypt) แล้วลบรหัส plaintext ออกจาก staff_users
--      - ใช้รหัสผ่านเดิมของพนักงาน (ถ้ามีและยาว >= 6 ตัว) แทน '123456' จากสคริปต์เก่า
--      - คนที่ไม่มีรหัสใช้ได้ หรือรหัสเป็น '123456' จะถูกตั้ง must_change_password = true
--   3. ลบ policy ทั้งหมดบนตารางของคลินิก (รวม "Allow public full access ...") แล้วสร้างใหม่
--      ให้เข้าถึงได้เฉพาะพนักงานที่ล็อกอินผ่าน Supabase Auth และ is_active = true
--   4. สร้าง RPC สำหรับ Admin ตั้งรหัสผ่านพนักงาน และให้พนักงานเปลี่ยนรหัสตัวเอง
--
-- หลังรันแล้ว: ไปที่ Authentication > Sign In / Providers แล้วปิด "Allow new users to sign up"
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- --------------------------------------------------------------------------
-- Step 1: Columns
-- --------------------------------------------------------------------------
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.staff_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.staff_users ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_users_auth_id ON public.staff_users(auth_user_id);

-- --------------------------------------------------------------------------
-- Step 2: Helper functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE auth.uid() IS NOT NULL
      AND (auth_user_id = auth.uid() OR id::text = auth.uid()::text)
      AND is_active IS NOT FALSE
  );
$$;

-- Admin = role 'admin' / 'ผู้ดูแลระบบ' หรือมีสิทธิ์ 'all' (ตรงกับที่หน้าเว็บใช้ตัดสิน)
CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE auth.uid() IS NOT NULL
      AND (auth_user_id = auth.uid() OR id::text = auth.uid()::text)
      AND is_active IS NOT FALSE
      AND (
        role IN ('admin', 'ผู้ดูแลระบบ')
        OR COALESCE(permissions::text, '') ~ '(^|[{\[",[:space:]])all([}\]",[:space:]]|$)'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(VARIADIC allowed_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff_admin() OR EXISTS (
    SELECT 1 FROM public.staff_users
    WHERE auth.uid() IS NOT NULL
      AND (auth_user_id = auth.uid() OR id::text = auth.uid()::text)
      AND is_active IS NOT FALSE
      AND role = ANY(allowed_roles)
  );
$$;

-- ปิด trigger เดิมที่ผูก auth user เข้ากับ staff_users ด้วย email อัตโนมัติ
-- (ถ้าเปิด sign up ไว้ คนนอกสมัครด้วย email ของพนักงานแล้วได้สิทธิ์ทันที)
DROP TRIGGER IF EXISTS on_auth_user_created_link_staff ON auth.users;

-- --------------------------------------------------------------------------
-- Step 3: Internal helper — สร้าง/อัปเดต auth user ของพนักงาน 1 คน
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._clinic_upsert_auth_user(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_uid uuid;
  v_email text := lower(trim(p_email));
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(),
      '', '', '', ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_uid AND provider = 'email') THEN
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', v_uid::text, NOW(), NOW(), NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_uid;
END;
$$;
REVOKE ALL ON FUNCTION public._clinic_upsert_auth_user(text, text) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------------
-- Step 4: ย้ายรหัสผ่านทุกคนเข้า Supabase Auth แล้วลบ plaintext
-- --------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_uid uuid;
  v_pwd text;
  v_usable boolean;
  v_existing_pwd text;
  v_auth_is_default boolean;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.staff_users
    WHERE email IS NOT NULL AND trim(email) <> ''
  LOOP
    v_pwd := r.password_hash;
    -- รหัส plaintext ที่ใช้ได้ (ไม่ใช่ SHA-256 hex และยาวพอ)
    v_usable := v_pwd IS NOT NULL AND length(v_pwd) >= 6 AND v_pwd !~ '^[0-9a-f]{64}$';

    SELECT encrypted_password INTO v_existing_pwd
    FROM auth.users WHERE lower(email) = lower(trim(r.email)) LIMIT 1;
    -- crypt() จะ error ถ้า encrypted_password ว่างหรือไม่ใช่ bcrypt จึงเช็ครูปแบบก่อน
    v_auth_is_default := v_existing_pwd IS NOT NULL
      AND v_existing_pwd LIKE '$2%'
      AND v_existing_pwd = extensions.crypt('123456', v_existing_pwd);
    IF v_existing_pwd IS NOT NULL AND v_existing_pwd NOT LIKE '$2%' THEN
      v_existing_pwd := NULL; -- ไม่มีรหัสที่ใช้ได้ → ให้ตั้งใหม่
    END IF;

    IF v_usable THEN
      v_uid := public._clinic_upsert_auth_user(r.email, v_pwd);
      UPDATE public.staff_users
      SET auth_user_id = v_uid,
          password_hash = NULL,
          must_change_password = (v_pwd = '123456')
      WHERE id = r.id;
    ELSIF v_existing_pwd IS NULL OR v_auth_is_default THEN
      -- ไม่มีรหัสที่ใช้ได้ → ตั้งรหัสสุ่ม ให้ Admin ตั้งรหัสใหม่ในหน้าจัดการพนักงาน
      v_uid := public._clinic_upsert_auth_user(r.email, encode(extensions.gen_random_bytes(18), 'base64'));
      UPDATE public.staff_users
      SET auth_user_id = v_uid,
          password_hash = NULL,
          must_change_password = true
      WHERE id = r.id;
    ELSE
      -- มี auth user ที่ตั้งรหัสเองแล้ว → แค่ผูกและลบ plaintext
      UPDATE public.staff_users
      SET auth_user_id = (SELECT id FROM auth.users WHERE lower(email) = lower(trim(r.email)) LIMIT 1),
          password_hash = NULL
      WHERE id = r.id;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  -- ป้องกัน GoTrue error "Scan error converting NULL"
  UPDATE auth.users
  SET confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_new = COALESCE(email_change_token_new, '');

  RAISE NOTICE 'Migrated % staff accounts to Supabase Auth.', v_count;
END $$;

-- --------------------------------------------------------------------------
-- Step 5: RPC
-- --------------------------------------------------------------------------
-- Admin ตั้ง/รีเซ็ตรหัสผ่านพนักงาน (ใช้ทั้งตอนเพิ่มพนักงานใหม่และแก้ไข)
CREATE OR REPLACE FUNCTION public.admin_set_staff_password(p_staff_id text, p_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  IF NOT public.is_staff_admin() THEN
    RAISE EXCEPTION 'Only admin can set staff passwords' USING ERRCODE = '42501';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT email INTO v_email FROM public.staff_users WHERE id::text = p_staff_id;
  IF v_email IS NULL OR trim(v_email) = '' THEN
    RAISE EXCEPTION 'Staff not found or has no email';
  END IF;

  v_uid := public._clinic_upsert_auth_user(v_email, p_password);
  UPDATE public.staff_users
  SET auth_user_id = v_uid, password_hash = NULL, must_change_password = true
  WHERE id::text = p_staff_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_staff_password(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_password(text, text) TO authenticated;

-- พนักงานล้าง flag หลังเปลี่ยนรหัสตัวเองแล้ว (ตัวรหัสเปลี่ยนผ่าน supabase.auth.updateUser)
CREATE OR REPLACE FUNCTION public.clear_my_password_flag()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.staff_users SET must_change_password = false
  WHERE auth.uid() IS NOT NULL AND (auth_user_id = auth.uid() OR id::text = auth.uid()::text);
$$;
REVOKE ALL ON FUNCTION public.clear_my_password_flag() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_my_password_flag() TO authenticated;

-- --------------------------------------------------------------------------
-- Step 6: RLS — ลบ policy เดิมทั้งหมด แล้วให้เฉพาะพนักงานที่ล็อกอินแล้ว
-- --------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  v_tables text[] := ARRAY[
    'appointments', 'bills', 'clinic_expenses', 'clinic_settings', 'commission_logs',
    'commission_settings', 'icd10_diseases', 'medicines', 'patients', 'referrers',
    'services', 'staff', 'staff_users', 'stk_nutrient_orders', 'stk_system_settings',
    'supplies', 'supply_intakes', 'supply_requests', 'system_settings', 'visits'
  ];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip missing table %', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;

    IF t = 'staff_users' THEN
      -- หมายเหตุ: ห้ามใช้ is_active_staff() ใน policy ของ staff_users เพราะจะเกิด Infinite Recursion (HTTP 500)
      EXECUTE 'CREATE POLICY "clinic_staff_read" ON public.staff_users FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
      EXECUTE 'CREATE POLICY "clinic_admin_insert" ON public.staff_users FOR INSERT TO authenticated WITH CHECK (public.is_staff_admin())';
      EXECUTE 'CREATE POLICY "clinic_admin_update" ON public.staff_users FOR UPDATE TO authenticated USING (public.is_staff_admin()) WITH CHECK (public.is_staff_admin())';
      EXECUTE 'CREATE POLICY "clinic_admin_delete" ON public.staff_users FOR DELETE TO authenticated USING (public.is_staff_admin())';
    ELSE
      EXECUTE format(
        'CREATE POLICY "clinic_staff_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t
      );
    END IF;
  END LOOP;

  -- หน้า login (ยังไม่ล็อกอิน) ต้องอ่านรูปพื้นหลังได้อย่างเดียว
  IF to_regclass('public.clinic_settings') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY "anon_read_login_bg" ON public.clinic_settings FOR SELECT TO anon USING (key = ''clinic_login_bg_url'')';
  END IF;
END $$;

-- ==========================================================================
-- ตรวจผลหลังรัน:
--   SELECT emp_code, email, auth_user_id IS NOT NULL AS linked, must_change_password,
--          password_hash IS NULL AS plaintext_removed
--   FROM public.staff_users ORDER BY emp_code;
--   SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY 1;
-- ==========================================================================
