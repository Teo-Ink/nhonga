-- Nhonga local test seed. Truncates catalogue tables then inserts a small,
-- realistic Mozambican-market catalogue. Product images use picsum.photos so
-- the storefront renders real pictures in the local test env.
BEGIN;

TRUNCATE product_image, product_variant, product, category, vendor, district RESTART IDENTITY CASCADE;

-- Provinces (districts reference these)
INSERT INTO province (code, name) VALUES
  ('MPM', 'Maputo Cidade'),
  ('MPT', 'Maputo Provincia');

-- Districts
INSERT INTO district (id, province_code, name) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'MPM', 'Maputo Cidade'),
  ('d0000000-0000-4000-8000-000000000002', 'MPT', 'Matola');

-- Vendors (status 'active' shows as verified in the storefront)
INSERT INTO vendor (id, slug, legal_name, display_name, vendor_type, district_id, status, rating_avg, rating_count) VALUES
  ('11111111-0000-4000-8000-000000000001', 'lojas-xitique', 'Xitique Comercial Lda', 'Lojas Xitique', 'company', 'd0000000-0000-4000-8000-000000000001', 'active', 4.6, 128),
  ('11111111-0000-4000-8000-000000000002', 'mama-rosa', 'Rosa Mabjaia', 'Mama Rosa', 'individual', 'd0000000-0000-4000-8000-000000000002', 'active', 4.9, 54);

-- Root categories (level 1, parent null)
INSERT INTO category (id, slug, name_pt, name_en, level, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'moda', 'Moda', 'Fashion', 1, 1),
  ('c0000000-0000-4000-8000-000000000002', 'electronica', 'Electronica', 'Electronics', 1, 2),
  ('c0000000-0000-4000-8000-000000000003', 'casa', 'Casa e Cozinha', 'Home & Kitchen', 1, 3),
  ('c0000000-0000-4000-8000-000000000004', 'alimentacao', 'Alimentacao', 'Food', 1, 4);

-- Products (status 'active' = published/live)
INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'capulana-tradicional', 'Capulana tradicional mocambicana', 'Traditional Mozambican Capulana',
   'Capulana 100% algodao, estampada a mao. Ideal para vestir, decorar ou oferecer. Medidas: 2m x 1,15m.',
   '{"Material":"Algodao","Origem":"Mocambique"}', 'active', 300, 4.8, 41, now()),
  ('a0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'smartphone-android-x8', 'Smartphone Android 6.5" - 64GB', 'Android Smartphone 64GB',
   'Ecra de 6,5 polegadas, bateria de 5000mAh que dura o dia todo. Dual SIM, ideal para M-Pesa e e-Mola.',
   '{"Ecra":"6.5 pol","Bateria":"5000mAh"}', 'active', 190, 4.3, 77, now()),
  ('a0000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   'carregador-solar', 'Carregador solar portatil 20W', 'Portable Solar Charger 20W',
   'Carregue o telemovel mesmo sem energia da rede. Dois portos USB, resistente a agua.',
   '{"Potencia":"20W"}', 'active', 450, 4.5, 33, now()),
  ('a0000000-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003',
   'panela-barro', 'Panela de barro tradicional 5L', 'Traditional Clay Pot 5L',
   'Panela de barro feita a mao. Da o sabor autentico ao caril e a matapa.',
   '{"Capacidade":"5 litros"}', 'active', 1800, 4.7, 22, now()),
  ('a0000000-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'camisola-selecao', 'Camisola da Seleccao de Mocambique', 'Mozambique National Team Jersey',
   'Camisola oficial dos Mambas. Tecido respiravel, corte moderno.',
   '{"Epoca":"2026"}', 'active', 220, 4.9, 96, now()),
  ('a0000000-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004',
   'cafe-gorongosa', 'Cafe de Gorongosa 500g', 'Gorongosa Coffee 500g',
   'Cafe de altitude cultivado na Serra da Gorongosa. Apoia a conservacao do parque.',
   '{"Peso":"500g","Torra":"Media"}', 'active', 520, 5.0, 18, now());

-- Variants
INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'CAP-AZUL', '{"Cor":"Azul"}', 45000, 60000, 12, true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'CAP-VERM', '{"Cor":"Vermelho"}', 45000, 60000, 0, true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'CAP-VERD', '{"Cor":"Verde"}', 45000, 60000, 7, true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'PHONE-64', '{"Armazenamento":"64GB"}', 895000, NULL, 15, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'PHONE-128', '{"Armazenamento":"128GB"}', 1095000, NULL, 4, true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 'SOLAR-20', '{}', 120000, 150000, 30, true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', 'PANELA-5L', '{}', 85000, NULL, 9, true),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000005', 'JERSEY-S', '{"Tamanho":"S"}', 130000, NULL, 5, true),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005', 'JERSEY-M', '{"Tamanho":"M"}', 130000, NULL, 0, true),
  ('b0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000005', 'JERSEY-L', '{"Tamanho":"L"}', 130000, NULL, 8, true),
  ('b0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000006', 'CAFE-500', '{}', 38000, 45000, 40, true);

-- Images (picsum seeds render real pictures)
INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'https://picsum.photos/seed/capulana/600/600', 600, 600, 'Capulana tradicional', 0),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'https://picsum.photos/seed/capulana2/600/600', 600, 600, 'Capulana detalhe', 1),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'https://picsum.photos/seed/phonemz/600/600', 600, 600, 'Smartphone', 0),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'https://picsum.photos/seed/solar/600/600', 600, 600, 'Carregador solar', 0),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004', 'https://picsum.photos/seed/panela/600/600', 600, 600, 'Panela de barro', 0),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005', 'https://picsum.photos/seed/jersey/600/600', 600, 600, 'Camisola da seleccao', 0),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000006', 'https://picsum.photos/seed/cafemz/600/600', 600, 600, 'Cafe de Gorongosa', 0);

COMMIT;

SELECT
  (SELECT count(*) FROM product) AS products,
  (SELECT count(*) FROM product_variant) AS variants,
  (SELECT count(*) FROM product_image) AS images;
