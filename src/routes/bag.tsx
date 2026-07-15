import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingBag, Trash2, ShieldCheck, Truck } from "lucide-react";
import { computePrice, inr, type Product } from "@/lib/mock-data";

type Row = {
  id: string;
  product_id: string;
  product_data: Product;
  size: string | null;
  quantity: number;
};

export const Route = createFileRoute("/bag")({
  head: () => ({ meta: [{ title: "My Bag — ReSell by Myntra" }] }),
  component: BagPage,
});

function BagPage() {
  const { user, loading } = useRequireAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("bag_items")
      .select("id,product_id,product_data,size,quantity")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setItems((data ?? []) as Row[]);
        setBusy(false);
      });
  }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("bag_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const priceOf = (p: Product) =>
    computePrice(p.originalPrice, p.ageYears, p.confirmedGrade ?? p.declaredGrade).listPrice;
  const subtotal = items.reduce((sum, r) => sum + priceOf(r.product_data) * r.quantity, 0);

  if (loading || !user)
    return (
      <Frame>
        <div className="p-20 text-center text-sm text-muted-foreground">Loading…</div>
      </Frame>
    );

  return (
    <Frame>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[1fr_340px]">
        <div>
          <h1 className="text-2xl font-black">My Bag</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} · escrow-protected checkout
          </p>

          {busy ? (
            <div className="mt-16 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="mt-8 rounded-md border border-dashed border-border p-16 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="mt-3 text-lg font-bold">Your bag is empty</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Add pre-loved pieces you love. Every item is AI Verified and inspected before
                delivery.
              </p>
              <Link
                to="/"
                className="mt-4 inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground"
              >
                Browse marketplace
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {items.map((row) => {
                const p = row.product_data;
                const list = priceOf(p);
                return (
                  <div
                    key={row.id}
                    className="flex gap-4 rounded-md border border-border bg-card p-4 shadow-card"
                  >
                    <Link to="/product/$id" params={{ id: p.id }} className="flex-shrink-0">
                      <img
                        src={p.image}
                        alt={p.title}
                        className="h-28 w-24 rounded-sm object-cover"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{p.brand}</div>
                      <div className="truncate text-sm text-muted-foreground">{p.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Size {row.size ?? p.size} · Qty {row.quantity}
                      </div>
                      <div className="mt-2 text-base font-black">
                        {inr(list)}{" "}
                        <span className="text-xs font-normal text-muted-foreground line-through">
                          {inr(p.originalPrice)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(row.id)}
                      aria-label="Remove"
                      className="self-start rounded-md border border-border p-2 text-muted-foreground hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="h-fit sticky top-20 rounded-md border border-border bg-card p-5 shadow-card">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Price Details
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <Row
              label={`Subtotal (${items.length} item${items.length === 1 ? "" : "s"})`}
              value={inr(subtotal)}
            />
            <Row label="Buyer protection" value="FREE" accent />
            <Row label="Delivery" value="FREE" accent />
            <div className="my-2 h-px bg-border" />
            <Row label="Total payable" value={inr(subtotal)} bold />
          </div>
          <button
            disabled={items.length === 0}
            onClick={() => toast.info("Checkout is a hackathon prototype — payments coming soon.")}
            className="mt-5 h-12 w-full rounded-md bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Place order
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
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-success font-semibold" : ""}>{value}</span>
    </div>
  );
}
