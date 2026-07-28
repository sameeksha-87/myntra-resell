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

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

async function main() {
  const orderIds = ["8fa57639-3328-41b3-9827-032673d4bcb2", "6dc0f76a-7fad-47e7-baec-d48a89ef69e2"];
  const listingIds = ["2265ac24-f3a2-4caf-9f2a-de8ffbc55569", "2e6263c1-f152-47a5-baa4-15cb225b8ecb"];

  // Check payment_transactions
  const { data: payTx } = await supabase
    .from("payment_transactions")
    .select("id, order_id, type, status")
    .in("order_id", orderIds);
  console.log("=== payment_transactions ===", payTx);

  // Check ledger_entries
  const { data: ledger } = await supabase
    .from("ledger_entries")
    .select("id, reference_id, reference_type")
    .in("reference_id", orderIds);
  console.log("=== ledger_entries ===", ledger);

  // Check seller_payouts
  const { data: payouts } = await supabase
    .from("seller_payouts")
    .select("id, order_id, status")
    .in("order_id", orderIds);
  console.log("=== seller_payouts ===", payouts);

  // Check pickup_jobs
  const { data: pickups } = await supabase
    .from("pickup_jobs")
    .select("id, listing_id, status")
    .in("listing_id", listingIds);
  console.log("=== pickup_jobs ===", pickups);
}

main().catch(console.error);


