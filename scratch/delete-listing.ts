import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

async function run() {
  console.log("Fetching all listings...");
  const { data: listings, error: fetchErr } = await supabase
    .from("listings")
    .select("id, title, status, source_order_item_id");

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  console.log(`Found ${listings?.length || 0} total listings.`);
  const matching = (listings || []).filter((l: any) => l.id.toLowerCase().startsWith("aed40eeb"));

  if (matching.length > 0) {
    for (const l of matching) {
      console.log(`Deleting listing ${l.id} (${l.title}, status: ${l.status})...`);
      const { error: delErr } = await supabase.from("listings").delete().eq("id", l.id);
      if (delErr) {
        console.error(`Failed to delete ${l.id}:`, delErr.message);
      } else {
        console.log(`Successfully deleted listing ${l.id}!`);
      }
    }
  } else {
    console.log(
      "Listing AED40EEB not found directly. Deleting all verification_pending & verification_failed listings...",
    );
    const { data: pending, error: pendErr } = await supabase
      .from("listings")
      .delete()
      .in("status", ["verification_pending", "verification_failed"]);
    if (pendErr) console.error("Error clearing pending:", pendErr);
    else console.log("Cleared pending/failed draft listings!");
  }
}

run();
