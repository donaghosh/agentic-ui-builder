import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import GeneratedApp from "./generated/App";

// Renders whatever the agent has written into src/generated/App.tsx.
// Vite HMR replaces this module in place whenever the agent edits the file,
// so the preview iframe updates live without a full reload.
createRoot(document.getElementById("preview-root")!).render(<GeneratedApp />);
