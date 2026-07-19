import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { Product } from "@/lib/mock-data";
import { computePrice, inr } from "@/lib/mock-data";
import { TrustBadge } from "./trust-badges";

export function ProductCard({ p }: { p: Product }) {
  const price = computePrice(p.originalPrice, p.ageYears, p.confirmedGrade ?? p.declaredGrade);
  const discount = Math.round((1 - price.listPrice / p.originalPrice) * 100);
  const [titleOnly] = (p.title || "").split("|||");

  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className="group relative flex flex-col overflow-hidden bg-card"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={p.image}
          alt={`${p.brand} ${titleOnly}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <button
          onClick={(e) => e.preventDefault()}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-2 opacity-0 shadow-card transition-opacity group-hover:opacity-100"
          aria-label="Wishlist"
        >
          <Heart className="h-4 w-4" />
        </button>
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {p.verified && <TrustBadge kind="verified" />}
          {p.inspected ? <TrustBadge kind="inspected" /> : <TrustBadge kind="inspection-pending" />}
        </div>
      </div>
      <div className="p-2">
        <div className="truncate text-sm font-bold">{p.brand}</div>
        <div className="truncate text-xs text-muted-foreground">{titleOnly}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-bold">{inr(price.listPrice)}</span>
          <span className="text-xs text-muted-foreground line-through">{inr(p.originalPrice)}</span>
          <span className="text-xs font-semibold text-primary">({discount}% OFF)</span>
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {p.confirmedGrade ?? p.declaredGrade} · Size {p.size}
        </div>
      </div>
    </Link>
  );
}
