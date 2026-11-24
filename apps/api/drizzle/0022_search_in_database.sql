-- P1-01: search and browse run in Postgres instead of loading every listing
-- into the API's memory.
--
-- product.search_doc holds the normalised text every search word is matched
-- against (title, description, category, attributes, shop and place names),
-- with the same rules as normalise() in search-text.ts: lower case, accents
-- removed, anything other than a-z/0-9 collapsed to one space. A trigram GIN
-- index makes the word-start regular expressions use an index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION nhonga_norm(t text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    translate(lower(coalesce(t, '')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "search_doc" text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION nhonga_product_search_doc(p_id uuid) RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT nhonga_norm(concat_ws(' ',
    p.title_pt, p.title_en, p.description_pt, p.description_en,
    c.slug, c.name_pt, c.name_en, p.attributes::text,
    v.display_name, d.name, pr.name))
  FROM product p
  JOIN category c ON c.id = p.category_id
  JOIN vendor v ON v.id = p.vendor_id
  LEFT JOIN district d ON d.id = v.district_id
  LEFT JOIN province pr ON pr.code = d.province_code
  WHERE p.id = p_id
$$;

-- The listing's own text changes → rebuild its document after the write.
CREATE OR REPLACE FUNCTION nhonga_product_search_doc_trg() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  UPDATE product SET search_doc = nhonga_product_search_doc(NEW.id)
   WHERE id = NEW.id AND search_doc IS DISTINCT FROM nhonga_product_search_doc(NEW.id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS product_search_doc ON product;
CREATE TRIGGER product_search_doc
  AFTER INSERT OR UPDATE OF title_pt, title_en, description_pt, description_en, attributes,
    category_id, vendor_id
  ON product FOR EACH ROW EXECUTE FUNCTION nhonga_product_search_doc_trg();

-- A shop renamed or moved → its listings' documents follow.
CREATE OR REPLACE FUNCTION nhonga_vendor_search_doc_trg() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  UPDATE product SET search_doc = nhonga_product_search_doc(id) WHERE vendor_id = NEW.id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS vendor_search_doc ON vendor;
CREATE TRIGGER vendor_search_doc
  AFTER UPDATE OF display_name, district_id ON vendor
  FOR EACH ROW
  WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name
        OR OLD.district_id IS DISTINCT FROM NEW.district_id)
  EXECUTE FUNCTION nhonga_vendor_search_doc_trg();

UPDATE product SET search_doc = nhonga_product_search_doc(id);

CREATE INDEX IF NOT EXISTS "product_search_doc_trgm_idx"
  ON "product" USING gin ("search_doc" gin_trgm_ops) WHERE "status" = 'active';

-- Browse: the newest active listings of a category, and of a shop.
CREATE INDEX IF NOT EXISTS "product_active_category_recent_idx"
  ON "product" ("category_id", (greatest("published_at", "bumped_at")) DESC)
  WHERE "status" = 'active';

-- The price and stock a listing shows (headlineVariant): the cheapest active
-- variant in stock, else the cheapest active one. Kept on the listing by a
-- trigger on its variants, so price filters and sorts read one indexed column.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "display_price_cents" bigint NOT NULL DEFAULT 0;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "in_stock" boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION nhonga_product_price_refresh(p_id uuid) RETURNS void
  LANGUAGE sql AS $$
  UPDATE product p SET
    display_price_cents = coalesce(
      (SELECT min(price_cents) FROM product_variant
        WHERE product_id = p_id AND is_active AND stock_quantity > 0),
      (SELECT min(price_cents) FROM product_variant WHERE product_id = p_id AND is_active),
      0),
    in_stock = EXISTS (SELECT 1 FROM product_variant
        WHERE product_id = p_id AND is_active AND stock_quantity > 0)
  WHERE p.id = p_id
$$;

CREATE OR REPLACE FUNCTION nhonga_variant_price_trg() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM nhonga_product_price_refresh(OLD.product_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.product_id <> OLD.product_id) THEN
    PERFORM nhonga_product_price_refresh(NEW.product_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS variant_price ON product_variant;
CREATE TRIGGER variant_price
  AFTER INSERT OR DELETE OR UPDATE OF price_cents, stock_quantity, is_active, product_id
  ON product_variant FOR EACH ROW EXECUTE FUNCTION nhonga_variant_price_trg();

SELECT nhonga_product_price_refresh(id) FROM product;

CREATE INDEX IF NOT EXISTS "product_active_price_idx"
  ON "product" ("display_price_cents") WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "product_active_recent_idx"
  ON "product" ((greatest("published_at", "bumped_at")) DESC) WHERE "status" = 'active';
