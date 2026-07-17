import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRequireAuth } from "@/lib/require-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, User as UserIcon, Package, Heart, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "My Profile — ReSell by Myntra" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [listingCount, setListingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name,phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? "");
          setPhone(data.phone ?? "");
        }
      });
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .then(({ count }) => {
        setListingCount(count ?? 0);
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="p-20 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-10 md:grid-cols-[280px_1fr]">
        <aside className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-hero text-lg font-black text-white">
              {(fullName || user.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{fullName || "Welcome!"}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <nav className="mt-4 grid gap-1 text-sm">
            <NavItem icon={UserIcon} label="Profile" active />
            <Link
              to="/orders"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted"
            >
              <Package className="h-4 w-4" /> Orders
            </Link>
            <Link
              to="/wishlist"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted"
            >
              <Heart className="h-4 w-4" /> Wishlist
            </Link>
            <Link
              to="/bag"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted"
            >
              <ShoppingBag className="h-4 w-4" /> Bag
            </Link>
          </nav>
          <button
            onClick={signOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-bold uppercase tracking-wide hover:border-primary hover:text-primary"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </aside>

        <section>
          <h1 className="text-2xl font-black">My Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Update how you appear on ReSell.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat label="Active listings" value={listingCount ?? "—"} />
            <Stat
              label="Member since"
              value={new Date(user.created_at).toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric",
              })}
            />
            <Stat label="Seller score" value="4.8 ★" accent />
          </div>

          <form
            onSubmit={save}
            className="mt-6 rounded-md border border-border bg-card p-6 space-y-4"
          >
            <Field label="Full name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91"
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Email">
              <input
                value={user.email ?? ""}
                disabled
                className="h-11 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground"
              />
            </Field>
            <button
              disabled={busy}
              className="h-11 rounded-md bg-primary px-6 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </form>
          {session ? null : null}
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

function NavItem({ icon: Icon, label, active }: any) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl font-black ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
