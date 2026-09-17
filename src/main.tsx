import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const container = document.getElementById("root");
if (!container) {
    throw new Error("Target container #root was not found in the document.");
}

const root = createRoot(container);
root.render(
    <StrictMode>
        <App />
    </StrictMode>,
);
