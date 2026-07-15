import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

type Search = { redirect?: string; mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    mode: s.mode === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [{ title: "Sign in — ReSell by Myntra" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: (search.redirect as any) || "/", replace: true });
    }
  }, [user, loading, navigate, search.redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to ReSell.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-2 md:py-16">
        <div className="hidden md:block">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" /> ReSell by Myntra
          </span>
          <h1 className="mt-4 text-4xl font-black leading-tight">
            Premium fashion, <span className="text-primary">pre-loved</span> and verified.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Sign in to save wishlists, manage your bag, and turn past Myntra orders into cash.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>✓ AI Verified every listing</li>
            <li>✓ Doorstep inspection · escrow payments</li>
            <li>✓ 48h buyer protection</li>
          </ul>
        </div>

        <div className="rounded-md border border-border bg-card p-6 shadow-card">
          <div className="mb-6 flex gap-1 rounded-md bg-muted p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-sm py-2 text-xs font-bold uppercase tracking-wide ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-sm py-2 text-xs font-bold uppercase tracking-wide ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-md bg-primary text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree to our terms and privacy policy.{" "}
            <Link to="/" className="text-primary">Back home</Link>
          </p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
