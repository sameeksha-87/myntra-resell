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

async function clear() {
  const { data, error } = await supabase
    .from("listings")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Deletes all rows
  
  if (error) {
    console.error("Error deleting listings:", error.message);
  } else {
    console.log("Successfully cleared listings table in your database!");
  }
}

clear();