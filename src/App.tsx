import type { ReactNode } from "react";
import { AnatomyExplorer } from "@/features";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import "./App.css";

export default function App(): ReactNode {
    return (
        <ErrorBoundary>
            <AnatomyExplorer />
        </ErrorBoundary>
    );
}
