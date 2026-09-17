import { useRef, type ReactNode } from "react";
import { Button } from "@/components/button/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/sheet/sheet";
import { ArrowUpRight, ChevronRight, Focus } from "lucide-react";
import {
    EXPLANATIONS,
    SYSTEMS,
    explanation,
    type Concept,
    type Part,
} from "../../features/anatomy";

interface DetailsSheetProps {
    readonly isOpen: boolean;
    readonly isolate: boolean;
    readonly chosenConcept: Concept | null;
    readonly selectedParts: readonly Part[];
    readonly selectedCount: number;
    readonly onOpenChange: (open: boolean) => void;
    readonly onChoosePart: (id: string) => void;
    readonly onToggleIsolate: () => void;
    readonly onClearSelection: () => void;
}

export function DetailsSheet({
    isOpen,
    isolate,
    chosenConcept,
    selectedParts,
    selectedCount,
    onOpenChange,
    onChoosePart,
    onToggleIsolate,
    onClearSelection,
}: DetailsSheetProps): ReactNode {
    const detailTitleRef = useRef<HTMLHeadingElement>(null);
    const primarySelectedPart = selectedParts[0];
    const primarySystem = SYSTEMS.find(
        (system) => system.id === primarySelectedPart?.system,
    );
    return (
        <Sheet
            open={isOpen}
            modal={false}
            disablePointerDismissal
            onOpenChange={onOpenChange}
        >
            <SheetContent
                initialFocus={detailTitleRef}
                className={`detail-sheet glass ${isolate ? "is-isolated" : ""}`}
                showCloseButton={true}
            >
                <div className="detail-header">
                    <div
                        className="detail-accent"
                        style={{ background: primarySystem?.color }}
                    />
                    <div className="eyebrow">
                        {primarySystem?.name ?? "ANATOMY"}
                    </div>
                    <SheetTitle
                        ref={detailTitleRef}
                        tabIndex={-1}
                        className="structure-title"
                    >
                        {chosenConcept?.name}
                    </SheetTitle>
                </div>

                <div
                    className="detail-scroll"
                    key={`${chosenConcept?.id}-${isolate}`}
                >
                    <SheetDescription className="structure-description">
                        {chosenConcept && primarySelectedPart
                            ? explanation(
                                  chosenConcept.name,
                                  primarySelectedPart.system,
                              )
                            : ""}
                    </SheetDescription>

                    {chosenConcept &&
                        !EXPLANATIONS[chosenConcept.name.toLowerCase()] && (
                            <span className="context-note">
                                System overview · structure identified from
                                source anatomy
                            </span>
                        )}

                    <div className="structure-meta">
                        <span>
                            Atlas reference
                            <strong>{chosenConcept?.id}</strong>
                        </span>
                        <span>
                            Selected pieces
                            <strong>{selectedCount.toLocaleString()}</strong>
                        </span>
                    </div>

                    {selectedParts.length > 1 && (
                        <div className="member-list">
                            <h3>Included structures</h3>
                            {selectedParts.slice(0, 50).map((p) => (
                                <Button
                                    variant="ghost"
                                    key={p.id}
                                    onClick={(): void => onChoosePart(p.id)}
                                >
                                    <span>{p.name}</span>
                                    <ChevronRight size={14} />
                                </Button>
                            ))}
                            {selectedParts.length > 50 && (
                                <p>
                                    And {selectedParts.length - 50} more modeled
                                    pieces.
                                </p>
                            )}
                        </div>
                    )}

                    <a
                        className="source-link"
                        href="https://lifesciencedb.jp/bp3d/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        View anatomical source <ArrowUpRight size={14} />
                    </a>
                </div>

                <div className="detail-actions">
                    <Button
                        className={`primary-action ${isolate ? "active" : ""}`}
                        onClick={onToggleIsolate}
                    >
                        <Focus size={18} />
                        {isolate
                            ? "Show surrounding anatomy"
                            : "Isolate structure"}
                        <ChevronRight size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        className="secondary-action"
                        onClick={onClearSelection}
                    >
                        Clear selection
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
