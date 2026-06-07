// A "prescription" is an exercise the clinician assigns to a patient, delivered
// as a link with the whole thing encoded in the URL fragment (the app is local,
// no backend). The patient opens the link and runs the exercise autonomously.

import type { SavedConfig } from "./configStore";

/** A saved discrimination config plus the patient-run parameters. */
export type Prescription<T = unknown> = SavedConfig<T> & {
  prescription: {
    /** Max presentations per trial in autonomous mode (1 + retries on error). */
    max_attempts: number;
    /** Optional label shown to the patient (e.g. their first name). */
    patient_label?: string;
  };
};

const HASH_KEY = "rx";

/** base64url(JSON) — URL-safe, no padding. */
function toBase64Url(text: string): string {
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(b64)));
}

export function encodePrescription(p: Prescription): string {
  return toBase64Url(JSON.stringify(p));
}

export function decodePrescription(encoded: string): Prescription | null {
  try {
    const obj = JSON.parse(fromBase64Url(encoded)) as Partial<Prescription>;
    if (
      obj &&
      obj.kind === "blindside-config" &&
      obj.exercise_type === "visual_discrimination" &&
      typeof obj.form === "object" &&
      obj.form !== null &&
      obj.prescription &&
      typeof obj.prescription.max_attempts === "number"
    ) {
      return obj as Prescription;
    }
    return null;
  } catch {
    return null;
  }
}

/** Full shareable link the patient opens. */
export function buildPrescriptionLink(p: Prescription): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${HASH_KEY}=${encodePrescription(p)}`;
}

/** Read a prescription from the current URL fragment, if present. */
export function readPrescriptionFromHash(): Prescription | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const enc = params.get(HASH_KEY);
  return enc ? decodePrescription(enc) : null;
}
