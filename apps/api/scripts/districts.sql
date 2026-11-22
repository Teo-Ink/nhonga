-- Additional real districts per province, for the hierarchical location picker
-- (province → district). Idempotent: the (province_code, name) unique index +
-- ON CONFLICT means this can be re-run and merged into seed.sql safely. The
-- capital of each province is already seeded; these add the rest.
INSERT INTO district (id, province_code, name) VALUES
  -- Maputo Cidade (municipal districts)
  (gen_random_uuid(), 'MPM', 'KaMpfumo'),
  (gen_random_uuid(), 'MPM', 'Nlhamankulu'),
  (gen_random_uuid(), 'MPM', 'KaMaxaquene'),
  (gen_random_uuid(), 'MPM', 'KaMavota'),
  (gen_random_uuid(), 'MPM', 'KaMubukwana'),
  (gen_random_uuid(), 'MPM', 'KaTembe'),
  -- Maputo Província
  (gen_random_uuid(), 'MPT', 'Boane'),
  (gen_random_uuid(), 'MPT', 'Marracuene'),
  (gen_random_uuid(), 'MPT', 'Manhiça'),
  (gen_random_uuid(), 'MPT', 'Namaacha'),
  (gen_random_uuid(), 'MPT', 'Moamba'),
  (gen_random_uuid(), 'MPT', 'Magude'),
  (gen_random_uuid(), 'MPT', 'Matutuíne'),
  -- Gaza
  (gen_random_uuid(), 'GAZ', 'Chókwè'),
  (gen_random_uuid(), 'GAZ', 'Bilene'),
  (gen_random_uuid(), 'GAZ', 'Chibuto'),
  (gen_random_uuid(), 'GAZ', 'Mandlakazi'),
  (gen_random_uuid(), 'GAZ', 'Massingir'),
  (gen_random_uuid(), 'GAZ', 'Chicualacuala'),
  -- Inhambane
  (gen_random_uuid(), 'INH', 'Maxixe'),
  (gen_random_uuid(), 'INH', 'Vilankulo'),
  (gen_random_uuid(), 'INH', 'Massinga'),
  (gen_random_uuid(), 'INH', 'Morrumbene'),
  (gen_random_uuid(), 'INH', 'Jangamo'),
  (gen_random_uuid(), 'INH', 'Homoíne'),
  -- Sofala
  (gen_random_uuid(), 'SOF', 'Dondo'),
  (gen_random_uuid(), 'SOF', 'Nhamatanda'),
  (gen_random_uuid(), 'SOF', 'Gorongosa'),
  (gen_random_uuid(), 'SOF', 'Búzi'),
  (gen_random_uuid(), 'SOF', 'Marromeu'),
  (gen_random_uuid(), 'SOF', 'Caia'),
  -- Manica
  (gen_random_uuid(), 'MAN', 'Gondola'),
  (gen_random_uuid(), 'MAN', 'Manica'),
  (gen_random_uuid(), 'MAN', 'Sussundenga'),
  (gen_random_uuid(), 'MAN', 'Báruè'),
  (gen_random_uuid(), 'MAN', 'Catandica'),
  -- Tete
  (gen_random_uuid(), 'TET', 'Moatize'),
  (gen_random_uuid(), 'TET', 'Angónia'),
  (gen_random_uuid(), 'TET', 'Cahora Bassa'),
  (gen_random_uuid(), 'TET', 'Changara'),
  (gen_random_uuid(), 'TET', 'Mutarara'),
  -- Zambézia
  (gen_random_uuid(), 'ZAM', 'Mocuba'),
  (gen_random_uuid(), 'ZAM', 'Gurué'),
  (gen_random_uuid(), 'ZAM', 'Milange'),
  (gen_random_uuid(), 'ZAM', 'Alto Molócuè'),
  (gen_random_uuid(), 'ZAM', 'Nicoadala'),
  (gen_random_uuid(), 'ZAM', 'Pebane'),
  -- Nampula
  (gen_random_uuid(), 'NAM', 'Nacala'),
  (gen_random_uuid(), 'NAM', 'Angoche'),
  (gen_random_uuid(), 'NAM', 'Monapo'),
  (gen_random_uuid(), 'NAM', 'Ribáuè'),
  (gen_random_uuid(), 'NAM', 'Malema'),
  (gen_random_uuid(), 'NAM', 'Moma'),
  -- Cabo Delgado
  (gen_random_uuid(), 'CDL', 'Montepuez'),
  (gen_random_uuid(), 'CDL', 'Mocímboa da Praia'),
  (gen_random_uuid(), 'CDL', 'Chiúre'),
  (gen_random_uuid(), 'CDL', 'Mueda'),
  (gen_random_uuid(), 'CDL', 'Palma'),
  -- Niassa
  (gen_random_uuid(), 'NIA', 'Cuamba'),
  (gen_random_uuid(), 'NIA', 'Marrupa'),
  (gen_random_uuid(), 'NIA', 'Mandimba'),
  (gen_random_uuid(), 'NIA', 'Mecanhelas')
ON CONFLICT (province_code, name) DO NOTHING;
