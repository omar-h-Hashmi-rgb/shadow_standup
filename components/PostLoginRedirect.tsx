"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * After the GitHub OAuth round-trip the browser returns to "/" (About). If the
 * user started the sign-in from the app, forward them to where they were going.
 * Renders nothing; a no-op on every other load.
 */
export default function PostLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    const go = (hasSession: boolean) => {
      if (!hasSession) return;
      let target: string | null = null;
      try {
        target = sessionStorage.getItem("post_login_redirect");
        if (target) sessionStorage.removeItem("post_login_redirect");
      } catch {
        return;
      }
      // Only ever an internal path.
      if (target && target.startsWith("/") && !target.startsWith("//")) router.replace(target);
    };

    supabase.auth.getSession().then(({ data: { session } }) => go(!!session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => go(!!session));
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
