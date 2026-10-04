-- Nhonga local test seed. Truncates catalogue tables then inserts a small but
-- fuller Mozambican-market catalogue across all six categories. Product images
-- are real, subject-matched CC-licensed photos (Flickr, via the Openverse API)
-- used as representative demo images — see docs/image-credits.md for licensing.
-- The /ph route still exists as a branded fallback placeholder generator.
BEGIN;

TRUNCATE product_image, product_variant, product, category, category_attribute, promotion_plan, product_promotion, review, app_user, vendor, district, ad_campaign, listing_report RESTART IDENTITY CASCADE;

-- Provinces — all 11 (names match the storefront checkout province list so a
-- guest order resolves to a real province/district for the address FK).
INSERT INTO province (code, name) VALUES
  ('MPM', 'Maputo Cidade'),
  ('MPT', 'Maputo Província'),
  ('GAZ', 'Gaza'),
  ('INH', 'Inhambane'),
  ('SOF', 'Sofala'),
  ('MAN', 'Manica'),
  ('TET', 'Tete'),
  ('ZAM', 'Zambézia'),
  ('NAM', 'Nampula'),
  ('CDL', 'Cabo Delgado'),
  ('NIA', 'Niassa')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Districts — one active district per province (the capital).
INSERT INTO district (id, province_code, name) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'MPM', 'Maputo Cidade'),
  ('d0000000-0000-4000-8000-000000000002', 'MPT', 'Matola'),
  ('d0000000-0000-4000-8000-000000000003', 'GAZ', 'Xai-Xai'),
  ('d0000000-0000-4000-8000-000000000004', 'INH', 'Inhambane'),
  ('d0000000-0000-4000-8000-000000000005', 'SOF', 'Beira'),
  ('d0000000-0000-4000-8000-000000000006', 'MAN', 'Chimoio'),
  ('d0000000-0000-4000-8000-000000000007', 'TET', 'Tete'),
  ('d0000000-0000-4000-8000-000000000008', 'ZAM', 'Quelimane'),
  ('d0000000-0000-4000-8000-000000000009', 'NAM', 'Nampula'),
  ('d0000000-0000-4000-8000-00000000000a', 'CDL', 'Pemba'),
  ('d0000000-0000-4000-8000-00000000000b', 'NIA', 'Lichinga');

-- Vendors (status 'active' shows as verified in the storefront)
INSERT INTO vendor (id, slug, legal_name, display_name, vendor_type, district_id, status, rating_avg, rating_count) VALUES
  ('11111111-0000-4000-8000-000000000001', 'lojas-xitique', 'Xitique Comercial Lda', 'Lojas Xitique', 'company', 'd0000000-0000-4000-8000-000000000001', 'active', 4.6, 128),
  ('11111111-0000-4000-8000-000000000002', 'mama-rosa', 'Rosa Mabjaia', 'Mama Rosa', 'individual', 'd0000000-0000-4000-8000-000000000002', 'active', 4.9, 54),
  ('11111111-0000-4000-8000-000000000003', 'artes-da-beira', 'Artes da Beira', 'Artes da Beira', 'individual', 'd0000000-0000-4000-8000-000000000005', 'active', 4.7, 39);

-- Classifieds contact numbers (demo). E.164 Mozambique (+258).
UPDATE vendor SET whatsapp = '258841234567', contact_phone = '258841234567' WHERE slug = 'lojas-xitique';
UPDATE vendor SET whatsapp = '258821112233', contact_phone = '258821112233' WHERE slug = 'mama-rosa';
UPDATE vendor SET whatsapp = '258843334455', contact_phone = '258843334455', show_phone = false WHERE slug = 'artes-da-beira';

-- Root categories (all six)
INSERT INTO category (id, slug, name_pt, name_en, level, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'moda', 'Moda', 'Fashion', 1, 1),
  ('c0000000-0000-4000-8000-000000000002', 'electronica', 'Eletrónica', 'Electronics', 1, 2),
  ('c0000000-0000-4000-8000-000000000005', 'telemoveis', 'Telemóveis', 'Phones', 1, 3),
  ('c0000000-0000-4000-8000-000000000003', 'casa', 'Casa e Cozinha', 'Home & Kitchen', 1, 4),
  ('c0000000-0000-4000-8000-000000000004', 'alimentacao', 'Alimentação', 'Food', 1, 5),
  ('c0000000-0000-4000-8000-000000000006', 'beleza', 'Beleza e Saúde', 'Beauty & Health', 1, 6);

-- Products
INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  -- Moda (c001)
  ('a0000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'capulana-tradicional', 'Capulana tradicional moçambicana', 'Traditional Mozambican Capulana', 'Capulana 100% algodão, estampada à mão. Ideal para vestir, decorar ou oferecer. Medidas: 2m x 1,15m.', '{"Material":"Algodão","Origem":"Moçambique"}', 'active', 300, 4.8, 41, now()),
  ('a0000000-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'camisola-selecao', 'Camisola da Selecção de Moçambique', 'Mozambique National Team Jersey', 'Camisola oficial dos Mambas. Tecido respirável, corte moderno.', '{"Época":"2026"}', 'active', 220, 4.9, 96, now()),
  ('a0000000-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'sandalias-couro', 'Sandálias de couro artesanais', 'Handmade Leather Sandals', 'Sandálias feitas à mão em couro genuíno por artesãos da Beira. Confortáveis e duráveis.', '{"Material":"Couro"}', 'active', 400, 4.6, 27, now()),
  ('a0000000-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'vestido-capulana', 'Vestido em capulana', 'Capulana Dress', 'Vestido moderno confeccionado em capulana autêntica. Peça única.', '{"Material":"Algodão"}', 'active', 350, 4.7, 18, now()),
  -- Eletrónica (c002)
  ('a0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'smartphone-android-x8', 'Smartphone Android 6.5" - 64GB', 'Android Smartphone 64GB', 'Ecrã de 6,5 polegadas, bateria de 5000mAh que dura o dia todo. Dual SIM, ideal para M-Pesa e e-Mola.', '{"Ecrã":"6.5 pol","Bateria":"5000mAh"}', 'active', 190, 4.3, 77, now()),
  ('a0000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'carregador-solar', 'Carregador solar portátil 20W', 'Portable Solar Charger 20W', 'Carregue o telemóvel mesmo sem energia da rede. Dois portos USB, resistente à água.', '{"Potência":"20W"}', 'active', 450, 4.5, 33, now()),
  ('a0000000-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'coluna-bluetooth', 'Coluna Bluetooth à prova de água', 'Waterproof Bluetooth Speaker', 'Som potente e 12h de bateria. Resistente à água e ao pó, ideal para a praia.', '{"Bateria":"12h","Resistência":"IPX7"}', 'active', 600, 4.4, 52, now()),
  ('a0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'power-bank-20000', 'Power bank 20000mAh', 'Power Bank 20000mAh', 'Carrega o telemóvel várias vezes. Dois portos de saída e carregamento rápido.', '{"Capacidade":"20000mAh"}', 'active', 380, 4.6, 61, now()),
  -- Telemóveis (c005)
  ('a0000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'telemovel-basico', 'Telemóvel básico dual SIM', 'Basic Dual-SIM Phone', 'Bateria que dura dias, rádio FM e lanterna. Perfeito como segundo telemóvel.', '{"SIM":"Dual"}', 'active', 120, 4.2, 44, now()),
  ('a0000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000005', 'capa-telemovel', 'Capa de telemóvel resistente', 'Rugged Phone Case', 'Protege o telemóvel de quedas e riscos. Vários modelos disponíveis.', '{"Material":"Silicone"}', 'active', 60, 4.5, 30, now()),
  ('a0000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'carregador-rapido', 'Carregador rápido USB-C 25W', 'Fast Charger USB-C 25W', 'Carregamento rápido e seguro para o seu telemóvel. Cabo incluído.', '{"Potência":"25W"}', 'active', 90, 4.6, 22, now()),
  -- Casa e Cozinha (c003)
  ('a0000000-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'panela-barro', 'Panela de barro tradicional 5L', 'Traditional Clay Pot 5L', 'Panela de barro feita à mão. Dá o sabor autêntico ao caril e à matapa.', '{"Capacidade":"5 litros"}', 'active', 1800, 4.7, 22, now()),
  ('a0000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'jogo-panelas', 'Jogo de 5 panelas antiaderentes', '5-Piece Non-stick Pot Set', 'Conjunto completo para a cozinha. Antiaderente e fácil de limpar.', '{"Peças":"5"}', 'active', 3200, 4.5, 48, now()),
  ('a0000000-0000-4000-8000-00000000000f', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'candeeiro-solar', 'Candeeiro solar recarregável', 'Rechargeable Solar Lamp', 'Luz para toda a casa sem contas de electricidade. Carrega ao sol.', '{"Autonomia":"8h"}', 'active', 500, 4.6, 71, now()),
  ('a0000000-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'esteira-palha', 'Esteira de palha tradicional', 'Traditional Straw Mat', 'Esteira tecida à mão, ideal para descansar ou decorar.', '{"Material":"Palha"}', 'active', 900, 4.8, 15, now()),
  -- Alimentação (c004)
  ('a0000000-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'cafe-gorongosa', 'Café de Gorongosa 500g', 'Gorongosa Coffee 500g', 'Café de altitude cultivado na Serra da Gorongosa. Apoia a conservação do parque.', '{"Peso":"500g","Torra":"Média"}', 'active', 520, 5.0, 18, now()),
  ('a0000000-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'castanha-caju', 'Castanha de caju torrada 250g', 'Roasted Cashew Nuts 250g', 'Castanha de caju de Nampula, torrada e ligeiramente salgada.', '{"Peso":"250g"}', 'active', 260, 4.9, 34, now()),
  ('a0000000-0000-4000-8000-000000000012', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004', 'piri-piri', 'Molho de piri-piri caseiro', 'Homemade Piri-Piri Sauce', 'Molho picante caseiro, feito com piri-piri moçambicano. Dá vida a qualquer prato.', '{"Volume":"200ml"}', 'active', 300, 4.7, 26, now()),
  ('a0000000-0000-4000-8000-000000000013', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'mel-natural', 'Mel natural de Manica 500g', 'Natural Manica Honey 500g', 'Mel puro colhido nas montanhas de Manica. Sem aditivos.', '{"Peso":"500g"}', 'active', 620, 4.8, 29, now()),
  -- Beleza (c006)
  ('a0000000-0000-4000-8000-000000000014', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'oleo-coco', 'Óleo de coco natural 250ml', 'Natural Coconut Oil 250ml', 'Óleo de coco prensado a frio, para pele e cabelo. 100% natural.', '{"Volume":"250ml"}', 'active', 280, 4.7, 40, now()),
  ('a0000000-0000-4000-8000-000000000015', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'sabonete-artesanal', 'Sabonete artesanal de karité', 'Handmade Shea Butter Soap', 'Sabonete natural feito à mão com manteiga de karité. Suave para a pele.', '{"Peso":"100g"}', 'active', 120, 4.6, 21, now()),
  ('a0000000-0000-4000-8000-000000000016', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000006', 'manteiga-karite', 'Manteiga de karité pura 200g', 'Pure Shea Butter 200g', 'Manteiga de karité pura, hidratante para pele seca. Multiuso.', '{"Peso":"200g"}', 'active', 220, 4.9, 33, now());

-- Variants
INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'CAP-AZUL', '{"Cor":"Azul"}', 45000, 60000, 12, true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'CAP-VERM', '{"Cor":"Vermelho"}', 45000, 60000, 0, true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'CAP-VERD', '{"Cor":"Verde"}', 45000, 60000, 7, true),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000005', 'JERSEY-S', '{"Tamanho":"S"}', 130000, NULL, 5, true),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005', 'JERSEY-M', '{"Tamanho":"M"}', 130000, NULL, 0, true),
  ('b0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000005', 'JERSEY-L', '{"Tamanho":"L"}', 130000, NULL, 8, true),
  ('b0000000-0000-4000-8000-000000000071', 'a0000000-0000-4000-8000-000000000007', 'SAND-39', '{"Tamanho":"39"}', 75000, 95000, 6, true),
  ('b0000000-0000-4000-8000-000000000072', 'a0000000-0000-4000-8000-000000000007', 'SAND-41', '{"Tamanho":"41"}', 75000, 95000, 9, true),
  ('b0000000-0000-4000-8000-000000000081', 'a0000000-0000-4000-8000-000000000008', 'VEST-M', '{"Tamanho":"M"}', 120000, NULL, 4, true),
  ('b0000000-0000-4000-8000-000000000082', 'a0000000-0000-4000-8000-000000000008', 'VEST-L', '{"Tamanho":"L"}', 120000, NULL, 3, true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'PHONE-64', '{"Armazenamento":"64GB"}', 895000, NULL, 15, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000002', 'PHONE-128', '{"Armazenamento":"128GB"}', 1095000, NULL, 4, true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 'SOLAR-20', '{}', 120000, 150000, 30, true),
  ('b0000000-0000-4000-8000-000000000091', 'a0000000-0000-4000-8000-000000000009', 'SPKR-BT', '{}', 210000, 260000, 18, true),
  ('b0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000000a', 'PB-20K', '{}', 95000, 120000, 25, true),
  ('b0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-00000000000b', 'PHN-BASIC', '{}', 85000, NULL, 40, true),
  ('b0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-00000000000c', 'CASE-PRETO', '{"Cor":"Preto"}', 25000, 35000, 50, true),
  ('b0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-00000000000c', 'CASE-AZUL', '{"Cor":"Azul"}', 25000, 35000, 33, true),
  ('b0000000-0000-4000-8000-0000000000d1', 'a0000000-0000-4000-8000-00000000000d', 'CHG-25W', '{}', 45000, NULL, 60, true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', 'PANELA-5L', '{}', 85000, NULL, 9, true),
  ('b0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-00000000000e', 'POTSET-5', '{}', 340000, 420000, 12, true),
  ('b0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-00000000000f', 'LAMP-SOL', '{}', 65000, 85000, 44, true),
  ('b0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000010', 'ESTEIRA', '{}', 40000, NULL, 20, true),
  ('b0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000006', 'CAFE-500', '{}', 38000, 45000, 40, true),
  ('b0000000-0000-4000-8000-000000000111', 'a0000000-0000-4000-8000-000000000011', 'CAJU-250', '{}', 32000, NULL, 35, true),
  ('b0000000-0000-4000-8000-000000000121', 'a0000000-0000-4000-8000-000000000012', 'PIRI-200', '{}', 18000, NULL, 55, true),
  ('b0000000-0000-4000-8000-000000000131', 'a0000000-0000-4000-8000-000000000013', 'MEL-500', '{}', 42000, 50000, 28, true),
  ('b0000000-0000-4000-8000-000000000141', 'a0000000-0000-4000-8000-000000000014', 'OLEO-250', '{}', 35000, NULL, 47, true),
  ('b0000000-0000-4000-8000-000000000151', 'a0000000-0000-4000-8000-000000000015', 'SAB-KAR', '{}', 15000, 20000, 70, true),
  ('b0000000-0000-4000-8000-000000000161', 'a0000000-0000-4000-8000-000000000016', 'KAR-200', '{}', 48000, NULL, 31, true);

-- Images (branded /ph placeholders: gradient tile + monogram, per category)
INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'https://live.staticflickr.com/2680/4277873044_9680cb5df3_b.jpg', 600, 600, 'Capulana tradicional', 0),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'https://live.staticflickr.com/3004/3037107861_bac7121f7c_m.jpg', 600, 600, 'Camisola da selecção', 0),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', 'https://live.staticflickr.com/158/389493829_8c239833f0.jpg', 600, 600, 'Sandálias de couro', 0),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', 'https://live.staticflickr.com/5553/14676634562_532dcd5f17_b.jpg', 600, 600, 'Vestido em capulana', 0),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'https://live.staticflickr.com/671/21135682726_f8f6da6372_b.jpg', 600, 600, 'Smartphone', 0),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'https://live.staticflickr.com/3868/14676487111_86e3d70288_b.jpg', 600, 600, 'Carregador solar', 0),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', 'https://live.staticflickr.com/4010/4526603240_3e8ef506d5_b.jpg', 600, 600, 'Coluna Bluetooth', 0),
  ('e0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000a', 'https://live.staticflickr.com/7554/15266648003_847cc1565a.jpg', 600, 600, 'Power bank', 0),
  ('e0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000b', 'https://live.staticflickr.com/65535/52783153788_f3b4a2c228_b.jpg', 600, 600, 'Telemóvel básico', 0),
  ('e0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-00000000000c', 'https://live.staticflickr.com/8031/7937955100_20426c348c_b.jpg', 600, 600, 'Capa de telemóvel', 0),
  ('e0000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-00000000000d', 'https://live.staticflickr.com/3897/14568522934_4012aae180_b.jpg', 600, 600, 'Carregador rápido', 0),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'https://live.staticflickr.com/51/143090034_275b9def6e_b.jpg', 600, 600, 'Panela de barro', 0),
  ('e0000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000e', 'https://live.staticflickr.com/4106/5023481258_8baff1be2b_b.jpg', 600, 600, 'Jogo de panelas', 0),
  ('e0000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-00000000000f', 'https://live.staticflickr.com/3481/3243961726_704b9163e9_b.jpg', 600, 600, 'Candeeiro solar', 0),
  ('e0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', 'https://live.staticflickr.com/8120/29616096525_4977eca05b_b.jpg', 600, 600, 'Esteira de palha', 0),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'https://live.staticflickr.com/6083/6149598235_7ff5ee3354_b.jpg', 600, 600, 'Café de Gorongosa', 0),
  ('e0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000011', 'https://live.staticflickr.com/2432/3602288203_f9b43b1e55_b.jpg', 600, 600, 'Castanha de caju', 0),
  ('e0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000012', 'https://live.staticflickr.com/8019/7698343400_966335843b_b.jpg', 600, 600, 'Molho de piri-piri', 0),
  ('e0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000013', 'https://live.staticflickr.com/130/411317929_1a62e5343d_b.jpg', 600, 600, 'Mel natural', 0),
  ('e0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000014', 'https://live.staticflickr.com/2756/4404443713_af1af58731_b.jpg', 600, 600, 'Óleo de coco', 0),
  ('e0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000015', 'https://live.staticflickr.com/8018/7468313382_01dca95e64_m.jpg', 600, 600, 'Sabonete artesanal', 0),
  ('e0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000016', 'https://live.staticflickr.com/2564/3760127384_9eee5a4e89_b.jpg', 600, 600, 'Manteiga de karité', 0);

-- Stagger publish dates so the "recent ads" feed shows a realistic spread.
UPDATE product SET published_at = now() - (floor(random() * 20) || ' days')::interval;

-- Paid visibility plans (admin-set pricing). Prices in cents (MT).
INSERT INTO promotion_plan (code, name_pt, name_en, kind, price_cents, duration_days, sort_order) VALUES
  ('destaque', 'Destaque', 'Featured', 'feature', 15000, 7, 1),
  ('turbo', 'Turbo', 'Turbo', 'feature', 35000, 14, 2),
  ('subir', 'Subir para o topo', 'Bump to top', 'bump', 5000, 0, 3);

-- Demo: two listings currently featured, so ranking is visibly different.
UPDATE product SET featured_until = now() + interval '7 days', bumped_at = now()
  WHERE slug IN ('smartphone-android-x8', 'capulana-tradicional');

-- ── Classifieds verticals: Viaturas, Imóveis, Serviços (G) ─────────────
INSERT INTO category (id, slug, name_pt, name_en, level, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000007', 'viaturas', 'Viaturas', 'Vehicles', 1, 7),
  ('c0000000-0000-4000-8000-000000000008', 'imoveis', 'Imóveis', 'Real estate', 1, 8),
  ('c0000000-0000-4000-8000-000000000009', 'servicos', 'Serviços', 'Services', 1, 9);

-- Typed, per-category attributes that drive the filters and the detail fields.
INSERT INTO category_attribute (id, category_id, key, label_pt, label_en, data_type, options, is_variant_axis, is_filterable, is_required, sort_order) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'marca', 'Marca', 'Make', 'enum', '["Toyota","Honda","Nissan","Mercedes","Hyundai","Mitsubishi","Outra"]', false, true, true, 1),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000007', 'modelo', 'Modelo', 'Model', 'text', NULL, false, true, false, 2),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000007', 'ano', 'Ano', 'Year', 'number', NULL, false, true, true, 3),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000007', 'km', 'Quilometragem', 'Mileage', 'number', NULL, false, true, false, 4),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000007', 'combustivel', 'Combustível', 'Fuel', 'enum', '["Gasolina","Diesel","Elétrico","Híbrido"]', false, true, false, 5),
  ('f0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000007', 'caixa', 'Caixa', 'Gearbox', 'enum', '["Manual","Automática"]', false, true, false, 6),
  ('f0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000008', 'negocio', 'Tipo', 'Type', 'enum', '["Venda","Arrendar"]', false, true, true, 1),
  ('f0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000008', 'quartos', 'Quartos', 'Bedrooms', 'number', NULL, false, true, false, 2),
  ('f0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000008', 'area', 'Área (m²)', 'Area (m²)', 'number', NULL, false, true, false, 3),
  ('f0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000009', 'categoria_servico', 'Tipo de serviço', 'Service type', 'text', NULL, false, true, false, 1),
  ('f0000000-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000009', 'zona', 'Zona', 'Area', 'text', NULL, false, true, false, 2);

-- Sample listings for the new verticals (single-price classifieds ads).
INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  ('a0000000-0000-4000-8000-000000000101', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'toyota-corolla-2016', 'Toyota Corolla 2016', 'Toyota Corolla 2016', 'Corolla 1.6, único dono, livro de revisões completo. Ar condicionado, vidros elétricos.', '{"marca":"Toyota","modelo":"Corolla","ano":"2016","km":"120000","combustivel":"Gasolina","caixa":"Manual"}', 'active', NULL, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000102', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000007', 'honda-fit-2014', 'Honda Fit 2014', 'Honda Fit 2014', 'Fit automático, económico, pronto a andar. Pneus novos.', '{"marca":"Honda","modelo":"Fit","ano":"2014","km":"95000","combustivel":"Gasolina","caixa":"Automática"}', 'active', NULL, NULL, 0, now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000103', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000008', 't3-arrendar-sommerschield', 'T3 para arrendar em Sommerschield', 'T3 for rent in Sommerschield', 'Apartamento T3 mobilado, 2 casas de banho, varanda com vista. Condomínio com segurança.', '{"negocio":"Arrendar","quartos":"3","area":"140"}', 'active', NULL, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000104', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 'terreno-matola', 'Terreno à venda na Matola', 'Land for sale in Matola', 'Terreno murado, com DUAT, ideal para construção. Acesso fácil.', '{"negocio":"Venda","quartos":"0","area":"800"}', 'active', NULL, NULL, 0, now() - interval '8 days'),
  ('a0000000-0000-4000-8000-000000000105', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000009', 'canalizador-24h', 'Canalizador 24h', 'Plumber 24h', 'Serviços de canalização ao domicílio, urgências 24h. Orçamento grátis.', '{"categoria_servico":"Canalização","zona":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000106', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000009', 'aulas-ingles', 'Aulas de inglês', 'English lessons', 'Explicador de inglês, todos os níveis. Ao domicílio ou online.', '{"categoria_servico":"Educação","zona":"Matola"}', 'active', NULL, NULL, 0, now() - interval '6 days');

INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000101', 'VIA-101', '{}', 75000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000102', 'VIA-102', '{}', 62000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000103', 'IMO-103', '{}', 4500000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000104', 'IMO-104', '{}', 120000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000205', 'a0000000-0000-4000-8000-000000000105', 'SER-105', '{}', 50000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000206', 'a0000000-0000-4000-8000-000000000106', 'SER-106', '{}', 80000, NULL, 1, true);

INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000101', '/ph?c=viaturas&t=Toyota%20Corolla', 640, 480, 'Toyota Corolla', 0),
  ('e0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000102', '/ph?c=viaturas&t=Honda%20Fit', 640, 480, 'Honda Fit', 0),
  ('e0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000103', '/ph?c=imoveis&t=T3%20Arrendar', 640, 480, 'Apartamento T3', 0),
  ('e0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000104', '/ph?c=imoveis&t=Terreno', 640, 480, 'Terreno', 0),
  ('e0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000105', '/ph?c=servicos&t=Canalizador', 640, 480, 'Canalizador', 0),
  ('e0000000-0000-4000-8000-000000000106', 'a0000000-0000-4000-8000-000000000106', '/ph?c=servicos&t=Aulas%20Ingles', 640, 480, 'Aulas de inglês', 0);

-- ── Empregos (jobs, integrated vertical) + Eventos (substitutes Pets) ──
INSERT INTO category (id, slug, name_pt, name_en, level, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000010', 'empregos', 'Empregos', 'Jobs', 1, 10),
  ('c0000000-0000-4000-8000-000000000011', 'eventos', 'Eventos', 'Events', 1, 11);

INSERT INTO category_attribute (id, category_id, key, label_pt, label_en, data_type, options, is_variant_axis, is_filterable, is_required, sort_order) VALUES
  ('f0000000-0000-4000-8000-000000000031', 'c0000000-0000-4000-8000-000000000010', 'tipo_contrato', 'Tipo de contrato', 'Contract type', 'enum', '["Tempo inteiro","Meio período","Freelance","Estágio","Temporário"]', false, true, true, 1),
  ('f0000000-0000-4000-8000-000000000032', 'c0000000-0000-4000-8000-000000000010', 'area', 'Área', 'Sector', 'enum', '["Vendas","Administração","TI","Construção","Saúde","Educação","Restauração","Transporte","Outra"]', false, true, true, 2),
  ('f0000000-0000-4000-8000-000000000033', 'c0000000-0000-4000-8000-000000000010', 'local', 'Local', 'Location', 'text', NULL, false, true, false, 3),
  ('f0000000-0000-4000-8000-000000000041', 'c0000000-0000-4000-8000-000000000011', 'tipo', 'Tipo', 'Type', 'enum', '["Concerto","Festa","Conferência","Desporto","Feira","Casamento","Bilhetes","Outro"]', false, true, true, 1),
  ('f0000000-0000-4000-8000-000000000043', 'c0000000-0000-4000-8000-000000000011', 'data', 'Data', 'Date', 'text', NULL, false, true, false, 2),
  ('f0000000-0000-4000-8000-000000000042', 'c0000000-0000-4000-8000-000000000011', 'zona', 'Zona', 'Area', 'text', NULL, false, true, false, 3);

INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  ('a0000000-0000-4000-8000-000000000107', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000010', 'programador-web-maputo', 'Programador Web (Maputo)', 'Web Developer (Maputo)', 'Vaga para programador web júnior/pleno. React e Node.js. Contrato a tempo inteiro. Envie o seu CV pelo contacto.', '{"tipo_contrato":"Tempo inteiro","area":"TI","local":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000108', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000010', 'empregada-domestica-matola', 'Empregada doméstica (Matola)', 'Domestic worker (Matola)', 'Procura-se empregada doméstica com experiência e referências. Meio período, bairro da Matola.', '{"tipo_contrato":"Meio período","area":"Outra","local":"Matola"}', 'active', NULL, NULL, 0, now() - interval '4 days'),
  ('a0000000-0000-4000-8000-000000000109', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000011', 'bilhetes-marrabenta', 'Bilhetes — Festival de Marrabenta', 'Tickets — Marrabenta Festival', 'Bilhetes para o Festival de Marrabenta. Entrada geral, lote limitado. Levantamento combinado.', '{"tipo":"Concerto","data":"2026-10-18","zona":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000110', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000011', 'dj-som-eventos', 'DJ e som para eventos', 'DJ and sound for events', 'Serviço de DJ, som e iluminação para festas, casamentos e conferências. Orçamento à medida.', '{"tipo":"Casamento","data":"A combinar","zona":"Matola"}', 'active', NULL, NULL, 0, now() - interval '7 days');

INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000207', 'a0000000-0000-4000-8000-000000000107', 'EMP-107', '{}', 4500000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000208', 'a0000000-0000-4000-8000-000000000108', 'EMP-108', '{}', 800000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000209', 'a0000000-0000-4000-8000-000000000109', 'EVT-109', '{}', 150000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000210', 'a0000000-0000-4000-8000-000000000110', 'EVT-110', '{}', 800000, NULL, 1, true);

INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000107', 'a0000000-0000-4000-8000-000000000107', '/ph?c=empregos&t=Programador', 640, 480, 'Vaga de programador', 0),
  ('e0000000-0000-4000-8000-000000000108', 'a0000000-0000-4000-8000-000000000108', '/ph?c=empregos&t=Domestica', 640, 480, 'Vaga doméstica', 0),
  ('e0000000-0000-4000-8000-000000000109', 'a0000000-0000-4000-8000-000000000109', '/ph?c=eventos&t=Marrabenta', 640, 480, 'Bilhetes de evento', 0),
  ('e0000000-0000-4000-8000-000000000110', 'a0000000-0000-4000-8000-000000000110', '/ph?c=eventos&t=DJ', 640, 480, 'DJ e som', 0);

-- ── Seller reviews (B) — real reviewers + reviews; vendor ratings derived below ──
INSERT INTO app_user (id, phone_e164, phone_verified_at, display_name, status) VALUES
  ('99990000-0000-4000-8000-000000000001', '+258842000001', now(), 'Ana C.', 'active'),
  ('99990000-0000-4000-8000-000000000002', '+258843000002', now(), 'João M.', 'active'),
  ('99990000-0000-4000-8000-000000000003', '+258844000003', now(), 'Rita S.', 'active');

INSERT INTO review (id, vendor_id, product_id, author_user_id, author_name, rating, comment, created_at) VALUES
  ('77770000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '99990000-0000-4000-8000-000000000001', 'Ana C.', 5, 'Vendedor rápido e honesto. O produto estava tal como no anúncio.', now() - interval '3 days'),
  ('77770000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', NULL, '99990000-0000-4000-8000-000000000002', 'João M.', 4, 'Boa comunicação pelo WhatsApp e entrega combinada sem problemas.', now() - interval '8 days'),
  ('77770000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', NULL, '99990000-0000-4000-8000-000000000001', 'Ana C.', 5, 'A Mama Rosa é impecável, capulanas lindas e atendimento simpático.', now() - interval '2 days'),
  ('77770000-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002', NULL, '99990000-0000-4000-8000-000000000003', 'Rita S.', 5, 'Recomendo! Respondeu rápido e o preço foi justo.', now() - interval '12 days'),
  ('77770000-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000003', NULL, '99990000-0000-4000-8000-000000000002', 'João M.', 4, 'Trabalho bem feito e no prazo combinado.', now() - interval '5 days'),
  ('77770000-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000003', NULL, '99990000-0000-4000-8000-000000000003', 'Rita S.', 5, 'Muito profissional, voltarei a contactar.', now() - interval '20 days');

-- Vendor rating now reflects the real review rows above (replaces demo aggregates).
UPDATE vendor v SET
  rating_count = s.cnt,
  rating_avg = s.avg
FROM (
  SELECT vendor_id, count(*)::int AS cnt, round(avg(rating)::numeric, 1) AS avg
  FROM review WHERE status = 'published' GROUP BY vendor_id
) s
WHERE v.id = s.vendor_id;

-- ── Display-ad campaigns (house-ads monetisation) — 2 active demo campaigns ──
INSERT INTO ad_campaign (id, advertiser_name, image_url, click_url, headline, placement, category_slug, starts_at, ends_at, price_cents, status) VALUES
  ('aaaa1111-0000-4000-8000-000000000001', 'Banco Exemplo', '/ph?c=viaturas&t=Banco%20Exemplo&s=Cr%C3%A9dito%20para%20a%20sua%20viatura', 'https://www.example.com', 'Banco Exemplo — crédito para a sua viatura', 'leaderboard', NULL, now() - interval '1 day', now() + interval '30 days', 1500000, 'active'),
  ('aaaa1111-0000-4000-8000-000000000002', 'Escola de Condução Xitique', '/ph?c=telemoveis&t=Escola%20de%20Condu%C3%A7%C3%A3o&s=Tire%20a%20sua%20carta', 'https://www.example.com', 'Tire a sua carta de condução', 'mpu', 'viaturas', now() - interval '1 day', now() + interval '30 days', 900000, 'active');

-- ── Real photos for the vertical listings + ad creatives (replace /ph) ──
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/6011/5982659068_d0b8a34e88_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'aulas-ingles';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/4076/4946114680_d1f08b637f_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'bilhetes-marrabenta';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/65535/49927055648_79e8263b8e_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'canalizador-24h';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/3167/2413600547_8f3670b933_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'dj-som-eventos';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/2832/13243754323_6ed69e4fe5_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'empregada-domestica-matola';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/8231/8546321749_6031438d3a_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'honda-fit-2014';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/3923/15204215650_f6cf50d027_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'programador-web-maputo';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/2151/2107624809_18f59fe877_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 't3-arrendar-sommerschield';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/2858/8751769199_6f4816d2b2_b.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'terreno-matola';
UPDATE product_image i SET s3_key = 'https://live.staticflickr.com/3817/14093903229_1836fcc2d5.jpg' FROM product p WHERE i.product_id = p.id AND p.slug = 'toyota-corolla-2016';
UPDATE ad_campaign SET image_url = 'https://live.staticflickr.com/7530/15222020274_aedac47229_b.jpg' WHERE advertiser_name = 'Banco Exemplo';
UPDATE ad_campaign SET image_url = 'https://live.staticflickr.com/951/42373784431_dba7832ed6_b.jpg' WHERE advertiser_name = 'Escola de Condução Xitique';


-- ── More sample listings across the verticals (fuller marketplace) ──
-- 15 extra classifieds ads (viaturas, imóveis, empregos, serviços, eventos),
-- each with a real CC-licensed photo (Openverse/Flickr). Prices in cents of MT.
INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  -- Viaturas (c007)
  ('a0000000-0000-4000-8000-000000000201', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', 'nissan-almera-2013', 'Nissan Almera 2013', 'Nissan Almera 2013', 'Almera 1.5 gasolina, económico e fiável. Ar condicionado, vidros elétricos, pneus em bom estado.', '{"marca":"Nissan","modelo":"Almera","ano":"2013","km":"110000","combustivel":"Gasolina","caixa":"Manual"}', 'active', NULL, NULL, 0, now() - interval '9 hours'),
  ('a0000000-0000-4000-8000-000000000202', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000007', 'toyota-hilux-2015', 'Toyota Hilux 2015 4x4', 'Toyota Hilux 2015 4x4', 'Pick-up Hilux 2.5 diesel, 4x4, ideal para obra ou machamba. Caixa de carga com capota. Livro de revisões.', '{"marca":"Toyota","modelo":"Hilux","ano":"2015","km":"98000","combustivel":"Diesel","caixa":"Manual"}', 'active', NULL, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000203', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000007', 'mota-haojue-125', 'Motorizada Haojue 125cc', 'Haojue 125cc Motorcycle', 'Mota Haojue 125cc, pouca quilometragem, documentos em ordem. Óptima para o dia-a-dia e entregas.', '{"marca":"Outra","modelo":"Haojue DK125","ano":"2019","km":"22000","combustivel":"Gasolina","caixa":"Manual"}', 'active', NULL, NULL, 0, now() - interval '4 days'),
  -- Imóveis (c008)
  ('a0000000-0000-4000-8000-000000000204', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 't2-polana-arrendar', 'T2 para arrendar na Polana', 'T2 for rent in Polana', 'Apartamento T2 com varanda, cozinha equipada e água quente. Condomínio com segurança 24h. Renda mensal.', '{"negocio":"Arrendar","quartos":"2","area":"90"}', 'active', NULL, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000205', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000008', 'vivenda-t4-matola', 'Vivenda T4 na Matola', 'T4 villa in Matola', 'Vivenda T4 com quintal, garagem para 2 carros e dependência. Bairro tranquilo, perto de escolas.', '{"negocio":"Venda","quartos":"4","area":"300"}', 'active', NULL, NULL, 0, now() - interval '6 days'),
  ('a0000000-0000-4000-8000-000000000206', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000008', 'loja-baixa-trespasse', 'Loja para trespasse na Baixa', 'Shop for lease transfer downtown', 'Trespasse de loja com montra na Baixa de Maputo. Boa localização, muito movimento. Contrato transferível.', '{"negocio":"Venda","quartos":"0","area":"120"}', 'active', NULL, NULL, 0, now() - interval '3 days'),
  -- Empregos (c010)
  ('a0000000-0000-4000-8000-000000000207', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000010', 'motorista-pesados-maputo', 'Motorista de pesados (Maputo)', 'Heavy-vehicle driver (Maputo)', 'Empresa de transportes procura motorista de pesados com carta pesada e experiência. Contrato a tempo inteiro.', '{"tipo_contrato":"Tempo inteiro","area":"Transporte","local":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '12 hours'),
  ('a0000000-0000-4000-8000-000000000208', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000010', 'rececionista-hotel-beira', 'Rececionista de hotel (Beira)', 'Hotel receptionist (Beira)', 'Hotel na Beira procura rececionista com boa apresentação e inglês. Turnos rotativos, tempo inteiro.', '{"tipo_contrato":"Tempo inteiro","area":"Restauração","local":"Beira"}', 'active', NULL, NULL, 0, now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000209', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000010', 'tecnico-electricidade-matola', 'Técnico de electricidade (Matola)', 'Electrical technician (Matola)', 'Vaga para técnico de electricidade com experiência em instalações prediais. Contrato a tempo inteiro.', '{"tipo_contrato":"Tempo inteiro","area":"Construção","local":"Matola"}', 'active', NULL, NULL, 0, now() - interval '5 days'),
  -- Serviços (c009)
  ('a0000000-0000-4000-8000-000000000210', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000009', 'eletricista-residencial', 'Eletricista residencial', 'Residential electrician', 'Instalações e reparações eléctricas ao domicílio. Quadros, tomadas, iluminação. Orçamento grátis.', '{"categoria_servico":"Eletricidade","zona":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000211', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000009', 'reparacao-frigorificos', 'Reparação de frigoríficos e ACs', 'Fridge & AC repair', 'Reparo de frigoríficos, arcas e ar condicionado ao domicílio. Recarga de gás e peças. Atendimento rápido.', '{"categoria_servico":"Reparação","zona":"Matola"}', 'active', NULL, NULL, 0, now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000212', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000009', 'fotografo-eventos', 'Fotógrafo para eventos', 'Event photographer', 'Fotografia e vídeo para casamentos, festas e eventos empresariais. Entrega em galeria digital.', '{"categoria_servico":"Fotografia","zona":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '8 days'),
  -- Eventos (c011)
  ('a0000000-0000-4000-8000-000000000213', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000011', 'aluguer-tendas-cadeiras', 'Aluguer de tendas e cadeiras', 'Tent & chair rental', 'Aluguer de tendas, cadeiras e mesas para festas e cerimónias. Montagem e transporte incluídos.', '{"tipo":"Festa","data":"A combinar","zona":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000214', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000011', 'bilhetes-jogo-mambas', 'Bilhetes — Mambas vs. Argélia', 'Tickets — Mozambique vs. Algeria', 'Bilhetes para o jogo dos Mambas no Estádio Nacional do Zimpeto. Bancada central, lote limitado.', '{"tipo":"Desporto","data":"2026-10-11","zona":"Maputo Cidade"}', 'active', NULL, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000215', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000011', 'dj-casamento-decoracao', 'DJ e decoração de casamentos', 'Wedding DJ & décor', 'Pacote completo para casamentos: DJ, som, iluminação e decoração de sala. Orçamento à medida.', '{"tipo":"Casamento","data":"A combinar","zona":"Matola"}', 'active', NULL, NULL, 0, now() - interval '10 days');

INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000201', 'VIA-201', '{}', 48000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000202', 'VIA-202', '{}', 135000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000303', 'a0000000-0000-4000-8000-000000000203', 'VIA-203', '{}', 6500000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000304', 'a0000000-0000-4000-8000-000000000204', 'IMO-204', '{}', 4500000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000305', 'a0000000-0000-4000-8000-000000000205', 'IMO-205', '{}', 850000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000306', 'a0000000-0000-4000-8000-000000000206', 'IMO-206', '{}', 95000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000307', 'a0000000-0000-4000-8000-000000000207', 'EMP-207', '{}', 2500000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000308', 'a0000000-0000-4000-8000-000000000208', 'EMP-208', '{}', 2200000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000309', 'a0000000-0000-4000-8000-000000000209', 'EMP-209', '{}', 3000000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000310', 'a0000000-0000-4000-8000-000000000210', 'SER-210', '{}', 150000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000311', 'a0000000-0000-4000-8000-000000000211', 'SER-211', '{}', 100000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000312', 'a0000000-0000-4000-8000-000000000212', 'SER-212', '{}', 500000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000313', 'a0000000-0000-4000-8000-000000000213', 'EVT-213', '{}', 800000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000314', 'a0000000-0000-4000-8000-000000000214', 'EVT-214', '{}', 50000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000315', 'a0000000-0000-4000-8000-000000000215', 'EVT-215', '{}', 1500000, NULL, 1, true);

INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000201', 'https://live.staticflickr.com/1136/1485326119_9f04c8be06_b.jpg', 1024, 768, 'Nissan Almera', 0),
  ('e0000000-0000-4000-8000-000000000202', 'a0000000-0000-4000-8000-000000000202', 'https://live.staticflickr.com/4131/4972591434_24ed4eae0c_b.jpg', 1024, 768, 'Toyota Hilux 4x4', 0),
  ('e0000000-0000-4000-8000-000000000203', 'a0000000-0000-4000-8000-000000000203', 'https://live.staticflickr.com/2931/14688503106_3061e9ac0a_b.jpg', 1024, 768, 'Motorizada 125cc', 0),
  ('e0000000-0000-4000-8000-000000000204', 'a0000000-0000-4000-8000-000000000204', 'https://live.staticflickr.com/5582/15291722925_b8fb636a5c_b.jpg', 1024, 768, 'Apartamento T2', 0),
  ('e0000000-0000-4000-8000-000000000205', 'a0000000-0000-4000-8000-000000000205', 'https://live.staticflickr.com/3131/3128754928_17f1181e02_b.jpg', 1024, 768, 'Vivenda T4', 0),
  ('e0000000-0000-4000-8000-000000000206', 'a0000000-0000-4000-8000-000000000206', 'https://live.staticflickr.com/4134/4918836141_5a31eeb48c_b.jpg', 1024, 768, 'Loja na Baixa', 0),
  ('e0000000-0000-4000-8000-000000000207', 'a0000000-0000-4000-8000-000000000207', 'https://live.staticflickr.com/2132/2225709482_c8ed3374c9_b.jpg', 1024, 768, 'Motorista de pesados', 0),
  ('e0000000-0000-4000-8000-000000000208', 'a0000000-0000-4000-8000-000000000208', 'https://live.staticflickr.com/7420/11059593346_7f3c1fb233_b.jpg', 1024, 768, 'Rececionista de hotel', 0),
  ('e0000000-0000-4000-8000-000000000209', 'a0000000-0000-4000-8000-000000000209', 'https://live.staticflickr.com/1215/5106374474_7f6785eb85_b.jpg', 1024, 768, 'Técnico de electricidade', 0),
  ('e0000000-0000-4000-8000-000000000210', 'a0000000-0000-4000-8000-000000000210', 'https://live.staticflickr.com/3266/3148848829_4dd6a49d73_b.jpg', 1024, 768, 'Eletricista', 0),
  ('e0000000-0000-4000-8000-000000000211', 'a0000000-0000-4000-8000-000000000211', 'https://live.staticflickr.com/4133/5024682259_9d3da85376_b.jpg', 1024, 768, 'Reparação de frigoríficos', 0),
  ('e0000000-0000-4000-8000-000000000212', 'a0000000-0000-4000-8000-000000000212', 'https://live.staticflickr.com/4101/4759829140_9f8c9c354c_b.jpg', 1024, 768, 'Fotógrafo', 0),
  ('e0000000-0000-4000-8000-000000000213', 'a0000000-0000-4000-8000-000000000213', 'https://live.staticflickr.com/6167/6142412961_403f0636cb_b.jpg', 1024, 768, 'Tendas e cadeiras', 0),
  ('e0000000-0000-4000-8000-000000000214', 'a0000000-0000-4000-8000-000000000214', 'https://live.staticflickr.com/2076/2487740918_0a39e271e2_b.jpg', 1024, 768, 'Estádio de futebol', 0),
  ('e0000000-0000-4000-8000-000000000215', 'a0000000-0000-4000-8000-000000000215', 'https://live.staticflickr.com/3558/3584418290_202ab5f954_b.jpg', 1024, 768, 'Decoração de casamento', 0);


-- ── More retail listings (moda, eletrónica, telemóveis, casa, alimentação, beleza) ──
-- 18 extra products (3 per retail category), each with a real CC-licensed
-- Flickr photo. Prices in cents of MT.
INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  -- Moda (c001)
  ('a0000000-0000-4000-8000-000000000216', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'tenis-desportivo', 'Ténis desportivo (vários números)', 'Sports sneakers (various sizes)', 'Ténis novos para desporto e dia-a-dia. Vários números disponíveis, confortáveis e leves.', '{"Material":"Têxtil","Estado":"Novo"}', 'active', 700, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000217', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'bolsa-senhora', 'Bolsa de senhora em couro', 'Women''s leather handbag', 'Bolsa elegante em couro sintético, espaçosa e resistente. Ideal para o dia-a-dia ou trabalho.', '{"Material":"Couro sintético","Cor":"Castanho"}', 'active', 600, NULL, 0, now() - interval '3 days'),
  ('a0000000-0000-4000-8000-000000000218', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'oculos-sol', 'Óculos de sol com proteção UV', 'UV-protection sunglasses', 'Óculos de sol unissexo com proteção UV400. Armação leve e resistente. Estojo incluído.', '{"Proteção":"UV400","Género":"Unissexo"}', 'active', 120, NULL, 0, now() - interval '6 days'),
  -- Eletrónica (c002)
  ('a0000000-0000-4000-8000-000000000219', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'tv-led-43', 'Televisor LED 43" Full HD', '43" Full HD LED TV', 'TV LED de 43 polegadas, Full HD, com entradas HDMI e USB. Imagem nítida e consumo baixo.', '{"Tamanho":"43 pol","Resolução":"Full HD"}', 'active', 8000, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000220', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'laptop-usado', 'Laptop usado i5 8GB RAM', 'Used laptop i5 8GB RAM', 'Portátil Core i5, 8GB de RAM e SSD de 256GB. Bom estado, bateria com boa autonomia. Ideal para estudo e trabalho.', '{"Processador":"Core i5","RAM":"8GB","Estado":"Usado"}', 'active', 2200, NULL, 0, now() - interval '4 days'),
  ('a0000000-0000-4000-8000-000000000221', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'fones-bluetooth', 'Auscultadores Bluetooth sem fios', 'Wireless Bluetooth headphones', 'Auscultadores sem fios com bom isolamento e bateria de longa duração. Microfone incorporado para chamadas.', '{"Ligação":"Bluetooth","Bateria":"20h"}', 'active', 300, NULL, 0, now() - interval '7 days'),
  -- Telemóveis (c005)
  ('a0000000-0000-4000-8000-000000000222', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'samsung-galaxy-a14', 'Samsung Galaxy A14 128GB', 'Samsung Galaxy A14 128GB', 'Galaxy A14 com 128GB, ecrã grande e bateria de 5000mAh. Dual SIM, selado na caixa com garantia.', '{"Marca":"Samsung","Armazenamento":"128GB","Estado":"Novo"}', 'active', 200, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000223', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', 'tecno-spark-usado', 'Tecno Spark usado 64GB', 'Tecno Spark used 64GB', 'Telemóvel Tecno Spark em bom estado, 64GB, com capa e carregador. Bateria em boas condições.', '{"Marca":"Tecno","Armazenamento":"64GB","Estado":"Usado"}', 'active', 190, NULL, 0, now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000224', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000005', 'smartwatch-fit', 'Smartwatch com medidor de passos', 'Smartwatch with step counter', 'Relógio inteligente com contador de passos, notificações e medição de frequência cardíaca. Compatível com Android e iPhone.', '{"Compatibilidade":"Android/iOS","Resistência":"IP67"}', 'active', 90, NULL, 0, now() - interval '8 days'),
  -- Casa e Cozinha (c003)
  ('a0000000-0000-4000-8000-000000000225', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'fogao-4-bocas', 'Fogão a gás 4 bocas com forno', '4-burner gas stove with oven', 'Fogão a gás de 4 bocas com forno, acendimento fácil e grelha em ferro. Ideal para toda a família.', '{"Bocas":"4","Tipo":"Gás"}', 'active', 25000, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000226', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'geleira-frigorifico', 'Frigorífico combinado 250L', 'Combi fridge 250L', 'Frigorífico combinado de 250 litros, baixo consumo, com congelador. Pouco uso, em ótimo estado.', '{"Capacidade":"250L","Classe":"A+"}', 'active', 45000, NULL, 0, now() - interval '4 days'),
  ('a0000000-0000-4000-8000-000000000227', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'conjunto-sofa', 'Conjunto de sofás 3+2 lugares', '3+2 seater sofa set', 'Conjunto de sofás de 3 e 2 lugares, tecido confortável e estrutura robusta. Entrega combinada em Maputo e Matola.', '{"Lugares":"3+2","Material":"Tecido"}', 'active', 60000, NULL, 0, now() - interval '9 days'),
  -- Alimentação (c004)
  ('a0000000-0000-4000-8000-000000000228', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'arroz-25kg', 'Saco de arroz 25kg', '25kg rice sack', 'Saco de arroz de 25kg, grão longo e de boa qualidade. Ideal para casa, revenda ou restaurante.', '{"Peso":"25kg","Tipo":"Grão longo"}', 'active', 25000, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000229', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'feijao-manteiga', 'Feijão manteiga 5kg', 'Butter beans 5kg', 'Feijão manteiga seco, limpo e escolhido. Embalagem de 5kg. Direto do produtor.', '{"Peso":"5kg","Tipo":"Manteiga"}', 'active', 5000, NULL, 0, now() - interval '5 days'),
  ('a0000000-0000-4000-8000-000000000230', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'amendoim-torrado', 'Amendoim torrado 1kg', 'Roasted peanuts 1kg', 'Amendoim torrado na hora, crocante e saboroso. Embalagem de 1kg. Ótimo para petiscar ou culinária.', '{"Peso":"1kg"}', 'active', 1000, NULL, 0, now() - interval '7 days'),
  -- Beleza (c006)
  ('a0000000-0000-4000-8000-000000000231', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'perfume-importado', 'Perfume importado 100ml', 'Imported perfume 100ml', 'Perfume importado de longa duração, 100ml. Fragrância marcante para o dia ou noite. Selado.', '{"Volume":"100ml","Género":"Unissexo"}', 'active', 350, NULL, 0, now() - interval '2 days'),
  ('a0000000-0000-4000-8000-000000000232', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'kit-maquilhagem', 'Kit de maquilhagem completo', 'Complete makeup kit', 'Kit de maquilhagem com paleta de sombras, base, batons e pincéis. Ideal para profissionais e uso pessoal.', '{"Peças":"Kit completo"}', 'active', 800, NULL, 0, now() - interval '6 days'),
  ('a0000000-0000-4000-8000-000000000233', '11111111-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000006', 'creme-hidratante', 'Creme hidratante corporal 400ml', 'Body moisturizer 400ml', 'Creme hidratante para o corpo, 400ml. Absorção rápida, deixa a pele macia. Para todo o tipo de pele.', '{"Volume":"400ml"}', 'active', 450, NULL, 0, now() - interval '10 days');

INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000316', 'a0000000-0000-4000-8000-000000000216', 'MOD-216', '{}', 250000, NULL, 20, true),
  ('b0000000-0000-4000-8000-000000000317', 'a0000000-0000-4000-8000-000000000217', 'MOD-217', '{}', 180000, NULL, 8, true),
  ('b0000000-0000-4000-8000-000000000318', 'a0000000-0000-4000-8000-000000000218', 'MOD-218', '{}', 95000, NULL, 30, true),
  ('b0000000-0000-4000-8000-000000000319', 'a0000000-0000-4000-8000-000000000219', 'ELE-219', '{}', 2200000, NULL, 5, true),
  ('b0000000-0000-4000-8000-000000000320', 'a0000000-0000-4000-8000-000000000220', 'ELE-220', '{}', 1800000, NULL, 3, true),
  ('b0000000-0000-4000-8000-000000000321', 'a0000000-0000-4000-8000-000000000221', 'ELE-221', '{}', 150000, NULL, 15, true),
  ('b0000000-0000-4000-8000-000000000322', 'a0000000-0000-4000-8000-000000000222', 'TEL-222', '{}', 1200000, NULL, 6, true),
  ('b0000000-0000-4000-8000-000000000323', 'a0000000-0000-4000-8000-000000000223', 'TEL-223', '{}', 850000, NULL, 1, true),
  ('b0000000-0000-4000-8000-000000000324', 'a0000000-0000-4000-8000-000000000224', 'TEL-224', '{}', 350000, NULL, 12, true),
  ('b0000000-0000-4000-8000-000000000325', 'a0000000-0000-4000-8000-000000000225', 'CAS-225', '{}', 950000, NULL, 4, true),
  ('b0000000-0000-4000-8000-000000000326', 'a0000000-0000-4000-8000-000000000226', 'CAS-226', '{}', 1800000, NULL, 2, true),
  ('b0000000-0000-4000-8000-000000000327', 'a0000000-0000-4000-8000-000000000227', 'CAS-227', '{}', 2200000, NULL, 3, true),
  ('b0000000-0000-4000-8000-000000000328', 'a0000000-0000-4000-8000-000000000228', 'ALI-228', '{}', 220000, NULL, 40, true),
  ('b0000000-0000-4000-8000-000000000329', 'a0000000-0000-4000-8000-000000000229', 'ALI-229', '{}', 60000, NULL, 25, true),
  ('b0000000-0000-4000-8000-000000000330', 'a0000000-0000-4000-8000-000000000230', 'ALI-230', '{}', 30000, NULL, 50, true),
  ('b0000000-0000-4000-8000-000000000331', 'a0000000-0000-4000-8000-000000000231', 'BEL-231', '{}', 180000, NULL, 10, true),
  ('b0000000-0000-4000-8000-000000000332', 'a0000000-0000-4000-8000-000000000232', 'BEL-232', '{}', 120000, NULL, 14, true),
  ('b0000000-0000-4000-8000-000000000333', 'a0000000-0000-4000-8000-000000000233', 'BEL-233', '{}', 65000, NULL, 18, true);

INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000216', 'a0000000-0000-4000-8000-000000000216', 'https://live.staticflickr.com/7413/27254488060_a4c93c8e25_b.jpg', 1024, 768, 'Ténis desportivo', 0),
  ('e0000000-0000-4000-8000-000000000217', 'a0000000-0000-4000-8000-000000000217', 'https://live.staticflickr.com/1/536241_9a2aa38767_b.jpg', 1024, 768, 'Bolsa de senhora', 0),
  ('e0000000-0000-4000-8000-000000000218', 'a0000000-0000-4000-8000-000000000218', 'https://live.staticflickr.com/8454/7993768362_324ae52f7e_b.jpg', 1024, 768, 'Óculos de sol', 0),
  ('e0000000-0000-4000-8000-000000000219', 'a0000000-0000-4000-8000-000000000219', 'https://live.staticflickr.com/65535/32716079687_4671d3ba40_b.jpg', 1024, 768, 'Televisor LED', 0),
  ('e0000000-0000-4000-8000-000000000220', 'a0000000-0000-4000-8000-000000000220', 'https://live.staticflickr.com/8809/17783465600_08cd924dff_b.jpg', 1024, 768, 'Laptop', 0),
  ('e0000000-0000-4000-8000-000000000221', 'a0000000-0000-4000-8000-000000000221', 'https://live.staticflickr.com/3220/2338990355_651cd9f8e4_b.jpg', 1024, 768, 'Auscultadores Bluetooth', 0),
  ('e0000000-0000-4000-8000-000000000222', 'a0000000-0000-4000-8000-000000000222', 'https://live.staticflickr.com/7386/12759210253_e19aa0f72c_b.jpg', 1024, 768, 'Samsung Galaxy', 0),
  ('e0000000-0000-4000-8000-000000000223', 'a0000000-0000-4000-8000-000000000223', 'https://live.staticflickr.com/7502/27160977795_7c5ef43e28_b.jpg', 1024, 768, 'Tecno Spark', 0),
  ('e0000000-0000-4000-8000-000000000224', 'a0000000-0000-4000-8000-000000000224', 'https://live.staticflickr.com/3790/13467474815_be54810773_b.jpg', 1024, 768, 'Smartwatch', 0),
  ('e0000000-0000-4000-8000-000000000225', 'a0000000-0000-4000-8000-000000000225', 'https://live.staticflickr.com/160/410044341_835bbf7017_b.jpg', 1024, 768, 'Fogão a gás', 0),
  ('e0000000-0000-4000-8000-000000000226', 'a0000000-0000-4000-8000-000000000226', 'https://live.staticflickr.com/3789/10312224554_1ceeca6906_b.jpg', 1024, 768, 'Frigorífico', 0),
  ('e0000000-0000-4000-8000-000000000227', 'a0000000-0000-4000-8000-000000000227', 'https://live.staticflickr.com/4401/36633084871_9ec6e549b1_b.jpg', 1024, 768, 'Conjunto de sofás', 0),
  ('e0000000-0000-4000-8000-000000000228', 'a0000000-0000-4000-8000-000000000228', 'https://live.staticflickr.com/4562/24971315878_b50ef5b255_b.jpg', 1024, 768, 'Saco de arroz', 0),
  ('e0000000-0000-4000-8000-000000000229', 'a0000000-0000-4000-8000-000000000229', 'https://live.staticflickr.com/2266/1753109292_2bfb7b950b_b.jpg', 1024, 768, 'Feijão manteiga', 0),
  ('e0000000-0000-4000-8000-000000000230', 'a0000000-0000-4000-8000-000000000230', 'https://live.staticflickr.com/172/391190975_d71078078c_b.jpg', 1024, 768, 'Amendoim torrado', 0),
  ('e0000000-0000-4000-8000-000000000231', 'a0000000-0000-4000-8000-000000000231', 'https://live.staticflickr.com/3537/3301171124_850fd70a5a_b.jpg', 1024, 768, 'Perfume', 0),
  ('e0000000-0000-4000-8000-000000000232', 'a0000000-0000-4000-8000-000000000232', 'https://live.staticflickr.com/4178/33638438273_17ae92d3b8_b.jpg', 1024, 768, 'Kit de maquilhagem', 0),
  ('e0000000-0000-4000-8000-000000000233', 'a0000000-0000-4000-8000-000000000233', 'https://live.staticflickr.com/7451/16255328209_14fc13361d_b.jpg', 1024, 768, 'Creme hidratante', 0);


-- ── Saúde (health) items folded into the Beleza e Saúde category ──
INSERT INTO product (id, vendor_id, category_id, slug, title_pt, title_en, description_pt, attributes, status, weight_grams, rating_avg, rating_count, published_at) VALUES
  ('a0000000-0000-4000-8000-000000000234', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'tensiometro-digital', 'Tensiómetro digital de braço', 'Digital arm blood-pressure monitor', 'Medidor de tensão arterial digital, de braço, com ecrã grande e memória. Ideal para controlo em casa.', '{"Tipo":"Braço","Ecrã":"Digital"}', 'active', 500, NULL, 0, now() - interval '1 days'),
  ('a0000000-0000-4000-8000-000000000235', '11111111-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'termometro-digital', 'Termómetro digital', 'Digital thermometer', 'Termómetro digital de leitura rápida, com sinal sonoro. Para toda a família. Ponta flexível.', '{"Leitura":"Rápida","Uso":"Familiar"}', 'active', 60, NULL, 0, now() - interval '4 days'),
  ('a0000000-0000-4000-8000-000000000236', '11111111-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000006', 'kit-primeiros-socorros', 'Kit de primeiros socorros', 'First-aid kit', 'Estojo de primeiros socorros completo: ligaduras, pensos, compressas, tesoura e antisséptico. Para casa, carro ou trabalho.', '{"Conteúdo":"Completo","Uso":"Casa/Carro"}', 'active', 900, NULL, 0, now() - interval '8 days');

INSERT INTO product_variant (id, product_id, sku, options, price_cents, compare_at_cents, stock_quantity, is_active) VALUES
  ('b0000000-0000-4000-8000-000000000334', 'a0000000-0000-4000-8000-000000000234', 'SAU-234', '{}', 350000, NULL, 8, true),
  ('b0000000-0000-4000-8000-000000000335', 'a0000000-0000-4000-8000-000000000235', 'SAU-235', '{}', 85000, NULL, 25, true),
  ('b0000000-0000-4000-8000-000000000336', 'a0000000-0000-4000-8000-000000000236', 'SAU-236', '{}', 120000, NULL, 15, true);

INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000234', 'a0000000-0000-4000-8000-000000000234', 'https://live.staticflickr.com/3722/10668630046_53eca2c5eb_b.jpg', 1024, 768, 'Tensiómetro digital', 0),
  ('e0000000-0000-4000-8000-000000000235', 'a0000000-0000-4000-8000-000000000235', 'https://live.staticflickr.com/1227/579070390_c69248b25c_b.jpg', 1024, 768, 'Termómetro digital', 0),
  ('e0000000-0000-4000-8000-000000000236', 'a0000000-0000-4000-8000-000000000236', 'https://live.staticflickr.com/5307/5575095686_b58e0b6f7e_b.jpg', 1024, 768, 'Kit de primeiros socorros', 0);

-- ── Extra photos for a few flagship listings (so the swipe gallery shines) ──
-- Additional real CC-licensed photos (Openverse/Flickr) at sort_order 1+.
-- Product resolved by slug so no UUID bookkeeping is needed.
INSERT INTO product_image (id, product_id, s3_key, width, height, alt_text, sort_order) VALUES
  ('e0000000-0000-4000-8000-000000000301', (SELECT id FROM product WHERE slug = 'nissan-almera-2013'), 'https://live.staticflickr.com/3260/2765757383_6a5c2aca67_b.jpg', 1024, 768, 'Nissan Almera — interior e tablier', 1),
  ('e0000000-0000-4000-8000-000000000302', (SELECT id FROM product WHERE slug = 'nissan-almera-2013'), 'https://live.staticflickr.com/4913/46155982522_9502b85ef6_b.jpg', 1024, 768, 'Nissan Almera — vista lateral', 2),
  ('e0000000-0000-4000-8000-000000000303', (SELECT id FROM product WHERE slug = 'toyota-corolla-2016'), 'https://live.staticflickr.com/8529/8482412928_866fb06dd9_b.jpg', 1024, 768, 'Toyota Corolla — vista lateral', 1),
  ('e0000000-0000-4000-8000-000000000304', (SELECT id FROM product WHERE slug = 'toyota-corolla-2016'), 'https://live.staticflickr.com/3260/2765757383_6a5c2aca67_b.jpg', 1024, 768, 'Toyota Corolla — interior e tablier', 2),
  ('e0000000-0000-4000-8000-000000000305', (SELECT id FROM product WHERE slug = 'toyota-hilux-2015'), 'https://live.staticflickr.com/4599/25181882108_0ae40fe540_b.jpg', 1024, 768, 'Toyota Hilux — vista frontal', 1),
  ('e0000000-0000-4000-8000-000000000306', (SELECT id FROM product WHERE slug = 'toyota-hilux-2015'), 'https://live.staticflickr.com/5616/15588642156_ba8baef4fd_b.jpg', 1024, 768, 'Toyota Hilux — caixa de carga', 2),
  ('e0000000-0000-4000-8000-000000000307', (SELECT id FROM product WHERE slug = 'honda-fit-2014'), 'https://live.staticflickr.com/3260/2765757383_6a5c2aca67_b.jpg', 1024, 768, 'Honda Fit — interior e tablier', 1),
  ('e0000000-0000-4000-8000-000000000308', (SELECT id FROM product WHERE slug = 'honda-fit-2014'), 'https://live.staticflickr.com/8529/8482412928_866fb06dd9_b.jpg', 1024, 768, 'Honda Fit — vista lateral', 2),
  ('e0000000-0000-4000-8000-000000000309', (SELECT id FROM product WHERE slug = 't2-polana-arrendar'), 'https://live.staticflickr.com/3099/2609148181_893f0c7d55_b.jpg', 1024, 768, 'T2 Polana — sala de estar', 1),
  ('e0000000-0000-4000-8000-000000000310', (SELECT id FROM product WHERE slug = 't2-polana-arrendar'), 'https://live.staticflickr.com/2287/2609138801_af674605aa_b.jpg', 1024, 768, 'T2 Polana — segunda divisão', 2),
  ('e0000000-0000-4000-8000-000000000311', (SELECT id FROM product WHERE slug = 'samsung-galaxy-a14'), 'https://live.staticflickr.com/7502/27160977795_7c5ef43e28_b.jpg', 1024, 768, 'Samsung Galaxy A14 — em uso', 1),
  ('e0000000-0000-4000-8000-000000000312', (SELECT id FROM product WHERE slug = 'samsung-galaxy-a14'), 'https://live.staticflickr.com/5627/29794402404_6c4c408265_b.jpg', 1024, 768, 'Samsung Galaxy A14 — ecrã', 2);



-- Demo: one shop on the paid "Loja Pro" subscription (verified selo).
UPDATE vendor SET pro_until = now() + interval '30 days' WHERE slug = 'mama-rosa';

COMMIT;

SELECT
  (SELECT count(*) FROM product) AS products,
  (SELECT count(*) FROM product_variant) AS variants,
  (SELECT count(*) FROM product_image) AS images,
  (SELECT count(*) FROM category) AS categories;
