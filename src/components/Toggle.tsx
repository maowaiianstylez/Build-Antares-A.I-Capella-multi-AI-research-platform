"use client";

/** A labelled on/off switch row used on the Settings and Plugins pages. */
export function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? "border-capella bg-capella" : "border-border bg-surface-2"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full transition-transform ${checked ? "translate-x-5 bg-background" : "translate-x-0 bg-muted"}`}
        />
      </button>
    </label>
  );
}
