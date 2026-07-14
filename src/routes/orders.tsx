import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { eligibleOrders, inr } from "@/lib/mock-data";
import { ArrowRight, PackageCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My Orders — Resell on ReSell by Myntra" },
      { name: "description", content: "Turn your past Myntra orders into cash. Pick an eligible order and start a resell listing." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-hero py-10 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <Sparkles className="h-3 w-3" /> Eligible for Resell
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">Your closet, worth cash again.</h1>
          <p className="mt-2 max-w-xl text-white/85">
            We've picked the premium orders from your Myntra history that qualify for ReSell. Choose one to start a listing.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase tracking-wide">Eligible Orders · {eligibleOrders.length}</h2>
          <div className="text-xs text-muted-foreground">Premium brands · &lt; 3 years old</div>
        </div>

        <div className="grid gap-3">
          {eligibleOrders.map((o) => (
            <div key={o.orderId} className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-card md:flex-row md:items-center">
              <img src={o.image} alt={o.title} className="h-32 w-24 flex-shrink-0 rounded-sm object-cover" />
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Order #{o.orderId} · Delivered {o.purchaseDate}</div>
                <div className="mt-1 text-lg font-bold">{o.brand}</div>
                <div className="text-sm text-muted-foreground">{o.title}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <span><b>Size:</b> {o.size}</span>
                  <span><b>Category:</b> {o.category}</span>
                  <span><b>Original:</b> {inr(o.originalPrice)}</span>
                  <span className="inline-flex items-center gap-1 text-success"><PackageCheck className="h-3 w-3" /> Purchase-verified</span>
                </div>
              </div>
              <Link
                to="/resell/$orderId"
                params={{ orderId: o.orderId }}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
              >
                Resell this <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Not seeing an order? Only premium-brand orders within 3 years qualify for ReSell today. <Link to="/" className="text-primary font-semibold">Browse the marketplace</Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
