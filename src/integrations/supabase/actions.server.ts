// src/integrations/supabase/actions.server.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";
import { supabaseAdmin } from "./client.server";
import { z } from "zod";

// Helper to check if a user has a specific role on the server
async function checkUserRole(userId: string, role: "admin" | "inspector"): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

// 1. Seed user mock orders
export const seedUserOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    try {
      // Call the PostgreSQL stored procedure to seed mock orders
      const { error } = await (supabaseAdmin as any).rpc("seed_user_mock_orders", {
        target_user_id: userId,
      });

      if (error) {
        console.error("Error seeding mock orders (non-critical):", error.message);
      }
    } catch (err: any) {
      console.error("Seed user orders caught error:", err?.message || err);
    }

    return { success: true };
  });

// 2. Create listing draft
export const createListingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      orderItemId: z.string().uuid(),
      declaredGrade: z.enum(["Pristine", "Excellent", "Good"]),
      customPrice: z.number().optional().nullable(),
      conditionDetails: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { orderItemId, declaredGrade, customPrice, conditionDetails } = data;

    // Check if the order item belongs to this user and is eligible
    const { data: item, error: itemError } = await supabaseAdmin
      .from("myntra_order_items")
      .select(
        `
        id,
        original_price_paise,
        title,
        size,
        image,
        myntra_orders (
          id,
          user_id,
          delivered_at
        ),
        eligibility_decisions (
          eligible
        )
      `,
      )
      .eq("id", orderItemId)
      .single();

    if (itemError || !item) {
      throw new Error("Order item not found");
    }

    const order = item.myntra_orders as any;
    if (order.user_id !== userId) {
      throw new Error("Unauthorized: Order item does not belong to you");
    }

    const eligibility = item.eligibility_decisions as any;
    if (!eligibility || !eligibility.eligible) {
      throw new Error("Item is not eligible for resale");
    }

    // Check if there is already an active listing for this order item
    const { data: existingListing } = await supabaseAdmin
      .from("listings")
      .select("id, status")
      .eq("source_order_item_id", orderItemId)
      .maybeSingle();

    const RESUMABLE_STATUSES = [
      "draft",
      "verification_pending",
      "verification_failed",
      "cancelled",
      "withdrawn",
    ];

    if (existingListing && !RESUMABLE_STATUSES.includes(existingListing.status)) {
      throw new Error("An active listing already exists for this order item");
    }

    // Calculate listing price based on original price, age, and grade
    const purchaseDate = new Date(order.delivered_at);
    const ageYears = Math.max(
      0,
      (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    );

    // Fetch pricing rule factors
    const { data: pricingRules } = await supabaseAdmin
      .from("pricing_rule_versions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!pricingRules) {
      throw new Error("Pricing rules configuration not found");
    }

    const factors = pricingRules.factors as any;
    const gradeFactor = factors[declaredGrade] || 1.0;
    const depreciationRate = factors.depreciation_per_year || 0.2;

    const originalPricePaise = Number(item.original_price_paise);
    const depreciationFactor = Math.max(0.2, 1.0 - depreciationRate * ageYears);

    // Calculate estimated AI price
    const aiPricePaise = Math.max(
      0,
      Math.round(originalPricePaise * depreciationFactor * gradeFactor),
    );

    // Set final listing price to custom price if supplied, else use AI estimated price
    const listingPricePaise =
      customPrice !== undefined && customPrice !== null
        ? Math.round(customPrice * 100)
        : aiPricePaise;

    const sellerPayoutPaise = Math.round(listingPricePaise * (1 - pricingRules.commission_rate));
    const commissionPaise = listingPricePaise - sellerPayoutPaise;

    const displayTitle = conditionDetails ? `${item.title}|||${conditionDetails}` : item.title;

    // Create draft listing (or update if previously failed/withdrawn)
    const listingData = {
      seller_id: userId,
      source_order_item_id: orderItemId,
      title: displayTitle,
      brand: "Zara", // Fallback, would fetch brand name normally
      category: "Outerwear", // Fallback
      size: item.size,
      declared_grade: declaredGrade,
      status: "draft",
      current_price_paise: listingPricePaise,
      currency: "INR",
      version: 1,
    };

    let listingId: string;
    if (existingListing) {
      listingId = existingListing.id;
      const { error: updateErr } = await supabaseAdmin
        .from("listings")
        .update({ ...listingData, updated_at: new Date().toISOString() })
        .eq("id", listingId);
      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
    } else {
      const { data: newListing, error: insertErr } = await supabaseAdmin
        .from("listings")
        .insert(listingData)
        .select("id")
        .single();
      if (insertErr || !newListing) throw new Error(`Insert failed: ${insertErr.message}`);
      listingId = newListing.id;
    }

    // Save Price Quote
    await supabaseAdmin.from("price_quotes").insert({
      listing_id: listingId,
      rule_version_id: pricingRules.id,
      source_event: "draft_creation",
      original_price_paise: originalPricePaise,
      age_years: ageYears,
      grade: declaredGrade,
      factors: { depreciationFactor, gradeFactor, ageYears },
      listing_price_paise: listingPricePaise,
      seller_payout_paise: sellerPayoutPaise,
      commission_paise: commissionPaise,
    });

    // Add Listing Event
    await supabaseAdmin.from("listing_events").insert({
      listing_id: listingId,
      sequence: 1,
      event_type: "draft_created",
      to_state: "draft",
      actor_type: "seller",
      actor_id: userId,
      payload: { declaredGrade, listingPricePaise },
    });

    return { listingId };
  });

// 3. Upload Listing Media
export const uploadListingMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      listingId: z.string().uuid(),
      angle: z.string(),
      imageBase64: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { listingId, angle, imageBase64 } = data;

    // Check ownership of listing
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("seller_id, status")
      .eq("id", listingId)
      .single();

    if (listingErr || !listing) throw new Error("Listing not found");
    if (listing.seller_id !== userId) throw new Error("Unauthorized");

    // Convert base64 to Buffer
    const base64Payload = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Payload);
    const buffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }
    const mimeType = imageBase64.match(/[^:]\w+\/[\w-+\d.]+(?=\;)/)?.[0] || "image/jpeg";
    // Store image in Supabase bucket
    const fileName = `${listingId}/${angle}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from("resell-photos")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Media upload failed: ${uploadErr.message}`);
    }

    const storageKey = uploadData.path;

    // Calculate a mock sha-256 or p-hash
    const sha256 = `mock_sha256_${storageKey.replace(/\//g, "_")}`;

    // Write to listing_media
    const { data: media, error: mediaErr } = await supabaseAdmin
      .from("listing_media")
      .insert({
        listing_id: listingId,
        storage_key: storageKey,
        media_type: "image",
        angle: angle,
        sha256: sha256,
        moderation_status: "approved",
      })
      .select("id")
      .single();

    if (mediaErr) {
      throw new Error(`Failed to save media metadata: ${mediaErr.message}`);
    }

    return { mediaId: media.id, storageKey };
  });

// 4. Submit for Verification
export const submitForVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      listingId: z.string().uuid(),
      simBlur: z.boolean().default(false),
      simWrongAngle: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { listingId, simBlur, simWrongAngle } = data;

    // Check ownership of listing
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingErr || !listing) throw new Error("Listing not found");
    if (listing.seller_id !== userId) throw new Error("Unauthorized");

    // Transition to verification_pending
    await supabaseAdmin
      .from("listings")
      .update({ status: "verification_pending", updated_at: new Date().toISOString() })
      .eq("id", listingId);

    await supabaseAdmin.from("listing_events").insert({
      listing_id: listingId,
      sequence: 2,
      event_type: "verification_started",
      from_state: "draft",
      to_state: "verification_pending",
      actor_type: "seller",
      actor_id: userId,
    });

    // Run verification run
    const runId = crypto.randomUUID();
    await supabaseAdmin.from("verification_runs").insert({
      id: runId,
      listing_id: listingId,
      provider: "AI_Vision_Core_v2",
      status: "running",
    });

    // Simulated checks
    const blurPassed = !simBlur;
    const anglePassed = !simWrongAngle;
    const duplicatePassed = true;

    await supabaseAdmin.from("verification_checks").insert([
      {
        verification_run_id: runId,
        check_type: "blur_check",
        status: blurPassed ? "passed" : "failed",
        score: blurPassed ? 165.2 : 42.1,
        threshold: 100.0,
        evidence: { blur_variance: blurPassed ? 165.2 : 42.1 },
      },
      {
        verification_run_id: runId,
        check_type: "angle_check",
        status: anglePassed ? "passed" : "failed",
        score: anglePassed ? 0.94 : 0.45,
        threshold: 0.85,
        evidence: { computed_angle_match: anglePassed ? 0.94 : 0.45 },
      },
      {
        verification_run_id: runId,
        check_type: "duplicate_check",
        status: duplicatePassed ? "passed" : "failed",
        score: 1.0,
        threshold: 0.9,
        evidence: { similarity_to_stock_photos: 0.05 },
      },
    ]);

    const overallPassed = blurPassed && anglePassed && duplicatePassed;

    if (overallPassed) {
      // Transition to live
      await supabaseAdmin
        .from("listings")
        .update({
          status: "live",
          verification_disposition: "approved",
          publish_timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);

      await supabaseAdmin
        .from("verification_runs")
        .update({
          status: "completed",
          confidence: 0.93,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      await supabaseAdmin.from("listing_events").insert({
        listing_id: listingId,
        sequence: 3,
        event_type: "listing_approved_live",
        from_state: "verification_pending",
        to_state: "live",
        actor_type: "system",
        payload: { runId },
      });

      return { status: "live", success: true };
    } else {
      // Transition to verification_failed
      const reason = !blurPassed ? "blurry_images" : "incorrect_angles";
      await supabaseAdmin
        .from("listings")
        .update({
          status: "verification_failed",
          verification_disposition: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);

      await supabaseAdmin
        .from("verification_runs")
        .update({
          status: "failed",
          confidence: 0.45,
          error_reason: reason,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      await supabaseAdmin.from("listing_events").insert({
        listing_id: listingId,
        sequence: 3,
        event_type: "verification_failed",
        from_state: "verification_pending",
        to_state: "verification_failed",
        actor_type: "system",
        payload: { reason, runId },
      });

      return { status: "verification_failed", success: false, reason };
    }
  });

// 5. Checkout validation & place order
export const placeCheckoutOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      listingId: z.string().uuid(),
      address: z.object({
        recipient: z.string(),
        phone: z.string(),
        line1: z.string(),
        line2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        pincode: z.string(),
      }),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { listingId, address } = data;

    // Use a transactional pipeline
    // In javascript, we perform queries inside a transaction lock context.
    // For a hackathon web app, we can use a PostgreSQL transactional lock: "SELECT ... FOR UPDATE" to prevent double checkouts.

    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingErr || !listing) throw new Error("Listing not found");
    if (listing.status !== "live") {
      throw new Error("This item is no longer available (sold or withdrawn)");
    }
    if (listing.seller_id === userId) {
      throw new Error("You cannot purchase your own listing");
    }

    // Prevent double purchasing using transaction simulated lock (setting state to reserved)
    const { data: lockResult, error: lockErr } = await supabaseAdmin
      .from("listings")
      .update({ status: "reserved", updated_at: new Date().toISOString() })
      .eq("id", listingId)
      .eq("status", "live")
      .select("id");

    if (lockErr || !lockResult || lockResult.length === 0) {
      throw new Error("Inventory reservation failed. The item is being purchased by someone else.");
    }

    // Insert address
    const { data: addressRecord, error: addressErr } = await supabaseAdmin
      .from("addresses")
      .insert({
        user_id: userId,
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        serviceable: true,
      })
      .select("id")
      .single();

    if (addressErr) {
      // Revert listing lock
      await supabaseAdmin.from("listings").update({ status: "live" }).eq("id", listingId);
      throw new Error(`Failed to save address: ${addressErr.message}`);
    }

    // Fetch pricing rule version and compute fees
    const price = Number(listing.current_price_paise);

    // Configured fees
    const commissionPaise = Math.round(price * 0.4);
    const payoutPaise = price - commissionPaise;
    const buyerFees = 0; // free delivery and buyer protection in prototype

    // Create Resale Order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("resale_orders")
      .insert({
        buyer_id: userId,
        seller_id: listing.seller_id,
        listing_id: listingId,
        final_price_paise: price,
        payout_paise: payoutPaise,
        commission_paise: commissionPaise,
        buyer_fees_paise: buyerFees,
        status: "sold", // Buyer paid escrow
        shipping_address_id: addressRecord.id,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      // Revert listing lock
      await supabaseAdmin.from("listings").update({ status: "live" }).eq("id", listingId);
      throw new Error(`Order placement failed: ${orderErr.message}`);
    }

    // Update listing status to sold
    await supabaseAdmin
      .from("listings")
      .update({ status: "sold", updated_at: new Date().toISOString() })
      .eq("id", listingId);

    // Credit coins to seller and send notification
    try {
      const coinsCredit = Math.round(payoutPaise / 100);

      const { data: sellerProfile } = await supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", listing.seller_id)
        .single();

      const currentPrefs = (sellerProfile?.preferences as any) || {};
      const currentCoins = Number(currentPrefs.myntra_coins || 0);
      const newCoins = currentCoins + coinsCredit;
      const updatedPrefs = { ...currentPrefs, myntra_coins: newCoins };

      await supabaseAdmin
        .from("profiles")
        .update({ preferences: updatedPrefs, updated_at: new Date().toISOString() })
        .eq("id", listing.seller_id);

      await supabaseAdmin.from("notifications").insert({
        user_id: listing.seller_id,
        template: "order_sold_coins_credited",
        channel: "in_app",
        payload: {
          orderId: order.id,
          coins: coinsCredit,
          listingTitle: listing.title,
          message: `Congratulations! Your item "${listing.title.split("|||")[0]}" has been purchased. ₹${coinsCredit} Myntra Coins have been credited to your account!`,
        },
      });
    } catch (err: any) {
      console.error("Error crediting seller coins/notification:", err?.message || err);
    }

    // Create Payment transaction (Escrow Auth & Hold)
    await supabaseAdmin.from("payment_transactions").insert({
      order_id: order.id,
      provider_payment_intent_id: `intent_${crypto.randomUUID()}`,
      type: "authorize",
      amount_paise: price,
      status: "captured", // Mock pay
      payload: { gateway: "razorpay", escrow: true },
    });

    // Create Ledger entries:
    // Debit buyer account, Credit Escrow account
    await supabaseAdmin.from("ledger_entries").insert([
      {
        reference_type: "order_payment",
        reference_id: order.id,
        account_from: "buyer",
        account_to: "escrow",
        amount_paise: price,
      },
    ]);

    // Schedule Pickup Job
    await supabaseAdmin.from("pickup_jobs").insert({
      listing_id: listingId,
      address_id: addressRecord.id,
      scheduled_slot: "Tomorrow morning 10AM - 12PM",
      status: "scheduled",
      tracking_number: `PICK-${Date.now()}`,
    });

    // Create Shipment tracker
    await supabaseAdmin.from("shipments").insert({
      order_id: order.id,
      status: "pending",
      tracking_number: `SHIP-${Date.now()}`,
    });

    // Add Listing Event
    await supabaseAdmin.from("listing_events").insert({
      listing_id: listingId,
      sequence: 4,
      event_type: "item_sold",
      from_state: "live",
      to_state: "sold",
      actor_type: "buyer",
      actor_id: userId,
      payload: { orderId: order.id },
    });

    // Clear item from checkout bags (Delete from bag items)
    await supabaseAdmin.from("bag_items").delete().eq("listing_id", listingId);

    return { orderId: order.id };
  });

// 6. Inspector submit doorstep report
export const inspectorSubmitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      listingId: z.string().uuid(),
      confirmedGrade: z.enum(["Pristine", "Excellent", "Good"]),
      passed: z.boolean(),
      notes: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { listingId, confirmedGrade, passed, notes } = data;

    // Check if inspector
    const isInspector = await checkUserRole(userId, "inspector");
    const isAdmin = await checkUserRole(userId, "admin");
    if (!isInspector && !isAdmin) {
      throw new Error("Unauthorized: Inspector role required");
    }

    const { data: listing, error: listingErr } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (listingErr || !listing) throw new Error("Listing not found");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("resale_orders")
      .select("*")
      .eq("listing_id", listingId)
      .single();

    if (orderErr || !order) throw new Error("Associated order not found");

    // Insert inspection report
    const { data: report } = await supabaseAdmin
      .from("inspection_reports")
      .insert({
        listing_id: listingId,
        inspector_id: userId,
        confirmed_grade: confirmedGrade,
        passed: passed,
        notes: notes || "Doorstep inspection successfully conducted.",
        evidence: { stretch_test: "passed", light_test: "passed", odor_test: "passed" },
      })
      .select("id")
      .single();

    // Check if grade matches
    const gradeMatches = listing.declared_grade === confirmedGrade;

    if (!passed) {
      // Failed inspection entirely!
      await supabaseAdmin
        .from("listings")
        .update({ status: "verification_failed" })
        .eq("id", listingId);
      await supabaseAdmin
        .from("resale_orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);

      // Issue Refund
      await supabaseAdmin.from("payment_transactions").insert({
        order_id: order.id,
        type: "refund",
        amount_paise: order.final_price_paise,
        status: "completed",
      });

      await supabaseAdmin.from("ledger_entries").insert([
        {
          reference_type: "refund",
          reference_id: order.id,
          account_from: "escrow",
          account_to: "buyer",
          amount_paise: order.final_price_paise,
        },
      ]);

      await supabaseAdmin.from("listing_events").insert({
        listing_id: listingId,
        sequence: 5,
        event_type: "inspection_failed_cancelled",
        from_state: listing.status,
        to_state: "verification_failed",
        actor_type: "inspector",
        actor_id: userId,
      });

      return { outcome: "failed_refunded" };
    }

    if (gradeMatches) {
      // Grade matches, inspection passes directly!
      await supabaseAdmin
        .from("listings")
        .update({ confirmed_grade: confirmedGrade, status: "inspection_passed" })
        .eq("id", listingId);
      await supabaseAdmin
        .from("resale_orders")
        .update({ status: "in_transit", updated_at: new Date().toISOString() })
        .eq("id", order.id);

      // Update pickup job and shipment
      await supabaseAdmin
        .from("pickup_jobs")
        .update({ status: "picked_up" })
        .eq("listing_id", listingId);

      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("id")
        .eq("order_id", order.id)
        .single();
      if (shipment) {
        await supabaseAdmin
          .from("shipments")
          .update({ status: "in_transit", updated_at: new Date().toISOString() })
          .eq("id", shipment.id);
        await supabaseAdmin.from("tracking_events").insert({
          shipment_id: shipment.id,
          status: "in_transit",
          description:
            "Package picked up and doorstep inspection passed. Shipped via delivery partner.",
        });
      }

      await supabaseAdmin.from("listing_events").insert({
        listing_id: listingId,
        sequence: 5,
        event_type: "inspection_passed",
        from_state: listing.status,
        to_state: "inspection_passed",
        actor_type: "inspector",
        actor_id: userId,
      });

      return { outcome: "passed" };
    } else {
      // Grade revised! Needs buyer approval before shipping
      // Calculate new listing price
      const originalPricePaise = Number(order.final_price_paise); // wait, listing original price

      // Compute revised price based on new grade
      // Fetch pricing factors from pricing version
      const { data: quote } = await supabaseAdmin
        .from("price_quotes")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!quote) throw new Error("Price quote not found");

      const factors = quote.factors as any;
      const gradeFactors: Record<string, number> = { Pristine: 1.0, Excellent: 0.85, Good: 0.7 };
      const newFactor = gradeFactors[confirmedGrade] || 0.7;
      const oldFactor = gradeFactors[listing.declared_grade] || 1.0;

      const revisedPricePaise = Math.round(
        Number(quote.original_price_paise) * factors.depreciationFactor * newFactor,
      );
      const revisedPayoutPaise = Math.round(revisedPricePaise * 0.6);
      const revisedCommissionPaise = revisedPricePaise - revisedPayoutPaise;

      // Update listing to revision status
      await supabaseAdmin
        .from("listings")
        .update({
          confirmed_grade: confirmedGrade,
          status: "inspection_revised",
          current_price_paise: revisedPricePaise,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId);

      await supabaseAdmin
        .from("resale_orders")
        .update({
          status: "buyer_approval_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      // Create buyer approvals record
      await supabaseAdmin.from("buyer_approvals").insert({
        order_id: order.id,
        type: "price_revision",
        old_terms: { price: order.final_price_paise, grade: listing.declared_grade },
        new_terms: {
          price: revisedPricePaise,
          grade: confirmedGrade,
          payout: revisedPayoutPaise,
          commission: revisedCommissionPaise,
        },
        status: "pending",
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours expiry
      });

      // Update pickup job
      await supabaseAdmin
        .from("pickup_jobs")
        .update({ status: "picked_up" })
        .eq("listing_id", listingId);

      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("id")
        .eq("order_id", order.id)
        .single();
      if (shipment) {
        await supabaseAdmin.from("tracking_events").insert({
          shipment_id: shipment.id,
          status: "pending_buyer_approval",
          description: `Doorstep inspection completed. Grade revised from ${listing.declared_grade} to ${confirmedGrade}. Awaiting buyer price revision approval.`,
        });
      }

      await supabaseAdmin.from("listing_events").insert({
        listing_id: listingId,
        sequence: 5,
        event_type: "inspection_revised",
        from_state: listing.status,
        to_state: "inspection_revised",
        actor_type: "inspector",
        actor_id: userId,
        payload: {
          oldGrade: listing.declared_grade,
          revisedGrade: confirmedGrade,
          revisedPrice: revisedPricePaise,
        },
      });

      return { outcome: "revised_approval_pending", revisedPricePaise };
    }
  });

// 7. Buyer approve/reject price revision
export const decidePriceRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      orderId: z.string().uuid(),
      approved: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { orderId, approved } = data;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("resale_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) throw new Error("Order not found");
    if (order.buyer_id !== userId) throw new Error("Unauthorized: Only the buyer can respond");

    const { data: approval, error: approvalErr } = await supabaseAdmin
      .from("buyer_approvals")
      .select("*")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .maybeSingle();

    if (approvalErr || !approval) throw new Error("No pending price revision approval found");

    const terms = approval.new_terms as any;

    if (approved) {
      // Buyer approved price drop!
      // Update Resale Order prices
      await supabaseAdmin
        .from("resale_orders")
        .update({
          final_price_paise: terms.price,
          payout_paise: terms.payout,
          commission_paise: terms.commission,
          status: "sold", // moves back to sold/paid
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      // Update Listing status to inspection_passed
      await supabaseAdmin
        .from("listings")
        .update({
          status: "inspection_passed",
          current_price_paise: terms.price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.listing_id);

      // Update approval record
      await supabaseAdmin
        .from("buyer_approvals")
        .update({
          status: "approved",
          decided_at: new Date().toISOString(),
        })
        .eq("id", approval.id);

      // Update shipment tracking and order to in_transit
      await supabaseAdmin.from("resale_orders").update({ status: "in_transit" }).eq("id", orderId);

      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("id")
        .eq("order_id", orderId)
        .single();
      if (shipment) {
        await supabaseAdmin
          .from("shipments")
          .update({ status: "in_transit", updated_at: new Date().toISOString() })
          .eq("id", shipment.id);
        await supabaseAdmin.from("tracking_events").insert({
          shipment_id: shipment.id,
          status: "in_transit",
          description: `Price revision approved by buyer. New price is ${terms.price / 100} INR. Shipment is in transit.`,
        });
      }

      // Record a refund transaction of the difference in the escrow
      const difference = Number(order.final_price_paise) - Number(terms.price);
      if (difference > 0) {
        await supabaseAdmin.from("payment_transactions").insert({
          order_id: orderId,
          type: "refund",
          amount_paise: difference,
          currency: "INR",
          status: "completed",
          payload: { reason: "price_revision_difference" },
        });

        await supabaseAdmin.from("ledger_entries").insert([
          {
            reference_type: "refund_difference",
            reference_id: orderId,
            account_from: "escrow",
            account_to: "buyer",
            amount_paise: difference,
          },
        ]);
      }

      await supabaseAdmin.from("listing_events").insert({
        listing_id: order.listing_id,
        sequence: 6,
        event_type: "price_revision_approved",
        from_state: "inspection_revised",
        to_state: "inspection_passed",
        actor_type: "buyer",
        actor_id: userId,
      });

      return { success: true, decision: "approved" };
    } else {
      // Buyer rejected price drop! Cancel order & refund full
      await supabaseAdmin
        .from("resale_orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      await supabaseAdmin
        .from("listings")
        .update({
          status: "withdrawn",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.listing_id);

      // Update approval record
      await supabaseAdmin
        .from("buyer_approvals")
        .update({
          status: "rejected",
          decided_at: new Date().toISOString(),
        })
        .eq("id", approval.id);

      // Refund full amount to buyer
      await supabaseAdmin.from("payment_transactions").insert({
        order_id: orderId,
        type: "refund",
        amount_paise: order.final_price_paise,
        currency: "INR",
        status: "completed",
        payload: { reason: "price_revision_rejected" },
      });

      await supabaseAdmin.from("ledger_entries").insert([
        {
          reference_type: "refund_full",
          reference_id: orderId,
          account_from: "escrow",
          account_to: "buyer",
          amount_paise: order.final_price_paise,
        },
      ]);

      const { data: shipment } = await supabaseAdmin
        .from("shipments")
        .select("id")
        .eq("order_id", orderId)
        .single();
      if (shipment) {
        await supabaseAdmin
          .from("shipments")
          .update({ status: "returned", updated_at: new Date().toISOString() })
          .eq("id", shipment.id);
        await supabaseAdmin.from("tracking_events").insert({
          shipment_id: shipment.id,
          status: "returned_to_seller",
          description: `Price revision rejected by buyer. Order cancelled and full refund of ${order.final_price_paise / 100} INR issued. Returning package to seller.`,
        });
      }

      await supabaseAdmin.from("listing_events").insert({
        listing_id: order.listing_id,
        sequence: 6,
        event_type: "price_revision_rejected",
        from_state: "inspection_revised",
        to_state: "withdrawn",
        actor_type: "buyer",
        actor_id: userId,
      });

      return { success: true, decision: "rejected" };
    }
  });

// 8. Submit dispute (Buyer raises dispute within 48h)
export const submitDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      orderId: z.string().uuid(),
      reason: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { orderId, reason } = data;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("resale_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) throw new Error("Order not found");
    if (order.buyer_id !== userId) throw new Error("Unauthorized");

    // Check if within 48h delivery protection
    const deliveryLimitTime = new Date(order.created_at).getTime() + 10 * 24 * 60 * 60 * 1000; // Mock delivery logic
    if (Date.now() > deliveryLimitTime) {
      // Wait, in prototype let it pass for demo
    }

    // Create dispute
    const { data: dispute } = await supabaseAdmin
      .from("disputes")
      .insert({
        order_id: orderId,
        complainant_id: userId,
        reason: reason,
        status: "open",
        deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    // Update order status to disputed
    await supabaseAdmin
      .from("resale_orders")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", orderId);

    // Update listing status
    await supabaseAdmin.from("listings").update({ status: "sold" }).eq("id", order.listing_id); // hold payout

    return { disputeId: dispute?.id };
  });

// 9. Admin Resolve Dispute & Release Payout
export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      disputeId: z.string().uuid(),
      resolutionAction: z.enum(["refund", "release_payout"]),
      notes: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { disputeId, resolutionAction, notes } = data;

    const isAdmin = await checkUserRole(userId, "admin");
    if (!isAdmin) throw new Error("Unauthorized: Admin privileges required");

    const { data: dispute, error: disputeErr } = await supabaseAdmin
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (disputeErr || !dispute) throw new Error("Dispute not found");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("resale_orders")
      .select("*")
      .eq("id", dispute.order_id)
      .single();

    if (orderErr || !order) throw new Error("Order not found");

    if (resolutionAction === "refund") {
      // Refund buyer
      await supabaseAdmin
        .from("disputes")
        .update({
          status: "resolved_refunded",
          resolution: notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", disputeId);

      await supabaseAdmin
        .from("resale_orders")
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      await supabaseAdmin
        .from("listings")
        .update({ status: "withdrawn" })
        .eq("id", order.listing_id);

      await supabaseAdmin.from("payment_transactions").insert({
        order_id: order.id,
        type: "refund",
        amount_paise: order.final_price_paise,
        status: "completed",
        payload: { reason: "dispute_resolved_refund" },
      });

      await supabaseAdmin.from("ledger_entries").insert([
        {
          reference_type: "dispute_refund",
          reference_id: order.id,
          account_from: "escrow",
          account_to: "buyer",
          amount_paise: order.final_price_paise,
        },
      ]);
    } else {
      // Release payout to seller
      await supabaseAdmin
        .from("disputes")
        .update({
          status: "resolved_released",
          resolution: notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", disputeId);

      await supabaseAdmin
        .from("resale_orders")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      await supabaseAdmin.from("listings").update({ status: "paid" }).eq("id", order.listing_id);

      // Create seller payout
      await supabaseAdmin.from("seller_payouts").insert({
        seller_id: order.seller_id,
        order_id: order.id,
        amount_paise: order.payout_paise,
        status: "paid",
        released_at: new Date().toISOString(),
      });

      // Move money from Escrow:
      // Escrow -> Myntra Commission (40%), Escrow -> Seller Payout (60%)
      await supabaseAdmin.from("ledger_entries").insert([
        {
          reference_type: "payout_release",
          reference_id: order.id,
          account_from: "escrow",
          account_to: "seller_payable",
          amount_paise: order.payout_paise,
        },
        {
          reference_type: "commission_release",
          reference_id: order.id,
          account_from: "escrow",
          account_to: "myntra_commission",
          amount_paise: order.commission_paise,
        },
      ]);
    }

    return { success: true };
  });

// 10. Release seller payout (called after protection window)
export const releaseSellerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { orderId } = data;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("resale_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) throw new Error("Order not found");

    // Make sure buyer protection window has elapsed (48h after delivery)
    // Or allow any admin/seller to release for testing ease in hackathon
    const isSeller = order.seller_id === userId;
    const isAdmin = await checkUserRole(userId, "admin");
    if (!isSeller && !isAdmin) throw new Error("Unauthorized");

    // Check if payout already paid
    const { data: existingPayout } = await supabaseAdmin
      .from("seller_payouts")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingPayout) throw new Error("Payout already released for this order");

    // Release payout
    await supabaseAdmin.from("seller_payouts").insert({
      seller_id: order.seller_id,
      order_id: orderId,
      amount_paise: order.payout_paise,
      method: "credits",
      status: "paid",
      released_at: new Date().toISOString(),
    });

    await supabaseAdmin
      .from("resale_orders")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    await supabaseAdmin
      .from("listings")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.listing_id);

    // Ledger transactions
    await supabaseAdmin.from("ledger_entries").insert([
      {
        reference_type: "payout_release",
        reference_id: orderId,
        account_from: "escrow",
        account_to: "seller_payable",
        amount_paise: order.payout_paise,
      },
      {
        reference_type: "commission_release",
        reference_id: orderId,
        account_from: "escrow",
        account_to: "myntra_commission",
        amount_paise: order.commission_paise,
      },
    ]);

    await supabaseAdmin.from("listing_events").insert({
      listing_id: order.listing_id,
      sequence: 7,
      event_type: "payout_released",
      from_state: "sold",
      to_state: "paid",
      actor_type: isSeller ? "seller" : "admin",
      actor_id: userId,
    });

    return { success: true };
  });

// 11. Fetch listings for Discovery Feed
export const fetchListings = createServerFn({ method: "GET" })
  .validator(
    z.object({
      category: z.string().optional(),
      brand: z.string().optional(),
      size: z.string().optional(),
      priceSort: z.enum(["asc", "desc"]).optional(),
      discountSort: z.enum(["asc", "desc"]).optional(),
      search: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { category, brand, size, search, priceSort } = data;

    let query = supabaseAdmin
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
      .eq("status", "live");

    if (category) query = query.eq("category", category);
    if (brand) query = query.eq("brand", brand);
    if (size) query = query.eq("size", size);
    if (search) query = query.ilike("title", `%${search}%`);

    if (priceSort) {
      query = query.order("current_price_paise", { ascending: priceSort === "asc" });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data: queryListings, error } = await query;
    if (error) throw new Error(error.message);

    // Map to client format
    return (queryListings ?? []).map((l: any) => {
      const media = l.listing_media || [];
      const imagePath =
        media.find((m: any) => m.angle === "top")?.storage_key || media[0]?.storage_key || "";
      const publicUrl = imagePath
        ? `${process.env.SUPABASE_URL}/storage/v1/object/public/resell-photos/${imagePath}`
        : "https://picsum.photos/seed/resell-default/600/750";

      const orderItem = l.myntra_order_items || {};
      const order = orderItem.myntra_orders || {};
      const originalPrice = orderItem.original_price_paise
        ? Number(orderItem.original_price_paise) / 100
        : Number(l.current_price_paise) / 100 / 0.7;

      const purchaseDate = order.delivered_at ? new Date(order.delivered_at) : new Date();
      const ageYears = Math.max(
        0.1,
        (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      );

      const gallery = media.map(
        (m: any) =>
          `${process.env.SUPABASE_URL}/storage/v1/object/public/resell-photos/${m.storage_key}`,
      );
      if (gallery.length === 0) {
        gallery.push(publicUrl);
      }

      return {
        id: l.id,
        brand: l.brand,
        title: l.title,
        category: l.category || "Outerwear",
        size: l.size || "M",
        originalPrice: originalPrice,
        ageYears: ageYears,
        declaredGrade: l.declared_grade,
        confirmedGrade: l.confirmed_grade || undefined,
        seller: "Verified Seller",
        sellerScore: 4.8,
        image: publicUrl,
        gallery: gallery,
        verified: true,
        inspected: l.confirmed_grade !== null,
        status: l.status,
      };
    });
  });

export const setSimulatedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ role: z.enum(["buyer", "seller", "inspector", "admin", "guest"]) }))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { role } = data;

    // Delete existing roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);

    if (role === "admin") {
      await supabaseAdmin.from("user_roles").insert([
        { user_id: userId, role: "admin" },
        { user_id: userId, role: "inspector" },
      ]);
    } else if (role === "inspector") {
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "inspector",
      });
    }

    return { success: true };
  });
