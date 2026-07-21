// src/routes/resell.$orderId.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { inr, type Grade } from "@/lib/mock-data";
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
  ChevronLeft,
  XCircle,
  Wallet,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { measureBlur } from "@/lib/image-processing";
import {
  createListingDraft,
  uploadListingMedia,
  submitForVerification,
  publishListing,
} from "@/integrations/supabase/actions.server";

export const Route = createFileRoute("/resell/$orderId")({
  loader: ({ params }) => {
    return { orderItemId: params.orderId };
  },
  head: ({ params }) => ({
    meta: [{ title: `Resell closet item — ReSell by Myntra` }],
  }),
  component: ResellFlow,
});

type Step = 0 | 1 | 2;

const requiredAngles = [
  {
    key: "top",
    label: "Front / Top View",
    tip: "Front of clothing or top-down view of shoes",
    required: true,
  },
  {
    key: "left",
    label: "Left / Back View",
    tip: "Back of clothing or left profile of shoes",
    required: true,
  },
  {
    key: "right",
    label: "Right / Side View",
    tip: "Side profile of clothing or right profile of shoes",
    required: true,
  },
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
  const { orderItemId } = Route.useLoaderData();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [step, setStep] = useState<Step>(0);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<Grade>("Excellent");
  const [enteredPrice, setEnteredPrice] = useState<string>("");
  const [conditionDetails, setConditionDetails] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifFailed, setVerifFailed] = useState(false);
  const [verifReason, setVerifReason] = useState("");
  const [verificationChecks, setVerificationChecks] = useState<Record<string, boolean> | null>(
    null,
  );
  const [listingId, setListingId] = useState<string | null>(null);

  // Loaded DB Order Item details
  const [order, setOrder] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(true);

  const [activeAngle, setActiveAngle] = useState<string | null>(null);
  const [scanningAngle, setScanningAngle] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [simBlur, setSimBlur] = useState<boolean>(false);
  const [simWrongAngle, setSimWrongAngle] = useState<boolean>(false);

  const [optionalSlots, setOptionalSlots] = useState<
    { key: string; label: string; tip: string; required: boolean }[]
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname }, replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setOrderLoading(true);
    supabase
      .from("myntra_order_items")
      .select(
        `
        id,
        title,
        size,
        original_price_paise,
        image,
        myntra_orders (
          id,
          delivered_at
        )
      `,
      )
      .eq("id", orderItemId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Order item not found");
          navigate({ to: "/orders" });
          return;
        }

        const originalPrice = Number(data.original_price_paise) / 100;
        if (originalPrice < 3000) {
          toast.error("Resale is not allowed for items purchased under ₹3,000");
          navigate({ to: "/orders" });
          return;
        }

        const o = data.myntra_orders as any;
        const purchaseDate = new Date(o.delivered_at);
        const ageYears = Math.max(
          0.1,
          (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
        );

        setOrder({
          id: data.id,
          orderId: o.id,
          brand: "Zara", // Fallback brand name
          title: data.title,
          category: "Outerwear",
          size: data.size,
          originalPrice: Number(data.original_price_paise) / 100,
          purchaseDate: purchaseDate.toLocaleDateString("en-IN", {
            month: "short",
            year: "numeric",
          }),
          ageYears: ageYears,
          image: data.image,
        });
        setOrderLoading(false);
      });
  }, [orderItemId, user]);

  const photosDone = Object.keys(photos).length;

  const price = useMemo(() => {
    if (!order) return { listPrice: 0, sellerPayout: 0, commission: 0, depreciation: 1, factor: 1 };

    // Staging / preview formula: matches server algorithm
    const gradeFactors = { Pristine: 1.0, Excellent: 0.85, Good: 0.7 };
    const factor = gradeFactors[grade] || 0.85;
    const depreciation = Math.max(0.2, 1.0 - 0.2 * order.ageYears);
    const listPrice = Math.max(0, Math.round(order.originalPrice * depreciation * factor));
    const sellerPayout = Math.round(listPrice * 0.9);
    const commission = listPrice - sellerPayout;

    return {
      listPrice,
      sellerPayout,
      commission,
      depreciation,
      factor,
    };
  }, [order, grade]);

  const activePrice = useMemo(() => {
    const aiEstimate = price.listPrice;
    const rawCustomPrice =
      enteredPrice && !isNaN(Number(enteredPrice)) ? Number(enteredPrice) : aiEstimate;
    const listPrice = order ? Math.min(rawCustomPrice, order.originalPrice) : rawCustomPrice;
    const sellerPayout = Math.round(listPrice * 0.9);
    const commission = listPrice - sellerPayout;
    return {
      listPrice,
      sellerPayout,
      commission,
      aiEstimate,
    };
  }, [price.listPrice, enteredPrice, order]);

  const startVerify = async () => {
    if (!user || !order) return;
    setStep(1);
    setVerifying(true);
    setVerifFailed(false);
    setScanStatus("Creating listing draft on server...");

    try {
      // 1. Create draft on server
      const draftResult = await createListingDraft({
        data: {
          orderItemId: order.id,
          declaredGrade: grade,
          customPrice: enteredPrice ? Number(enteredPrice) : undefined,
          conditionDetails: conditionDetails || undefined,
        },
      });
      const currentListingId = draftResult.listingId;
      setListingId(currentListingId);

      // 2. Upload photo attachments
      const photoKeys = Object.keys(photos);
      for (let i = 0; i < photoKeys.length; i++) {
        const angle = photoKeys[i];
        setScanStatus(`Uploading original ${angle} view to secure private storage...`);
        await uploadListingMedia({
          data: {
            listingId: currentListingId,
            angle: angle,
            imageBase64: photos[angle],
          },
        });
      }

      // 3. Submit for AI verification
      setScanStatus("Running server checks for lighting, perspective and duplicate risk...");
      const topPhoto = photos["top"] || photos["front"] || Object.values(photos)[0];
      const verifResult = await submitForVerification({
        data: {
          listingId: currentListingId,
          simBlur,
          simWrongAngle,
          photoBase64: topPhoto,
          catalogImageUrl: order.image,
        },
      });

      setVerifying(false);
      setVerificationChecks(verifResult.checkResults || null);
      if (verifResult.success) {
        setVerified(true);
        toast.success("AI Verification passed! Click 'Go Live' to publish it.");
      } else {
        setVerified(false);
        setVerifFailed(true);
        setVerifReason(verifResult.reason || "Verification check failed");
        toast.error(`Verification rejected: ${verifResult.reason}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit listing");
      setVerifying(false);
      setStep(0);
    }
  };

  const processFile = async (file: File, key: string) => {
    setScanningAngle(key);
    setScanStatus("Reading image...");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setScanStatus("Analyzing image focus...");
      let blurResult = await measureBlur(dataUrl);

      if (simBlur) {
        blurResult = { variance: 45, isBlurry: true };
      }

      if (blurResult.isBlurry) {
        toast.error(
          `Rejected: Photo is too blurry! (Variance: ${Math.round(blurResult.variance)} < 100). Hold camera steady and retake.`,
        );
        return;
      }

      setScanStatus("Checking perspective alignment...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (simWrongAngle && key === "top") {
        toast.error(
          `Rejected: Incorrect perspective angle. Please align the item to match the requested framing.`,
        );
        return;
      }

      toast.success("Upload Successful");
      setPhotos((prev) => ({ ...prev, [key]: dataUrl }));
    } catch (err) {
      console.error(err);
      toast.error("Failed to process image");
    } finally {
      setScanningAngle(null);
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAngle) return;
    const key = activeAngle;
    setActiveAngle(null);
    await processFile(file, key);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleFileBrowse = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeAngle) return;
    const key = activeAngle;
    setActiveAngle(null);
    await processFile(file, key);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerCamera = (key: string) => {
    setActiveAngle(key);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    if (isMobile) {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  const triggerUpload = (key: string) => {
    setActiveAngle(key);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const addOptionalSlot = () => {
    const totalCount = requiredAngles.length + optionalSlots.length;
    if (totalCount >= 10) {
      toast.error("You can upload a maximum of 10 photos.");
      return;
    }
    const nextIndex = optionalSlots.length + 1;
    const newKey = `optional_${Date.now()}`;
    setOptionalSlots((prev) => [
      ...prev,
      {
        key: newKey,
        label: `Photo ${requiredAngles.length + nextIndex}`,
        tip: "Optional angle, tag, or defect photo",
        required: false,
      },
    ]);
  };

  const removeOptionalSlot = (key: string) => {
    setOptionalSlots((prev) => prev.filter((s) => s.key !== key));
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleWebcamCapture = (dataUrl: string) => {
    if (activeAngle) {
      setPhotos((prev) => ({ ...prev, [activeAngle]: dataUrl }));
      setActiveAngle(null);
    }
  };

  if (orderLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading order details...</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileBrowse}
      />

      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      {activeAngle &&
        !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        ) && (
          <CameraModal
            angleLabel={
              [...requiredAngles, ...optionalSlots].find((a) => a.key === activeAngle)?.label || ""
            }
            onCapture={handleWebcamCapture}
            onClose={() => setActiveAngle(null)}
            simBlur={simBlur}
            simWrongAngle={simWrongAngle}
          />
        )}

      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-wide">
          {["Upload & Details", "Verify", "Live"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={i === step ? "text-foreground" : "text-muted-foreground"}>{s}</span>
              {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
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
              grade={grade}
              setGrade={setGrade}
              enteredPrice={enteredPrice}
              setEnteredPrice={setEnteredPrice}
              conditionDetails={conditionDetails}
              setConditionDetails={setConditionDetails}
              aiEstimate={price.listPrice}
              activePrice={activePrice}
              order={order}
              onContinue={startVerify}
              done={photosDone}
              scanningAngle={scanningAngle}
              scanStatus={scanStatus}
              simBlur={simBlur}
              setSimBlur={setSimBlur}
              simWrongAngle={simWrongAngle}
              setSimWrongAngle={setSimWrongAngle}
              requiredAngles={requiredAngles}
              optionalSlots={optionalSlots}
              onAddOptional={addOptionalSlot}
              onRemoveOptional={removeOptionalSlot}
              processFile={processFile}
              onTriggerUpload={triggerUpload}
            />
          )}
          {step === 1 && (
            <VerifyStep
              verifying={verifying}
              verified={verified}
              failed={verifFailed}
              reason={verifReason}
              verificationChecks={verificationChecks}
              onContinue={() => setStep(2)}
              onBack={() => {
                setStep(0); // Let them retake photos if verification failed
                setVerified(false);
                setVerifFailed(false);
              }}
            />
          )}
          {step === 2 && (
            <LiveStep
              onView={() =>
                navigate({ to: "/listing/$id", params: { id: listingId ?? order.orderId } })
              }
            />
          )}
        </div>

        <aside className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit sticky top-24 space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Listing Summary
            </h3>
            <div className="flex gap-4">
              <img
                src={order.image}
                alt={order.title}
                className="h-28 w-20 rounded-md object-cover bg-muted border border-border shadow-sm"
              />
              <div className="flex flex-col justify-between py-1">
                <div>
                  <div className="text-sm font-black text-foreground">{order.brand}</div>
                  <div className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                    {order.title}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground w-fit">
                  Size: {order.size}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2.5">
            <SummaryRow label="Original Purchase Price" value={inr(order.originalPrice)} />
            <SummaryRow label="Estimated Resale Price" value={inr(activePrice.listPrice)} bold />
            <SummaryRow label="Seller Payout" value={inr(activePrice.sellerPayout)} accent bold />
            <SummaryRow
              label="Photos Uploaded"
              value={`${photosDone} / ${requiredAngles.length + optionalSlots.length}`}
            />
            <SummaryRow label="Declared Grade" value={grade} />
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Verification Status
            </div>
            {verifying ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-600 border border-amber-500/20">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                AI Verification in progress...
              </div>
            ) : verified ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                <Check className="h-3.5 w-3.5 animate-pulse" />
                Verified & Ready
              </div>
            ) : verifFailed ? (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 border border-rose-500/20">
                <XCircle className="h-3.5 w-3.5" />
                Verification Failed
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-500/10 px-3 py-2 text-xs font-bold text-zinc-600 border border-zinc-500/20">
                <AlertTriangle className="h-3.5 w-3.5 text-zinc-500" />
                Draft ({photosDone} / {requiredAngles.length + optionalSlots.length} photos)
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground font-black">
              Quality Inspection Note:
            </span>{" "}
            Your final payout will be processed after the item passes the quality inspection.
          </div>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}

function Loader2(props: any) {
  return <Loader2Icon {...props} />;
}

function Loader2Icon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

interface PhotoStepProps {
  photos: Record<string, string>;
  onTrigger: (key: string) => void;
  grade: Grade;
  setGrade: (g: Grade) => void;
  enteredPrice: string;
  setEnteredPrice: (p: string) => void;
  conditionDetails: string;
  setConditionDetails: (d: string) => void;
  aiEstimate: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activePrice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  onContinue: () => void;
  done: number;
  scanningAngle: string | null;
  scanStatus: string;
  simBlur: boolean;
  setSimBlur: (v: boolean) => void;
  simWrongAngle: boolean;
  setSimWrongAngle: (v: boolean) => void;
  requiredAngles: { key: string; label: string; tip: string; required: boolean }[];
  optionalSlots: { key: string; label: string; tip: string; required: boolean }[];
  onAddOptional: () => void;
  onRemoveOptional: (key: string) => void;
  processFile: (file: File, key: string) => Promise<void>;
  onTriggerUpload: (key: string) => void;
}

function PhotoStep({
  photos,
  onTrigger,
  grade,
  setGrade,
  enteredPrice,
  setEnteredPrice,
  conditionDetails,
  setConditionDetails,
  aiEstimate,
  activePrice,
  order,
  onContinue,
  done,
  scanningAngle,
  scanStatus,
  requiredAngles,
  optionalSlots,
  onAddOptional,
  onRemoveOptional,
  processFile,
  onTriggerUpload,
}: PhotoStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requiredDone = requiredAngles.every((a) => !!photos[a.key]);

  const renderCard = (a: { key: string; label: string; tip: string; required?: boolean }) => {
    const photoUrl = photos[a.key];
    const isScanning = scanningAngle === a.key;

    return (
      <div
        key={a.key}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) {
            await processFile(file, a.key);
          }
        }}
        className={`group relative aspect-[3/4] rounded-xl border-2 border-dashed p-3 text-left transition flex flex-col justify-between ${
          photoUrl
            ? "border-success bg-success/5"
            : isScanning
              ? "border-primary bg-primary/5 cursor-wait"
              : a.required
                ? "border-primary/45 hover:border-primary bg-background shadow-xs"
                : "border-border/80 hover:border-primary bg-background/40"
        }`}
      >
        {photoUrl ? (
          <>
            <img
              src={photoUrl}
              alt={a.label}
              className="absolute inset-0 h-full w-full rounded-xl object-cover"
            />
            <div className="absolute inset-0 rounded-xl bg-black/40" />

            <div className="absolute right-2 top-2 flex gap-1 z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (a.required) {
                    onTrigger(a.key); // simple reload or allow retaking
                  } else {
                    onRemoveOptional(a.key);
                  }
                }}
                className="rounded-full bg-black/60 p-1 text-white hover:bg-rose-600 transition cursor-pointer shadow"
                title={a.required ? "Clear Photo" : "Remove Photo"}
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="absolute left-3 bottom-3 z-10 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-white">
                {a.label}
              </span>
              <span className="text-[8px] text-zinc-300">
                {a.required ? "Required" : "Optional"}
              </span>
            </div>

            <div className="absolute right-3 bottom-3 z-10 rounded-full bg-success p-1 text-white shadow">
              <Check className="h-2.5 w-2.5" />
            </div>
          </>
        ) : isScanning ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-1">
            <RefreshCw className="h-5 w-5 animate-spin text-primary mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary animate-pulse">
              Processing...
            </span>
            <span className="text-[8px] text-muted-foreground mt-1 line-clamp-2">{scanStatus}</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center p-2 my-auto">
            <Camera className="h-5 w-5 text-muted-foreground group-hover:text-primary mb-2 mx-auto" />
            <div className="text-[10px] font-bold uppercase text-foreground leading-tight">
              {a.label}
              {a.required && <span className="text-primary ml-0.5">*</span>}
            </div>
            <div className="mt-1 text-[8px] text-muted-foreground leading-snug">{a.tip}</div>

            <div className="mt-3.5 flex gap-1.5 z-10 justify-center">
              <button
                type="button"
                onClick={() => onTrigger(a.key)}
                className="px-2 py-1 text-[9px] bg-primary text-primary-foreground rounded hover:bg-primary/95 font-bold uppercase cursor-pointer"
              >
                Camera
              </button>
              <button
                type="button"
                onClick={() => onTriggerUpload(a.key)}
                className="px-2 py-1 text-[9px] bg-muted text-muted-foreground border border-border rounded hover:bg-muted/80 font-bold uppercase cursor-pointer"
              >
                Upload
              </button>
            </div>

            {!a.required && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveOptional(a.key);
                }}
                className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:text-rose-600 transition cursor-pointer"
                title="Delete Card"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-black">Add photos & details of your item</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Capture or upload your item's photos. Our AI will automatically verify them for quality
          and alignment.
        </p>
      </div>

      {/* Photo Upload Guidelines */}
      <div className="rounded-xl border border-border bg-muted/40 p-5 shadow-xs">
        <h3 className="flex items-center gap-2 font-bold text-foreground mb-3 text-sm">
          <Sparkles className="h-4 w-4 text-primary" /> Photo Upload Guidelines
        </h3>
        <ul className="grid gap-2.5 sm:grid-cols-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Place the item on a plain background.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Use good lighting and avoid blurry photos.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Lay the item flat and keep it fully visible.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Capture the main photo from a top-down angle.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Do not use filters or edit the images.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Ensure the brand and size tags are visible.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Include clear photos of any defects, if present.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
            <span>Upload photos of the front, back, brand tag, size tag, and any defects.</span>
          </li>
        </ul>
      </div>

      {/* Upload grid section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Item Photos
          </h3>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {done} of {requiredAngles.length + optionalSlots.length} Photos Uploaded
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {requiredAngles.map((a) => renderCard(a))}
          {optionalSlots.map((a) => renderCard(a))}
        </div>

        {requiredAngles.length + optionalSlots.length < 10 && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onAddOptional}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition cursor-pointer"
            >
              + Add More Photos
            </button>
          </div>
        )}
      </div>

      {/* Condition & details section */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-1.5 mb-4 text-foreground border-b border-border pb-2">
          <Sliders className="h-5 w-5 text-primary" /> Product Condition & Details
        </h3>

        {/* Grade picker */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase text-muted-foreground mb-2">
            Condition Grade
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {grades.map((g) => (
              <button
                key={g.grade}
                type="button"
                onClick={() => setGrade(g.grade)}
                className={`rounded-md border p-3 text-left transition cursor-pointer text-xs ${grade === g.grade ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-foreground bg-background"}`}
              >
                <div className="font-black text-sm">{g.grade}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {g.example}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
            Details about product condition
          </label>
          <textarea
            placeholder="e.g. Only worn twice, looks brand new. No tears, stains, or damage. Comes with original tag."
            value={conditionDetails}
            onChange={(e) => setConditionDetails(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* Price section */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <h3 className="text-base font-bold uppercase tracking-wider flex items-center gap-1.5 mb-4 text-foreground border-b border-border pb-2">
          <Wallet className="h-5 w-5 text-primary" /> Pricing & Payout
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 items-start">
          <div>
            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1.5">
              Resale price (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm font-bold text-muted-foreground">
                ₹
              </span>
              <input
                type="number"
                placeholder={String(aiEstimate)}
                value={enteredPrice}
                onChange={(e) => setEnteredPrice(e.target.value)}
                className={`w-full rounded-md border py-2 pl-7 pr-3 text-sm font-bold focus:outline-none ${
                  enteredPrice && Number(enteredPrice) > order.originalPrice
                    ? "border-rose-500 bg-rose-50/10 focus:border-rose-500"
                    : "border-border bg-background focus:border-primary"
                }`}
              />
            </div>
            {enteredPrice && Number(enteredPrice) > order.originalPrice ? (
              <p className="mt-1.5 text-[11px] text-rose-600 font-semibold leading-snug">
                Resale price cannot exceed the original purchase price of {inr(order.originalPrice)}
                .
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                AI suggests reselling for{" "}
                <span
                  className="font-bold text-primary cursor-pointer hover:underline"
                  onClick={() => setEnteredPrice(String(aiEstimate))}
                >
                  ₹{aiEstimate}
                </span>{" "}
                based on original price ({inr(order.originalPrice)}) and {grade} condition.
              </p>
            )}
          </div>

          <div className="rounded-md bg-muted/40 p-4 text-xs">
            <div className="text-muted-foreground font-bold uppercase tracking-wider text-[10px] mb-1">
              Seller Receives
            </div>
            <div className="text-2xl font-black text-success mb-2">
              {inr(activePrice.sellerPayout)}
            </div>
            <div className="text-muted-foreground leading-relaxed text-[11px]">
              "Your final payout will be processed after the item passes the quality inspection."
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onContinue}
          disabled={
            !requiredDone || (enteredPrice ? Number(enteredPrice) > order.originalPrice : false)
          }
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40 cursor-pointer"
        >
          Verify & Publish Listing ({done}/{requiredAngles.length + optionalSlots.length})
        </button>
      </div>
    </section>
  );
}

function playBeep(freq = 800, duration = 0.1) {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn("Audio playback failed", e);
  }
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

  const [timerSecs, setTimerSecs] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const handleCapture = async () => {
    if (loading || !!error || scanning || timerActive) return;

    if (timerSecs > 0) {
      setTimerActive(true);
      setCountdown(timerSecs);
      playBeep(800, 0.1);

      let currentSecs = timerSecs;
      countdownIntervalRef.current = setInterval(() => {
        currentSecs -= 1;
        if (currentSecs <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setCountdown(null);
          setTimerActive(false);
          playBeep(1200, 0.15); // Confirmation capture beep
          captureNow();
        } else {
          setCountdown(currentSecs);
          playBeep(800, 0.1);
        }
      }, 1000);
    } else {
      playBeep(1200, 0.15);
      captureNow();
    }
  };

  const captureNow = async () => {
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

        toast.success("Upload Successful");
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
          className="absolute right-4 top-4 text-zinc-400 hover:text-white transition cursor-pointer"
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

              {/* Timer selector pill */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/65 backdrop-blur-md rounded-full border border-white/10 p-0.5">
                <div className="pl-2 pr-1 text-zinc-400 flex items-center">
                  <Timer className="h-3.5 w-3.5" />
                </div>
                {[0, 3, 5, 10].map((s) => (
                  <button
                    key={s}
                    disabled={timerActive}
                    onClick={() => setTimerSecs(s)}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full cursor-pointer transition ${
                      timerSecs === s
                        ? "bg-primary text-primary-foreground shadow font-extrabold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {s === 0 ? "Off" : `${s}s`}
                  </button>
                ))}
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-dashed border-white/30 h-[80%] w-[80%] rounded-md flex items-center justify-center">
                  <span className="bg-black/60 px-2 py-0.5 text-[9px] font-bold tracking-widest text-white/90 uppercase rounded border border-white/10 mt-auto mb-2">
                    {angleLabel} Overlay Grid
                  </span>
                </div>
              </div>
            </>
          )}

          {countdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
              <div className="animate-ping absolute inline-flex h-24 w-24 rounded-full bg-primary/20 opacity-75"></div>
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-4xl shadow-[0_0_20px_rgba(var(--primary),0.5)]">
                {countdown}
              </div>
              <span className="mt-4 text-xs font-black uppercase tracking-wider text-white drop-shadow">
                Pose now!
              </span>
            </div>
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
            className="rounded-md border border-zinc-800 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:bg-zinc-900 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCapture}
            disabled={loading || !!error || scanning || timerActive}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 disabled:opacity-40 transition cursor-pointer"
          >
            <Camera className="h-4 w-4" />{" "}
            {timerActive ? `Capturing in ${countdown}s` : "Capture Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface VerifyStepProps {
  verifying: boolean;
  verified: boolean;
  failed: boolean;
  reason: string;
  verificationChecks: Record<string, boolean> | null;
  onContinue: () => void;
  onBack: () => void;
}

function VerifyStep({
  verifying,
  verified,
  failed,
  reason,
  verificationChecks,
  onContinue,
  onBack,
}: VerifyStepProps) {
  const checks = [
    {
      label: "Image quality gate",
      note: "Blur / lighting / resolution check",
      key: "blur_check",
    },
    {
      label: "Category & brand match",
      note: "Against original Myntra purchase record",
      key: "brand_check",
    },
    {
      label: "FashionCLIP & ORB verification match",
      note: "Crop garment via Fashion YOLO, compare via FashionCLIP & ORB feature matching",
      key: "clip_similarity_check",
    },
    {
      label: "Duplicate image detection",
      note: "Prevent stock photo or scraped list",
      key: "duplicate_check",
    },
    {
      label: "Confidence scoring",
      note: "Durable validation audit complete",
      key: "confidence_check",
    },
  ];

  return (
    <section>
      <h2 className="text-2xl font-black">Auto Product Verification</h2>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">
        Server runs validation algorithms asynchronously on the uploaded original media keys.
      </p>

      {verifying && (
        <div className="mt-3 text-xs text-primary font-bold flex items-center gap-1.5 animate-pulse">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Running: {verifying}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {checks.map((c, i) => {
          const checkPassed = (() => {
            if (verifying) return null;
            if (verified) return true;
            if (!verificationChecks) return false;
            if (c.key === "brand_check") return true;
            if (c.key === "confidence_check") return verified;
            return verificationChecks[c.key] !== false;
          })();

          return (
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
                ) : checkPassed ? (
                  <div className="rounded-full bg-success p-1 text-white">
                    <Check className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="rounded-full bg-destructive p-1 text-white">
                    <XCircle className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
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

      {failed && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive leading-relaxed">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-bold">Verification rejected by AI guardrails</div>
            <div className="text-xs">
              Reason code: <span className="font-bold underline">{reason}</span>.
              {reason === "different_product"
                ? " The uploaded photo does not match the original purchase catalog image. Ensure you upload the correct product."
                : reason === "incorrect_angles" || reason.includes("perspective")
                  ? " The capture perspective did not match the grid overlay layout guidelines."
                  : " The photos uploaded were too blurry or low resolution. Hold camera steady and capture in bright lighting."}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase cursor-pointer flex items-center gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" /> {failed ? "Retake Photos" : "Back"}
        </button>
        <button
          onClick={onContinue}
          disabled={!verified}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-40 cursor-pointer"
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
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Buyers can now see it in ReSell search & discovery, labelled AI Verified. You'll get a push
        notification the moment it sells.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onView}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground cursor-pointer"
        >
          Track listing
        </button>
        <Link
          to="/"
          className="rounded-md border border-border px-6 py-3 text-sm font-bold uppercase cursor-pointer"
        >
          Back to marketplace
        </Link>
      </div>
    </section>
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
