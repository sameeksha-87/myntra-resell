// src/routes/checkout.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Truck, CreditCard, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { inr } from "@/lib/mock-data";
import { placeCheckoutOrder } from "@/integrations/supabase/actions.server";

type AddressInput = {
  recipient: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
};

type CheckoutItem = {
  id: string;
  listing_id: string;
  brand: string;
  title: string;
  size: string;
  price: number;
  image: string;
};

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — ReSell by Myntra" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(true);

  // Addresses from DB
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // New address form state
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressInput>({
    recipient: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");

  const loadCheckoutData = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      // 1. Fetch bag items (only live ones)
      const { data: bagData, error: bagError } = await supabase
        .from("bag_items")
        .select(
          `
          id,
          size,
          listings (
            id,
            title,
            brand,
            category,
            size,
            current_price_paise,
            status,
            listing_media (
              storage_key
            )
          )
        `,
        )
        .eq("user_id", user.id);

      if (bagError) throw bagError;

      const formatted = (bagData ?? [])
        .filter((row: any) => row.listings && row.listings.status === "live")
        .map((row: any) => {
          const l = row.listings;
          const media = l.listing_media || [];
          const imagePath = media[0]?.storage_key || "";
          const publicUrl = imagePath
            ? `${(supabase as any).supabaseUrl}/storage/v1/object/public/resell-photos/${imagePath}`
            : "https://picsum.photos/seed/resell-default/600/750";

          return {
            id: row.id,
            listing_id: l.id,
            brand: l.brand,
            title: (l.title || "").split("|||")[0],
            size: row.size || l.size,
            price: Number(l.current_price_paise) / 100,
            image: publicUrl,
          };
        });

      if (formatted.length === 0) {
        toast.info("No available items in checkout. Redirecting to bag.");
        navigate({ to: "/bag" });
        return;
      }
      setItems(formatted);

      // 2. Fetch user addresses
      const { data: addressData, error: addressError } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (addressError) throw addressError;

      setSavedAddresses(addressData || []);
      if (addressData && addressData.length > 0) {
        setSelectedAddressId(addressData[0].id);
      } else {
        setShowNewAddressForm(true);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load checkout details");
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadCheckoutData();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newAddress.recipient ||
      !newAddress.phone ||
      !newAddress.line1 ||
      !newAddress.city ||
      !newAddress.state ||
      !newAddress.pincode
    ) {
      toast.error("Please fill in all required address fields");
      return;
    }

    try {
      setCheckoutLoading(true);
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          user_id: user!.id,
          recipient: newAddress.recipient,
          phone: newAddress.phone,
          line1: newAddress.line1,
          line2: newAddress.line2 || "",
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          is_default: savedAddresses.length === 0,
        })
        .select("*")
        .single();

      if (error) throw error;

      setSavedAddresses((prev) => [data, ...prev]);
      setSelectedAddressId(data.id);
      setShowNewAddressForm(false);
      toast.success("Delivery address saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save address");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    // Determine address
    let activeAddress: AddressInput;
    if (showNewAddressForm) {
      if (
        !newAddress.recipient ||
        !newAddress.phone ||
        !newAddress.line1 ||
        !newAddress.city ||
        !newAddress.state ||
        !newAddress.pincode
      ) {
        toast.error("Please provide a valid delivery address");
        return;
      }
      activeAddress = newAddress;
    } else {
      const selected = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!selected) {
        toast.error("Please select a delivery address");
        return;
      }
      activeAddress = {
        recipient: selected.recipient,
        phone: selected.phone,
        line1: selected.line1,
        line2: selected.line2 || "",
        city: selected.city,
        state: selected.state,
        pincode: selected.pincode,
      };
    }

    setProcessing(true);

    try {
      // Go through checkout items and purchase them (resale is 1-of-1, usually 1 item per checkout)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        setProcessStep("Reserving exclusive item in listing ledger...");
        await new Promise((resolve) => setTimeout(resolve, 800));

        setProcessStep("Establishing secure holding container...");
        await new Promise((resolve) => setTimeout(resolve, 850));

        setProcessStep("Authorizing payment gateways & logs...");

        const result = await placeCheckoutOrder({
          data: {
            listingId: item.listing_id,
            address: activeAddress,
          },
        });

        setProcessStep("Finalizing logisticsWaybills and schedule...");
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      setProcessStep("Order confirmed!");
      await new Promise((resolve) => setTimeout(resolve, 800));

      toast.success(
        "Order placed successfully! Payout will be processed after doorstep inspection.",
      );
      navigate({ to: "/orders" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to complete checkout");
      setProcessing(false);
      loadCheckoutData(); // reload
    }
  };

  const subtotal = items.reduce((sum, r) => sum + r.price, 0);

  if (loading || checkoutLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-semibold">
            Resolving secure checkout cache...
          </p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6">
        <div className="relative h-16 w-16 mb-4">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
        <h2 className="text-lg font-black uppercase tracking-wider animate-pulse">
          Processing Order Transaction
        </h2>
        <p className="mt-2 text-xs text-zinc-400 font-mono tracking-wide">{processStep}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          to="/bag"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> Back to bag
        </Link>

        <h1 className="text-2xl font-black uppercase tracking-wide">Checkout</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Secure Payout Protection active · Pay after doorstep inspection
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            {/* Delivery address */}
            <div className="rounded-md border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold uppercase tracking-wide border-b border-border pb-2 flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-primary" /> Delivery Address
              </h2>

              {!showNewAddressForm && savedAddresses.length > 0 && (
                <div className="mt-4">
                  <div className="grid gap-3">
                    {savedAddresses.slice(0, 1).map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                          selectedAddressId === addr.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="selectedAddress"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-1 accent-primary h-4 w-4"
                        />
                        <div className="text-xs leading-normal">
                          <div className="font-bold text-foreground">
                            {addr.recipient} · {addr.phone}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            {addr.line1}, {addr.line2 ? `${addr.line2}, ` : ""}
                            {addr.city}, {addr.state} - {addr.pincode}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowNewAddressForm(true)}
                    className="mt-4 text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    + Add new delivery address
                  </button>
                </div>
              )}

              {(showNewAddressForm || savedAddresses.length === 0) && (
                <form onSubmit={handleAddNewAddress} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Recipient Name *
                      </label>
                      <input
                        type="text"
                        name="recipient"
                        required
                        value={newAddress.recipient}
                        onChange={handleInputChange}
                        className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Contact Phone *
                      </label>
                      <input
                        type="text"
                        name="phone"
                        required
                        value={newAddress.phone}
                        onChange={handleInputChange}
                        className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Flat, House no., Building, Street *
                    </label>
                    <input
                      type="text"
                      name="line1"
                      required
                      value={newAddress.line1}
                      onChange={handleInputChange}
                      className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Area, Colony, Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      name="line2"
                      value={newAddress.line2}
                      onChange={handleInputChange}
                      className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-3 grid-cols-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        City *
                      </label>
                      <input
                        type="text"
                        name="city"
                        required
                        value={newAddress.city}
                        onChange={handleInputChange}
                        className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        State *
                      </label>
                      <input
                        type="text"
                        name="state"
                        required
                        value={newAddress.state}
                        onChange={handleInputChange}
                        className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Pincode *
                      </label>
                      <input
                        type="text"
                        name="pincode"
                        required
                        value={newAddress.pincode}
                        onChange={handleInputChange}
                        className="mt-1 w-full h-9 rounded border border-border px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    {savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewAddressForm(false)}
                        className="px-4 py-2 border border-border text-xs font-bold uppercase rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-5 py-2 bg-primary text-white text-xs font-bold uppercase rounded cursor-pointer"
                    >
                      Save and Use Address
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Payment method */}
            <div className="rounded-md border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-bold uppercase tracking-wide border-b border-border pb-2 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-primary" /> Payment Method
              </h2>
              <div className="mt-4 p-4 border border-primary/20 bg-primary/5 rounded-md flex items-center gap-3">
                <input type="radio" checked readOnly className="accent-primary h-4 w-4" />
                <div className="text-xs">
                  <div className="font-bold text-foreground">Secure Payment Protection</div>
                  <div className="text-muted-foreground mt-0.5 leading-normal">
                    Funds will stay in a secure Myntra account. The seller is paid only after
                    delivery is inspected at your door and the 48-hour quality inspection completes.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            {/* Item list */}
            <div className="rounded-md border border-border bg-card p-4 shadow-card">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                Order Items ({items.length})
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 text-xs">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-16 w-14 rounded-sm object-cover bg-muted border border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-foreground">{item.brand}</div>
                      <div className="text-muted-foreground truncate">{item.title}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Size: {item.size}
                      </div>
                    </div>
                    <div className="font-bold">{inr(item.price)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-md border border-border bg-card p-5 shadow-card">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
                Order Summary
              </div>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Item Subtotal" value={inr(subtotal)} />
                <SummaryRow label="Buyer Protection Fee" value="FREE" accent />
                <SummaryRow label="Doorstep Delivery" value="FREE" accent />
                <div className="my-2 h-px bg-border" />
                <SummaryRow label="Total Payable" value={inr(subtotal)} bold />
              </div>

              <button
                disabled={processing || savedAddresses.length === 0}
                onClick={handlePlaceOrder}
                className="mt-5 h-12 w-full rounded-md bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/95 disabled:opacity-40 cursor-pointer shadow transition"
              >
                Place Order
              </button>

              <div className="mt-4 flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
                <ShieldCheck className="h-4 w-4 text-success flex-shrink-0" />
                <div>
                  By placing this order, you authorize Myntra to process your payment securely. If
                  the doorstep inspection reveals grade discrepancies, you will be offered the
                  revised terms and are entitled to a full refund if rejected.
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

function SummaryRow({ label, value, bold, accent }: any) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-bold border-t border-border pt-2 text-foreground" : ""}`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-success font-semibold" : "text-foreground"}>{value}</span>
    </div>
  );
}
