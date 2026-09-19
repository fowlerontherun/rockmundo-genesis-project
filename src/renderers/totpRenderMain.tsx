import React from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import {
  TotpRenderSurface,
  type TotpOfflineRenderFrame,
  type TotpOfflineRenderPayload,
} from "./TotpRenderSurface";

declare global {
  interface Window {
    __totpRenderBootstrap?: (payload: TotpOfflineRenderPayload) => Promise<void>;
    __totpRenderSetFrame?: (frame: TotpOfflineRenderFrame) => Promise<void>;
    __totpRenderReady?: boolean;
  }
}

const rootNode = document.getElementById("root");
if (!rootNode) throw new Error("Offline renderer root is missing.");
const root = createRoot(rootNode);

let payload: TotpOfflineRenderPayload | null = null;
let frame: TotpOfflineRenderFrame = { itemIndex: 0, localMs: 0 };

const paint = async () => {
  root.render(payload ? <TotpRenderSurface payload={payload} frame={frame} /> : <div className="h-[1080px] w-[1920px] bg-black" />);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
};

window.__totpRenderBootstrap = async (next) => {
  payload = next;
  frame = { itemIndex: 0, localMs: 0 };
  await paint();
  window.__totpRenderReady = true;
};

window.__totpRenderSetFrame = async (next) => {
  if (!payload) throw new Error("Offline renderer has not been bootstrapped.");
  frame = next;
  await paint();
};

void paint();