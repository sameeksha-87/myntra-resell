import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "./auth-context";

export function useRequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.href });
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
    }
  }, [user, loading, navigate, pathname]);
  return { user, loading };
}
