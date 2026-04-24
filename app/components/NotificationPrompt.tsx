"use client";

import { useEffect, useState } from "react";
import { requestNotificationToken } from "@/lib/messaging";

const DISMISS_KEY = "pulse:notif-prompt-dismissed";
const SHOW_DELAY_MS = 4000;

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function handleAllow() {
    setPending(true);
    const token = await requestNotificationToken();
    if (token) {
      try {
        await fetch("/api/register-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch (err) {
        console.error("Failed to register token", err);
      }
    }
    setPending(false);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl animate-[fadeInUp_.3s_ease-out]">
      <h2 className="font-[var(--font-serif),serif] text-lg font-semibold text-[var(--text-primary)]">
        Get notified when big stories break
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        We&rsquo;ll ping you only when a story hits five or more sources.
      </p>
      <div className="mt-4 flex gap-2 justify-end">
        <button
          onClick={dismiss}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          Not now
        </button>
        <button
          onClick={handleAllow}
          disabled={pending}
          className="rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-sm font-medium text-[var(--bg)] hover:bg-white disabled:opacity-50"
        >
          {pending ? "…" : "Allow"}
        </button>
      </div>
    </div>
  );
}
