// Company details shown on the legal and support pages. Change them here (or with the
// environment variables) and every page picks them up.
export const COMPANY = "Rehua A.I Systems";
export const PRODUCT = "Rehua A.I Capella";
export const LEGAL_UPDATED = "November 24, 2026";

/** Public support address, e.g. support@rehua.ai once the domain is set up. */
export const supportEmail = () => process.env.SUPPORT_EMAIL?.trim() || null;

/** Where support requests from the in-app form are delivered. Falls back to the first owner email. */
export const supportInbox = () =>
  supportEmail() ??
  (process.env.OWNER_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((e) => e.replace(/^[\s"'`<]+|[\s"'`>]+$/g, ""))
    .find((e) => e.includes("@")) ??
  null;
