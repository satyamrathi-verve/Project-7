"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/*
  The app root just routes you onward: into the Dashboard when you're signed in,
  or to the Sign In gate when you're not. (The old "start here / roadmap" page is
  gone now that the app is built and ready to run.)
*/
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getCurrentUser() ? "/dashboard" : "/signin");
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );
}
