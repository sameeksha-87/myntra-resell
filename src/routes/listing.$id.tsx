import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Check, PackageCheck, ShieldCheck, Truck, Wallet, Sparkles } from "lucide-react";

export const Route = createFileRoute("/listing/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Listing ${params.id} · Status — ReSell by Myntra` }],
  }),
  component: ListingStatus,
});

const stages = [
  { key: "verifying", label: "Verifying", icon: ShieldCheck, note: "AI Verification passed · high confidence" },
  { key: "live", label: "Live in marketplace", icon: Sparkles, note: "Visible to buyers · boosted by 4.8★ seller score" },
  { key: "sold", label: "Sold", icon: Wallet, note: "Buyer paid ₹6,120 · held in escrow" },
  { key: "pickup", label: "Pickup scheduled", icon: Truck, note: "Tomorrow · 10 AM – 12 PM slot" },
  { key: "inspection", label: "Doorstep inspection", icon: PackageCheck, note: "Stretch · Light · Odor tests on arrival" },
  { key: "paid", label: "Payout released", icon: Check, note: "60% credited as Myntra Credits after 48h protection" },
];

function ListingStatus() {
  const { id } = Route.useParams();
  const currentIdx = 2; // "Sold"

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-hero py-8 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-xs font-bold uppercase tracking-widest text-white/80">Listing #{id}</div>
          <h1 className="mt-1 text-2xl font-black md:text-3xl">Your item just sold 🎉</h1>
          <p className="mt-1 text-sm text-white/85">Payment is held in escrow. Pickup is scheduled for tomorrow morning.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-8 md:grid-cols-[1fr_320px]">
        {/* Timeline */}
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide">Order Tracker</h2>
          <ol className="mt-4 relative border-l border-border pl-6">
            {stages.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              const Icon = s.icon;
              return (
                <li key={s.key} className="mb-6 last:mb-0">
                  <span
                    className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      done ? "border-success bg-success text-white" : active ? "border-primary bg-primary text-white" : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <div className={`text-sm font-bold ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
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
        </div>

        {/* Grade-mismatch banner + payout */}
        <aside className="space-y-4">
          <div className="rounded-md border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-warning-foreground">
              <Sparkles className="h-4 w-4" /> Grade-Mismatch Policy
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              If the inspector revises your grade downwards, we recompute the price transparently and give the buyer a chance to accept before charging. Your payout adjusts to the confirmed grade.
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-4 shadow-card">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Provisional Payout</div>
            <div className="mt-1 text-2xl font-black">₹3,672</div>
            <div className="text-xs text-muted-foreground">60% of ₹6,120 · after 48h buyer protection</div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 bg-primary" />
            </div>
            <div className="mt-1 flex justify-between text-[10px] uppercase text-muted-foreground">
              <span>Sold</span><span>Inspected</span><span>Delivered</span><span>Paid</span>
            </div>
          </div>

          <Link to="/orders" className="block rounded-md border border-border bg-card p-4 text-center text-sm font-bold uppercase tracking-wide hover:border-primary">
            List another item
          </Link>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}
