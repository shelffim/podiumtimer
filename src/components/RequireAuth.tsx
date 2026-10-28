"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/services/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticatedPath, setAuthenticatedPath] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const next = pathname + window.location.search;

    api.getUser().then((user) => {
      if (!active) return;
      if (user) setAuthenticatedPath(pathname);
      else router.replace("/?next=" + encodeURIComponent(next));
    }).catch(() => {
      if (active) setError(new Error());
    });

    return () => { active = false; };
  }, [pathname, router]);

  if (error) throw error;
  return authenticatedPath === pathname ? children : null;
}
