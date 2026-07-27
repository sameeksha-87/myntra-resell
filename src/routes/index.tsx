import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ProductCard } from "@/components/product-card";
import { products } from "@/lib/mock-data";
import { ShieldCheck, PackageCheck, Recycle, Sparkles, ArrowRight, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchListings } from "@/integrations/supabase/actions.server";

export const Route = createFileRoute("/")({
  component: Index,
});

const categories = [
  {
    id: "c8ccf46f-2235-4e5e-8905-a792e92716bc",
    label: "Jeans",
    emoji: "👖",
    img: "/jeans.png",
  },
  {
    id: "f17caa0a-b689-4d1c-a434-34abfc366c0f",
    label: "Tops",
    emoji: "👚",
    img: "/tops.png",
  },
  {
    id: "d00000e2-675e-41a5-8220-d40b9ddf67d0",
    label: "Dresses",
    emoji: "👗",
    img: "/dresses.png",
  },
  {
    id: "5f163d0f-8e56-4003-b58e-370699d792df",
    label: "Shoes",
    emoji: "👟",
    img: "/shoes.png",
  },
];

function Index() {
  const [dbListings, setDbListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    fetchListings({
      data: {
        category: selectedCategory,
        priceSort: priceSort,
        search: searchQuery || undefined,
      },
    })
      .then((data) => {
        setDbListings(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading listings:", err);
        setLoading(false);
      });
  }, [selectedCategory, priceSort, searchQuery]);

  const handleCategoryClick = (catId: string) => {
    setSelectedCategory(selectedCategory === catId ? undefined : catId);
    document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="bg-gradient-hero text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur">
              <Sparkles className="h-3 w-3" /> Premium Thrift · Circular Fashion
            </span>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight md:text-6xl">
              Pre-loved fashion,
              <br /> Myntra-approved.
            </h1>
            <p className="mt-4 max-w-md text-white/85 text-sm md:text-base">
              Every listing is AI Verified against original purchase records and Doorstep Inspected
              before delivery. Great brands, honest grades, zero surprises.
            </p>


            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#feed"
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary hover:bg-white/90"
              >
                Shop the drop <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/orders"
                className="inline-flex items-center gap-2 rounded-md border border-white/50 px-5 py-3 text-sm font-bold uppercase tracking-wide hover:bg-white/10"
              >
                Resell your Myntra order
              </Link>
            </div>
          </div>
          
          {/* Category image cards (redesigned hero) */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {categories.map((c) => {
                const isSelected = selectedCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleCategoryClick(c.id)}
                    className={`relative aspect-[4/5] w-full rounded-lg overflow-hidden shadow-card group transition-all duration-300 transform hover:-translate-y-1 text-left border ${
                      isSelected
                        ? "border-white ring-4 ring-primary ring-offset-2 ring-offset-zinc-900 scale-[1.03]"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <img
                      src={c.img}
                      alt={c.label}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent transition-opacity group-hover:from-zinc-950/90" />
                    
                    {/* Floating emoji + category title */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                      <span className="text-xl inline-block transition-transform group-hover:scale-110 duration-300">
                        {c.emoji}
                      </span>
                      <h3 className="mt-1 font-display text-sm font-black uppercase tracking-wider">
                        {c.label}
                      </h3>
                      <p className="text-[9px] text-white/70 uppercase tracking-widest font-bold mt-0.5 group-hover:text-primary transition-colors">
                        Browse collection →
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-verified" /> AI Product Verification
          </span>
          <span className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-success" /> Doorstep Inspection
          </span>
          <span className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-primary" /> Secure Payments
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Original Purchase Match
          </span>
        </div>
      </div>

      {/* Feed */}
      <section id="feed" className="mx-auto max-w-7xl px-4 pb-16 md:px-6 scroll-mt-20">
        <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-wider">Trending Pre-Loved</h2>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Refreshing..."
                : `${dbListings.length} verified items listed from actual Myntra purchases`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search bar */}
            <div className="relative flex-1 min-w-[200px] md:flex-initial">
              <input
                type="text"
                placeholder="Search brands or titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 rounded-md border border-border pl-8 pr-8 text-xs focus:border-primary focus:outline-none"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Sorting buttons */}
            <div className="flex gap-2 text-xs font-semibold uppercase tracking-wide">
              <button
                onClick={() => setPriceSort(undefined)}
                className={`rounded-full border px-3 py-1.5 cursor-pointer ${priceSort === undefined ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground bg-background"}`}
              >
                Recommended
              </button>
              <button
                onClick={() => setPriceSort("asc")}
                className={`rounded-full border px-3 py-1.5 cursor-pointer ${priceSort === "asc" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground bg-background"}`}
              >
                Price: Low to High
              </button>
              <button
                onClick={() => setPriceSort("desc")}
                className={`rounded-full border px-3 py-1.5 cursor-pointer ${priceSort === "desc" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground bg-background"}`}
              >
                Price: High to Low
              </button>
            </div>
          </div>
        </div>

        {/* Selected category alert */}
        {selectedCategory && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold uppercase flex items-center gap-1.5">
              Category: {categories.find((c) => c.id === selectedCategory)?.label || "Selected"}
              <button
                onClick={() => setSelectedCategory(undefined)}
                className="hover:text-primary-foreground hover:bg-primary rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground animate-pulse">
            Fetching verified pre-loved fashion...
          </div>
        ) : dbListings.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-md mt-6 bg-card">
            <div className="text-lg font-bold">No active listings found</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery || selectedCategory
                ? "Try adjusting your filters or search terms."
                : "Be the first to list! Go to 'Resell your Myntra order' to create a listing."}
            </p>
            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory(undefined);
                }}
                className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-md"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
            {dbListings.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      {/* Sell CTA */}
      <section className="border-t border-border bg-accent/50">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-6 py-14 md:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Turn your closet into cash
            </span>
            <h2 className="mt-2 text-3xl font-black md:text-4xl">
              Resell your Myntra order in 3 taps.
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Pick an eligible order, upload photos with in-app capture guidance, and we handle
              verification, pickup, doorstep inspection and payout. Keep 90% of the final price.
            </p>
            <Link
              to="/orders"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            >
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
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {s.k}
                </div>
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
