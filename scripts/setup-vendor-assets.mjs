// Copies WebGazer's prebuilt bundle and its MediaPipe FaceMesh assets from
// node_modules into public/, so Vite can serve them. We don't import WebGazer
// as an ES module because Vite mis-bundles its MediaPipe dependency
// (FaceMesh class resolves to undefined). Loading the pre-built script tag
// from /public sidesteps that.
//
// Runs automatically after `npm install` via the postinstall hook in
// package.json. Can also be run manually: `npm run setup-assets`.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const COPIES = [
  {
    from: resolve(root, "node_modules/webgazer/dist/webgazer.js"),
    to: resolve(root, "public/webgazer.js"),
    kind: "file",
  },
  {
    from: resolve(root, "node_modules/webgazer/dist/mediapipe/face_mesh"),
    to: resolve(root, "public/mediapipe/face_mesh"),
    kind: "dir",
  },
];

let copied = 0;
let skipped = 0;

for (const { from, to, kind } of COPIES) {
  if (!existsSync(from)) {
    console.warn(`[setup-assets] missing source: ${from} — skipping`);
    skipped++;
    continue;
  }
  if (kind === "dir") {
    rmSync(to, { recursive: true, force: true });
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  } else {
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }
  copied++;
}

console.log(
  `[setup-assets] ${copied} item(s) copied${skipped ? `, ${skipped} skipped` : ""}.`,
);
