import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

async function main() {
  const targetCategoryId = "5f163d0f-8e56-4003-b58e-370699d792df"; // Shoes category ID
  console.log(`Filtering listings by category_id = ${targetCategoryId}...`);

  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      title,
      myntra_order_items!inner (
        id,
        category_id
      )
    `,
    )
    .eq("myntra_order_items.category_id", targetCategoryId);

  if (error) {
    console.error("Error filtering listings:", error);
  } else {
    console.log("Filtered Listings:", data);
  }
}

main().catch(console.error);
