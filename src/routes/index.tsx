import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/mock-data";
import { ShieldCheck, PackageCheck, Recycle, Sparkles, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const categories = [
  { label: "Dresses", img: "https://picsum.photos/seed/cat-dress/300/300" },
  { label: "Sneakers", img: "https://picsum.photos/seed/cat-shoe/300/300" },
  { label: "Outerwear", img: "https://picsum.photos/seed/cat-jacket/300/300" },
  { label: "Denim", img: "https://picsum.photos/seed/cat-jeans/300/300" },
  { label: "Blazers", img: "https://picsum.photos/seed/cat-blazer/300/300" },
  { label: "Bags", img: "https://picsum.photos/seed/cat-bag/300/300" },
  { label: "Luxury", img: "https://picsum.photos/seed/cat-luxury/300/300" },
  { label: "Kids", img: "https://picsum.photos/seed/cat-kids/300/300" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-gradient-hero text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur">
              <Sparkles className="h-3 w-3" /> Premium Thrift · Recycle
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-6xl">
              Pre-loved fashion,<br /> Myntra-approved.
            </h1>
            <p className="mt-4 max-w-md text-white/85">
              Every listing is AI Verified against original purchase records and Doorstep Inspected before delivery. Great brands, honest grades, zero surprises.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#feed" className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary hover:bg-white/90">
                Shop the drop <ArrowRight className="h-4 w-4" />
              </a>
              <Link to="/orders" className="inline-flex items-center gap-2 rounded-md border border-white/50 px-5 py-3 text-sm font-bold uppercase tracking-wide hover:bg-white/10">
                Resell your Myntra order
              </Link>
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-4 text-center">
              {[
                { icon: ShieldCheck, k: "AI", v: "Verified" },
                { icon: PackageCheck, k: "48h", v: "Buyer Protection" },
                { icon: Recycle, k: "60/40", v: "Seller / Myntra" },
              ].map((s) => (
                <div key={s.v} className="rounded-md bg-white/10 p-3 backdrop-blur">
                  <s.icon className="mx-auto h-5 w-5" />
                  <div className="mt-1 text-lg font-black">{s.k}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/80">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-2 gap-3">
              {products.slice(0, 4).map((p, i) => (
                <img
                  key={p.id}
                  src={p.image}
                  alt={p.title}
                  className={`aspect-[4/5] w-full rounded-md object-cover shadow-card ${i % 2 ? "translate-y-6" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-verified" /> AI Product Verification</span>
          <span className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-success" /> Doorstep Inspection</span>
          <span className="flex items-center gap-2"><Recycle className="h-4 w-4 text-primary" /> Escrow-Protected Payments</span>
          <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Original Purchase Match</span>
        </div>
      </div>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <h2 className="text-center text-2xl font-black uppercase tracking-wider">Shop by Category</h2>
        <div className="mt-6 grid grid-cols-4 gap-4 md:grid-cols-8">
          {categories.map((c) => (
            <div key={c.label} className="group flex flex-col items-center">
              <div className="aspect-square w-full overflow-hidden rounded-full border-2 border-transparent group-hover:border-primary">
                <img src={c.img} alt={c.label} className="h-full w-full object-cover" />
              </div>
              <span className="mt-2 text-xs font-bold uppercase">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Feed */}
      <section id="feed" className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="flex items-end justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-wider">Trending Pre-Loved</h2>
            <p className="text-xs text-muted-foreground">{products.length} verified items · updated live</p>
          </div>
          <div className="hidden gap-2 text-xs font-semibold uppercase tracking-wide md:flex">
            {["Recommended", "New in", "Price ↑", "Price ↓", "Discount"].map((f, i) => (
              <button key={f} className={`rounded-full border px-3 py-1.5 ${i === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Sell CTA */}
      <section className="border-t border-border bg-accent/50">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-6 py-14 md:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Turn your closet into cash</span>
            <h2 className="mt-2 text-3xl font-black md:text-4xl">Resell your Myntra order in 3 taps.</h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Pick an eligible order, upload photos with in-app capture guidance, and we handle verification, pickup, doorstep inspection and payout. Keep 60% of the final price.
            </p>
            <Link to="/orders" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90">
              Start selling <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs font-semibold">
            {[
              { k: "1", t: "Pick an order", d: "From your Myntra history" },
              { k: "2", t: "Upload photos", d: "Live capture guidance" },
              { k: "3", t: "Get paid", d: "After doorstep inspection" },
            ].map((s) => (
              <div key={s.k} className="rounded-md border border-border bg-card p-4 shadow-card">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">{s.k}</div>
                <div className="mt-2 font-bold uppercase">{s.t}</div>
                <div className="mt-1 text-[11px] font-normal text-muted-foreground">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
