"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Offers "Install Antares" where the browser supports it, and Add to Home Screen steps on iPhone/iPad. */
export default function InstallButton({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = setTimeout(() => setIos(!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)));
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (!prompt && !ios) return null;

  return (
    <div className={className}>
      <button
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          } else {
            setShowIosHelp((s) => !s);
          }
        }}
        className="w-full rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2"
      >
        📲 Install the Antares app
      </button>
      {showIosHelp && (
        <p className="mt-2 px-1 text-xs text-muted">
          Tap the Share button in Safari, then choose &ldquo;Add to Home Screen&rdquo;.
        </p>
      )}
    </div>
  );
}
