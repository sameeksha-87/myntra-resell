import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { computePrice, eligibleOrders, inr, type Grade } from "@/lib/mock-data";
import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronRight, ShieldCheck, Sparkles, Upload, X, AlertTriangle, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/resell/$orderId")({
  loader: ({ params }) => {
    const order = eligibleOrders.find((o) => o.orderId === params.orderId);
    if (!order) throw notFound();
    return { order };
  },
  head: ({ params }) => ({
    meta: [{ title: `Resell order ${params.orderId} — ReSell by Myntra` }],
  }),
  component: ResellFlow,
});

type Step = 0 | 1 | 2 | 3 | 4;

const angles = [
  { key: "front", label: "Front", tip: "Full item, flat lay or on hanger" },
  { key: "back", label: "Back", tip: "Show the back panel clearly" },
  { key: "tag", label: "Brand tag", tip: "Close-up of brand label & size" },
  { key: "defect", label: "Any defect", tip: "Zoom into wear, marks or stains (if any)" },
];

const grades: { grade: Grade; blurb: string; example: string }[] = [
  { grade: "Pristine", blurb: "Unworn or worn once. Tags on or original packaging.", example: "0 signs of wear" },
  { grade: "Excellent", blurb: "Lightly worn 2-5 times. No visible flaws.", example: "Minimal signs of wear" },
  { grade: "Good", blurb: "Worn many times. Minor visible wear, fully functional.", example: "Small pilling or fade" },
];

function ResellFlow() {
  const { order } = Route.useLoaderData();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>(0);
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [grade, setGrade] = useState<Grade>("Excellent");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [listingId, setListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname }, replace: true });
    }
  }, [user, loading, navigate]);

  const photosDone = angles.filter((a) => photos[a.key]).length;
  const price = useMemo(() => computePrice(order.originalPrice, order.ageYears, grade), [order, grade]);

  const startVerify = async () => {
    if (!user) return;
    setStep(3);
    setVerifying(true);
    const { data, error } = await supabase.from("listings").insert({
      user_id: user.id,
      order_id: order.orderId,
      brand: order.brand,
      title: order.title,
      image: order.image,
      size: order.size,
      category: order.category,
      original_price: order.originalPrice,
      ask_price: price.listPrice,
      seller_payout: price.sellerPayout,
      declared_grade: grade,
      status: "verifying",
    }).select("id").single();
    if (error) {
      toast.error(error.message);
      setVerifying(false);
      setStep(2);
      return;
    }
    setListingId(data.id);
    setTimeout(async () => {
      await supabase.from("listings").update({ status: "live", updated_at: new Date().toISOString() }).eq("id", data.id);
      setVerifying(false);
      setVerified(true);
    }, 2200);
  };


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Stepper */}
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wide">
          {["Photos", "Condition", "Price", "Verify", "Live"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={i === step ? "text-foreground" : "text-muted-foreground"}>{s}</span>
              {i < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          {step === 0 && (
            <PhotoStep
              photos={photos}
              onToggle={(k: string) => setPhotos((p) => ({ ...p, [k]: !p[k] }))}
              onContinue={() => setStep(1)}
              done={photosDone}
            />
          )}
          {step === 1 && (
            <GradeStep grade={grade} setGrade={setGrade} onBack={() => setStep(0)} onContinue={() => setStep(2)} />
          )}
          {step === 2 && (
            <PriceStep price={price} order={order} grade={grade} onBack={() => setStep(1)} onContinue={startVerify} />
          )}
          {step === 3 && (
            <VerifyStep verifying={verifying} verified={verified} onContinue={() => setStep(4)} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <LiveStep
              onView={() => navigate({ to: "/listing/$id", params: { id: listingId ?? order.orderId } })}
            />
          )}
        </div>

        {/* Summary rail */}
        <aside className="rounded-md border border-border bg-card p-4 shadow-card h-fit sticky top-20">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item</div>
          <div className="mt-2 flex gap-3">
            <img src={order.image} alt={order.title} className="h-28 w-20 rounded-sm object-cover" />
            <div>
              <div className="text-sm font-bold">{order.brand}</div>
              <div className="text-xs text-muted-foreground">{order.title}</div>
              <div className="mt-1 text-[11px]">Size {order.size} · {order.category}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Bought {order.purchaseDate} · {inr(order.originalPrice)}</div>
            </div>
          </div>

          <div className="my-4 h-px bg-border" />

          <SummaryRow label="Photos" value={`${photosDone} / ${angles.length}`} />
          <SummaryRow label="Declared grade" value={grade} />
          <SummaryRow label="Provisional price" value={inr(price.listPrice)} bold />
          <SummaryRow label="Your payout (60%)" value={inr(price.sellerPayout)} accent />
          <SummaryRow label="Myntra fee (40%)" value={inr(price.commission)} />

          <div className="mt-3 rounded-sm bg-accent/50 p-2 text-[11px] text-accent-foreground">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            Price locks after doorstep inspection confirms grade.
          </div>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}

function PhotoStep({ photos, onToggle, onContinue, done }: any) {
  return (
    <section>
      <h2 className="text-2xl font-black">Add photos of your item</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use the in-app camera to capture each angle. Blurry, dark or duplicate photos are auto-rejected.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {angles.map((a) => {
          const done = photos[a.key];
          return (
            <button
              key={a.key}
              onClick={() => onToggle(a.key)}
              className={`group relative aspect-[4/5] rounded-md border-2 border-dashed p-4 text-left transition ${done ? "border-success bg-success/5" : "border-border hover:border-primary"}`}
            >
              {done ? (
                <>
                  <img src={`https://picsum.photos/seed/upload-${a.key}/300/400`} alt="" className="absolute inset-0 h-full w-full rounded-md object-cover" />
                  <div className="absolute inset-0 rounded-md bg-black/30" />
                  <div className="absolute right-2 top-2 rounded-full bg-success p-1 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="absolute bottom-2 left-2 text-xs font-bold uppercase tracking-wide text-white">{a.label}</div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                  <div className="mt-2 text-sm font-bold uppercase">{a.label}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{a.tip}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-md border border-border bg-accent/40 p-3 text-xs">
        <div className="mb-1 font-bold uppercase tracking-wide">Live capture guardrails</div>
        <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
          <li>Blur & lighting checked in real-time</li>
          <li>Stock/scraped photos are auto-flagged via reverse-image search</li>
          <li>Photos must match the brand & category of your original order</li>
        </ul>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onContinue}
          disabled={done < angles.length}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Continue ({done}/{angles.length})
        </button>
      </div>
    </section>
  );
}

function GradeStep({ grade, setGrade, onBack, onContinue }: { grade: Grade; setGrade: (g: Grade) => void; onBack: () => void; onContinue: () => void; }) {
  return (
    <section>
      <h2 className="text-2xl font-black">Rate the condition honestly</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Our delivery partner re-confirms this at pickup. Misdeclared grades affect your seller score and future payouts.
      </p>
      <div className="mt-4 grid gap-3">
        {grades.map((g) => (
          <button
            key={g.grade}
            onClick={() => setGrade(g.grade)}
            className={`rounded-md border-2 p-4 text-left transition ${grade === g.grade ? "border-primary bg-primary/5" : "border-border hover:border-foreground"}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-black">{g.grade}</div>
              <div className={`text-xs font-bold uppercase ${grade === g.grade ? "text-primary" : "text-muted-foreground"}`}>{g.example}</div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{g.blurb}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground" />
        <div>
          Overstating grade twice forfeits your ₹79 seller deposit and can restrict future listings.
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase">Back</button>
        <button onClick={onContinue} className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground">Continue</button>
      </div>
    </section>
  );
}

function PriceStep({ price, order, grade, onBack, onContinue }: any) {
  return (
    <section>
      <h2 className="text-2xl font-black">Your provisional price</h2>
      <p className="mt-1 text-sm text-muted-foreground">Fully transparent breakdown. Buyer sees this labelled "AI-estimated".</p>

      <div className="mt-4 overflow-hidden rounded-md border border-border">
        <div className="bg-gradient-hero p-6 text-white">
          <div className="text-xs font-bold uppercase tracking-widest text-white/80">Listing Price</div>
          <div className="mt-1 text-4xl font-black">{inr(price.listPrice)}</div>
          <div className="mt-1 text-sm text-white/85">You receive <b>{inr(price.sellerPayout)}</b> after inspection</div>
        </div>
        <div className="divide-y divide-border text-sm">
          <BreakRow label="Original Myntra price" value={inr(order.originalPrice)} />
          <BreakRow label={`Depreciation · ${order.ageYears} yr × 20%`} value={`× ${price.depreciation.toFixed(2)}`} />
          <BreakRow label={`Grade factor · ${grade}`} value={`× ${price.factor.toFixed(2)}`} />
          <BreakRow label="Final listing price" value={inr(price.listPrice)} bold />
          <BreakRow label="Seller payout (60%)" value={inr(price.sellerPayout)} accent />
          <BreakRow label="Myntra commission (40%)" value={inr(price.commission)} />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-accent/40 p-3 text-xs">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
        <div>Price is provisional. If our inspector revises the grade, we recompute and notify the buyer before charging.</div>
      </div>

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase">Back</button>
        <button onClick={onContinue} className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground">Publish listing</button>
      </div>
    </section>
  );
}

function VerifyStep({ verifying, verified, onContinue, onBack }: any) {
  const checks = [
    { label: "Image quality gate", note: "Blur / lighting / resolution / background" },
    { label: "Category & brand match", note: "Against original Myntra purchase record" },
    { label: "Reverse-image duplicate check", note: "Reject scraped or stock photos" },
    { label: "Confidence score", note: "Verified · Needs Review · Rejected" },
  ];
  return (
    <section>
      <h2 className="text-2xl font-black">Auto Product Verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">Runs in the background — no waiting on a rendering pipeline.</p>
      <div className="mt-4 grid gap-3">
        {checks.map((c, i) => (
          <div key={c.label} className="flex items-center justify-between rounded-md border border-border bg-card p-3">
            <div>
              <div className="text-sm font-bold">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.note}</div>
            </div>
            <div>
              {verifying ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" style={{ animationDelay: `${i * 120}ms` }} />
              ) : (
                <div className="rounded-full bg-success p-1 text-white"><Check className="h-4 w-4" /></div>
              )}
            </div>
          </div>
        ))}
      </div>

      {verified && (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-verified/30 bg-verified/10 p-4 text-sm text-verified">
          <ShieldCheck className="h-5 w-5" />
          <div>
            <div className="font-bold">Verified — high confidence</div>
            <div className="text-xs">Your listing is ready to go live on ReSell.</div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase">Back</button>
        <button onClick={onContinue} disabled={!verified} className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-40">
          Go live
        </button>
      </div>
    </section>
  );
}

function LiveStep({ onView }: { onView: () => void }) {
  return (
    <section className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-white">
        <Check className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-2xl font-black">Your listing is live!</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Buyers can now see it in ReSell search & discovery, labelled AI Verified. You'll get a push notification the moment it sells.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={onView} className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground">
          Track listing
        </button>
        <Link to="/" className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase">
          Back to marketplace
        </Link>
      </div>
    </section>
  );
}

function BreakRow({ label, value, bold, accent }: any) {
  return (
    <div className={`flex justify-between px-5 py-3 ${bold ? "bg-muted/50 font-bold" : ""}`}>
      <span className={accent ? "text-success font-semibold" : ""}>{label}</span>
      <span className={accent ? "text-success font-bold" : ""}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, bold, accent }: any) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-success font-bold" : ""}>{value}</span>
    </div>
  );
}
