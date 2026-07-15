import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Heart, Trash2, ShoppingBag } from "lucide-react";
import { inr, computePrice, type Product } from "@/lib/mock-data";

type Row = { id: string; product_id: string; product_data: Product };

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "My Wishlist — ReSell by Myntra" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading } = useRequireAuth();
  const [items, setItems] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("wishlist_items")
      .select("id,product_id,product_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Row[]);
    setBusy(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Removed from wishlist");
  };

  const moveToBag = async (row: Row) => {
    if (!user) return;
    const { error } = await supabase.from("bag_items").upsert(
      {
        user_id: user.id,
        product_id: row.product_id,
        product_data: row.product_data,
        size: row.product_data.size,
        quantity: 1,
      },
      { onConflict: "user_id,product_id" },
    );
    if (error) return toast.error(error.message);
    await supabase.from("wishlist_items").delete().eq("id", row.id);
    setItems((prev) => prev.filter((i) => i.id !== row.id));
    toast.success("Moved to bag");
  };

  if (loading || !user)
    return (
      <Frame>
        <div className="p-20 text-center text-sm text-muted-foreground">Loading…</div>
      </Frame>
    );

  return (
    <Frame>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">My Wishlist</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} saved item{items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {busy ? (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            Loading your wishlist…
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-md border border-dashed border-border p-16 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-3 text-lg font-bold">Your wishlist is empty</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Save pre-loved pieces you love and grab them before someone else does.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground"
            >
              Browse marketplace
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((row) => {
              const p = row.product_data;
              const price = computePrice(
                p.originalPrice,
                p.ageYears,
                p.confirmedGrade ?? p.declaredGrade,
              );
              return (
                <div
                  key={row.id}
                  className="group overflow-hidden rounded-md border border-border bg-card shadow-card"
                >
                  <Link
                    to="/product/$id"
                    params={{ id: p.id }}
                    className="block aspect-[4/5] overflow-hidden bg-muted"
                  >
                    <img
                      src={p.image}
                      alt={p.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </Link>
                  <div className="p-3">
                    <div className="truncate text-sm font-bold">{p.brand}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.title}</div>
                    <div className="mt-1 text-sm font-black">
                      {inr(price.listPrice)}{" "}
                      <span className="text-xs font-normal text-muted-foreground line-through">
                        {inr(p.originalPrice)}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => moveToBag(row)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-2 text-[11px] font-bold uppercase tracking-wide text-primary-foreground"
                      >
                        <ShoppingBag className="h-3 w-3" /> Move to bag
                      </button>
                      <button
                        onClick={() => remove(row.id)}
                        aria-label="Remove"
                        className="rounded-md border border-border p-2 text-muted-foreground hover:border-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
