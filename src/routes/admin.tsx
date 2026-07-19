// src/routes/admin.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { useRequireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldAlert,
  PackageCheck,
  ClipboardCheck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Coins,
  RefreshCw,
  Layers,
} from "lucide-react";
import { inr } from "@/lib/mock-data";
import { inspectorSubmitReport, adminResolveDispute } from "@/integrations/supabase/actions.server";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Operations Console — ReSell Staff" }] }),
  component: AdminPage,
});

type Tab = "inspect" | "disputes" | "ledger";

function AdminPage() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("inspect");

  // Stats
  const [escrowBalance, setEscrowBalance] = useState(0);
  const [commissionBalance, setCommissionBalance] = useState(0);

  // Inspection Queue
  const [inspectQueue, setInspectQueue] = useState<any[]>([]);
  const [inspectLoading, setInspectLoading] = useState(true);

  // Active Inspection Form State
  const [activeListing, setActiveListing] = useState<any | null>(null);
  const [confirmedGrade, setConfirmedGrade] = useState<"Pristine" | "Excellent" | "Good">(
    "Excellent",
  );
  const [inspectionPassed, setInspectionPassed] = useState(true);
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // Disputes Queue
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [resolvingDisputeId, setResolvingDisputeId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Ledger Entries
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  const fetchInspectionQueue = async () => {
    setInspectLoading(true);
    try {
      // Fetch listings in 'sold' or related shipping/pickup pending status
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          id,
          title,
          brand,
          size,
          declared_grade,
          current_price_paise,
          status,
          resale_orders (
            id,
            buyer_id,
            final_price_paise,
            status
          )
        `,
        )
        .in("status", ["sold", "pickup_scheduled", "picked_up"]);

      if (error) throw error;
      setInspectQueue(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load inspection queue");
    } finally {
      setInspectLoading(false);
    }
  };

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    try {
      const { data, error } = await supabase
        .from("disputes")
        .select(
          `
          id,
          reason,
          status,
          created_at,
          order_id,
          resale_orders (
            final_price_paise,
            buyer_id,
            seller_id,
            listings (
              title,
              brand
            )
          )
        `,
        )
        .eq("status", "open");

      if (error) throw error;
      setDisputes(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load disputes");
    } finally {
      setDisputesLoading(false);
    }
  };

  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLedgerEntries(data || []);

      // Calculate stats from ledger
      let escrow = 0;
      let commission = 0;
      (data || []).forEach((entry: any) => {
        const amt = Number(entry.amount_paise) / 100;
        if (entry.account_to === "escrow") escrow += amt;
        if (entry.account_from === "escrow") escrow -= amt;
        if (entry.account_to === "myntra_commission") commission += amt;
      });
      setEscrowBalance(escrow);
      setCommissionBalance(commission);
    } catch (err: any) {
      toast.error(err.message || "Failed to load ledger records");
    } finally {
      setLedgerLoading(false);
    }
  };

  const refreshAll = () => {
    fetchInspectionQueue();
    fetchDisputes();
    fetchLedger();
  };

  useEffect(() => {
    if (user) {
      refreshAll();
    }
  }, [user]);

  const handleOpenInspectModal = (listing: any) => {
    setActiveListing(listing);
    setConfirmedGrade(listing.declared_grade);
    setInspectionPassed(true);
    setInspectionNotes("");
  };

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListing) return;
    setSubmittingReport(true);
    try {
      const result = await inspectorSubmitReport({
        data: {
          listingId: activeListing.id,
          confirmedGrade: confirmedGrade,
          passed: inspectionPassed,
          notes: inspectionNotes || undefined,
        },
      });

      toast.success(`Doorstep inspection report submitted! Outcome: ${result.outcome}`);
      setActiveListing(null);
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleResolveDispute = async (disputeId: string, action: "refund" | "release_payout") => {
    if (!resolutionNotes) {
      toast.error("Please add resolution notes");
      return;
    }
    setResolvingDisputeId(disputeId);
    try {
      await adminResolveDispute({
        data: {
          disputeId,
          resolutionAction: action,
          notes: resolutionNotes,
        },
      });
      toast.success(
        `Dispute resolved. Outcome: ${action === "refund" ? "refunded" : "payout released"}`,
      );
      setResolutionNotes("");
      refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve dispute");
    } finally {
      setResolvingDisputeId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-semibold">
            Authorizing staff credentials...
          </p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-hero py-10 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <ShieldAlert className="h-3.5 w-3.5" /> Staff Operations Console
          </span>
          <h1 className="mt-3 text-3xl font-black md:text-4xl">Operations Dashboard</h1>
          <p className="mt-2 max-w-xl text-white/85">
            Audit AI verification checks, perform doorstep inspection grade clearances, resolve
            buyer disputes, and audit ledger accounts.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <div className="border-b border-border bg-card shadow-sm py-6">
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-3 gap-6 text-center">
          <div className="rounded-md border border-border p-4 bg-background">
            <Coins className="mx-auto h-5 w-5 text-primary mb-1.5" />
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Total Escrow Hold
            </div>
            <div className="mt-1 text-xl font-black text-foreground">{inr(escrowBalance)}</div>
          </div>
          <div className="rounded-md border border-border p-4 bg-background">
            <Coins className="mx-auto h-5 w-5 text-success mb-1.5" />
            <div className="text-xs font-bold uppercase text-muted-foreground">
              Myntra Commissions
            </div>
            <div className="mt-1 text-xl font-black text-success">{inr(commissionBalance)}</div>
          </div>
          <div className="rounded-md border border-border p-4 bg-background">
            <AlertTriangle className="mx-auto h-5 w-5 text-destructive mb-1.5" />
            <div className="text-xs font-bold uppercase text-muted-foreground">Active Disputes</div>
            <div className="mt-1 text-xl font-black text-destructive">{disputes.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 flex justify-between items-center">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("inspect")}
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "inspect"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <PackageCheck className="h-4 w-4" /> Inspection Queue ({inspectQueue.length})
            </button>
            <button
              onClick={() => setActiveTab("disputes")}
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "disputes"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="h-4 w-4" /> Disputes Center ({disputes.length})
            </button>
            <button
              onClick={() => setActiveTab("ledger")}
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "ledger"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-4 w-4" /> Double-Entry Ledger
            </button>
          </div>

          <button
            onClick={refreshAll}
            className="p-2 border border-border rounded-full hover:bg-muted text-muted-foreground cursor-pointer"
            title="Refresh dashboard data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-8">
        {/* Inspection Queue */}
        {activeTab === "inspect" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-black uppercase tracking-wide">
                Doorstep Pickups awaiting Inspection
              </h2>
              <p className="text-xs text-muted-foreground">
                Perform structural, light, and odor checks on items picked up from sellers
              </p>
            </div>

            {inspectLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading inspection items...
              </div>
            ) : inspectQueue.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-md bg-card">
                <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-2 font-bold">Inspection queue empty</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Sold listing orders will automatically appear here for doorstep grading.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {inspectQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-md border border-border bg-card p-4 shadow-card md:flex-row md:items-center justify-between"
                  >
                    <div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        LISTING ID: {item.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="mt-1 text-sm font-bold text-foreground">
                        {item.brand} · {item.title}
                      </div>
                      <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                        <span>Size: {item.size}</span>
                        <span>
                          Declared Grade:{" "}
                          <span className="font-bold text-primary">{item.declared_grade}</span>
                        </span>
                        <span>Price Paid: {inr(Number(item.current_price_paise) / 100)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenInspectModal(item)}
                      className="px-4 py-2 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded cursor-pointer hover:bg-primary/95 shadow"
                    >
                      Conduct Inspection
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inspection report modal */}
            {activeListing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
                <form
                  onSubmit={handleSubmitInspection}
                  className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl"
                >
                  <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-1.5">
                    <PackageCheck className="h-5 w-5 text-primary animate-pulse" /> Submit
                    Inspection Report
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conducting doorstep checks on:{" "}
                    <span className="font-bold">
                      {activeListing.brand} · {activeListing.title}
                    </span>{" "}
                    (Declared: {activeListing.declared_grade})
                  </p>

                  <div className="mt-5 space-y-4 text-xs">
                    <div>
                      <label className="font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                        Grade Verification Decision
                      </label>
                      <div className="flex gap-2">
                        {["Pristine", "Excellent", "Good"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setConfirmedGrade(g as any)}
                            className={`flex-1 py-2 border text-center font-bold rounded cursor-pointer transition ${
                              confirmedGrade === g
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border hover:border-foreground"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                        Doorstep Quality Tests
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setInspectionPassed(true)}
                          className={`flex-1 py-2 border text-center font-bold rounded cursor-pointer ${
                            inspectionPassed
                              ? "border-success bg-success/5 text-success"
                              : "border-border"
                          }`}
                        >
                          Clear & Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectionPassed(false)}
                          className={`flex-1 py-2 border text-center font-bold rounded cursor-pointer ${
                            !inspectionPassed
                              ? "border-destructive bg-destructive/5 text-destructive"
                              : "border-border"
                          }`}
                        >
                          Reject & Cancel
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                        {!inspectionPassed
                          ? "Rejection triggers an immediate buyer refund and schedules item return to seller."
                          : confirmedGrade !== activeListing.declared_grade
                            ? "Grade revision triggers an approval prompt sent to the buyer. Shipment halts."
                            : "Passing clears shipment to move in transit directly. Seller payout scheduled."}
                      </p>
                    </div>

                    <div>
                      <label className="font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Inspection Notes
                      </label>
                      <textarea
                        placeholder="Write detailed inspection outcomes (e.g. slight seam fraying)..."
                        value={inspectionNotes}
                        onChange={(e) => setInspectionNotes(e.target.value)}
                        className="w-full h-16 p-2 rounded border border-border focus:outline-none focus:border-primary resize-none bg-background text-foreground"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveListing(null)}
                      className="rounded border border-border px-4 py-2 font-bold uppercase cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReport}
                      className="inline-flex items-center gap-1 bg-primary text-white px-5 py-2 font-bold uppercase rounded cursor-pointer shadow hover:bg-primary/95 disabled:opacity-40"
                    >
                      {submittingReport && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit
                      Report
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Disputes Queue */}
        {activeTab === "disputes" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-black uppercase tracking-wide">Buyer Disputes Center</h2>
              <p className="text-xs text-muted-foreground">
                Moderate disputes filed within the 48-hour buyer protection window
              </p>
            </div>

            {disputesLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading disputes...
              </div>
            ) : disputes.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-md bg-card">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <h3 className="mt-2 font-bold">No active disputes</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Disputes raised by buyers on delivered items will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {disputes.map((disp) => {
                  const ord = disp.resale_orders || {};
                  const list = ord.listings || {};
                  return (
                    <div
                      key={disp.id}
                      className="rounded-md border border-border bg-card p-5 shadow-card leading-relaxed text-xs"
                    >
                      <div className="font-mono text-muted-foreground mb-1 text-[10px]">
                        DISPUTE ID: {disp.id.toUpperCase()}
                      </div>
                      <div className="font-bold text-sm text-foreground">
                        {list.brand} · {list.title}
                      </div>

                      <div className="mt-2 text-destructive bg-destructive/5 border border-destructive/10 p-3 rounded font-semibold leading-normal">
                        Complainant Reason: "{disp.reason}"
                      </div>

                      <div className="mt-3">
                        <label className="font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Resolution Audit notes
                        </label>
                        <input
                          type="text"
                          placeholder="Provide details on moderation outcome..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          className="w-full h-9 rounded border border-border px-3 focus:outline-none focus:border-primary bg-background text-foreground"
                        />
                      </div>

                      <div className="mt-4 flex gap-3">
                        <button
                          disabled={resolvingDisputeId === disp.id}
                          onClick={() => handleResolveDispute(disp.id, "refund")}
                          className="px-4 py-2 bg-destructive text-white font-bold uppercase rounded cursor-pointer shadow hover:bg-destructive/90 transition"
                        >
                          Resolve & Full Refund Buyer
                        </button>
                        <button
                          disabled={resolvingDisputeId === disp.id}
                          onClick={() => handleResolveDispute(disp.id, "release_payout")}
                          className="px-4 py-2 bg-success text-white font-bold uppercase rounded cursor-pointer shadow hover:bg-success/90 transition"
                        >
                          Dismiss & Release Seller Payout
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ledger logs */}
        {activeTab === "ledger" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-black uppercase tracking-wide">Double-Entry Ledger</h2>
              <p className="text-xs text-muted-foreground">
                Immutable business audit trail of all cash flows inside Escrow and payout nodes
              </p>
            </div>

            {ledgerLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Loading ledger...
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-md bg-card">
                <Coins className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-2 font-bold">Ledger is empty</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Transaction entries will log here as checkouts and audits occur.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-border bg-card">
                <table className="w-full text-left text-xs leading-normal">
                  <thead className="bg-muted text-muted-foreground font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Reference Type</th>
                      <th className="p-3">From Account</th>
                      <th className="p-3">To Account</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono text-[10px] text-muted-foreground">
                          {entry.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="p-3 capitalize">{entry.reference_type.replace("_", " ")}</td>
                        <td className="p-3">
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800 font-semibold">
                            {entry.account_from}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-800 font-semibold">
                            {entry.account_to}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-foreground">
                          {inr(Number(entry.amount_paise) / 100)}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(entry.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
