import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name");
  
  if (error) {
    console.error("Error fetching categories:", error);
    return;
  }
  
  console.log("Categories in DB:");
  console.log(JSON.stringify(categories, null, 2));

  const { data: listings, error: listingsErr } = await supabase
    .from("listings")
    .select("id, title, brand, category, status");

  if (listingsErr) {
    console.error("Error fetching listings:", listingsErr);
    return;
  }

  console.log("Listings in DB:");
  console.log(JSON.stringify(listings, null, 2));
}

main();
