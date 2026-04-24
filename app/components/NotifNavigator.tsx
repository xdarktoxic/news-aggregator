"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NotifNavigator() {
  const router = useRouter();

  useEffect(() => {
    if (!navigator.serviceWorker) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "NOTIF_CLICK" && event.data.url) {
        const url: string = event.data.url;
        // Strip origin if present so Next.js router gets a pathname
        const path = url.startsWith("http")
          ? new URL(url).pathname
          : url;
        router.push(path);
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [router]);

  return null;
}
