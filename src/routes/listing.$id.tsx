import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Check, PackageCheck, ShieldCheck, Truck, Wallet, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/mock-data";

export const Route = createFileRoute("/listing/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Listing ${params.id} · Status — ReSell by Myntra` }],
  }),
  component: ListingStatus,
});

type Listing = {
  id: string;
  brand: string;
  title: string;
  image: string | null;
  ask_price: number;
  seller_payout: number;
  status: string;
  declared_grade: string;
  size: string | null;
  created_at: string;
};

const stageOrder = ["verifying", "live", "sold", "pickup", "inspection", "paid"] as const;

const stageMeta = {
  verifying: {
    label: "Verifying",
    icon: ShieldCheck,
    note: "AI Verification passed · high confidence",
  },
  live: {
    label: "Live in marketplace",
    icon: Sparkles,
    note: "Visible to buyers · boosted by 4.8★ seller score",
  },
  sold: { label: "Sold", icon: Wallet, note: "Buyer paid · held in escrow" },
  pickup: { label: "Pickup scheduled", icon: Truck, note: "Tomorrow · 10 AM – 12 PM slot" },
  inspection: {
    label: "Doorstep inspection",
    icon: PackageCheck,
    note: "Stretch · Light · Odor tests on arrival",
  },
  paid: {
    label: "Payout released",
    icon: Check,
    note: "60% credited as Myntra Credits after 48h protection",
  },
};

function ListingStatus() {
  const { id } = Route.useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Only try DB lookup for UUIDs; legacy mock IDs like "M8823411" fall through gracefully.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setLoaded(true);
      return;
    }
    supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setListing(data as Listing);
        setLoaded(true);
      });
  }, [id]);

  const status = listing?.status ?? "sold";
  const currentIdx = Math.max(0, stageOrder.indexOf(status as any));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-hero py-8 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-xs font-bold uppercase tracking-widest text-white/80">
            {listing ? `${listing.brand} · ${listing.title}` : `Listing #${id}`}
          </div>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">
            {listing
              ? status === "verifying"
                ? "Your listing is being verified ✨"
                : status === "live"
                  ? "Your listing is live 🎉"
                  : "Your item just sold 🎉"
              : "Your item just sold 🎉"}
          </h1>
          <p className="mt-1 text-sm text-white/85">
            {listing
              ? `Listed at ${inr(listing.ask_price)} · payout ${inr(listing.seller_payout)}`
              : "Payment is held in escrow. Pickup is scheduled for tomorrow morning."}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-8 md:grid-cols-[1fr_320px]">
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide">Order Tracker</h2>
          <ol className="mt-4 relative border-l border-border pl-6">
            {stageOrder.map((key, i) => {
              const s = stageMeta[key];
              const done = i < currentIdx;
              const active = i === currentIdx;
              const Icon = s.icon;
              return (
                <li key={key} className="mb-6 last:mb-0">
                  <span
                    className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      done
                        ? "border-success bg-success text-white"
                        : active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <div
                    className={`text-sm font-bold ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.note}</div>
                  {active && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      In progress
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {loaded && !listing && (
            <div className="mt-4 rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
              Showing a sample tracker. Real listings you create are saved to your account.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-warning-foreground">
              <Sparkles className="h-4 w-4" /> Grade-Mismatch Policy
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              If the inspector revises your grade downwards, we recompute the price transparently
              and give the buyer a chance to accept before charging.
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-4 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Provisional Payout
            </div>
            <div className="mt-1 text-2xl font-black">
              {listing ? inr(listing.seller_payout) : "₹3,672"}
            </div>
            <div className="text-xs text-muted-foreground">
              60% of {listing ? inr(listing.ask_price) : "₹6,120"} · after 48h buyer protection
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, ((currentIdx + 1) / stageOrder.length) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] uppercase text-muted-foreground">
              <span>Verifying</span>
              <span>Live</span>
              <span>Sold</span>
              <span>Paid</span>
            </div>
          </div>

          <Link
            to="/orders"
            className="block rounded-md border border-border bg-card p-4 text-center text-sm font-bold uppercase tracking-wide hover:border-primary"
          >
            List another item
          </Link>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}
