-- Nhonga local test seed. Truncates catalogue tables then inserts a small but
-- fuller Mozambican-market catalogue across all six categories. Product images
-- are real, subject-matched CC-licensed photos (Flickr, via the Openverse API)
-- used as representative demo images — see docs/image-credits.md for licensing.
-- The /ph route still exists as a branded fallback placeholder generator.
BEGIN;

TRUNCATE product_image, product_variant, product, category, category_attribute, promotion_plan, product_promotion, review, app_user, vendor, district RESTART IDENTITY CASCADE;

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
  ('c0000000-0000-4000-8000-000000000006', 'beleza', 'Beleza', 'Beauty', 1, 6);

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

COMMIT;

SELECT
  (SELECT count(*) FROM product) AS products,
  (SELECT count(*) FROM product_variant) AS variants,
  (SELECT count(*) FROM product_image) AS images,
  (SELECT count(*) FROM category) AS categories;
