// Local store of completed session results (localStorage). A patient running a
// prescription at home saves here; the clinician can review on the device, and
// the same session can also be downloaded as a file to send back.

import type { SessionFile } from "../types/session";

const STORAGE_KEY = "blindside-results";

export type StoredResult = {
  saved_at: string;
  session: SessionFile;
};

function readAll(): StoredResult[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredResult[]) : [];
  } catch {
    return [];
  }
}

/** Persist a completed session. Returns the stored entry. */
export function saveSession(session: SessionFile): StoredResult {
  const entry: StoredResult = { saved_at: new Date().toISOString(), session };
  if (typeof localStorage !== "undefined") {
    const all = readAll();
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  return entry;
}

/** Stored sessions, newest first. */
export function listSessions(): StoredResult[] {
  return readAll().reverse();
}

/** Trigger a browser download of a session as a .json file. */
export function downloadSession(session: SessionFile): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blindside-results-${session.session.id.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
