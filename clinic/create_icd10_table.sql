-- ============================================================
-- Clinic System: ICD-10 Diseases Master Table Setup
-- Execute this SQL script in Supabase SQL Editor.
-- ============================================================

-- 1. Create ICD-10 Diseases Table
CREATE TABLE IF NOT EXISTS public.icd10_diseases (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name_la TEXT NOT NULL,
    name_th TEXT,
    name_en TEXT,
    category VARCHAR(100),
    is_common BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS & Add Public Access Policies
ALTER TABLE public.icd10_diseases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access icd10_diseases" ON public.icd10_diseases;
CREATE POLICY "Allow public read access icd10_diseases" ON public.icd10_diseases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public full access icd10_diseases" ON public.icd10_diseases;
CREATE POLICY "Allow public full access icd10_diseases" ON public.icd10_diseases FOR ALL USING (true) WITH CHECK (true);

-- 3. Add ICD-10 columns to visits table (for recording final diagnosis on each visit)
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS icd10_code VARCHAR(50);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS icd10_name TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS icd10_diag_note TEXT;

-- 4. Create Indexes for fast autocomplete search
CREATE INDEX IF NOT EXISTS idx_icd10_code ON public.icd10_diseases (code);
CREATE INDEX IF NOT EXISTS idx_icd10_is_common ON public.icd10_diseases (is_common);

-- 5. Seed Initial Common Clinic Diseases (Lao, Thai, English)
INSERT INTO public.icd10_diseases (code, name_la, name_th, name_en, category, is_common, sort_order) VALUES
-- ระบบทางเดินหายใจ (Respiratory)
('J00', 'ໄຂ້ຫວັດທຳມະດາ', 'ไข้หวัดเฉียบพลัน', 'Acute nasopharyngitis [common cold]', 'ລະບົບຫາຍໃຈ', TRUE, 1),
('J02.9', 'ຄໍອັກເສບ', 'คอหอยอักเสบเฉียบพลัน', 'Acute pharyngitis, unspecified', 'ລະບົບຫາຍໃຈ', TRUE, 2),
('J03.9', 'ຕ່ອມທອນຊິນອັກເສບ', 'ต่อมทอนซิลอักเสบเฉียบพลัน', 'Acute tonsillitis, unspecified', 'ລະບົບຫายໃຈ', TRUE, 3),
('J06.9', 'ຕິດເຊື້ອທາງເດີນຫາຍໃຈສ່ວນເທິງ', 'ติดเชื้อทางเดินหายใจส่วนบนเฉียบพลัน', 'Acute upper respiratory infection', 'ລະບົບຫายໃຈ', TRUE, 4),
('J20.9', 'ຫຼອດລົມອັກເສບ', 'หลอดลมอักเสบเฉียบพลัน', 'Acute bronchitis, unspecified', 'ລະບົບຫายใจ', TRUE, 5),
('J18.9', 'ປອດອັກເສບ', 'ปอดอักเสบ / ปอดบวม', 'Pneumonia, unspecified', 'ລະບົບຫายใจ', FALSE, 6),
('J45.9', 'ພະຍາດຫືດ', 'โรคหอบหืด', 'Asthma, unspecified', 'ລະບົບຫายใจ', TRUE, 7),
('J30.4', 'ພູມແພ້ອາກາດ', 'โรคจมูกอักเสบจากภูมิแพ้', 'Allergic rhinitis, unspecified', 'ລະບົບຫายใจ', TRUE, 8),

-- ระบบหัวใจและหลอดเลือด (Cardiovascular)
('I10', 'ຄວາມດັນເລືອດສູງ', 'โรคความดันโลหิตสูง', 'Essential (primary) hypertension', 'ລະບົບຫົວໃຈ ແລະ ຫຼອດເລືອດ', TRUE, 10),
('I25.9', 'ພະຍາດຫຼອດເລືອດຫົວໃຈ', 'โรคหลอดเลือดหัวใจโคโรนารี', 'Chronic ischaemic heart disease', 'ລະບົບຫົວໃຈ ແລະ ຫຼອດເລືອດ', FALSE, 11),
('I64', 'ພະຍາດຫຼອດເລືອດສະໝອງ / ອຳມະພຶກ', 'โรคหลอดเลือดสมอง / อัมพฤกษ์', 'Stroke, not specified as haemorrhage or infarction', 'ລະບົບຫົວໃຈ ແລະ ຫຼອດເລືອດ', FALSE, 12),

-- ระบบต่อมไร้ท่อและเมตาบอลิซึม (Endocrine & Metabolic)
('E11.9', 'ເບົາຫວານ (ຊະນິດທີ 2)', 'โรคเบาหวานชนิดที่ 2', 'Type 2 diabetes mellitus without complications', 'ລະບົບຕ່ອມໄຮ້ທໍ່ ແລະ ເມຕາບອລິຊຶມ', TRUE, 20),
('E78.5', 'ໄຂມັນໃນເລືອດສູງ', 'ภาวะไขมันในเลือดสูง', 'Hyperlipidaemia, unspecified', 'ລະບົບຕ່ອມໄຮ້ທໍ່ ແລະ ເມຕາບອລິຊຶມ', TRUE, 21),
('E03.9', 'ຕ່ອມໄທຣອຍດ໌ເຮັດວຽກຕ່ຳ', 'ภาวะพร่องฮอร์โมนไทรอยด์', 'Hypothyroidism, unspecified', 'ລະບົບຕ່ອມໄຮ້ທໍ່ ແລະ ເມຕາບອລິຊຶມ', FALSE, 22),
('E05.9', 'ຕ່ອມໄທຣອຍດ໌ເປັນພິດ', 'ภาวะต่อมไทรอยด์เป็นพิษ', 'Thyrotoxicosis, unspecified', 'ລະບົບຕ່ອມໄຮ້ທໍ່ ແລະ ເມຕາບອລິຊຶມ', FALSE, 23),
('E79.0', 'ກົດຢູຣິກໃນເລືອດສູງ', 'ภาวะกรดยูริกในเลือดสูง', 'Hyperuricaemia without signs of inflammatory arthritis', 'ລະບົບຕ່ອມໄຮ້ທໍ່ ແລະ ເມຕາບອລິຊຶມ', TRUE, 24),

-- ระบบทางเดินอาหาร (Gastrointestinal)
('K21.9', 'ພະຍາດກົດໄຫຼຍ້ອນ', 'โรคกรดไหลย้อน (GERD)', 'Gastro-oesophageal reflux disease', 'ລະບົບທາງເດີນອາຫານ', TRUE, 30),
('K29.7', 'ກະເພາະອາຫານອັກເສບ', 'โรคกระเพาะอาหารอักเสบ', 'Gastritis, unspecified', 'ລະບົບທາງເດີนอาหาร', TRUE, 31),
('K30', 'ແໜ້ນທ້ອງ / ອືດທ້ອງ / ອາຫານບໍ່ຍ່ອຍ', 'อาหารไม่ย่อย / ท้องอืด', 'Dyspepsia', 'ລະບົບທາງເດີນອາຫານ', TRUE, 32),
('A09', 'ຖອກທ້ອງຕິດເຊື້ອ', 'อุจจาระร่วงเฉียบพลันจากการติดเชื้อ', 'Infectious gastroenteritis and colitis', 'ລະບົບທາງເດີນອາຫານ', TRUE, 33),
('K52.9', 'ລຳໄສ້ອັກເສບທຳມະດາ', 'ลำไส้อักเสบไม่ระบุสาเหตุ', 'Non-infective gastroenteritis and colitis', 'ລະບົບທາງເດີນອາຫານ', FALSE, 34),
('K76.0', 'ໄຂມັນພອກຕັບ', 'ภาวะไขมันคั่งสะสมในตับ', 'Fatty (change of) liver', 'ລະບົບທາງເດີນອາຫານ', TRUE, 35),

-- ระบบกล้ามเนื้อ กระดูก และข้อ (Musculoskeletal)
('M79.1', 'ປວດກ້າມຊີ້ນ / ກ້າມຊີ້ນອັກເສບ', 'กล้ามเนื้ออักเสบ / ปวดกล้ามเนื้อ', 'Myalgia', 'ກ້າມຊີ້ນ ແລະ ຂໍ້ຕໍ່', TRUE, 40),
('M54.5', 'ປວດແອວ / ປວດຫຼັງສ່ວນລຸ່ມ', 'ปวดหลังส่วนล่าง', 'Low back pain', 'ກ້າມຊີ້ນ ແລະ ຂໍ້ຕໍ່', TRUE, 41),
('M25.5', 'ປວດຂໍ້ຕໍ່', 'อาการปวดข้อ', 'Pain in joint', 'ກ້າມຊີ້ນ ແລະ ຂໍ້ຕໍ່', TRUE, 42),
('M10.9', 'ພະຍາດເກົາຕ໌', 'โรคเกาต์', 'Gout, unspecified', 'ກ້າມຊີ້ນ ແລະ ຂໍ້ຕໍ່', TRUE, 43),
('M17.9', 'ຂໍ້ເຂົ່າເສື່ອມ', 'โรคข้อเข่าเสื่อม', 'Gonarthrosis [arthrosis of knee], unspecified', 'ກ້າມຊີ້ນ ແລະ ຂໍ້ຕໍ່', FALSE, 44),

-- ระบบประสาทและอาการทั่วไป (Neurology & General Symptoms)
('G44.2', 'ປວດຫົວຈາກຄວາມຕຶງຄຽດ', 'ปวดศีรษะจากความเครียด', 'Tension-type headache', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', TRUE, 50),
('G43.9', 'ໄມເກຣນ', 'โรคปวดศีรษะไมเกรน', 'Migraine, unspecified', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', TRUE, 51),
('R51', 'ອາການປວດຫົວ', 'อาการปวดศีรษะ', 'Headache', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', FALSE, 52),
('R50.9', 'ມີໄຂ້ ບໍ່ຮູ້ສາເຫດ', 'ไข้ไม่ระบุสาเหตุ', 'Fever, unspecified', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', TRUE, 53),
('R42', 'ວິນວຽນຫົວ / ໜ້າມືດ', 'วิงเวียนศีรษะ / บ้านหมุน', 'Dizziness and giddiness', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', TRUE, 54),
('B34.9', 'ຕິດເຊື້ອໄວຣັສທົ່ວໄປ', 'การติดเชื้อไวรัสไม่ระบุชนิด', 'Viral infection, unspecified', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', FALSE, 55),
('D64.9', 'ພາວະເລືອດຈາງ / ໂລຫິດຈາງ', 'ภาวะโลหิตจาง', 'Anaemia, unspecified', 'ລະບົບປະສາດ ແລະ ອາການທົ່ວໄປ', TRUE, 56),

-- ระบบผิวหนัง (Dermatology)
('L30.9', 'ຜິວໜັງອັກເສບ / ຜື່ນແພ້', 'ผิวหนังอักเสบ / ผื่นแพ้', 'Dermatitis, unspecified', 'ລະບົບຜິວໜັງ', TRUE, 60),
('L50.9', 'ລົມພິດ', 'ลมพิษ', 'Urticaria, unspecified', 'ລະບົບຜິວໜັງ', TRUE, 61),

-- ระบบทางเดินปัสสาวะ (Genitourinary)
('N39.0', 'ຕິດເຊື້ອທາງເດີນຍ່ຽວ (ກະເພາະຍ່ຽວອັກເສບ)', 'การติดเชื้อทางเดินปัสสาวะ', 'Urinary tract infection, site not specified', 'ລະບົບທາງເດີນຍ່ຽວ', TRUE, 70),
('N20.9', 'ນິ້ວໃນທາງເດີນຍ່ຽວ', 'นิ่วในทางเดินปัสสาวะ', 'Urinary calculus, unspecified', 'ລະບົບທາງເດີນຍ່ຽວ', FALSE, 71),

-- ตาและหู (Eye & ENT)
('H10.9', 'ຕາແດງ / ເຍື່ອບຸຕາອັກເສບ', 'ตาแดง / เยื่อบุตาอักเสบ', 'Conjunctivitis, unspecified', 'ຕາ ແລະ ຫູ', TRUE, 80),
('H66.9', 'ຫູຊັ້ນກາງອັກເສບ', 'หูชั้นกลางอักเสบ', 'Otitis media, unspecified', 'ຕາ ແລະ ຫູ', FALSE, 81),

-- สุขภาพทั่วไป (General Checkup)
('Z00.0', 'ກວດສຸຂະພາບທົ່ວໄປ', 'ตรวจสุขภาพทั่วไป', 'General medical examination', 'ກວດສຸຂະພາບທົ່ວໄປ', TRUE, 90)
ON CONFLICT (code) DO UPDATE SET
  name_la = EXCLUDED.name_la,
  name_th = EXCLUDED.name_th,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  is_common = EXCLUDED.is_common,
  sort_order = EXCLUDED.sort_order;
