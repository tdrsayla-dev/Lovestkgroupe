-- LOVE STK GROUPE | Supabase schema v1 | 2026-10-08
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วาง SQL ทั้งไฟล์ > Run
-- ใช้กับ Project ใหม่ หรือ Project ที่ยังไม่มีตารางชื่อเดียวกัน
-- สร้าง 12 ตาราง ไม่ลบข้อมูลเดิม; รันซ้ำได้เมื่อโครงสร้างตรงกับไฟล์นี้
-- สำคัญ: ไฟล์นี้สร้างโครงสร้าง ไม่ได้ย้าย CMS เดิมหรือเชื่อมเว็บไซต์โดยอัตโนมัติ
-- ใช้ Supabase Auth สำหรับผู้ดูแล; ไม่เก็บรหัสผ่านหรือ API Key ในตารางนี้
-- ข้อความ 3 ภาษาเก็บใน translations; รหัสภาษา: th / lo / en
-- แยก draft / published / archived; public อ่านได้เฉพาะข้อมูล published
-- ต้องตั้ง Supabase Storage + นโยบาย Storage แยก หากต้องการอัปโหลดรูป
-- คำแปลกรอกเองได้ ไม่ต้องใช้ Google Translation API

BEGIN;
CREATE SCHEMA IF NOT EXISTS website_private;
REVOKE ALL ON SCHEMA website_private FROM PUBLIC;
GRANT USAGE ON SCHEMA website_private TO anon, authenticated, service_role;

-- 1. ผู้ดูแล: สร้าง account ใน Supabase Authentication ก่อน แล้วผูก user_id
CREATE TABLE IF NOT EXISTS public.admin_users (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT '',
 role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor')),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ไฟล์รูป / วิดีโอ / เอกสาร: เก็บที่อยู่ไฟล์ ไม่เก็บ binary ใน database
CREATE TABLE IF NOT EXISTS public.media_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 file_name text NOT NULL,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
 storage_bucket text NOT NULL DEFAULT 'website-media',
 object_path text,
 public_url text,
 width integer CHECK (width > 0),
 height integer CHECK (height > 0),
 alt_text jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(alt_text)='object'),
 is_public boolean NOT NULL DEFAULT false,
 uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (object_path IS NOT NULL OR public_url IS NOT NULL),
 CHECK (public_url IS NULL OR public_url ~ '^https://' OR public_url ~ '^/?assets/')
);
CREATE UNIQUE INDEX IF NOT EXISTS media_files_storage_path_uq
 ON public.media_files(storage_bucket,object_path) WHERE object_path IS NOT NULL;

-- 3. ตั้งค่าเว็บ / ติดต่อ / สี / ภาษา (เฉพาะข้อมูลที่เปิดเผยต่อผู้เข้าชมได้)
CREATE TABLE IF NOT EXISTS public.website_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settings_key text NOT NULL DEFAULT 'main' UNIQUE CHECK (settings_key='main'),
 site_name text NOT NULL DEFAULT 'LOVE STK GROUPE',
 default_language text NOT NULL DEFAULT 'lo' CHECK (default_language IN ('th','lo','en')),
 enabled_languages text[] NOT NULL DEFAULT ARRAY['th','lo','en'],
 logo_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 favicon_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 phone text NOT NULL DEFAULT '',
 email text NOT NULL DEFAULT '',
 address jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(address)='object'),
 social_links jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(social_links)='object'),
 theme jsonb NOT NULL DEFAULT '{"brandColor":"#175bd2","highlightColor":"#E0B840","defaultMode":"dark"}'::jsonb CHECK (jsonb_typeof(theme)='object'),
 slide_seconds numeric(5,2) NOT NULL DEFAULT 3.5 CHECK (slide_seconds BETWEEN 2 AND 30),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (cardinality(enabled_languages)>0 AND enabled_languages <@ ARRAY['th','lo','en']::text[]),
 CHECK (default_language=ANY(enabled_languages))
);

-- 4. ส่วนต่าง ๆ ของหน้าเว็บ: hero, about, contact, footer ฯลฯ
CREATE TABLE IF NOT EXISTS public.page_sections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 page_key text NOT NULL CHECK (length(trim(page_key))>0),
 section_key text NOT NULL CHECK (length(trim(section_key))>0),
 component_type text NOT NULL DEFAULT 'text',
 image_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 video_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 sort_order integer NOT NULL DEFAULT 0,
 is_visible boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 appearance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(appearance)='object'),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(page_key,section_key)
);

-- 5. ธุรกิจในเครือ
CREATE TABLE IF NOT EXISTS public.businesses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 logo_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 cover_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 website_url text,
 sort_order integer NOT NULL DEFAULT 0,
 is_visible boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (website_url IS NULL OR website_url ~ '^https://')
);

-- 6. ผู้บริหาร: role เช่น CEO / CFO / COO; ชื่อ ประวัติ ตำแหน่งเต็มอยู่ใน translations
CREATE TABLE IF NOT EXISTS public.executives (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 role_code text NOT NULL,
 business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
 portrait_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 sort_order integer NOT NULL DEFAULT 0,
 is_visible boolean NOT NULL DEFAULT true,
 is_mock boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. ข่าวสาร: title / summary / body อยู่ใน translations
CREATE TABLE IF NOT EXISTS public.news (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 category text NOT NULL DEFAULT 'company',
 cover_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 news_date date NOT NULL DEFAULT current_date,
 publish_at timestamptz NOT NULL DEFAULT now(),
 is_featured boolean NOT NULL DEFAULT false,
 is_mock boolean NOT NULL DEFAULT false,
 is_visible boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. สินค้า: name / summary / description อยู่ใน translations
CREATE TABLE IF NOT EXISTS public.products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 sku text UNIQUE,
 business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
 category text NOT NULL DEFAULT 'health',
 price numeric(20,2) CHECK (price >= 0), -- NULL = สอบถามราคา; 0 เป็นราคาที่ถูกต้อง
 currency text NOT NULL DEFAULT 'LAK' CHECK (currency IN ('LAK','THB','USD')),
 sort_order integer NOT NULL DEFAULT 0,
 is_mock boolean NOT NULL DEFAULT false,
 is_visible boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 attributes jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. รูปสินค้า: เพิ่มได้เกิน 4 รูปในอนาคต ไม่จำกัดจำนวน
CREATE TABLE IF NOT EXISTS public.product_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES public.media_files(id) ON DELETE RESTRICT,
 view_key text NOT NULL DEFAULT 'additional',
 is_primary boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(product_id,media_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_uq
 ON public.product_images(product_id) WHERE is_primary;

-- 10. แบนเนอร์ / โปรโมชั่น / สไลด์
CREATE TABLE IF NOT EXISTS public.promotions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 placement text NOT NULL DEFAULT 'products-hero',
 media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 mobile_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
 link_url text,
 starts_at timestamptz,
 ends_at timestamptz,
 sort_order integer NOT NULL DEFAULT 0,
 is_visible boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
 CHECK (link_url IS NULL OR link_url ~ '^https://' OR link_url ~ '^[/#]' OR link_url ~ '^[a-zA-Z0-9_-]+[.]html([?#].*)?$')
);

-- 11. คำแปล: เลือกเจ้าของเพียง 1 ช่อง หรือ dictionary_key สำหรับเมนู/ปุ่ม
-- field_key เช่น title, summary, body, name, description, button_label
-- value เป็นข้อความ UTF-8; ถ้าใช้ HTML ให้เว็บไซต์ sanitize ก่อนแสดง
CREATE TABLE IF NOT EXISTS public.translations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dictionary_key text,
 section_id uuid REFERENCES public.page_sections(id) ON DELETE CASCADE,
 business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
 executive_id uuid REFERENCES public.executives(id) ON DELETE CASCADE,
 news_id uuid REFERENCES public.news(id) ON DELETE CASCADE,
 product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
 promotion_id uuid REFERENCES public.promotions(id) ON DELETE CASCADE,
 field_key text NOT NULL DEFAULT 'label' CHECK (length(trim(field_key))>0),
 language text NOT NULL CHECK (language IN ('th','lo','en')),
 value text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 translation_method text NOT NULL DEFAULT 'manual' CHECK (translation_method IN ('manual','api')),
 needs_review boolean NOT NULL DEFAULT false,
 source_language text CHECK (source_language IN ('th','lo','en')),
 source_hash text,
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (num_nonnulls(dictionary_key,section_id,business_id,executive_id,news_id,product_id,promotion_id)=1),
 CHECK (dictionary_key IS NULL OR length(trim(dictionary_key))>0)
);

-- 12. ประวัติการแก้ไข: เขียนจาก trigger; ผู้ใช้แก้หรือลบ log เองไม่ได้
CREATE TABLE IF NOT EXISTS public.audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 table_name text NOT NULL,
 record_id uuid,
 action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
 old_data jsonb,
 new_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS translations_dictionary_key_uq ON public.translations(dictionary_key,field_key,language) WHERE dictionary_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS translations_section_id_uq ON public.translations(section_id,field_key,language) WHERE section_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS translations_business_id_uq ON public.translations(business_id,field_key,language) WHERE business_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS translations_executive_id_uq ON public.translations(executive_id,field_key,language) WHERE executive_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS translations_news_id_uq ON public.translations(news_id,field_key,language) WHERE news_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS translations_product_id_uq ON public.translations(product_id,field_key,language) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS translations_promotion_id_uq ON public.translations(promotion_id,field_key,language) WHERE promotion_id IS NOT NULL;

-- ดัชนีสำหรับหมวดหมู่ การแสดงผล ลำดับ และ foreign keys
CREATE INDEX IF NOT EXISTS page_sections_page_idx ON public.page_sections(page_key,status,sort_order);
CREATE INDEX IF NOT EXISTS businesses_display_idx ON public.businesses(status,sort_order);
CREATE INDEX IF NOT EXISTS executives_business_idx ON public.executives(business_id);
CREATE INDEX IF NOT EXISTS executives_display_idx ON public.executives(status,sort_order);
CREATE INDEX IF NOT EXISTS news_display_idx ON public.news(status,category,publish_at DESC);
CREATE INDEX IF NOT EXISTS products_display_idx ON public.products(status,category,sort_order);
CREATE INDEX IF NOT EXISTS products_business_idx ON public.products(business_id);
CREATE INDEX IF NOT EXISTS product_images_display_idx ON public.product_images(product_id,sort_order);
CREATE INDEX IF NOT EXISTS product_images_media_idx ON public.product_images(media_id);
CREATE INDEX IF NOT EXISTS promotions_display_idx ON public.promotions(placement,status,sort_order);
CREATE INDEX IF NOT EXISTS translations_language_idx ON public.translations(language,status);
CREATE INDEX IF NOT EXISTS media_files_uploader_idx ON public.media_files(uploaded_by);
CREATE INDEX IF NOT EXISTS audit_logs_record_idx ON public.audit_logs(table_name,record_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs(actor_id,created_at DESC);

-- Helpers อยู่ใน schema ที่ไม่ควรเปิดเป็น Data API schema
CREATE OR REPLACE FUNCTION website_private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_users a WHERE a.id=(SELECT auth.uid()) AND a.is_active);
$$;
CREATE OR REPLACE FUNCTION website_private.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_users a WHERE a.id=(SELECT auth.uid()) AND a.is_active AND a.role='owner');
$$;
REVOKE ALL ON FUNCTION website_private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION website_private.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION website_private.is_admin(), website_private.is_owner() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION website_private.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;
CREATE OR REPLACE FUNCTION website_private.write_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.audit_logs(actor_id,table_name,record_id,action,old_data,new_data)
 VALUES(auth.uid(),TG_TABLE_NAME,CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,TG_OP,
 CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
 CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION website_private.touch_updated_at(),website_private.write_audit_log() FROM PUBLIC;

-- Enable RLS และสิทธิ์ขั้นต่ำ; service_role ใช้เฉพาะ backend ห้ามใส่ใน browser
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.website_settings FROM anon, authenticated;
GRANT SELECT ON public.website_settings TO authenticated;
GRANT ALL ON public.website_settings TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.website_settings;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.website_settings FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.website_settings;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.website_settings FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.website_settings TO authenticated;
GRANT SELECT ON public.website_settings TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.website_settings;
CREATE POLICY website_admin_manage ON public.website_settings FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.page_sections FROM anon, authenticated;
GRANT SELECT ON public.page_sections TO authenticated;
GRANT ALL ON public.page_sections TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.page_sections;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.page_sections FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.page_sections;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.page_sections FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.page_sections TO authenticated;
GRANT SELECT ON public.page_sections TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.page_sections;
CREATE POLICY website_admin_manage ON public.page_sections FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.translations FROM anon, authenticated;
GRANT SELECT ON public.translations TO authenticated;
GRANT ALL ON public.translations TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.translations;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.translations FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.translations;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.translations FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.translations TO authenticated;
GRANT SELECT ON public.translations TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.translations;
CREATE POLICY website_admin_manage ON public.translations FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.businesses FROM anon, authenticated;
GRANT SELECT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.businesses;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.businesses;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.businesses FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT SELECT ON public.businesses TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.businesses;
CREATE POLICY website_admin_manage ON public.businesses FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.executives ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.executives FROM anon, authenticated;
GRANT SELECT ON public.executives TO authenticated;
GRANT ALL ON public.executives TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.executives;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.executives FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.executives;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.executives FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.executives TO authenticated;
GRANT SELECT ON public.executives TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.executives;
CREATE POLICY website_admin_manage ON public.executives FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news FROM anon, authenticated;
GRANT SELECT ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.news;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.news;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.news FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT SELECT ON public.news TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.news;
CREATE POLICY website_admin_manage ON public.news FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.products FROM anon, authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.products;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.products;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.products;
CREATE POLICY website_admin_manage ON public.products FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_images FROM anon, authenticated;
GRANT SELECT ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.product_images;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.product_images;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.product_images FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT ON public.product_images TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.product_images;
CREATE POLICY website_admin_manage ON public.product_images FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotions FROM anon, authenticated;
GRANT SELECT ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.promotions;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.promotions;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.promotions FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.promotions;
CREATE POLICY website_admin_manage ON public.promotions FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_files FROM anon, authenticated;
GRANT SELECT ON public.media_files TO authenticated;
GRANT ALL ON public.media_files TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.media_files;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.media_files;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.media_files FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
GRANT INSERT, UPDATE, DELETE ON public.media_files TO authenticated;
GRANT SELECT ON public.media_files TO anon;
DROP POLICY IF EXISTS website_admin_manage ON public.media_files;
CREATE POLICY website_admin_manage ON public.media_files FOR ALL TO authenticated
 USING ((SELECT website_private.is_admin())) WITH CHECK ((SELECT website_private.is_admin()));
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
DROP TRIGGER IF EXISTS website_touch_updated_at ON public.admin_users;
CREATE TRIGGER website_touch_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION website_private.touch_updated_at();
DROP TRIGGER IF EXISTS website_audit_change ON public.admin_users;
CREATE TRIGGER website_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION website_private.write_audit_log();
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- เจ้าของเท่านั้นที่เพิ่ม/เปลี่ยนสิทธิ์ผู้ดูแลได้; editor ไม่มีสิทธิ์ยกระดับตนเอง
GRANT INSERT,UPDATE,DELETE ON public.admin_users TO authenticated;
DROP POLICY IF EXISTS website_owner_manage ON public.admin_users;
CREATE POLICY website_owner_manage ON public.admin_users FOR ALL TO authenticated
 USING ((SELECT website_private.is_owner())) WITH CHECK ((SELECT website_private.is_owner()));
DROP POLICY IF EXISTS website_admin_own_row ON public.admin_users;
CREATE POLICY website_admin_own_row ON public.admin_users FOR SELECT TO authenticated USING (id=(SELECT auth.uid()));
DROP POLICY IF EXISTS website_admin_read_log ON public.audit_logs;
CREATE POLICY website_admin_read_log ON public.audit_logs FOR SELECT TO authenticated USING ((SELECT website_private.is_admin()));

-- เงื่อนไขข้อมูลที่ผู้เข้าชมอ่านได้
DROP POLICY IF EXISTS website_public_read ON public.website_settings;
CREATE POLICY website_public_read ON public.website_settings FOR SELECT TO anon,authenticated USING (true);
DROP POLICY IF EXISTS website_public_read ON public.page_sections;
CREATE POLICY website_public_read ON public.page_sections FOR SELECT TO anon,authenticated USING (status='published' AND is_visible);
DROP POLICY IF EXISTS website_public_read ON public.businesses;
CREATE POLICY website_public_read ON public.businesses FOR SELECT TO anon,authenticated USING (status='published' AND is_visible);
DROP POLICY IF EXISTS website_public_read ON public.executives;
CREATE POLICY website_public_read ON public.executives FOR SELECT TO anon,authenticated USING (status='published' AND is_visible);
DROP POLICY IF EXISTS website_public_read ON public.news;
CREATE POLICY website_public_read ON public.news FOR SELECT TO anon,authenticated USING (status='published' AND is_visible AND publish_at<=now());
DROP POLICY IF EXISTS website_public_read ON public.products;
CREATE POLICY website_public_read ON public.products FOR SELECT TO anon,authenticated USING (status='published' AND is_visible);
DROP POLICY IF EXISTS website_public_read ON public.promotions;
CREATE POLICY website_public_read ON public.promotions FOR SELECT TO anon,authenticated USING (status='published' AND is_visible AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()));
DROP POLICY IF EXISTS website_public_read ON public.media_files;
CREATE POLICY website_public_read ON public.media_files FOR SELECT TO anon,authenticated USING (is_public);
DROP POLICY IF EXISTS website_public_read ON public.product_images;
CREATE POLICY website_public_read ON public.product_images FOR SELECT TO anon,authenticated USING (EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.status='published' AND p.is_visible) AND EXISTS(SELECT 1 FROM public.media_files m WHERE m.id=media_id AND m.is_public));
DROP POLICY IF EXISTS website_public_read ON public.translations;
CREATE POLICY website_public_read ON public.translations FOR SELECT TO anon,authenticated USING (status='published' AND NOT needs_review AND (
 dictionary_key IS NOT NULL
 OR EXISTS(SELECT 1 FROM public.page_sections p WHERE p.id=section_id AND p.status='published' AND p.is_visible)
 OR EXISTS(SELECT 1 FROM public.businesses b WHERE b.id=business_id AND b.status='published' AND b.is_visible)
 OR EXISTS(SELECT 1 FROM public.executives e WHERE e.id=executive_id AND e.status='published' AND e.is_visible)
 OR EXISTS(SELECT 1 FROM public.news n WHERE n.id=news_id AND n.status='published' AND n.is_visible AND n.publish_at<=now())
 OR EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.status='published' AND p.is_visible)
 OR EXISTS(SELECT 1 FROM public.promotions p WHERE p.id=promotion_id AND p.status='published' AND p.is_visible AND (p.starts_at IS NULL OR p.starts_at<=now()) AND (p.ends_at IS NULL OR p.ends_at>now()))
));

-- ข้อมูลตั้งต้นเฉพาะชื่อเว็บและ Dictionary ตัวอย่าง; ไม่ใส่ราคาหรือข้อมูลธุรกิจจริง
INSERT INTO public.website_settings(settings_key,site_name)
VALUES('main','LOVE STK GROUPE') ON CONFLICT(settings_key) DO NOTHING;
INSERT INTO public.translations(dictionary_key,field_key,language,value,status)
VALUES ('contact','label','th','ติดต่อเรา','published'),
       ('contact','label','lo','ຕິດຕໍ່ພວກເຮົາ','published'),
       ('contact','label','en','Contact us','published')
ON CONFLICT DO NOTHING;
COMMIT;

-- ขั้นตอนหลังรัน
-- 1) Authentication > Users: สร้าง/เชิญบัญชีผู้ดูแล (ใช้ Supabase Auth)
-- 2) เพิ่ม owner คนแรกด้วย SQL ด้านล่าง โดยนำเครื่องหมาย -- ออก
--    เปลี่ยน UUID เป็น User UID จริงจาก Authentication > Users
-- INSERT INTO public.admin_users(id,display_name,role)
-- VALUES('ใส่-USER-UUID-จริง','Website owner','owner');
-- ห้ามใช้ service_role key ใน HTML/JavaScript ฝั่งผู้เข้าชม
-- 3) เพิ่มข้อมูล draft; ใส่ข้อความใน translations ด้วย parent_id / field_key / language
-- 4) เมื่อตรวจแล้ว ตั้ง status='published' ทั้งรายการหลักและคำแปล
--    รูปที่ต้องเปิดสาธารณะตั้ง media_files.is_public=true
-- 5) ติดต่อเราอยู่ website_settings; social_links เช่น {"line":"https://...","whatsapp":"https://..."}
-- 6) ไม่ใช่ระบบ version history แบบ restore อัตโนมัติ: audit_logs คือประวัติการเปลี่ยนแปลง
--    ถ้าต้องแก้ draft โดยคง published เดิมพร้อมกัน ให้เพิ่ม workflow/versioning ภายหลัง
-- 7) หากต้องการระบบคำสั่งซื้อจริง ค่อยเพิ่ม customers / orders / order_items
-- 8) Audit เก็บสำเนาข้อมูลที่แก้ไข: กำหนด retention ตามการใช้งาน และอย่าใส่ secrets ใน CMS

-- ตรวจจำนวนตารางที่สร้าง (ผลควรเป็น 12)
SELECT count(*) AS website_table_count FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
 ('website_settings','page_sections','translations','businesses','executives','news',
  'products','product_images','promotions','media_files','admin_users','audit_logs');
