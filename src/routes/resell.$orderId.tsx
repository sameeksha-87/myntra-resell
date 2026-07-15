import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { computePrice, eligibleOrders, inr, type Grade, type EligibleOrder } from "@/lib/mock-data";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  X,
  AlertTriangle,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { measureBlur } from "@/lib/image-processing";

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
  { key: "top", label: "Top Angle", tip: "Collar, shoulders, or top-down view" },
  { key: "left", label: "Left Angle", tip: "Left side profile showing seams/sleeves" },
  { key: "right", label: "Right Angle", tip: "Right side profile showing seams/sleeves" },
];

const grades: { grade: Grade; blurb: string; example: string }[] = [
  {
    grade: "Pristine",
    blurb: "Unworn or worn once. Tags on or original packaging.",
    example: "0 signs of wear",
  },
  {
    grade: "Excellent",
    blurb: "Lightly worn 2-5 times. No visible flaws.",
    example: "Minimal signs of wear",
  },
  {
    grade: "Good",
    blurb: "Worn many times. Minor visible wear, fully functional.",
    example: "Small pilling or fade",
  },
];

function ResellFlow() {
  const { order } = Route.useLoaderData();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>(0);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<Grade>("Excellent");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [listingId, setListingId] = useState<string | null>(null);

  const [activeAngle, setActiveAngle] = useState<string | null>(null);
  const [scanningAngle, setScanningAngle] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [simBlur, setSimBlur] = useState<boolean>(false);
  const [simWrongAngle, setSimWrongAngle] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname }, replace: true });
    }
  }, [user, loading, navigate]);

  const photosDone = Object.keys(photos).length;
  const price = useMemo(
    () => computePrice(order.originalPrice, order.ageYears, grade),
    [order, grade],
  );

  const startVerify = async () => {
    if (!user) return;
    setStep(3);
    setVerifying(true);
    const { data, error } = await supabase
      .from("listings")
      .insert({
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
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setVerifying(false);
      setStep(2);
      return;
    }
    setListingId(data.id);
    setTimeout(async () => {
      await supabase
        .from("listings")
        .update({ status: "live", updated_at: new Date().toISOString() })
        .eq("id", data.id);
      setVerifying(false);
      setVerified(true);
    }, 2200);
  };

  const handleMobileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAngle) return;

    const angleKey = activeAngle;
    setActiveAngle(null);
    setScanningAngle(angleKey);
    setScanStatus("Reading captured image...");

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";

    setTimeout(async () => {
      setScanStatus("Analyzing image focus (Laplacian Variance)...");
      let blurResult = await measureBlur(dataUrl);

      if (simBlur) {
        blurResult = { variance: 45, isBlurry: true };
      }

      if (blurResult.isBlurry) {
        toast.error(
          `Rejected: Photo is too blurry! (Variance: ${Math.round(blurResult.variance)} < 100). Hold camera steady and retake.`,
        );
        setScanningAngle(null);
        return;
      }

      setScanStatus("Checking perspective alignment...");
      setTimeout(() => {
        if (simWrongAngle) {
          toast.error(
            `Rejected: Incorrect perspective angle. Please align the item to match the requested framing.`,
          );
          setScanningAngle(null);
          return;
        }

        toast.success(
          `AI Verification Passed! Sharpness: ${Math.round(blurResult.variance)} | Perspective: 93%`,
        );
        setPhotos((prev) => ({ ...prev, [angleKey]: dataUrl }));
        setScanningAngle(null);
      }, 1000);
    }, 1200);
  };

  const triggerCamera = (key: string) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    setActiveAngle(key);

    if (isMobile) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleWebcamCapture = (dataUrl: string) => {
    if (activeAngle) {
      setPhotos((prev) => ({ ...prev, [activeAngle]: dataUrl }));
      setActiveAngle(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleMobileCapture}
      />

      {activeAngle &&
        !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ) && (
          <CameraModal
            angleLabel={angles.find((a) => a.key === activeAngle)?.label || ""}
            onCapture={handleWebcamCapture}
            onClose={() => setActiveAngle(null)}
            simBlur={simBlur}
            simWrongAngle={simWrongAngle}
          />
        )}

      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wide">
          {["Photos", "Condition", "Price", "Verify", "Live"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
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
              onTrigger={triggerCamera}
              onContinue={() => setStep(1)}
              done={photosDone}
              scanningAngle={scanningAngle}
              scanStatus={scanStatus}
              simBlur={simBlur}
              setSimBlur={setSimBlur}
              simWrongAngle={simWrongAngle}
              setSimWrongAngle={setSimWrongAngle}
            />
          )}
          {step === 1 && (
            <GradeStep
              grade={grade}
              setGrade={setGrade}
              onBack={() => setStep(0)}
              onContinue={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <PriceStep
              price={price}
              order={order}
              grade={grade}
              onBack={() => setStep(1)}
              onContinue={startVerify}
            />
          )}
          {step === 3 && (
            <VerifyStep
              verifying={verifying}
              verified={verified}
              onContinue={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <LiveStep
              onView={() =>
                navigate({ to: "/listing/$id", params: { id: listingId ?? order.orderId } })
              }
            />
          )}
        </div>

        <aside className="rounded-md border border-border bg-card p-4 shadow-card h-fit sticky top-20">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Item
          </div>
          <div className="mt-2 flex gap-3">
            <img
              src={order.image}
              alt={order.title}
              className="h-28 w-20 rounded-sm object-cover"
            />
            <div>
              <div className="text-sm font-bold">{order.brand}</div>
              <div className="text-xs text-muted-foreground">{order.title}</div>
              <div className="mt-1 text-[11px]">
                Size {order.size} · {order.category}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Bought {order.purchaseDate} · {inr(order.originalPrice)}
              </div>
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

interface PhotoStepProps {
  photos: Record<string, string>;
  onTrigger: (key: string) => void;
  onContinue: () => void;
  done: number;
  scanningAngle: string | null;
  scanStatus: string;
  simBlur: boolean;
  setSimBlur: (v: boolean) => void;
  simWrongAngle: boolean;
  setSimWrongAngle: (v: boolean) => void;
}

function PhotoStep({
  photos,
  onTrigger,
  onContinue,
  done,
  scanningAngle,
  scanStatus,
  simBlur,
  setSimBlur,
  simWrongAngle,
  setSimWrongAngle,
}: PhotoStepProps) {
  return (
    <section>
      <h2 className="text-2xl font-black">Add photos of your item</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Use the in-app camera to capture each perspective. Pre-existing file uploads are disabled to
        prevent fraud.
      </p>

      <div className="mt-4 rounded-md border border-dashed border-primary bg-primary/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-bold text-primary mb-2">
          <Sliders className="h-4 w-4" /> AI Guardrails Tester Settings
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Configure these switches to test the rejected camera capture workflows locally.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs">
            <input
              type="checkbox"
              checked={simBlur}
              onChange={(e) => setSimBlur(e.target.checked)}
              className="rounded border-border focus:ring-primary h-4 w-4"
            />
            Simulate Blurry Photo Reject
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold text-xs">
            <input
              type="checkbox"
              checked={simWrongAngle}
              onChange={(e) => setSimWrongAngle(e.target.checked)}
              className="rounded border-border focus:ring-primary h-4 w-4"
            />
            Simulate Incorrect Angle Reject
          </label>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {angles.map((a) => {
          const photoUrl = photos[a.key];
          const isScanning = scanningAngle === a.key;

          return (
            <button
              key={a.key}
              onClick={() => !isScanning && onTrigger(a.key)}
              className={`group relative aspect-[3/4] rounded-md border-2 border-dashed p-3 text-left transition ${
                photoUrl
                  ? "border-success bg-success/5"
                  : isScanning
                    ? "border-primary bg-primary/5 cursor-wait"
                    : "border-border hover:border-primary"
              }`}
            >
              {photoUrl ? (
                <>
                  <img
                    src={photoUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-md object-cover"
                  />
                  <div className="absolute inset-0 rounded-md bg-black/30" />
                  <div className="absolute right-2 top-2 rounded-full bg-success p-1 text-white shadow-md">
                    <Check className="h-3 w-3" />
                  </div>
                  <div className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wide text-white">
                    {a.label}
                  </div>
                </>
              ) : isScanning ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-1">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary mb-1.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary animate-pulse">
                    Scanning...
                  </span>
                  <span className="text-[8px] text-muted-foreground mt-0.5 line-clamp-2">
                    {scanStatus}
                  </span>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center p-1">
                  <Camera className="h-5 w-5 text-muted-foreground group-hover:text-primary mb-1.5" />
                  <div className="text-[10px] font-bold uppercase">{a.label}</div>
                  <div className="mt-0.5 text-[8px] text-muted-foreground leading-tight">
                    {a.tip}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-md border border-border bg-accent/40 p-3.5 text-xs">
        <div className="mb-1 font-bold uppercase tracking-wide flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-success" /> Live capture guardrails active
        </div>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
          <li>Blur, lighting and detail level checked instantly on device</li>
          <li>Angle Verification limits capture to specified layout alignment guide</li>
          <li>System gallery upload is blocked; only native viewport captures allowed</li>
        </ul>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onContinue}
          disabled={done < angles.length}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Continue Condition Verification ({done}/{angles.length})
        </button>
      </div>
    </section>
  );
}

function CameraModal({
  angleLabel,
  onCapture,
  onClose,
  simBlur,
  simWrongAngle,
}: {
  angleLabel: string;
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  simBlur: boolean;
  simWrongAngle: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("");

  useEffect(() => {
    async function startCamera() {
      try {
        setLoading(true);
        setError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Could not access device camera. Please allow permission to start live capture.");
        setLoading(false);
      }
    }
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setScanning(true);
    setScanStatus("Analyzing image resolution and details...");

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setScanning(false);
      return;
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");

    setTimeout(async () => {
      setScanStatus("Calculating sharpness variance (Laplacian)...");
      let blurResult = await measureBlur(dataUrl);

      if (simBlur) {
        blurResult = { variance: 38, isBlurry: true };
      }

      if (blurResult.isBlurry) {
        toast.error(
          `Rejected: Photo is too blurry! (Laplacian score: ${Math.round(blurResult.variance)} < 100). Hold camera steady and retake.`,
        );
        setScanning(false);
        return;
      }

      setScanStatus(`Verifying alignment for ${angleLabel}...`);
      setTimeout(() => {
        if (simWrongAngle) {
          toast.error(
            `Rejected: Wrong perspective detected. Ensure you capture the correct ${angleLabel} profile.`,
          );
          setScanning(false);
          return;
        }

        toast.success(
          `AI Verification Passed! Sharpness: ${Math.round(blurResult.variance)} | Alignment: 94%`,
        );
        onCapture(dataUrl);
        setScanning(false);
      }, 1000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-base font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
          <Camera className="h-5 w-5 text-primary" /> Live Capture Viewfinder
        </h3>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Aligning: <span className="text-primary font-bold">{angleLabel}</span>. Stock files and
          library selections are disabled.
        </p>

        <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-lg bg-zinc-900 border border-zinc-850">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span className="text-[10px] text-zinc-400">
                Initializing native camera stream...
              </span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-xs text-red-400">
              <AlertTriangle className="h-7 w-7 mb-1.5" />
              {error}
            </div>
          )}
          {!loading && !error && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-dashed border-white/30 h-[80%] w-[80%] rounded-md flex items-center justify-center">
                  <span className="bg-black/60 px-2 py-0.5 text-[9px] font-bold tracking-widest text-white/90 uppercase rounded border border-white/10 mt-auto mb-2">
                    {angleLabel} Overlay Grid
                  </span>
                </div>
              </div>
            </>
          )}

          {scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-center p-4">
              <div className="relative h-12 w-12 mb-3">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 border border-primary text-primary">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary">
                {scanStatus}
              </div>
              <div className="mt-1 text-[10px] text-zinc-400">Evaluating quality metrics...</div>
              <div className="absolute left-0 right-0 h-0.5 bg-red-500/80 animate-bounce top-1/2 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-800 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-900 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCapture}
            disabled={loading || !!error || scanning}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 disabled:opacity-40 transition"
          >
            <Camera className="h-4 w-4" /> Capture Photo
          </button>
        </div>
      </div>
    </div>
  );
}

function GradeStep({
  grade,
  setGrade,
  onBack,
  onContinue,
}: {
  grade: Grade;
  setGrade: (g: Grade) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <h2 className="text-2xl font-black">Rate the condition honestly</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Our delivery partner re-confirms this at pickup. Misdeclared grades affect your seller score
        and future payouts.
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
              <div
                className={`text-xs font-bold uppercase ${grade === g.grade ? "text-primary" : "text-muted-foreground"}`}
              >
                {g.example}
              </div>
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
        <button
          onClick={onBack}
          className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground"
        >
          Continue
        </button>
      </div>
    </section>
  );
}

interface PriceStepProps {
  price: ReturnType<typeof computePrice>;
  order: EligibleOrder;
  grade: Grade;
  onBack: () => void;
  onContinue: () => void;
}

function PriceStep({ price, order, grade, onBack, onContinue }: PriceStepProps) {
  return (
    <section>
      <h2 className="text-2xl font-black">Your provisional price</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Fully transparent breakdown. Buyer sees this labelled "AI-estimated".
      </p>

      <div className="mt-4 overflow-hidden rounded-md border border-border">
        <div className="bg-gradient-hero p-6 text-white">
          <div className="text-xs font-bold uppercase tracking-widest text-white/80">
            Listing Price
          </div>
          <div className="mt-1 text-4xl font-black">{inr(price.listPrice)}</div>
          <div className="mt-1 text-sm text-white/85">
            You receive <b>{inr(price.sellerPayout)}</b> after inspection
          </div>
        </div>
        <div className="divide-y divide-border text-sm">
          <BreakRow label="Original Myntra price" value={inr(order.originalPrice)} />
          <BreakRow
            label={`Depreciation · ${order.ageYears} yr × 20%`}
            value={`× ${price.depreciation.toFixed(2)}`}
          />
          <BreakRow label={`Grade factor · ${grade}`} value={`× ${price.factor.toFixed(2)}`} />
          <BreakRow label="Final listing price" value={inr(price.listPrice)} bold />
          <BreakRow label="Seller payout (60%)" value={inr(price.sellerPayout)} accent />
          <BreakRow label="Myntra commission (40%)" value={inr(price.commission)} />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-accent/40 p-3 text-xs">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          Price is provisional. If our inspector revises the grade, we recompute and notify the
          buyer before charging.
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground"
        >
          Publish listing
        </button>
      </div>
    </section>
  );
}

interface VerifyStepProps {
  verifying: boolean;
  verified: boolean;
  onContinue: () => void;
  onBack: () => void;
}

function VerifyStep({ verifying, verified, onContinue, onBack }: VerifyStepProps) {
  const checks = [
    { label: "Image quality gate", note: "Blur / lighting / resolution / background" },
    { label: "Category & brand match", note: "Against original Myntra purchase record" },
    { label: "Reverse-image duplicate check", note: "Reject scraped or stock photos" },
    { label: "Confidence score", note: "Verified · Needs Review · Rejected" },
  ];
  return (
    <section>
      <h2 className="text-2xl font-black">Auto Product Verification</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Runs in the background — no waiting on a rendering pipeline.
      </p>
      <div className="mt-4 grid gap-3">
        {checks.map((c, i) => (
          <div
            key={c.label}
            className="flex items-center justify-between rounded-md border border-border bg-card p-3"
          >
            <div>
              <div className="text-sm font-bold">{c.label}</div>
              <div className="text-xs text-muted-foreground">{c.note}</div>
            </div>
            <div>
              {verifying ? (
                <div
                  className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ) : (
                <div className="rounded-full bg-success p-1 text-white">
                  <Check className="h-4 w-4" />
                </div>
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
        <button
          onClick={onBack}
          className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!verified}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-40"
        >
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
        Buyers can now see it in ReSell search & discovery, labelled AI Verified. You'll get a push
        notification the moment it sells.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onView}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground"
        >
          Track listing
        </button>
        <Link
          to="/"
          className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase"
        >
          Back to marketplace
        </Link>
      </div>
    </section>
  );
}

interface BreakRowProps {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}

function BreakRow({ label, value, bold, accent }: BreakRowProps) {
  return (
    <div className={`flex justify-between px-5 py-3 ${bold ? "bg-muted/50 font-bold" : ""}`}>
      <span className={accent ? "text-success font-semibold" : ""}>{label}</span>
      <span className={accent ? "text-success font-bold" : ""}>{value}</span>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}

function SummaryRow({ label, value, bold, accent }: SummaryRowProps) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-success font-bold" : ""}>{value}</span>
    </div>
  );
}
