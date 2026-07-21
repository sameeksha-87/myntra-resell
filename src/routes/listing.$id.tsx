// src/routes/listing.$id.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import {
  Check,
  PackageCheck,
  ShieldCheck,
  Truck,
  Wallet,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  Loader2,
  ArrowLeft,
  XCircle,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { inr } from "@/lib/mock-data";
import {
  decidePriceRevision,
  releaseSellerPayout,
  submitDispute,
} from "@/integrations/supabase/actions.server";
import { toast } from "sonner";

export const Route = createFileRoute("/listing/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Listing Tracker — ReSell by Myntra` }],
  }),
  component: ListingStatus,
});

function ListingStatus() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<any>(null);

  // Dispute form state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);

  const fetchListingData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("listings")
        .select(
          `
          id,
          title,
          brand,
          category,
          size,
          current_price_paise,
          declared_grade,
          confirmed_grade,
          status,
          seller_id,
          resale_orders (
            id,
            buyer_id,
            final_price_paise,
            payout_paise,
            commission_paise,
            status,
            buyer_protection_expiry,
            buyer_approvals (
              id,
              status,
              old_terms,
              new_terms
            ),
            shipments (
              id,
              status,
              tracking_number,
              tracking_events (
                status,
                description,
                occurred_at
              )
            ),
            disputes (
              id,
              reason,
              status,
              resolution
            )
          ),
          pickup_jobs (
            id,
            scheduled_slot,
            status,
            tracking_number
          )
        `,
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      setListing(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load listing details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth", search: { redirect: window.location.pathname }, replace: true });
      return;
    }
    if (user) {
      fetchListingData();
    }
  }, [id, user, authLoading]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-semibold">
            Retrieving tracking records...
          </p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-md mx-auto py-24 text-center px-6">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
          <h2 className="text-lg font-bold">Listing not found</h2>
          <p className="text-xs text-muted-foreground mt-1">
            This listing doesn't exist or you don't have access to track it.
          </p>
          <Link
            to="/orders"
            className="mt-4 inline-block text-xs font-bold text-primary uppercase tracking-wider hover:underline"
          >
            Back to account orders
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const isSeller = listing.seller_id === user?.id;
  const order = listing.resale_orders;
  const isBuyer = order && order.buyer_id === user?.id;

  const currentStatus = order?.status || listing.status;

  // High-level Stages for presentation tracker
  const stages = [
    { key: "verifying", label: "Verification", icon: ShieldCheck, note: "AI checks complete" },
    { key: "live", label: "Marketplace Live", icon: Sparkles, note: "Visible to buyers" },
    { key: "sold", label: "Item Sold", icon: Wallet, note: "Buyer payment authorized" },
    {
      key: "inspection",
      label: "Inspection / Shipping",
      icon: PackageCheck,
      note: "Doorstep grade verification",
    },
    { key: "paid", label: "Payout Settled", icon: Check, note: "Transaction closed" },
  ];

  // Map low level DB status to current active high-level index
  let activeIndex = 0;
  if (["live", "reserved"].includes(currentStatus)) activeIndex = 1;
  else if (currentStatus === "sold") activeIndex = 2;
  else if (["in_transit", "buyer_approval_pending", "disputed"].includes(currentStatus))
    activeIndex = 3;
  else if (["delivered", "completed", "paid"].includes(currentStatus)) activeIndex = 4;

  const handlePriceApproval = async (approved: boolean) => {
    if (!order) return;
    setActionBusy(true);
    try {
      const result = await decidePriceRevision({
        data: {
          orderId: order.id,
          approved,
        },
      });

      if (result.success) {
        toast.success(`Price revision ${approved ? "approved" : "rejected"}.`);
        fetchListingData();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit decision");
    } finally {
      setActionBusy(false);
    }
  };

  const handleClaimPayout = async () => {
    if (!order) return;
    setActionBusy(true);
    try {
      const result = await releaseSellerPayout({
        data: {
          orderId: order.id,
        },
      });
      if (result.success) {
        toast.success("Payout successfully released to your Myntra Credits!");
        fetchListingData();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to release payout");
    } finally {
      setActionBusy(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !disputeReason) return;
    setSubmittingDispute(true);
    try {
      await submitDispute({
        data: {
          orderId: order.id,
          reason: disputeReason,
        },
      });
      toast.success("Dispute raised. Operations team has been notified.");
      setShowDisputeForm(false);
      fetchListingData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit dispute");
    } finally {
      setSubmittingDispute(false);
    }
  };

  const pendingApproval = order?.buyer_approvals?.find((a: any) => a.status === "pending");
  const shipment = order?.shipments;
  const trackingEvents = shipment?.tracking_events || [];
  const dispute = order?.disputes;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-gradient-hero py-8 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/80">
            <Link to="/orders" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Account
            </Link>
            <span>·</span>
            <span>
              {listing.brand} · {(listing.title || "").split("|||")[0]}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-black md:text-3xl leading-tight">
            {isSeller ? "Seller Console · Listing Status" : "Buyer Console · Order Tracking"}
          </h1>
          <p className="mt-1 text-xs text-white/85">
            Listing Price: {inr(listing.current_price_paise / 100)} · Confirmed Grade:{" "}
            {listing.confirmed_grade || listing.declared_grade}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-8 md:grid-cols-[1fr_320px]">
        {/* Left Side: Status Steps & Updates */}
        <div className="space-y-6">
          {/* Price Revision Action for Buyer */}
          {isBuyer && currentStatus === "buyer_approval_pending" && pendingApproval && (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-5 shadow-card leading-relaxed">
              <div className="flex items-center gap-2 text-sm font-bold text-warning-foreground uppercase tracking-wide">
                <AlertTriangle className="h-5 w-5 text-warning animate-bounce" /> Action Required:
                Doorstep Inspection Grade Revised
              </div>
              <p className="mt-2 text-xs text-muted-foreground text-pretty">
                During doorstep pickup, the inspector revised the grade of the item from{" "}
                <span className="font-bold">{pendingApproval.old_terms.grade}</span> to{" "}
                <span className="font-bold text-primary">{pendingApproval.new_terms.grade}</span>.
                The price has been updated transparently:
              </p>

              <div className="mt-4 grid grid-cols-2 gap-4 border border-border/50 bg-card p-3 rounded-md text-xs">
                <div>
                  <div className="text-muted-foreground font-semibold">Original Bid</div>
                  <div className="text-lg font-black text-zinc-500 line-through">
                    {inr(pendingApproval.old_terms.price / 100)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Grade: {pendingApproval.old_terms.grade}
                  </div>
                </div>
                <div>
                  <div className="text-primary font-bold">Revised Offer</div>
                  <div className="text-lg font-black text-success">
                    {inr(pendingApproval.new_terms.price / 100)}
                  </div>
                  <div className="text-[10px] text-success font-semibold mt-0.5">
                    Grade: {pendingApproval.new_terms.grade}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  disabled={actionBusy}
                  onClick={() => handlePriceApproval(true)}
                  className="px-4 py-2.5 bg-success text-white text-xs font-bold uppercase tracking-wider rounded cursor-pointer shadow hover:bg-success/90"
                >
                  Accept & Ship Item
                </button>
                <button
                  disabled={actionBusy}
                  onClick={() => handlePriceApproval(false)}
                  className="px-4 py-2.5 bg-destructive/10 text-destructive border border-destructive/20 text-xs font-bold uppercase tracking-wider rounded cursor-pointer hover:bg-destructive/20"
                >
                  Reject & Refund
                </button>
              </div>
            </div>
          )}

          {/* Seller Price Revision Waiting Alert */}
          {isSeller && currentStatus === "buyer_approval_pending" && (
            <div className="rounded-md border border-warning/20 bg-warning/5 p-4 text-xs leading-relaxed flex items-start gap-2">
              <RefreshCw className="h-5 w-5 text-warning animate-spin flex-shrink-0" />
              <div>
                <div className="font-bold text-warning-foreground uppercase tracking-wide">
                  Inspection Grade Mismatch · Awaiting Buyer Approval
                </div>
                <p className="text-muted-foreground mt-1">
                  The inspector confirmed a grade of{" "}
                  <span className="font-bold">{listing.confirmed_grade}</span> instead of your
                  declared <span className="font-bold">{listing.declared_grade}</span>. The pricing
                  has been re-quoted and the buyer is reviewing the terms.
                </p>
              </div>
            </div>
          )}

          {/* Active Dispute Status */}
          {currentStatus === "disputed" && dispute && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5 shadow-card leading-relaxed">
              <div className="flex items-center gap-2 text-sm font-bold text-destructive uppercase tracking-wide">
                <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" /> Active Dispute
                Under Operations Review
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <b>Complainant Reason:</b> "{dispute.reason}"
              </p>
              <div className="mt-3 bg-card border border-border/50 p-3 rounded text-[11px] text-muted-foreground">
                Our operations console is auditing the photo submissions, inspection logs, and
                ledger allocations. A resolution will be applied within 24 hours. Payout is
                currently locked for review.
              </div>
            </div>
          )}

          {/* Refunded Order Status */}
          {currentStatus === "refunded" && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs leading-relaxed flex items-start gap-2">
              <XCircle className="h-5 w-5 text-zinc-500 flex-shrink-0" />
              <div>
                <div className="font-bold text-zinc-800 uppercase tracking-wide">
                  Order Refunded & Dispute Closed
                </div>
                <p className="text-muted-foreground mt-1">
                  The dispute has been resolved in favor of the buyer. The holding has been fully
                  released back to the buyer's account.
                </p>
              </div>
            </div>
          )}

          {/* Timeline Tracker */}
          <div className="rounded-md border border-border bg-card p-5 shadow-card">
            <h2 className="text-base font-black uppercase tracking-wide mb-4">
              Milestone Progress
            </h2>
            <ol className="relative border-l border-border pl-6 space-y-6">
              {stages.map((stage, idx) => {
                const done = idx < activeIndex;
                const active = idx === activeIndex;
                const Icon = stage.icon;

                return (
                  <li key={stage.key} className="relative">
                    <span
                      className={`absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        done
                          ? "border-success bg-success text-white"
                          : active
                            ? "border-primary bg-primary text-white animate-pulse"
                            : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>

                    <div className="text-xs">
                      <div
                        className={`font-bold ${active ? "text-primary text-sm" : "text-foreground"}`}
                      >
                        {stage.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{stage.note}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Logistics Tracking Events */}
          {order && shipment && (
            <div className="rounded-md border border-border bg-card p-5 shadow-card">
              <h2 className="text-base font-black uppercase tracking-wide mb-4 flex items-center gap-1.5">
                <Truck className="h-5 w-5 text-primary" /> Shipment Tracking logs
              </h2>

              {trackingEvents.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No shipping updates yet. Scheduled pickup is active.
                </div>
              ) : (
                <div className="space-y-4">
                  {trackingEvents.map((evt: any, i: number) => {
                    const time = new Date(evt.occurred_at).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    });
                    const date = new Date(evt.occurred_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <div
                        key={i}
                        className="flex gap-3 text-xs leading-normal border-b border-border/30 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="text-right text-muted-foreground w-16 flex-shrink-0">
                          <div className="font-bold">{time}</div>
                          <div className="text-[10px]">{date}</div>
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-foreground uppercase text-[10px] tracking-wide">
                            {evt.status.replace("_", " ")}
                          </div>
                          <div className="text-muted-foreground mt-0.5">{evt.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Price Summary & Support */}
        <aside className="space-y-4">
          {/* Provisional/Final Payout box */}
          <div className="rounded-md border border-border bg-card p-5 shadow-card leading-relaxed">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {isSeller ? "Seller Payout" : "Secure Payment Holding"}
            </div>
            <div className="mt-1 text-2xl font-black">
              {inr(
                isSeller
                  ? order
                    ? order.payout_paise / 100
                    : (listing.current_price_paise * 0.9) / 100
                  : order
                    ? order.final_price_paise / 100
                    : listing.current_price_paise / 100,
              )}
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              {isSeller
                ? `90% of listing price ${inr(order ? order.final_price_paise / 100 : listing.current_price_paise / 100)}`
                : `Holding ID: txn_${id.slice(0, 6)}`}
            </div>

            {/* Seller Payout Claim Action */}
            {isSeller && currentStatus === "delivered" && (
              <button
                disabled={actionBusy}
                onClick={handleClaimPayout}
                className="mt-4 w-full py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded cursor-pointer hover:bg-primary/95 shadow transition flex items-center justify-center gap-1"
              >
                {actionBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wallet className="h-3.5 w-3.5" />
                )}{" "}
                Claim Payout Credits
              </button>
            )}

            {isSeller && currentStatus === "paid" && (
              <div className="mt-4 bg-green-50 border border-green-200 text-success text-center py-2 text-xs font-bold uppercase tracking-wider rounded">
                Payout released ✓
              </div>
            )}
          </div>

          {(() => {
            const [, conditionDesc] = (listing.title || "").split("|||");
            if (!conditionDesc) return null;
            return (
              <div className="rounded-md border border-border bg-card p-4 shadow-card text-xs leading-normal">
                <div className="font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Sliders className="h-3.5 w-3.5 text-primary" /> Declared Details
                </div>
                <p className="text-muted-foreground italic">"{conditionDesc}"</p>
              </div>
            );
          })()}

          {/* Pickup job info */}
          {isSeller && listing.pickup_jobs && (
            <div className="rounded-md border border-border bg-card p-4 shadow-card text-xs leading-normal">
              <div className="font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Pickup Job Information
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div>
                  <b>Slot:</b> {listing.pickup_jobs.scheduled_slot}
                </div>
                <div>
                  <b>Partner Code:</b> {listing.pickup_jobs.tracking_number}
                </div>
                <div>
                  <b>Status:</b>{" "}
                  <span className="capitalize font-bold text-primary">
                    {listing.pickup_jobs.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Buyer protection dispute box */}
          {isBuyer && currentStatus === "delivered" && !dispute && (
            <div className="rounded-md border border-border bg-card p-4 shadow-card text-xs">
              <h3 className="font-bold flex items-center gap-1.5 text-foreground uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4 text-success" /> 48h Buyer Protection Active
              </h3>
              <p className="mt-1.5 text-muted-foreground text-pretty">
                If the item size, details, or condition does not match what was inspected, you can
                open a dispute.
              </p>

              {!showDisputeForm ? (
                <button
                  onClick={() => setShowDisputeForm(true)}
                  className="mt-3 w-full py-2 border border-border text-[11px] font-bold uppercase tracking-wider hover:border-destructive hover:text-destructive rounded cursor-pointer"
                >
                  Raise Dispute
                </button>
              ) : (
                <form onSubmit={handleDisputeSubmit} className="mt-3 space-y-2">
                  <textarea
                    placeholder="Provide description of mismatch details..."
                    required
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full h-16 p-2 rounded border border-border text-xs focus:outline-none focus:border-primary resize-none bg-background text-foreground"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowDisputeForm(false)}
                      className="px-2.5 py-1.5 border border-border text-[10px] uppercase font-bold rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingDispute}
                      className="px-3 py-1.5 bg-destructive text-white text-[10px] uppercase font-bold rounded cursor-pointer"
                    >
                      {submittingDispute ? "Submitting..." : "Submit Dispute"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}
