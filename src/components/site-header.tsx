import { Link } from "@tanstack/react-router";
import { Search, Heart, ShoppingBag, User, Sparkles } from "lucide-react";

const nav = [
  { label: "MEN", to: "/" },
  { label: "WOMEN", to: "/" },
  { label: "KIDS", to: "/" },
  { label: "HOME", to: "/" },
  { label: "BEAUTY", to: "/" },
  { label: "STUDIO", to: "/", tag: "New" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight">
            <span className="text-primary">Re</span>Sell
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:inline">
            by Myntra
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              className="group relative py-5 text-xs font-bold uppercase tracking-wide text-foreground hover:text-primary"
            >
              {n.label}
              {n.tag && (
                <span className="ml-1 align-super text-[9px] font-bold text-primary">
                  {n.tag}
                </span>
              )}
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 scale-x-0 bg-primary transition-transform group-hover:scale-x-100" />
            </Link>
          ))}
          <Link
            to="/orders"
            className="flex items-center gap-1 rounded-full bg-gradient-hero px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
          >
            <Sparkles className="h-3 w-3" /> Resell
          </Link>
        </nav>

        <div className="ml-auto flex flex-1 items-center gap-4 md:flex-none">
          <div className="relative flex-1 md:w-80 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search for pre-loved brands, styles..."
              className="h-10 w-full rounded-md bg-muted pl-9 pr-3 text-sm outline-none ring-primary/20 focus:bg-background focus:ring-2"
            />
          </div>
          <button className="hidden flex-col items-center text-[10px] font-semibold text-foreground/80 hover:text-primary md:flex">
            <User className="h-5 w-5" />
            Profile
          </button>
          <button className="hidden flex-col items-center text-[10px] font-semibold text-foreground/80 hover:text-primary md:flex">
            <Heart className="h-5 w-5" />
            Wishlist
          </button>
          <button className="flex flex-col items-center text-[10px] font-semibold text-foreground/80 hover:text-primary">
            <ShoppingBag className="h-5 w-5" />
            Bag
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="text-xl font-black">
            <span className="text-primary">Re</span>Sell
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            India's trusted marketplace for pre-loved premium fashion. Every item AI Verified and Doorstep Inspected.
          </p>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">Shop</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Women</li><li>Men</li><li>Sneakers</li><li>Luxury</li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">Sell</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/orders" className="hover:text-primary">Start a listing</Link></li>
            <li>How pricing works</li><li>Doorstep inspection</li><li>Seller protection</li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">Trust</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>AI Verification</li><li>Buyer Protection · 48h</li><li>Escrow Payments</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © 2026 ReSell by Myntra · Myntra Hackerramp Prototype
      </div>
    </footer>
  );
}
