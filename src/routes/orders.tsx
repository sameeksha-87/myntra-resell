// src/routes/orders.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { inr } from "@/lib/mock-data";
import {
  ArrowRight,
  PackageCheck,
  Sparkles,
  AlertCircle,
  ShoppingBag,
  Loader2,
  ClipboardList,
  ShoppingCart,
  RefreshCw,
  ChevronRight,
  Package,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { seedUserOrders, publishListing } from "@/integrations/supabase/actions.server";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [{ title: "My Closet & Orders — ReSell by Myntra" }],
  }),
  component: OrdersPage,
});

type Tab = "closet" | "purchases" | "listings";

function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("closet");

  // Closet items (mock Myntra orders)
  const [closetItems, setClosetItems] = useState<any[]>([]);
  const [closetLoading, setClosetLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Purchased items (resale orders bought by the user)
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);

  // Listings uploaded by this user for selling
  const [myListings, setMyListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleGoLive = async (listingId: string) => {
    setPublishingId(listingId);
    try {
      await publishListing({ data: { listingId } });
      toast.success("Listing is now live on the marketplace!");
      fetchMyListings();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish listing");
    } finally {
      setPublishingId(null);
    }
  };

  const fetchCloset = async () => {
    setClosetLoading(true);
    try {
      const { data, error } = await supabase.from("myntra_order_items").select(`
          id,
          title,
          size,
          original_price_paise,
          image,
          quantity,
          status,
          myntra_orders (
            id,
            delivered_at
          ),
          eligibility_decisions (
            eligible,
            reason_code
          )
        `);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSeeding(true);
        // Call server action to seed mock orders for new user
        await seedUserOrders();
        setSeeding(false);

        // Re-fetch
        const { data: refetchedData, error: refetchError } = await supabase.from(
          "myntra_order_items",
        ).select(`
            id,
            title,
            size,
            original_price_paise,
            image,
            quantity,
            status,
            myntra_orders (
              id,
              delivered_at
            ),
            eligibility_decisions (
              eligible,
              reason_code
            )
          `);
        if (refetchError) throw refetchError;
        setClosetItems(refetchedData || []);
      } else {
        setClosetItems(data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load closet orders");
    } finally {
      setClosetLoading(false);
    }
  };

  const fetchPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const { data, error } = await supabase
        .from("resale_orders")
        .select(
          `
          id,
          final_price_paise,
          status,
          created_at,
          listings (
            id,
            title,
            brand,
            size,
            declared_grade,
            confirmed_grade,
            listing_media (
              storage_key
            )
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data ?? []).map((row: any) => {
        const l = row.listings || {};
        const media = l.listing_media || [];
        const imagePath = media[0]?.storage_key || "";
        const publicUrl = imagePath
          ? `${(supabase as any).supabaseUrl}/storage/v1/object/public/resell-photos/${imagePath}`
          : "https://picsum.photos/seed/resell-default/600/750";

        return {
          id: row.id,
          listing_id: l.id,
          title: (l.title || "").split("|||")[0],
          brand: l.brand,
          size: l.size,
          declaredGrade: l.declared_grade,
          confirmedGrade: l.confirmed_grade,
          price: Number(row.final_price_paise) / 100,
          image: publicUrl,
          status: row.status,
          created_at: row.created_at,
        };
      });

      setPurchases(formatted);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load purchases");
    } finally {
      setPurchasesLoading(false);
    }
  };

  const fetchMyListings = async () => {
    setListingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          id,
          title,
          brand,
          size,
          current_price_paise,
          declared_grade,
          confirmed_grade,
          status,
          created_at,
          source_order_item_id,
          listing_media (
            storage_key
          )
        `,
        )
        .eq("seller_id", user!.id)
        .neq("status", "verification_failed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data ?? []).map((l: any) => {
        const media = l.listing_media || [];
        const imagePath = media[0]?.storage_key || "";
        const publicUrl = imagePath
          ? `${(supabase as any).supabaseUrl}/storage/v1/object/public/resell-photos/${imagePath}`
          : "https://picsum.photos/seed/resell-default/600/750";

        return {
          id: l.id,
          title: (l.title || "").split("|||")[0],
          brand: l.brand,
          size: l.size,
          price: Number(l.current_price_paise) / 100,
          image: publicUrl,
          status: l.status,
          created_at: l.created_at,
          source_order_item_id: l.source_order_item_id,
        };
      });

      setMyListings(formatted);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load active listings");
    } finally {
      setListingsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname }, replace: true });
      return;
    }
    if (user) {
      fetchCloset();
      fetchPurchases();
      fetchMyListings();
    }
  }, [user, authLoading, activeTab]);

  // Format reason code into user friendly text
  const getReasonText = (code: string) => {
    switch (code) {
      case "price_below_minimum_threshold":
        return "Original price below ₹3,000 threshold";
      case "item_too_old":
        return "Purchase is more than 3 years old";
      case "brand_not_eligible":
        return "Brand tier not eligible for circular resale";
      default:
        return "Item does not meet eligibility requirements";
    }
  };

  const activeListingItemIds = new Set(
    myListings
      .filter((l) => !["verification_failed", "cancelled", "withdrawn"].includes(l.status))
      .map((l) => l.source_order_item_id),
  );

  const eligibleItems = closetItems.filter(
    (i) => i.eligibility_decisions?.eligible && !activeListingItemIds.has(i.id),
  );
  const ineligibleItems = closetItems.filter((i) => !i.eligibility_decisions?.eligible);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "created":
        return (
          <span className="bg-zinc-100 text-zinc-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Ordered
          </span>
        );
      case "sold":
        return (
          <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Paid (Escrow)
          </span>
        );
      case "in_transit":
        return (
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Shipped
          </span>
        );
      case "delivered":
        return (
          <span className="bg-green-100 text-green-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Delivered
          </span>
        );
      case "buyer_approval_pending":
        return (
          <span className="bg-warning/10 text-warning-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded animate-pulse">
            Action Required
          </span>
        );
      case "disputed":
        return (
          <span className="bg-destructive/10 text-destructive text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Disputed
          </span>
        );
      case "completed":
        return (
          <span className="bg-green-100 text-green-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Completed
          </span>
        );
      case "verified":
        return (
          <span className="bg-verified/15 text-verified text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Verified
          </span>
        );
      case "cancelled":
        return (
          <span className="bg-zinc-100 text-zinc-400 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="bg-zinc-100 text-zinc-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
            {status}
          </span>
        );
    }
  };

  if (
    authLoading ||
    (activeTab === "closet" && closetLoading && !seeding) ||
    (activeTab === "purchases" && purchasesLoading) ||
    (activeTab === "listings" && listingsLoading)
  ) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            {seeding ? "Importing past orders from Myntra..." : "Syncing circular ledger..."}
          </p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-hero py-10 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" /> ReSell Account Hub
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">My Closet & Orders</h1>
          <p className="mt-2 max-w-xl text-white/85">
            Manage your past Myntra orders, list qualifying clothes for resale, or track items you
            purchased on the pre-loved marketplace.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 flex gap-6">
          <button
            onClick={() => setActiveTab("closet")}
            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "closet"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-4 w-4" /> Resell Closet ({closetItems.length})
          </button>
          <button
            onClick={() => setActiveTab("listings")}
            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "listings"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="h-4 w-4" /> My Listings ({myListings.length})
          </button>
          <button
            onClick={() => setActiveTab("purchases")}
            className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "purchases"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> My Purchases ({purchases.length})
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-5xl px-6 py-8">
        {activeTab === "closet" && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-black uppercase tracking-wide">
                Eligible Closet · {eligibleItems.length}
              </h2>
              <p className="text-xs text-muted-foreground">
                Verification-guaranteed · Premium brands · Delivered &lt; 3 years ago
              </p>
            </div>

            {eligibleItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-12 text-center bg-card">
                <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-2 font-bold">No eligible items found</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto text-pretty">
                  Only items purchased on Myntra from premium brands with a purchase price greater
                  than ₹3,000 qualify.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {eligibleItems.map((item) => {
                  const order = item.myntra_orders || {};
                  const dateStr = order.delivered_at
                    ? new Date(order.delivered_at).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })
                    : "Recent";

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-card md:flex-row md:items-center transition-all hover:border-primary/30"
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-28 w-24 flex-shrink-0 rounded-sm object-cover bg-muted border border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          Order #{order.id} · Delivered {dateStr}
                        </div>
                        <div className="mt-1 text-base font-bold text-foreground">Zara</div>
                        <div className="text-sm text-muted-foreground truncate">{item.title}</div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>
                            <b>Size:</b> {item.size}
                          </span>
                          <span>
                            <b>Original Price:</b> {inr(item.original_price_paise / 100)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-success font-semibold">
                            <PackageCheck className="h-3.5 w-3.5" /> Purchase-verified
                          </span>
                        </div>
                      </div>
                      <Link
                        to="/resell/$orderId"
                        params={{ orderId: item.id }}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                      >
                        Resell this <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}

            {ineligibleItems.length > 0 && (
              <div className="mt-12">
                <div className="mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    Ineligible Closet Items · {ineligibleItems.length}
                  </h2>
                </div>
                <div className="grid gap-3 opacity-70">
                  {ineligibleItems.map((item) => {
                    const order = item.myntra_orders || {};
                    const dateStr = order.delivered_at
                      ? new Date(order.delivered_at).toLocaleDateString("en-IN", {
                          month: "short",
                          year: "numeric",
                        })
                      : "Recent";

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 md:flex-row md:items-center"
                      >
                        <img
                          src={item.image}
                          alt={item.title}
                          className="h-20 w-16 flex-shrink-0 rounded-sm object-cover filter grayscale bg-muted border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Delivered {dateStr}
                          </div>
                          <div className="text-sm font-bold text-muted-foreground">
                            {item.title}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                            <span>Size: {item.size}</span>
                            <span>Price: {inr(item.original_price_paise / 100)}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-xs text-destructive font-semibold">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {getReasonText(item.eligibility_decisions?.reason_code)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "purchases" && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide">
                  Order History · {purchases.length}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Track shipments, verify inspection revisions, or open disputes
                </p>
              </div>
              <button
                onClick={fetchPurchases}
                className="p-2 border border-border rounded-full hover:bg-muted text-muted-foreground cursor-pointer"
                title="Refresh order history"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {purchases.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-16 text-center bg-card shadow-sm">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 text-lg font-bold">No purchases yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto text-pretty">
                  Explore the marketplace for premium pre-loved fashion. Authenticated circular
                  economy checkout.
                </p>
                <Link
                  to="/"
                  className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
                >
                  Browse listings
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {purchases.map((purchase) => {
                  const dateStr = new Date(purchase.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <div
                      key={purchase.id}
                      className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-card md:flex-row md:items-center"
                    >
                      <img
                        src={purchase.image}
                        alt={purchase.title}
                        className="h-24 w-20 flex-shrink-0 rounded-sm object-cover bg-muted border border-border"
                      />
                      <div className="flex-1 min-w-0 leading-normal">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ORDER ID: {purchase.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            · Purchased {dateStr}
                          </span>
                          {getStatusBadge(purchase.status)}
                        </div>
                        <div className="mt-1 text-base font-bold text-foreground">
                          {purchase.brand}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {purchase.title}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>
                            <b>Size:</b> {purchase.size}
                          </span>
                          <span>
                            <b>Price Paid:</b> {inr(purchase.price)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        <Link
                          to="/listing/$id"
                          params={{ id: purchase.listing_id }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm text-center"
                        >
                          {purchase.status === "buyer_approval_pending"
                            ? "Resolve Terms"
                            : "Track Order"}{" "}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "listings" && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wide">
                  Active Resell Listings · {myListings.length}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Monitor status, review pricing details, and check verification logs
                </p>
              </div>
              <button
                onClick={fetchMyListings}
                className="p-2 border border-border rounded-full hover:bg-muted text-muted-foreground cursor-pointer"
                title="Refresh listings"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {myListings.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-16 text-center bg-card shadow-sm">
                <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 text-lg font-bold">No active listings</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto text-pretty">
                  Select an eligible item from your closet to list it on Myntra ReSell.
                </p>
                <button
                  onClick={() => setActiveTab("closet")}
                  className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
                >
                  View resell closet
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {myListings.map((listing) => {
                  const dateStr = new Date(listing.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <div
                      key={listing.id}
                      className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-card md:flex-row md:items-center"
                    >
                      <img
                        src={listing.image}
                        alt={listing.title}
                        className="h-24 w-20 flex-shrink-0 rounded-sm object-cover bg-muted border border-border"
                      />
                      <div className="flex-1 min-w-0 leading-normal">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            LISTING ID: {listing.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            · Listed {dateStr}
                          </span>
                          {getStatusBadge(listing.status)}
                        </div>
                        <div className="mt-1 text-base font-bold text-foreground">
                          {listing.brand}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {listing.title}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          <span>
                            <b>Size:</b> {listing.size}
                          </span>
                          <span>
                            <b>Listing Price:</b> {inr(listing.price)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        {listing.status === "verified" ? (
                          <>
                            <button
                              onClick={() => handleGoLive(listing.id)}
                              disabled={publishingId === listing.id}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-verified px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-verified/90 transition-all cursor-pointer shadow-sm text-center disabled:opacity-50"
                            >
                              {publishingId === listing.id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing...
                                </>
                              ) : (
                                <>Go Live</>
                              )}
                            </button>
                            <Link
                              to="/listing/$id"
                              params={{ id: listing.id }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted transition-all cursor-pointer text-center"
                            >
                              Details
                            </Link>
                          </>
                        ) : (
                          <Link
                            to="/listing/$id"
                            params={{ id: listing.id }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm text-center"
                          >
                            Track Status <ChevronRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-12 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Not seeing an order? Only premium-brand orders within 3 years qualify for ReSell today.{" "}
          <Link to="/" className="text-primary font-semibold hover:underline">
            Browse the marketplace
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
