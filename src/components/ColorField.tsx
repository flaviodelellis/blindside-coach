import { useEffect, useRef, useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import "./ColorField.css";

/** Expand `#abc` → `#aabbcc` so the swatch and the picker render consistently. */
export function normalizeHex(hex: string): string {
  const v = hex.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(v);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
}

export function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const current = normalizeHex(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the gradient popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="form-row color-field">
      <label htmlFor={id}>{label}</label>
      <div className="color-field-control">
        <div className="color-popover-wrap" ref={wrapRef}>
          <button
            id={id}
            type="button"
            className="color-trigger"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span className="color-trigger-swatch" style={{ background: current }} />
            <span className="color-trigger-hex">{current.toUpperCase()}</span>
          </button>

          {open && (
            <div className="color-popover" role="dialog" aria-label={label}>
              <HexColorPicker color={current} onChange={onChange} />
              <div className="color-popover-hex">
                <span className="color-popover-hash">#</span>
                <HexColorInput
                  color={current}
                  onChange={onChange}
                  prefixed={false}
                  aria-label={`${label} hex`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
