"use client";

// Bridges to the iPhone, iPad and Android apps (Capacitor). The apps load the live Rehua site, and
// Capacitor injects window.Capacitor so the same pages can reach native features. On the web every
// helper falls back to the browser, so nothing here breaks the website.

type CapWindow = { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };

/** True inside the iPhone, iPad or Android app. */
export const isNativeApp = () =>
  typeof window !== "undefined" && Boolean((window as unknown as CapWindow).Capacitor?.isNativePlatform?.());

/** "ios", "android" or "web". */
export const nativePlatform = () =>
  (typeof window !== "undefined" && (window as unknown as CapWindow).Capacitor?.getPlatform?.()) || "web";

/** A light tap of the phone's haptic engine (send, answer finished). Does nothing on the web. */
export async function tapFeedback(kind: "light" | "success" = "light") {
  if (!isNativeApp()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics are a nicety; never let them break a message.
  }
}

/** Opens the system share sheet (Messages, Mail, Notes…). Falls back to the web share API, then the clipboard. */
export async function shareText(title: string, text: string): Promise<"shared" | "copied" | "cancelled"> {
  try {
    if (isNativeApp()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, dialogTitle: "Share answer" });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "cancelled";
  }
}

/**
 * Opens a page in the system browser (Safari or Chrome) instead of inside the app. Used for Stripe
 * checkout and the billing portal, which need the real browser for Apple Pay, Google Pay and saved cards.
 * Calls onClosed when the person comes back to the app.
 */
export async function openInBrowser(url: string, onClosed?: () => void) {
  if (!isNativeApp()) {
    window.location.assign(url);
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  if (onClosed) {
    const handle = await Browser.addListener("browserFinished", () => {
      handle.remove();
      onClosed();
    });
  }
  await Browser.open({ url, presentationStyle: "popover" });
}

let pushStarted = false;

/**
 * Asks for notification permission once the person is signed in, and sends this device's push token
 * to the server so Rehua can say when a Deep Dive has finished. Only runs inside the app.
 */
export async function registerForPush() {
  if (!isNativeApp() || pushStarted) return;
  pushStarted = true;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;
    await PushNotifications.addListener("registration", ({ value }) => {
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value, platform: nativePlatform() }),
      }).catch(() => {});
    });
    // Tapping a notification opens the conversation it's about.
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url?.startsWith("/")) window.location.assign(url);
    });
    await PushNotifications.register();
  } catch (err) {
    // Push isn't set up yet (no Firebase / APNs keys in the build). The app works without it.
    console.warn("Push notifications unavailable", err);
  }
}

/** Removes this device's push token when signing out, so notifications stop. */
export async function unregisterPush() {
  if (!isNativeApp()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
    pushStarted = false;
  } catch {
    // Nothing to undo.
  }
}

// ---- Native speech recognition ----
// Apple doesn't let web pages inside an app use the browser's speech recognition, so the apps use
// the phone's own engine (Apple Speech on iOS, Google on Android) through a plugin.

export type NativeListenHandle = { stop: () => Promise<void> };

export async function nativeSpeechAvailable() {
  if (!isNativeApp()) return false;
  try {
    const { SpeechRecognition } = await import("@capgo/capacitor-speech-recognition");
    return (await SpeechRecognition.available()).available;
  } catch {
    return false;
  }
}

/** Listens once. onPartial gets the words so far; onDone gets the final text (empty if nothing was heard). */
export async function nativeListen(
  lang: string,
  onPartial: (text: string) => void,
  onDone: (text: string) => void,
): Promise<NativeListenHandle | null> {
  const { SpeechRecognition } = await import("@capgo/capacitor-speech-recognition");
  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== "granted") perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== "granted") return null;

  let latest = "";
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = async () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    await SpeechRecognition.stop().catch(() => {});
    await SpeechRecognition.removeAllListeners();
    onDone(latest.trim());
  };
  // iOS keeps listening until told to stop, so end the turn after a pause in speech (like the
  // browser does), or after 10 seconds of silence at the start.
  const stopAfter = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(finish, ms);
  };
  stopAfter(10_000);
  await SpeechRecognition.addListener("partialResults", ({ matches }) => {
    latest = matches?.[0] ?? latest;
    onPartial(latest);
    stopAfter(1_800);
  });
  await SpeechRecognition.addListener("listeningState", ({ status }) => {
    if (status === "stopped") finish();
  });
  SpeechRecognition.start({ language: lang, partialResults: true, popup: false, maxResults: 1 }).catch(() => finish());
  return {
    stop: finish,
  };
}
