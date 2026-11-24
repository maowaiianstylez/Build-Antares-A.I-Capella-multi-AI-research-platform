"use client";

// Per-device chat preferences, kept in the browser so they work without an extra database table.
// Settings and Plugins write them; the chat screen reads them when it opens.

export type Preferences = {
  /** "auto" or a provider id such as "claude". */
  defaultModel: string;
  /** Start new chats with Deep Dive on (only applies on plans that include it). */
  deepDiveDefault: boolean;
  /** Read every answer aloud. */
  readAloud: boolean;
  /** Enter sends the message; when off, Enter adds a new line and the Send button sends. */
  enterToSend: boolean;
  /** Speaking speed for read-aloud, 0.75 to 1.5. */
  voiceRate: number;
  /** AI models the user switched off in Plugins; hidden from the model picker. */
  disabledModels: string[];
};

export const DEFAULT_PREFERENCES: Preferences = {
  defaultModel: "auto",
  deepDiveDefault: false,
  readAloud: false,
  enterToSend: true,
  voiceRate: 1,
  disabledModels: [],
};

const KEY = "rehua_preferences";

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(next: Preferences) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing or storage blocked: the choice still applies until the page reloads.
  }
}
