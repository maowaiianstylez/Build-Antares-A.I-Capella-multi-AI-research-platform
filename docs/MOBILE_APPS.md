# Rehua on the App Store and Google Play

The iPhone, iPad and Android apps are native shells built with [Capacitor 8](https://capacitorjs.com).
They load the live Rehua site (`server.url` in `capacitor.config.ts`), so a website deploy updates the
apps immediately. Store releases are only needed for native changes (new plugins, icons, permissions).

## What the apps add beyond the website

Apple rejects apps that are "a repackaged website" (App Review Guideline 4.2), so the apps use native features:

| Feature | Where |
|---|---|
| Push notification when a Deep Dive finishes | `src/lib/push.ts` (server), `registerForPush()` in `src/lib/native.ts` |
| The phone's own speech recognition for the mic and Hands-free (the web version doesn't work inside an iOS app) | `nativeListen()` in `src/lib/native.ts`, used by `src/components/useVoice.ts` |
| Native share sheet for answers and their sources | `shareText()` |
| Haptic taps on send and when an answer finishes | `tapFeedback()` |
| Checkout and the billing portal open in the system browser (Apple Pay / Google Pay work there) | `openInBrowser()` |
| Offline screen instead of a blank page | `mobile/www/offline.html` |
| Native splash screen and icons | `assets/`, generated with `npm run mobile:icons` |

Store-required features that also live on the website: in-app account deletion (`/account`, `DELETE /api/me`),
reporting an AI answer (`Report` under each answer, `POST /api/reports`), and the
[privacy policy](/privacy), [terms](/terms) and [support](/support) pages.

## Building

You need a Mac with Xcode for iOS, and Android Studio for Android.

```bash
npm install
npm run mobile:ios        # syncs, then opens Xcode
npm run mobile:android    # syncs, then opens Android Studio
```

- **iOS:** in Xcode select the `App` target, then Signing & Capabilities: choose your team and add the
  **Push Notifications** capability (the entitlement file is already there). Product > Archive uploads to
  App Store Connect.
- **Android:** put `google-services.json` from Firebase in `android/app/` (it turns on push), then
  Build > Generate Signed App Bundle. Use Play App Signing and keep the upload key somewhere safe.
- **Bundle ID / application ID:** `ai.rehua.app`. It is permanent after the first upload, so change it in
  `capacitor.config.ts`, `ios/App/App.xcodeproj` and `android/app/build.gradle` before then if needed.
- **Pointing at a new domain:** `REHUA_APP_URL=https://rehua.ai npm run mobile:sync`, then rebuild.
- **New icon:** replace `assets/icon-only.png` (1024×1024, no transparency) and `assets/icon-foreground.png`,
  then `npm run mobile:icons`. The current ones are upscaled from the 512px web icon; a 1024px master is better.

## Server settings for the apps

| Variable | Purpose |
|---|---|
| `SUPPORT_EMAIL` | Shown on the support, privacy and terms pages, and receives support requests and answer reports. Falls back to the first `OWNER_EMAILS` address for delivery. |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON on one line. Turns on Android push. |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` | Apple push key (the `.p8` file's contents). Turns on iPhone/iPad push. |
| `APNS_PRODUCTION` | `true` for TestFlight and App Store builds, leave unset for builds run from Xcode. |
| `APNS_BUNDLE_ID` | Defaults to `ai.rehua.app`. |

`/api/health` shows `supportEmail` and `push.android` / `push.ios` as on or off.

## Payments in the apps

See the plan in the launch guide. In short: launch on the **US storefront** first, where Apple's guideline 3.1.1(a)
lets apps link to web checkout without an entitlement, and Google Play allows external links and alternative billing
(Google charges a service fee and requires reporting on those sales since October 1, 2026). Before selling outside
the US, add Apple in-app purchase and Google Play Billing (RevenueCat is the simplest way to run them next to Stripe).
