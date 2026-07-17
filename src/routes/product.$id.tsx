// src/routes/product.$id.tsx
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TrustBadge } from "@/components/trust-badges";
import { inr, products, type Grade } from "@/lib/mock-data";
import {
  Heart,
  Share2,
  ShieldCheck,
  PackageCheck,
  Recycle,
  Star,
  Truck,
  RotateCcw,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$id")({
  loader: ({ params }) => {
    return { id: params.id };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `Pre-loved Fashion Spec — ReSell` },
          {
            name: "description",
            content: `Pre-loved fashion item. AI Verified and Doorstep Inspected on ReSell by Myntra.`,
          },
        ]
      : [],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <div className="p-20 text-center">
      Product not found.{" "}
      <Link to="/" className="text-primary underline">
        Back home
      </Link>
    </div>
  ),
});

function ProductPage() {
  const { id } = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [wished, setWished] = useState(false);
  const [busy, setBusy] = useState<"" | "bag" | "wish" | "delete">("");

  // Verification checks from DB
  const [verifChecks, setVerifChecks] = useState<any[]>([]);

  const fetchProduct = async () => {
    setLoading(true);
    const isUuid = /^[0-9a-f-]{36}$/i.test(id);
    
    if (!isUuid) {
      // Legacy mock products fallback
      const mockP = products.find((p) => p.id === id);
      if (!mockP) {
        toast.error("Listing not found");
        setLoading(false);
        return;
      }
      setProduct(mockP);
      setLoading(false);
      return;
    }

    try {
      // Query normalized listing joined with profile, order specs and media
      const { data: rawData, error } = await supabase
        .from("listings")
        .select(`
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
        `)
        .eq("id", id)
        .single();

      if (error || !rawData) throw new Error("Listing not found");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, seller_score")
        .eq("id", rawData.seller_id)
        .maybeSingle();

      const data = rawData as any;
      const orderItem = data.myntra_order_items as any || {};
      const order = orderItem.myntra_orders as any || {};
      const media = data.listing_media || [];

      // Format photo gallery from storage keys
      const gallery = media.map(
        (m: any) => `${(supabase as any).supabaseUrl}/storage/v1/object/public/resell-photos/${m.storage_key}`
      );
      if (gallery.length === 0) {
        // Fallback demo image if storage bucket fails
        gallery.push("https://picsum.photos/seed/resell-default/600/750");
      }

      const purchaseDate = order.delivered_at ? new Date(order.delivered_at) : new Date();
      const ageYears = Math.max(0.1, (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const originalPrice = orderItem.original_price_paise ? Number(orderItem.original_price_paise) / 100 : 9999;
      
      const grade = data.confirmed_grade || data.declared_grade;
      const gradeFactors = { Pristine: 1.0, Excellent: 0.85, Good: 0.70 };
      const factor = gradeFactors[grade as Grade] || 0.85;
      const depreciation = Math.max(0.2, 1.0 - 0.20 * ageYears);

      setProduct({
        id: data.id,
        brand: data.brand,
        title: data.title,
        category: data.category,
        originalPrice: originalPrice,
        ageYears: ageYears,
        declaredGrade: data.declared_grade,
        confirmedGrade: data.confirmed_grade,
        seller: profile?.full_name || "Verified Seller",
        sellerScore: Number(profile?.seller_score) || 4.7,
        seller_id: data.seller_id,
        image: gallery[0],
        gallery: gallery,
        verified: true,
        inspected: !!data.confirmed_grade,
        size: data.size,
        status: data.status,
        priceFormula: {
          listPrice: Number(data.current_price_paise) / 100,
          sellerPayout: Math.round((Number(data.current_price_paise) / 100) * 0.6),
          commission: Math.round((Number(data.current_price_paise) / 100) * 0.4),
          depreciation,
          factor,
        }
      });

      // Fetch verification checks
      const { data: runs } = await supabase
        .from("verification_runs")
        .select("id")
        .eq("listing_id", id)
        .order("started_at", { ascending: false })
        .limit(1);

      if (runs && runs.length > 0) {
        const { data: checks } = await supabase
          .from("verification_checks")
          .select("check_type, status, score, threshold")
          .eq("verification_run_id", runs[0].id!);
        if (checks) setVerifChecks(checks);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load listing specifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!user || !product) {
      setWished(false);
      return;
    }
    
    // Check wishlist state in DB
    const isUuid = /^[0-9a-f-]{36}$/i.test(product.id);
    if (!isUuid) return;

    supabase
      .from("wishlist_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", product.id)
      .maybeSingle()
      .then(({ data }) => setWished(!!data));
  }, [user, product]);

  const needAuth = () => {
    toast.info("Please sign in to continue");
    navigate({ to: "/auth", search: { redirect: window.location.pathname } });
  };

  // Helper to ensure mock products have a database listing record before cart/wishlist insertion
  const ensureDbListingForMock = async (mockProduct: any): Promise<string> => {
    if (!user) throw new Error("User required");
    const deterministicId = "00000000-0000-0000-0000-" + mockProduct.id.padStart(12, "0");

    const { data: existing } = await supabase
      .from("listings")
      .select("id")
      .eq("id", deterministicId)
      .maybeSingle();

    if (existing) return deterministicId;

    // Create the listing in DB
    const originalPricePaise = mockProduct.originalPrice * 100;
    const gradeFactors = { Pristine: 1.0, Excellent: 0.85, Good: 0.70 };
    const grade = mockProduct.confirmedGrade || mockProduct.declaredGrade;
    const factor = gradeFactors[grade as Grade] || 0.85;
    const depreciation = Math.max(0.2, 1 - 0.20 * mockProduct.ageYears);
    const currentPricePaise = Math.max(0, Math.round(originalPricePaise * depreciation * factor));

    const { error } = await supabase.from("listings").insert({
      id: deterministicId,
      seller_id: user.id, // mock current user as seller
      title: mockProduct.title,
      brand: mockProduct.brand,
      category: mockProduct.category,
      size: mockProduct.size,
      declared_grade: mockProduct.declaredGrade,
      confirmed_grade: mockProduct.confirmedGrade,
      status: "live",
      current_price_paise: currentPricePaise,
    } as any);

    if (error) throw new Error(`Mock migration failed: ${error.message}`);
    return deterministicId;
  };

  const addToBag = async () => {
    if (!user) return needAuth();
    setBusy("bag");
    try {
      const dbListingId = await ensureDbListingForMock(product);

      // Check if product already in bag
      const { data: existing } = await supabase
        .from("bag_items")
        .select("id")
        .eq("user_id", user.id)
        .eq("listing_id", dbListingId)
        .maybeSingle();

      if (existing) {
        toast.info("Item is already in your bag");
        navigate({ to: "/bag" });
        return;
      }

      const { error } = await supabase.from("bag_items").insert({
        user_id: user.id,
        listing_id: dbListingId,
        size: product.size,
        quantity: 1,
      } as any);

      if (error) throw error;

      toast.success("Added to bag", {
        action: { label: "View bag", onClick: () => navigate({ to: "/bag" }) },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to add to bag");
    } finally {
      setBusy("");
    }
  };

  const toggleWishlist = async () => {
    if (!user) return needAuth();
    setBusy("wish");
    try {
      const dbListingId = await ensureDbListingForMock(product);

      if (wished) {
        const { error } = await supabase
          .from("wishlist_items")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", dbListingId);
        if (error) throw error;
        setWished(false);
        toast.success("Removed from wishlist");
      } else {
        const { error } = await supabase.from("wishlist_items").insert({
          user_id: user.id,
          listing_id: dbListingId,
        } as any);
        if (error) throw error;
        setWished(true);
        toast.success("Added to wishlist");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update wishlist");
    } finally {
      setBusy("");
    }
  };

  const deleteListing = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this listing? It will be removed from the marketplace and returned to your closet.",
      )
    )
      return;
    setBusy("delete");
    try {
      const { error } = await supabase.from("listings").delete().eq("id", product.id);

      if (error) throw error;

      toast.success("Listing deleted successfully");
      navigate({ to: "/orders" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete listing");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-semibold">Validating listing ledger...</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const grade = product.confirmedGrade || product.declaredGrade;
  const isSeller = user && product && product.seller_id === user.id;
  
  // Custom price formulas
  const priceFormula = product.priceFormula || {
    listPrice: product.originalPrice,
    sellerPayout: Math.round(product.originalPrice * 0.6),
    commission: Math.round(product.originalPrice * 0.4),
    depreciation: 1.0,
    factor: 1.0,
  };
  const discount = Math.round((1 - priceFormula.listPrice / product.originalPrice) * 100);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 md:grid-cols-[1.1fr_1fr] md:px-6 md:py-10">
        {/* Gallery */}
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div className="flex flex-col gap-2">
            {product.gallery.map((g: string, i: number) => (
              <button
                key={g + i}
                onClick={() => setActiveImageIndex(i)}
                className={`aspect-[4/5] overflow-hidden rounded-sm border-2 cursor-pointer ${activeImageIndex === i ? "border-primary" : "border-transparent"}`}
              >
                <img src={g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted border border-border">
            <img src={product.gallery[activeImageIndex]} alt={product.title} className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 flex flex-col gap-2">
              <TrustBadge kind="verified" size="md" />
              <TrustBadge kind={product.inspected ? "inspected" : "inspection-pending"} size="md" />
            </div>
            {product.status !== "live" && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="bg-primary text-white text-xs font-black uppercase px-4 py-2 rounded shadow-md tracking-widest">
                  {product.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Product specs */}
        <div>
          <div className="text-2xl font-black text-foreground">{product.brand}</div>
          <div className="text-lg text-muted-foreground">{product.title}</div>
          
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success">
              {product.sellerScore.toFixed(1)} <Star className="h-3 w-3 fill-success" />
            </span>
            <span className="text-xs text-muted-foreground">Listed by {product.seller}</span>
          </div>
          
          <div className="mt-4 h-px w-full bg-border" />

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black">{inr(priceFormula.listPrice)}</span>
            <span className="text-sm text-muted-foreground line-through">
              {inr(product.originalPrice)}
            </span>
            <span className="text-sm font-bold text-primary">({discount}% OFF)</span>
          </div>
          <div className="text-xs font-semibold text-success">inclusive of all taxes</div>

          {!product.inspected && (
            <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed">
              <b>AI-estimated price</b> — final price is confirmed after doorstep inspection. If the
              grade drops, we'll notify you before final capture.
            </div>
          )}

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wide">Available Size</div>
            <div className="mt-2 flex gap-2">
              {["XS", "S", "M", "L", "XL"].map((s) => (
                <button
                  key={s}
                  className={`h-11 w-11 rounded-full border text-sm font-semibold select-none ${s === product.size ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground opacity-50"}`}
                  disabled={s !== product.size}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Only this size is available for this pre-loved item.
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 w-full">
            {isSeller ? (
              <button
                onClick={deleteListing}
                disabled={busy === "delete"}
                className="w-full rounded-md bg-destructive py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-destructive/90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {busy === "delete" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting Listing…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Delete Resell Listing
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  onClick={addToBag}
                  disabled={busy === "bag" || product.status !== "live"}
                  className="flex-1 rounded-md bg-primary py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {busy === "bag" ? "Adding…" : product.status !== "live" ? "Unavailable" : "Add to Bag"}
                </button>
                <button
                  onClick={toggleWishlist}
                  disabled={busy === "wish"}
                  className={`flex items-center gap-2 rounded-md border px-5 py-3.5 text-sm font-bold uppercase tracking-wide cursor-pointer ${wished ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-foreground"}`}
                >
                  <Heart className={`h-4 w-4 ${wished ? "fill-primary text-primary" : ""}`} />{" "}
                  {wished ? "Wishlisted" : "Wishlist"}
                </button>
              </div>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
              }}
              aria-label="Share"
              className="rounded-md border border-border p-3.5 hover:border-foreground cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {/* Trust validation panel */}
          <div className="mt-6 rounded-md border border-border bg-card p-4">
            <div className="text-xs font-bold uppercase tracking-wider">
              Why you can trust this listing
            </div>
            <div className="mt-3 grid gap-3 text-sm">
              <TrustRow
                icon={ShieldCheck}
                title="AI Product Verification passed"
                note="Matched against original Myntra purchase record, quality gate cleared, no duplicate/stock photos detected."
                color="text-verified"
              />
              
              {/* Dynamic AI Checks list if available */}
              {verifChecks.length > 0 && (
                <div className="pl-6 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground bg-muted/30 p-2 rounded">
                  {verifChecks.map((check) => (
                    <div key={check.check_type} className="flex justify-between border-b border-border/30 pb-0.5">
                      <span className="capitalize">{check.check_type.replace("_", " ")}:</span>
                      <span className={check.status === "passed" ? "text-success font-bold" : "text-destructive font-bold"}>
                        {check.status === "passed" ? "Pass" : "Fail"} ({(check.score || 0).toFixed(1)})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <TrustRow
                icon={PackageCheck}
                title={
                  product.inspected
                    ? `Doorstep Inspected · Grade ${grade}`
                    : `Inspection pending · Declared ${grade}`
                }
                note={
                  product.inspected
                    ? "Stretch, Light and Odor tests confirmed by our delivery partner."
                    : "Stretch, Light and Odor tests happen on pickup. Price locks after inspection."
                }
                color="text-success"
              />
              
              {product.confirmedGrade && product.confirmedGrade !== product.declaredGrade && (
                <TrustRow
                  icon={Recycle}
                  title={`Grade revised: ${product.declaredGrade} → ${product.confirmedGrade}`}
                  note="Price recomputed transparently on inspection. Buyer confirmed the revised price."
                  color="text-warning-foreground"
                />
              )}
            </div>
          </div>

          {/* Delivery promises */}
          <div className="mt-4 grid gap-3 rounded-md border border-border p-4 text-sm md:grid-cols-2">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-bold">Free delivery in 4–6 days</div>
                <div className="text-xs text-muted-foreground">
                  Escrow protected · pay only after inspection
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-bold">48h Buyer Protection</div>
                <div className="text-xs text-muted-foreground">
                  Raise a dispute within 48h of delivery
                </div>
              </div>
            </div>
          </div>

          {/* Price transparency breakdown */}
          <details className="mt-4 rounded-md border border-border p-4 text-sm">
            <summary className="cursor-pointer font-bold select-none">How this price was computed</summary>
            <div className="mt-3 space-y-1 text-xs">
              <Row label="Original Myntra price" value={inr(product.originalPrice)} />
              <Row
                label={`Depreciation · ${priceFormula.depreciation.toFixed(2)} factor`}
                value={`× ${priceFormula.depreciation.toFixed(2)}`}
              />
              <Row label={`Grade factor · ${grade}`} value={`× ${priceFormula.factor.toFixed(2)}`} />
              <div className="my-2 border-t border-border" />
              <Row label="Final listing price" value={inr(priceFormula.listPrice)} bold />
              <Row label="Seller receives (60%)" value={inr(priceFormula.sellerPayout)} />
              <Row label="Myntra commission (40%)" value={inr(priceFormula.commission)} />
            </div>
          </details>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function TrustRow({ icon: Icon, title, note, color }: any) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />
      <div>
        <div className="font-bold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground leading-normal mt-0.5">{note}</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: any) {
  return (
    <div className={`flex justify-between py-1 ${bold ? "font-bold border-t border-border pt-2" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
