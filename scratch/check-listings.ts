import { createClient } from "@supabase/supabase-js";

declare const process: any;
declare const require: any;

const fs = require("fs");
const path = require("path");

// Dependency-free local .env parser
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line: string) => {
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

async function check() {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      brand,
      category,
      size,
      current_price_paise,
      declared_grade,
      confirmed_grade,
      status,
      seller_id,
      source_order_item_id,
      created_at,
      myntra_order_items (
        original_price_paise,
        myntra_orders (
          delivered_at
        )
      ),
      listing_media (
        storage_key,
        angle
      )
    `,
    )
    .limit(1);

  if (error) {
    console.error("PostgREST Error Detail:", error);
  } else {
    console.log("Success! Data fetched:", data);
  }
}

check();
