import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { TrustBadge } from "@/components/trust-badges";
import { computePrice, inr, products } from "@/lib/mock-data";
import { Heart, Share2, ShieldCheck, PackageCheck, Recycle, Star, Truck, RotateCcw } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/product/$id")({
  loader: ({ params }) => {
    const product = products.find((p) => p.id === params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.brand} ${loaderData.product.title} — ReSell` },
          { name: "description", content: `Pre-loved ${loaderData.product.brand} ${loaderData.product.title}. AI Verified and Doorstep Inspected on ReSell by Myntra.` },
          { property: "og:title", content: `${loaderData.product.brand} · ${loaderData.product.title}` },
          { property: "og:image", content: loaderData.product.image },
        ]
      : [],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <div className="p-20 text-center">Product not found. <Link to="/" className="text-primary underline">Back home</Link></div>
  ),
});

function ProductPage() {
  const { product: p } = Route.useLoaderData();
  const grade = p.confirmedGrade ?? p.declaredGrade;
  const price = computePrice(p.originalPrice, p.ageYears, grade);
  const discount = Math.round((1 - price.listPrice / p.originalPrice) * 100);
  const [active, setActive] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 md:grid-cols-[1.1fr_1fr] md:px-6 md:py-10">
        {/* Gallery */}
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div className="flex flex-col gap-2">
            {p.gallery.map((g, i) => (
              <button
                key={g + i}
                onClick={() => setActive(i)}
                className={`aspect-[4/5] overflow-hidden rounded-sm border-2 ${active === i ? "border-primary" : "border-transparent"}`}
              >
                <img src={g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
            <img src={p.gallery[active]} alt={p.title} className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 flex flex-col gap-2">
              <TrustBadge kind="verified" size="md" />
              <TrustBadge kind={p.inspected ? "inspected" : "inspection-pending"} size="md" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div>
          <div className="text-2xl font-black">{p.brand}</div>
          <div className="text-lg text-muted-foreground">{p.title}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-sm bg-success/10 px-1.5 py-0.5 text-xs font-bold text-success">
              {p.sellerScore} <Star className="h-3 w-3 fill-success" />
            </span>
            <span className="text-xs text-muted-foreground">Sold by {p.seller}</span>
          </div>
          <div className="mt-4 h-px w-full bg-border" />

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black">{inr(price.listPrice)}</span>
            <span className="text-sm text-muted-foreground line-through">{inr(p.originalPrice)}</span>
            <span className="text-sm font-bold text-primary">({discount}% OFF)</span>
          </div>
          <div className="text-xs font-semibold text-success">inclusive of all taxes</div>

          {!p.inspected && (
            <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
              <b>AI-estimated price</b> — final price is confirmed after doorstep inspection. If the grade drops, we'll notify you before charging.
            </div>
          )}

          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wide">Select Size</div>
            <div className="mt-2 flex gap-2">
              {["XS", "S", "M", "L", "XL"].map((s) => (
                <button
                  key={s}
                  className={`h-11 w-11 rounded-full border text-sm font-semibold ${s === p.size ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"}`}
                  disabled={s !== p.size}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Only this size is available for this pre-loved item.</div>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="flex-1 rounded-md bg-primary py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90">
              Add to Bag
            </button>
            <button className="flex items-center gap-2 rounded-md border border-border px-5 py-3.5 text-sm font-bold uppercase tracking-wide hover:border-foreground">
              <Heart className="h-4 w-4" /> Wishlist
            </button>
            <button aria-label="Share" className="rounded-md border border-border p-3.5 hover:border-foreground">
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {/* Trust panel */}
          <div className="mt-6 rounded-md border border-border bg-card p-4">
            <div className="text-xs font-bold uppercase tracking-wider">Why you can trust this listing</div>
            <div className="mt-3 grid gap-3 text-sm">
              <TrustRow icon={ShieldCheck} title="AI Product Verification passed" note="Matched against original Myntra purchase record, quality gate cleared, no duplicate/stock photos detected." color="text-verified" />
              <TrustRow
                icon={PackageCheck}
                title={p.inspected ? `Doorstep Inspected · Grade ${grade}` : `Inspection pending · Declared ${grade}`}
                note={p.inspected ? "Stretch, Light and Odor tests confirmed by our delivery partner." : "Stretch, Light and Odor tests happen on pickup. Price locks after inspection."}
                color="text-success"
              />
              {p.confirmedGrade && p.confirmedGrade !== p.declaredGrade && (
                <TrustRow
                  icon={Recycle}
                  title={`Grade revised: ${p.declaredGrade} → ${p.confirmedGrade}`}
                  note="Price recomputed transparently on inspection. Buyer confirmed the revised price."
                  color="text-warning-foreground"
                />
              )}
            </div>
          </div>

          {/* Delivery */}
          <div className="mt-4 grid gap-3 rounded-md border border-border p-4 text-sm md:grid-cols-2">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-bold">Free delivery in 4–6 days</div>
                <div className="text-xs text-muted-foreground">Escrow protected · pay only after inspection</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-bold">48h Buyer Protection</div>
                <div className="text-xs text-muted-foreground">Raise a dispute within 48h of delivery</div>
              </div>
            </div>
          </div>

          {/* Price transparency */}
          <details className="mt-4 rounded-md border border-border p-4 text-sm">
            <summary className="cursor-pointer font-bold">How this price was computed</summary>
            <div className="mt-3 space-y-1 text-xs">
              <Row label="Original Myntra price" value={inr(p.originalPrice)} />
              <Row label={`Depreciation · ${p.ageYears} yr × 20%`} value={`× ${price.depreciation.toFixed(2)}`} />
              <Row label={`Grade factor · ${grade}`} value={`× ${price.factor.toFixed(2)}`} />
              <div className="my-2 border-t border-border" />
              <Row label="Final listing price" value={inr(price.listPrice)} bold />
              <Row label="Seller receives (60%)" value={inr(price.sellerPayout)} />
              <Row label="Myntra commission (40%)" value={inr(price.commission)} />
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
    <div className="flex items-start gap-3">
      <Icon className={`mt-0.5 h-5 w-5 ${color}`} />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
