import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { registerAtlasTools } from "../agent-tools";
import {
    DEFAULT_VISIBLE,
    SYSTEMS,
    type Atlas,
    type Concept,
    type Part,
    type SceneState,
    type System,
    type SystemId,
    type View,
} from "../anatomy";
import {
    INITIAL_SCENE_STATE,
    type ExplorerPanel,
} from "../model/explorer-state";
import { searchConcepts } from "../model/search-concepts";

interface ExplorerState {
    readonly sceneState: SceneState;
    readonly activePanel: ExplorerPanel;
    readonly isDetailsOpen: boolean;
    readonly isAboutOpen: boolean;
    readonly searchQuery: string;
    readonly chosenConcept: Concept | null;
    readonly systemCounts: Readonly<Record<string, number>>;
    readonly activeSystems: readonly System[];
    readonly selectedParts: readonly Part[];
    readonly visiblePartCount: number;
    readonly searchResults: Concept[];
    readonly setIsDetailsOpen: (open: boolean) => void;
    readonly setIsAboutOpen: (open: boolean) => void;
    readonly setSearchQuery: (query: string) => void;
    readonly handleChooseConcept: (concept: Concept) => void;
    readonly handleChoosePart: (id: string) => void;
    readonly handleToggleSystem: (id: SystemId) => void;
    readonly handleResetScene: () => void;
    readonly handleOpenPanel: (panel: Exclude<ExplorerPanel, null>) => void;
    readonly handleClosePanel: () => void;
    readonly handleShowSystems: (visible: readonly SystemId[]) => void;
    readonly handleViewChange: (view: View) => void;
    readonly handleToggleRotate: () => void;
    /** Accept a percentage in 0..100 (not clamped) and store its 0..1 scene fraction. */
    readonly handleExplodeChange: (percent: number) => void;
    readonly handleToggleIsolate: () => void;
    readonly handleClearSelection: () => void;
    readonly handleOpenAbout: () => void;
}

/**
 * Own explorer selection, panels, search, and immutable scene-state transitions.
 *
 * A null atlas yields empty search/part results without resetting UI state. Treat the atlas
 * and returned state as immutable; memoized results depend on their identities. Owns the
 * slash shortcut for the mount lifetime and replaces optional tool registrations when the
 * atlas changes. Both are cleaned up on unmount.
 */
export function useExplorerState(atlas: Atlas | null): ExplorerState {
    const [sceneState, setSceneState] =
        useState<SceneState>(INITIAL_SCENE_STATE);
    const [activePanel, setActivePanel] = useState<"layers" | "search" | null>(
        null,
    );
    const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
    const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [chosenConcept, setChosenConcept] = useState<Concept | null>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (
                event.key === "/" &&
                !(event.target instanceof HTMLInputElement) &&
                !(event.target instanceof HTMLTextAreaElement)
            ) {
                event.preventDefault();
                setActivePanel("search");
                setIsDetailsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return (): void => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const partsMap = useMemo(() => {
        return new Map(atlas?.parts.map((p) => [p.id, p]));
    }, [atlas]);

    const systemCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const sys of SYSTEMS) {
            counts[sys.id] =
                atlas?.parts.filter((p) => p.system === sys.id).length ?? 0;
        }
        return counts;
    }, [atlas]);

    const activeSystems = useMemo(() => {
        return SYSTEMS.filter((sys) => (systemCounts[sys.id] ?? 0) > 0);
    }, [systemCounts]);

    const selectedParts = useMemo(() => {
        return sceneState.selected
            .map((id) => partsMap.get(id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined);
    }, [sceneState.selected, partsMap]);

    const visiblePartCount = useMemo(() => {
        if (!atlas) return 0;
        return atlas.parts.filter((p) =>
            sceneState.isolate
                ? sceneState.selected.includes(p.id)
                : sceneState.visible.includes(p.system) ||
                  sceneState.selected.includes(p.id),
        ).length;
    }, [atlas, sceneState.isolate, sceneState.selected, sceneState.visible]);

    const searchResults = useMemo(
        () => searchConcepts(atlas, searchQuery),
        [atlas, searchQuery],
    );

    const handleChooseConcept = (concept: Concept): void => {
        setChosenConcept(concept);
        setSceneState((prev) => ({
            ...prev,
            selected: concept.elements,
            isolate: false,
            rotate: false,
        }));
        setIsDetailsOpen(true);
        setActivePanel(null);
    };

    useEffect(() => {
        if (!atlas) return;
        return registerAtlasTools(atlas, (concept) => {
            flushSync(() => {
                handleChooseConcept(concept);
            });
        });
    }, [atlas]);

    const handleChoosePart = (partId: string): void => {
        const part = partsMap.get(partId);
        if (!part) return;

        setChosenConcept({
            id: part.conceptId,
            name: part.name,
            elements: [partId],
        });
        setSceneState((prev) => ({
            ...prev,
            selected: [partId],
            isolate: false,
            rotate: false,
        }));
        setIsDetailsOpen(true);
        setActivePanel(null);
    };

    const handleToggleSystem = (systemId: SystemId): void => {
        setIsDetailsOpen(false);
        setSceneState((prev) => ({
            ...prev,
            selected: [],
            isolate: false,
            visible: prev.visible.includes(systemId)
                ? prev.visible.filter((id) => id !== systemId)
                : [...prev.visible, systemId],
        }));
    };

    const handleResetScene = (): void => {
        setSceneState((prev) => ({
            ...INITIAL_SCENE_STATE,
            visible: DEFAULT_VISIBLE,
            reset: prev.reset + 1,
        }));
        setChosenConcept(null);
        setIsDetailsOpen(false);
        setActivePanel(null);
    };

    const handleOpenPanel = (panelName: "layers" | "search"): void => {
        setIsDetailsOpen(false);
        setActivePanel((current) => (current === panelName ? null : panelName));
    };

    const handleShowSystems = (visible: readonly SystemId[]): void => {
        setSceneState((prev) => ({
            ...prev,
            selected: [],
            isolate: false,
            visible,
        }));
    };

    const handleViewChange = (view: View): void => {
        setSceneState((prev) => ({
            ...prev,
            view,
            reset: prev.reset + 1,
            rotate: false,
        }));
    };

    const handleToggleRotate = (): void => {
        setSceneState((prev) => ({ ...prev, rotate: !prev.rotate }));
    };

    const handleExplodeChange = (percent: number): void => {
        setSceneState((prev) => ({
            ...prev,
            explode: percent / 100,
            view: percent > 80 ? "front" : prev.view,
            rotate: false,
        }));
    };

    const handleToggleIsolate = (): void => {
        setSceneState((prev) => ({
            ...prev,
            isolate: !prev.isolate,
            explode: 0,
        }));
    };

    const handleClearSelection = (): void => {
        setSceneState((prev) => ({ ...prev, selected: [], isolate: false }));
        setIsDetailsOpen(false);
    };

    const handleOpenAbout = (): void => {
        setIsDetailsOpen(false);
        setActivePanel(null);
        setIsAboutOpen(true);
    };

    const handleClosePanel = (): void => setActivePanel(null);

    return {
        sceneState,
        activePanel,
        isDetailsOpen,
        isAboutOpen,
        searchQuery,
        chosenConcept,
        systemCounts,
        activeSystems,
        selectedParts,
        visiblePartCount,
        searchResults,
        setIsDetailsOpen,
        setIsAboutOpen,
        setSearchQuery,
        handleChooseConcept,
        handleChoosePart,
        handleToggleSystem,
        handleResetScene,
        handleOpenPanel,
        handleClosePanel,
        handleShowSystems,
        handleViewChange,
        handleToggleRotate,
        handleExplodeChange,
        handleToggleIsolate,
        handleClearSelection,
        handleOpenAbout,
    };
}
