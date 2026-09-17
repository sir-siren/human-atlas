import { type ReactNode } from "react";
import { Button } from "@/components/button/button";
import { Badge } from "@/components/badge/badge";
import { Info, Search } from "lucide-react";
import type { ExplorerPanel } from "../../features/model/explorer-state";

interface ExplorerHeaderProps {
    readonly pieceCount: number | undefined;
    readonly activePanel: ExplorerPanel;
    readonly onOpenPanel: (panel: "layers" | "search") => void;
    readonly onOpenAbout: () => void;
}

export function ExplorerHeader({
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
                    {pieceCount?.toLocaleString() ?? "2,234"} modeled pieces
                    <span>·</span> BodyParts3D
                </div>
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
