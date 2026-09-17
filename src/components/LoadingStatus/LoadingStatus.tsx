import { type ReactNode } from "react";
import { Button } from "@/components/button/button";
import { Activity } from "lucide-react";

interface LoadingStatusProps {
    readonly progress: number;
    readonly errorMessage: string;
    readonly pieceCount: number | undefined;
}

export function LoadingStatus({
    progress,
    errorMessage,
    pieceCount,
}: LoadingStatusProps): ReactNode {
    return (
        <>
            {progress < 100 && !errorMessage && (
                <div className="loading glass" role="status" aria-live="polite">
                    <Activity size={18} />
                    <div>
                        <strong>Preparing the anatomy</strong>
                        <span>
                            {progress}% · Loading{" "}
                            {pieceCount?.toLocaleString() ?? "2,234"} pieces
                        </span>
                        <div className="loading-track">
                            <i style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className="loading glass error" role="alert">
                    <p>{errorMessage}</p>
                    <Button
                        variant="ghost"
                        onClick={(): void => window.location.reload()}
                    >
                        Reload viewer
                    </Button>
                </div>
            )}
        </>
    );
}
