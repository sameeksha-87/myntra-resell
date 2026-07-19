import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

declare const process: any;

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex > 0) {
        const key = trimmed.slice(0, equalIndex).trim();
        const value = trimmed
          .slice(equalIndex + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        process.env[key] = value;
      }
    }
  });
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env keys!");
  process.exit(1);
}

const supabase = createClient(url, key);

const updatedFunctionSql = `
CREATE OR REPLACE FUNCTION public.seed_user_mock_orders(target_user_id UUID)
RETURNS VOID SECURITY DEFINER AS $$
DECLARE
  brand_tommy UUID;
  brand_nike UUID;
  brand_zara UUID;
  brand_levis UUID;
  brand_roadster UUID;
  
  cat_outer UUID;
  cat_shoes UUID;
  cat_skirts UUID;
  cat_shirts UUID;

  o1_id TEXT := 'o-101-' || target_user_id::text;
  o2_id TEXT := 'o-102-' || target_user_id::text;
  o3_id TEXT := 'o-103-' || target_user_id::text;
  o4_id TEXT := 'o-104-' || target_user_id::text;
  o5_id TEXT := 'o-105-' || target_user_id::text;
BEGIN
  -- First seed standard catalog metadata
  PERFORM public.seed_catalog_metadata();

  -- Get brand and category UUIDs
  SELECT id INTO brand_tommy FROM public.brands WHERE name = 'Tommy Hilfiger';
  SELECT id INTO brand_nike FROM public.brands WHERE name = 'Nike';
  SELECT id INTO brand_zara FROM public.brands WHERE name = 'Zara';
  SELECT id INTO brand_levis FROM public.brands WHERE name = 'Levi''s';
  SELECT id INTO brand_roadster FROM public.brands WHERE name = 'Roadster';
  
  SELECT id INTO cat_outer FROM public.categories WHERE name = 'Outerwear';
  SELECT id INTO cat_shoes FROM public.categories WHERE name = 'Sneakers';
  SELECT id INTO cat_skirts FROM public.categories WHERE name = 'Dresses';
  SELECT id INTO cat_shirts FROM public.categories WHERE name = 'Kids';

  -- If user doesn't have orders, create them
  IF NOT EXISTS (SELECT 1 FROM public.myntra_orders WHERE user_id = target_user_id) THEN
    -- Order 1
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES (o1_id, target_user_id, now() - INTERVAL '1 year')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      gen_random_uuid(),
      o1_id,
      'TH-JACKET-001',
      brand_tommy,
      cat_outer,
      'Colour-Block Puffer Jacket',
      'M',
      1499900,
      'https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    ) ON CONFLICT DO NOTHING;
    
    -- Order 2
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES (o2_id, target_user_id, now() - INTERVAL '2 years')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      gen_random_uuid(),
      o2_id,
      'NIKE-COURT-002',
      brand_nike,
      cat_shoes,
      'Court Vision Low Sneakers',
      'UK 8',
      649500,
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    ) ON CONFLICT DO NOTHING;
    
    -- Order 3
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES (o3_id, target_user_id, now() - INTERVAL '6 months')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      gen_random_uuid(),
      o3_id,
      'ZARA-SKIRT-003',
      brand_zara,
      cat_skirts,
      'Pleated Satin Midi Skirt',
      'S',
      399000,
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    ) ON CONFLICT DO NOTHING;

    -- Order 4
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES (o4_id, target_user_id, now() - INTERVAL '1 year')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      gen_random_uuid(),
      o4_id,
      'LEVIS-TRUCKER-004',
      brand_levis,
      cat_outer,
      'Trucker Denim Jacket',
      'L',
      549900,
      'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    ) ON CONFLICT DO NOTHING;

    -- Order 5
    INSERT INTO public.myntra_orders (id, user_id, delivered_at)
    VALUES (o5_id, target_user_id, now() - INTERVAL '1 year')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.myntra_order_items (id, order_id, product_reference, brand_id, category_id, title, size, original_price_paise, image, quantity, status)
    VALUES (
      gen_random_uuid(),
      o5_id,
      'ROADSTER-SHIRT-005',
      brand_roadster,
      cat_shirts,
      'Casual Solid Cotton Shirt',
      'M',
      249900,
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=400',
      1,
      'delivered'
    ) ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;
`;

async function main() {
  console.log("Updating seed_user_mock_orders function...");
  const { error } = await (supabase as any).rpc("exec_sql", { sql: updatedFunctionSql });
  if (error) {
    console.log("exec_sql RPC not available, trying raw query fallback or notice:", error);
  } else {
    console.log("Successfully updated seed_user_mock_orders stored procedure!");
  }
}

main();
