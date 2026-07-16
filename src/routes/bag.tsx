// src/routes/bag.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, Trash2, ShieldCheck, Truck, AlertTriangle } from "lucide-react";
import { inr } from "@/lib/mock-data";

type BagRow = {
  id: string;
  listing_id: string;
  brand: string;
  title: string;
  size: string;
  quantity: number;
  price: number;
  image: string;
  status: string;
  isAvailable: boolean;
};

export const Route = createFileRoute("/bag")({
  head: () => ({ meta: [{ title: "My Bag — ReSell by Myntra" }] }),
  component: BagPage,
});

function BagPage() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<BagRow[]>([]);
  const [busy, setBusy] = useState(true);

  const fetchBag = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("bag_items")
        .select(`
          id,
          size,
          quantity,
          listings (
            id,
            title,
            brand,
            category,
            size,
            current_price_paise,
            declared_grade,
            confirmed_grade,
            status,
            listing_media (
              storage_key,
              angle
            )
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const formatted: BagRow[] = (data ?? []).map((row: any) => {
        const l = row.listings || {};
        const media = l.listing_media || [];
        const imagePath = media.find((m: any) => m.angle === "top")?.storage_key || media[0]?.storage_key || "";
        const publicUrl = imagePath
          ? `${process.env.SUPABASE_URL}/storage/v1/object/public/resell-photos/${imagePath}`
          : "https://picsum.photos/seed/resell-default/600/750";

        const price = l.current_price_paise ? Number(l.current_price_paise) / 100 : 0;

        return {
          id: row.id,
          listing_id: l.id,
          brand: l.brand || "Brand",
          title: l.title || "Pre-loved Fashion",
          size: row.size || l.size || "M",
          quantity: row.quantity,
          price: price,
          image: publicUrl,
          status: l.status,
          isAvailable: l.status === "live",
        };
      });

      setItems(formatted);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load bag items");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user) fetchBag();
  }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("bag_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Item removed from bag");
  };

  // Only sum available items
  const availableItems = items.filter((i) => i.isAvailable);
  const subtotal = availableItems.reduce((sum, r) => sum + r.price * r.quantity, 0);
  const hasUnavailable = items.some((i) => !i.isAvailable);

  if (loading || !user) {
    return (
      <Frame>
        <div className="p-20 text-center text-sm text-muted-foreground font-semibold">Validating session security...</div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[1fr_340px]">
        <div>
          <h1 className="text-2xl font-black">My Bag</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} · escrow-protected circular check
          </p>

          {busy ? (
            <div className="mt-16 text-center text-sm text-muted-foreground animate-pulse">Checking item ledger status...</div>
          ) : items.length === 0 ? (
            <div className="mt-8 rounded-md border border-dashed border-border p-16 text-center bg-card shadow-sm">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="mt-3 text-lg font-bold">Your bag is empty</div>
              <p className="mt-1 text-sm text-muted-foreground text-pretty max-w-sm mx-auto">
                Browse the marketplace for authenticated pre-loved Myntra products. Zero risk doorstep protection active.
              </p>
              <Link
                to="/"
                className="mt-6 inline-block rounded-md bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 transition shadow-sm"
              >
                Browse marketplace
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {hasUnavailable && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-destructive leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    Some items in your bag are no longer available (sold or withdrawn). Please remove them to proceed to checkout.
                  </div>
                </div>
              )}
              {items.map((row) => (
                <div
                  key={row.id}
                  className={`flex gap-4 rounded-md border p-4 shadow-card transition bg-card ${
                    row.isAvailable ? "border-border" : "border-destructive/20 bg-destructive/5 opacity-80"
                  }`}
                >
                  <Link to="/product/$id" params={{ id: row.listing_id }} className="flex-shrink-0">
                    <img
                      src={row.image}
                      alt={row.title}
                      className="h-28 w-24 rounded-sm object-cover bg-muted"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{row.brand}</div>
                    <div className="truncate text-sm text-muted-foreground">{row.title}</div>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>Size: <b>{row.size}</b></span>
                      <span>Qty: <b>{row.quantity}</b></span>
                    </div>
                    
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-base font-black">{inr(row.price)}</span>
                      {!row.isAvailable && (
                        <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(row.id)}
                    aria-label="Remove"
                    className="self-start rounded-md border border-border p-2 text-muted-foreground hover:border-destructive hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit sticky top-20 rounded-md border border-border bg-card p-5 shadow-card">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Price Details
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row
              label={`Subtotal (${availableItems.length} available)`}
              value={inr(subtotal)}
            />
            <Row label="Buyer protection fee" value="FREE" accent />
            <Row label="Delivery promise" value="FREE" accent />
            <div className="my-2 h-px bg-border" />
            <Row label="Total payable" value={inr(subtotal)} bold />
          </div>
          
          <button
            disabled={availableItems.length === 0 || hasUnavailable}
            onClick={() => navigate({ to: "/checkout" })}
            className="mt-5 h-12 w-full rounded-md bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer shadow transition"
          >
            Proceed to Checkout
          </button>
          
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-verified" /> Escrow-protected · pay after
              inspection
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" /> Free delivery in 4–6 days
            </div>
          </div>
        </aside>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

function Row({ label, value, bold, accent }: any) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold border-t border-border pt-2 text-foreground" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-success font-semibold" : "text-foreground"}>{value}</span>
    </div>
  );
}
