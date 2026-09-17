import { type ReactNode } from "react";
import { Button } from "@/components/button/button";
import { Badge } from "@/components/badge/badge";
import { Info, Search } from "lucide-react";
import type { ExplorerPanel } from "../../features/model/explorer-state";
import type { ModelSex } from "../../features/anatomy";

interface ExplorerHeaderProps {
    readonly sex: ModelSex;
    readonly pieceCount: number | undefined;
    readonly activePanel: ExplorerPanel;
    readonly onOpenPanel: (panel: "layers" | "search") => void;
    readonly onOpenAbout: () => void;
}

/** Show the selected reference's source, coverage and exploration actions. */
export function ExplorerHeader({
    sex,
    pieceCount,
    activePanel,
    onOpenPanel,
    onOpenAbout,
}: ExplorerHeaderProps): ReactNode {
    return (
        <>
            <header className="identity">
                <div className="eyebrow">
                    <span className="status-dot" /> INTERACTIVE ANATOMY
                </div>
                <h1>
                    Human Atlas
                    <Badge variant="outline" className="edition">
                        3D
                    </Badge>
                </h1>
                <div className="identity-meta">
                    {pieceCount?.toLocaleString() ?? "…"} modeled pieces
                    <span>·</span>{" "}
                    {sex === "male" ? "BodyParts3D" : "Human Reference Atlas"}
                </div>
                {sex === "female" && (
                    <p className="model-scope">
                        Partial skeleton and muscle coverage
                    </p>
                )}
            </header>

            <nav className="top-actions" aria-label="Explorer panels">
                <Button
                    variant="ghost"
                    className={activePanel === "search" ? "active" : ""}
                    onClick={(): void => onOpenPanel("search")}
                    aria-label="Search anatomy"
                >
                    <Search size={18} />
                    <span>Find a structure</span>
                    <kbd aria-hidden="true">/</kbd>
                </Button>
                <Button
                    variant="ghost"
                    className="icon-button"
                    aria-label="About this atlas"
                    onClick={onOpenAbout}
                >
                    <Info size={18} />
                </Button>
            </nav>
        </>
    );
}
