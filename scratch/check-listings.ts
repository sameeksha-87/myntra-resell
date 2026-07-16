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
  console.error("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in your .env file.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from("listings")
    .select("id, status, source_order_item_id");
  
  if (error) {
    console.error("Error fetching listings:", error.message);
  } else {
    console.log("Current Listings in DB:", data);
  }
}

check();
