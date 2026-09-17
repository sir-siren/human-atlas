import { type ReactNode } from "react";
import { Button } from "@/components/button/button";
import {
    Layers3,
    Pause,
    RotateCcw,
    RotateCw,
    ArrowUpRight,
} from "lucide-react";
import { Slider } from "@/components/slider/slider";
import type { View } from "../../features/anatomy";

interface ExplorerControlsProps {
    readonly view: View;
    /** Supply the scene fraction (0..1); `onExplodeChange` reports percent (0..100). */
    readonly explode: number;
    readonly rotate: boolean;
    readonly isolate: boolean;
    readonly conceptName: string | undefined;
    readonly onViewChange: (view: View) => void;
    readonly onToggleRotate: () => void;
    readonly onExplodeChange: (percent: number) => void;
    readonly onReset: () => void;
    readonly onOpenLayers: () => void;
    readonly onOpenAbout: () => void;
}

export function ExplorerControls({
    view,
    explode,
    rotate,
    isolate,
    conceptName,
    onViewChange,
    onToggleRotate,
    onExplodeChange,
    onReset,
    onOpenLayers,
    onOpenAbout,
}: ExplorerControlsProps): ReactNode {
    return (
        <>
            <nav className="view-controls glass" aria-label="Camera controls">
                {(["three-quarter", "front", "side", "back"] as const).map(
                    (viewName, idx) => (
                        <Button
                            variant="ghost"
                            key={viewName}
                            className={view === viewName ? "active" : ""}
                            aria-pressed={view === viewName}
                            disabled={explode > 0.8 && viewName !== "front"}
                            onClick={(): void => onViewChange(viewName)}
                            title={`${viewName} view`}
                            aria-label={`${viewName} view`}
                        >
                            <span>{["¾", "F", "S", "B"][idx]}</span>
                        </Button>
                    ),
                )}
                <i />
                <Button
                    variant="ghost"
                    disabled={explode >= 0.4}
                    aria-label={rotate ? "Pause rotation" : "Rotate body"}
                    title="Auto rotate"
                    className={rotate ? "active" : ""}
                    onClick={onToggleRotate}
                >
                    {rotate ? <Pause size={17} /> : <RotateCw size={18} />}
                </Button>
                <Button
                    variant="ghost"
                    aria-label="Reset view and layers"
                    title="Reset"
                    onClick={onReset}
                >
                    <RotateCcw size={17} />
                </Button>
            </nav>

            <div className="scene-caption" aria-live="polite">
                <span className="caption-line" />
                <span>
                    {isolate
                        ? (conceptName ?? "SELECTED STRUCTURE")
                        : explode > 0.95
                          ? "ANATOMICAL INVENTORY"
                          : explode > 0.05
                            ? "SEPARATED STRUCTURES"
                            : "ADULT HUMAN · MALE"}
                </span>
                <span className="caption-line" />
            </div>

            <div className="bottom-dock glass">
                <Button
                    variant="ghost"
                    className="mobile-only dock-layers"
                    onClick={onOpenLayers}
                    aria-label="Open system layers"
                >
                    <Layers3 size={20} />
                    <span>Systems</span>
                </Button>
                <div className="explode-control">
                    <div className="explode-label">
                        <label id="explode-label">Explode anatomy</label>
                        <output aria-live="polite">
                            {Math.round(explode * 100)}
                            <span>%</span>
                        </output>
                    </div>
                    <Slider
                        aria-labelledby="explode-label"
                        min={0}
                        max={100}
                        step={1}
                        value={[explode * 100]}
                        onValueChange={(val): void => {
                            const numericVal = Array.isArray(val)
                                ? (val[0] ?? 0)
                                : val;
                            onExplodeChange(numericVal);
                        }}
                    />
                    <div className="slider-endpoints">
                        <span>Assembled</span>
                        <span>Every piece</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="dock-reset"
                    onClick={onReset}
                    aria-label="Assemble and reset"
                >
                    <RotateCcw size={18} />
                    <span>Reset</span>
                </Button>
            </div>

            <footer className="studio-footer">
                <span>
                    {explode > 0.8 ? "Drag to pan" : "Drag to orbit"} <b>·</b>{" "}
                    Pinch to zoom <b>·</b> Tap to inspect
                </span>
                <Button variant="ghost" onClick={onOpenAbout}>
                    Source & credits <ArrowUpRight size={12} />
                </Button>
            </footer>
        </>
    );
}
