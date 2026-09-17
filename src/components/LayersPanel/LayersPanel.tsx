import { type ReactNode } from "react";
import { Button } from "@/components/button/button";
import { Badge } from "@/components/badge/badge";
import { X } from "lucide-react";
import { Switch } from "@/components/switch/switch";
import type { System, SystemId } from "../../features/anatomy";

interface LayersPanelProps {
    readonly isOpen: boolean;
    readonly activeSystems: readonly System[];
    readonly systemCounts: Readonly<Record<string, number>>;
    readonly visibleSystems: readonly SystemId[];
    readonly visiblePartCount: number;
    readonly onClose: () => void;
    readonly onShowSystems: (systems: readonly SystemId[]) => void;
    readonly onToggleSystem: (system: SystemId) => void;
}

export function LayersPanel({
    isOpen,
    activeSystems,
    systemCounts,
    visibleSystems,
    visiblePartCount,
    onClose,
    onShowSystems,
    onToggleSystem,
}: LayersPanelProps): ReactNode {
    return (
        <section
            className={`layers-panel glass ${isOpen ? "mobile-open" : ""}`}
            aria-label="Anatomical layers"
        >
            <div className="panel-heading">
                <span>Systems</span>
                <Button
                    variant="ghost"
                    className="mobile-only icon-button"
                    onClick={onClose}
                    aria-label="Close systems"
                >
                    <X size={18} />
                </Button>
                <Badge
                    variant="secondary"
                    className="desktop-only small-number"
                >
                    {activeSystems.length}
                </Badge>
            </div>

            <div className="layer-presets">
                <Button
                    variant="ghost"
                    aria-pressed={activeSystems.every((sys) =>
                        visibleSystems.includes(sys.id),
                    )}
                    onClick={(): void =>
                        onShowSystems(activeSystems.map((sys) => sys.id))
                    }
                >
                    All
                </Button>
                <Button
                    variant="ghost"
                    aria-pressed={
                        visibleSystems.length === 1 &&
                        visibleSystems[0] === "skeletal"
                    }
                    onClick={(): void => onShowSystems(["skeletal"])}
                >
                    Skeleton
                </Button>
                <Button
                    variant="ghost"
                    aria-pressed={
                        visibleSystems.length === 6 &&
                        [
                            "cardiac",
                            "respiratory",
                            "digestive",
                            "urinary",
                            "endocrine",
                            "reproductive",
                        ].every((id) => visibleSystems.includes(id as SystemId))
                    }
                    onClick={(): void =>
                        onShowSystems([
                            "cardiac",
                            "respiratory",
                            "digestive",
                            "urinary",
                            "endocrine",
                            "reproductive",
                        ])
                    }
                >
                    Organs
                </Button>
            </div>

            <div className="system-list">
                {activeSystems.map((sys) => (
                    <div
                        className={`system-row ${visibleSystems.includes(sys.id) ? "enabled" : ""}`}
                        key={sys.id}
                    >
                        <Button
                            variant="ghost"
                            className="system-name"
                            title={`Show only ${sys.name.toLowerCase()}`}
                            onClick={(): void => onShowSystems([sys.id])}
                        >
                            <span
                                className="system-dot"
                                style={{ background: sys.color }}
                            />
                            {sys.name}
                            <span className="system-count">
                                {systemCounts[sys.id]}
                            </span>
                        </Button>
                        <Switch
                            checked={visibleSystems.includes(sys.id)}
                            onCheckedChange={(): void => onToggleSystem(sys.id)}
                            aria-label={`Show ${sys.name.toLowerCase()}`}
                        />
                    </div>
                ))}
            </div>

            <div className="panel-foot">
                <span>{visiblePartCount.toLocaleString()} pieces visible</span>
                <Button variant="ghost" onClick={(): void => onShowSystems([])}>
                    Hide all
                </Button>
            </div>
        </section>
    );
}
