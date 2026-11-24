import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone, iPad and Android apps. They are native shells (Capacitor) that load the live Rehua site,
 * so every website update reaches the apps instantly without a new store release, plus native
 * features: push notifications, the phone's speech engine, the share sheet, haptics, and paying in
 * the system browser.
 *
 * REHUA_APP_URL points the apps at a different server (e.g. https://rehua.ai once the domain is
 * live). Run `npm run mobile:sync` after changing it.
 */
const appUrl = process.env.REHUA_APP_URL || "https://build-antares-ai-capella-multi-ai-research-plat-production.up.railway.app";

const config: CapacitorConfig = {
  // Permanent once the app is first uploaded to the App Store / Google Play. Change it before then if needed.
  appId: "ai.rehua.app",
  appName: "Rehua",
  // Only holds the offline screen; the app itself is loaded from appUrl.
  webDir: "mobile/www",
  appendUserAgent: "RehuaApp",
  backgroundColor: "#05070d",
  server: {
    url: `${appUrl.replace(/\/$/, "")}/chat`,
    cleartext: false,
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "automatic",
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: "#05070d",
      showSpinner: false,
    },
    // Don't pop a banner for "Deep Dive ready" while Rehua is already open on screen.
    PushNotifications: { presentationOptions: [] },
  },
};

export default config;
