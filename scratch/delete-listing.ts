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
  console.log("Cleaning failed listings...");
  const { data: listings, error: fetchErr } = await supabase
    .from("listings")
    .select("id, title, status");

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return;
  }

  const failed = (listings || []).filter((l: any) =>
    l.status === "verification_failed" || l.id.toLowerCase().startsWith("33c033b7")
  );

  console.log(`Deleting ${failed.length} failed listings...`);
  for (const f of failed) {
    const { error: delErr } = await supabase.from("listings").delete().eq("id", f.id);
    if (delErr) console.error(`Failed to delete ${f.id}:`, delErr.message);
    else console.log(`Deleted failed listing ${f.id}`);
  }
}

run();
