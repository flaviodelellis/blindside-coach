import { useEffect, useRef, useState } from "react";

/**
 * Controlled numeric input that, unlike a raw `<input type="number">` wired to
 * `Number(e.target.value)`, lets the user clear the field while typing instead
 * of snapping back to a stuck `0`. The value is only normalized and clamped on
 * blur. The native spinner (and its `step`) is preserved.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  id,
  className,
  placeholder,
  inputMode,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  className?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal";
  "aria-label"?: string;
}) {
  const [text, setText] = useState<string>(() => String(value));
  const focused = useRef(false);

  // Keep the field in sync with external value changes (resets, presets),
  // but never clobber what the user is actively typing.
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const clamp = (n: number) => {
    let out = n;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return out;
  };

  return (
    <input
      id={id}
      className={className}
      type="number"
      inputMode={inputMode}
      placeholder={placeholder}
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === "") return; // allow an empty field while editing
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        const parsed = Number(text);
        const next =
          text.trim() === "" || Number.isNaN(parsed)
            ? clamp(min ?? 0)
            : clamp(parsed);
        onChange(next);
        setText(String(next));
      }}
    />
  );
}
