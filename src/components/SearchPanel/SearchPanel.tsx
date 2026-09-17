import { type ReactNode } from "react";
import { Button } from "@/components/button/button";
import { X } from "lucide-react";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/combobox/combobox";
import type { Concept } from "../../features/anatomy";

interface SearchPanelProps {
    readonly searchResults: Concept[];
    readonly searchQuery: string;
    readonly onClose: () => void;
    readonly onChooseConcept: (concept: Concept) => void;
    readonly onSearchQueryChange: (query: string) => void;
}

/** Render caller-filtered results without applying the combobox's own name filter. */
export function SearchPanel({
    searchResults,
    searchQuery,
    onClose,
    onChooseConcept,
    onSearchQueryChange,
}: SearchPanelProps): ReactNode {
    return (
        <section className="search-panel glass" aria-label="Find anatomy">
            <div className="panel-heading">
                <span>Find a structure</span>
                <Button
                    variant="ghost"
                    className="icon-button"
                    onClick={onClose}
                    aria-label="Close search"
                >
                    <X size={18} />
                </Button>
            </div>
            <Combobox<Concept>
                items={searchResults}
                value={null}
                onValueChange={(val): void => {
                    if (val) {
                        onChooseConcept(val);
                    }
                }}
                inputValue={searchQuery}
                onInputValueChange={onSearchQueryChange}
                itemToStringLabel={(c): string => c.name}
                filter={null}
                open
                onOpenChange={(isOpen): void => {
                    if (!isOpen) {
                        onClose();
                    }
                }}
            >
                <ComboboxInput
                    autoFocus
                    placeholder="Heart, femur, cranial nerve…"
                    aria-label="Search named anatomical structures"
                    showTrigger={false}
                />
                <ComboboxContent className="anatomy-search-results">
                    <ComboboxEmpty>
                        No structures match your search.
                    </ComboboxEmpty>
                    <ComboboxList>
                        {(c: Concept): ReactNode => (
                            <ComboboxItem key={c.id} value={c}>
                                <span className="search-result-name">
                                    {c.name}
                                </span>
                                <span className="small-number">
                                    {c.elements.length}{" "}
                                    {c.elements.length === 1
                                        ? "piece"
                                        : "pieces"}
                                </span>
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            <p className="search-note">
                {searchQuery
                    ? "Showing up to 80 matches. Refine your search to find smaller structures."
                    : "Start with a major organ, or search every named structure."}
            </p>
        </section>
    );
}
