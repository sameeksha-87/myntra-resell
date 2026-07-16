import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { setSimulatedRole } from "@/integrations/supabase/actions.server";
import { Sliders, Shield } from "lucide-react";
import { toast } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">This page took a walk</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
        >
          Back to ReSell
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back home.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ReSell by Myntra — Premium Thrift & Recycle Marketplace" },
      {
        name: "description",
        content:
          "Buy and sell pre-loved premium fashion. Every item AI Verified and Doorstep Inspected before delivery.",
      },
      { name: "author", content: "Myntra Hackerramp" },
      { property: "og:title", content: "ReSell by Myntra — Premium Thrift & Recycle Marketplace" },
      {
        property: "og:description",
        content:
          "Buy and sell pre-loved premium fashion. Every item AI Verified and Doorstep Inspected before delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ReSell by Myntra — Premium Thrift & Recycle Marketplace" },
      {
        name: "twitter:description",
        content:
          "Buy and sell pre-loved premium fashion. Every item AI Verified and Doorstep Inspected before delivery.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a7c87d18-b578-4bf0-a952-28c164b97ce3/id-preview-dc689659--8e4ad3c0-42ac-43b9-a7d8-083c523a20de.lovable.app-1784044094608.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a7c87d18-b578-4bf0-a952-28c164b97ce3/id-preview-dc689659--8e4ad3c0-42ac-43b9-a7d8-083c523a20de.lovable.app-1784044094608.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RoleSwitcher() {
  const { user, signOut } = useAuth();
  const [role, setRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("simulated_role") || "seller";
    }
    return "seller";
  });
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const handleRoleChange = async (newRole: string) => {
    if (!user) {
      if (newRole !== "guest") {
        toast.info("Please sign in first to switch roles");
        router.navigate({ to: "/auth" });
        return;
      }
      return;
    }

    setBusy(true);
    try {
      if (newRole === "guest") {
        await signOut();
        setRole("guest");
        localStorage.setItem("simulated_role", "guest");
        router.navigate({ to: "/" });
      } else {
        await setSimulatedRole({ data: { role: newRole as any } });
        setRole(newRole);
        localStorage.setItem("simulated_role", newRole);
        toast.success(`Active database role switched to: ${newRole.toUpperCase()}`);
        router.invalidate();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to switch role");
    } finally {
      setBusy(false);
    }
  };

  // Sync role on load if logged in
  useEffect(() => {
    if (user && role !== "guest") {
      setSimulatedRole({ data: { role: role as any } }).catch(console.error);
    }
  }, [user]);

  return (
    <div className="bg-zinc-900 text-zinc-100 text-xs py-2.5 px-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-zinc-800">
      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-primary">
        <Sliders className="h-3.5 w-3.5 animate-pulse text-primary" /> ReSell Hackathon Simulator
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
        {user ? (
          <span className="text-[10px] text-zinc-400">
            Signed in: <span className="text-zinc-200 font-bold">{user.email}</span>
          </span>
        ) : (
          <span className="text-[10px] text-warning font-semibold animate-pulse">
            Signed out / Guest mode
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Active Role:</span>
          <div className="flex rounded overflow-hidden border border-zinc-700 bg-zinc-800">
            {["buyer", "seller", "inspector", "admin"].map((r) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => handleRoleChange(r)}
                className={`px-2.5 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                  role === r && user
                    ? "bg-primary text-primary-foreground font-black"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750"
                }`}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => handleRoleChange("guest")}
              className={`px-2.5 py-1 text-[10px] uppercase font-bold transition-all cursor-pointer ${
                (!user || role === "guest")
                  ? "bg-zinc-700 text-zinc-200 font-black"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-750"
              }`}
            >
              Sign Out
            </button>
          </div>
        </div>

        {user && (role === "admin" || role === "inspector") && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-[10px] bg-warning text-warning-foreground px-2 py-0.5 rounded font-black uppercase tracking-wider hover:opacity-90 transition"
          >
            <Shield className="h-3 w-3" /> Ops Console
          </Link>
        )}
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleSwitcher />
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

