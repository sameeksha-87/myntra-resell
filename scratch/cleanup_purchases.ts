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
  console.log("Fetching resale orders (purchases)...");
  const { data: resaleOrders, error: fetchErr } = await supabase
    .from("resale_orders")
    .select("id, listing_id, status");

  if (fetchErr) {
    console.error("Error fetching resale orders:", fetchErr);
    return;
  }

  if (!resaleOrders || resaleOrders.length === 0) {
    console.log("No resale orders (purchases) found to remove.");
    return;
  }

  console.log(`Found ${resaleOrders.length} resale orders to clean up:`, resaleOrders);

  const orderIds = resaleOrders.map((o) => o.id);
  const listingIds = resaleOrders.map((o) => o.listing_id);

  // 1. Delete dependent ledger_entries explicitly since they do not cascade delete
  console.log("Deleting ledger entries for orders...");
  const { error: ledgerErr } = await supabase
    .from("ledger_entries")
    .delete()
    .in("reference_id", orderIds);
  if (ledgerErr) {
    console.error("Error deleting ledger entries:", ledgerErr);
  } else {
    console.log("Deleted ledger entries successfully.");
  }

  // 2. Delete pickup_jobs for target listings since listings will NOT be deleted
  console.log("Deleting pickup jobs for listings...");
  const { error: pickupErr } = await supabase
    .from("pickup_jobs")
    .delete()
    .in("listing_id", listingIds);
  if (pickupErr) {
    console.error("Error deleting pickup jobs:", pickupErr);
  } else {
    console.log("Deleted pickup jobs successfully.");
  }

  // 3. Delete resale orders (which cascades to payment_transactions, shipments, disputes, buyer_approvals, etc.)
  console.log("Deleting resale orders...");
  const { error: orderErr } = await supabase
    .from("resale_orders")
    .delete()
    .in("id", orderIds);
  if (orderErr) {
    console.error("Error deleting resale orders:", orderErr);
  } else {
    console.log("Deleted resale orders successfully.");
  }

  // 4. Reset target listings status to "live" so they are back on the resell listings marketplace
  console.log("Reactivating listings to 'live' status...");
  const { error: listingErr } = await supabase
    .from("listings")
    .update({ status: "live", confirmed_grade: null })
    .in("id", listingIds);
  if (listingErr) {
    console.error("Error updating listings status:", listingErr);
  } else {
    console.log("Successfully updated listings status to 'live'.");
  }

  console.log("=== Verification of Current Listings status ===");
  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, status");
  console.log(listings);
}

main().catch(console.error);
