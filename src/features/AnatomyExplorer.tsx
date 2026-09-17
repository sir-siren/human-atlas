import type { ReactNode } from "react";
import AnatomyScene from "./AnatomyScene";
import { AboutSheet } from "../components/AboutSheet/AboutSheet";
import { DetailsSheet } from "../components/DetailsSheet/DetailsSheet";
import { ExplorerControls } from "../components/ExplorerControls/ExplorerControls";
import { ExplorerHeader } from "../components/ExplorerHeader/ExplorerHeader";
import { LayersPanel } from "../components/LayersPanel/LayersPanel";
import { LoadingStatus } from "../components/LoadingStatus/LoadingStatus";
import { SearchPanel } from "../components/SearchPanel/SearchPanel";
import { useAtlasCatalogue } from "./hooks/useAtlasCatalogue";
import { useExplorerState } from "./hooks/useExplorerState";
import { useRenderQuality } from "./hooks/useRenderQuality";
import { parseRenderQuality } from "./scene/render-quality";

export default function AnatomyExplorer(): ReactNode {
    const { atlas, progress, errorMessage, onProgress, onError } =
        useAtlasCatalogue();
    const explorer = useExplorerState(atlas);
    const { quality, setQuality } = useRenderQuality();
    const { sceneState } = explorer;
    const inspectorOpen =
        explorer.isDetailsOpen && explorer.selectedParts.length > 0;

    return (
        <main className="studio">
            {atlas && (
                <AnatomyScene
                    atlas={atlas}
                    quality={quality}
                    state={{ ...sceneState, inspectorOpen }}
                    onSelect={explorer.handleChoosePart}
                    onProgress={onProgress}
                    onError={onError}
                />
            )}
            <div className="vignette" />
            <label className="quality-control">
                <span>Graphics</span>
                <select
                    aria-label="Graphics quality"
                    value={quality}
                    onChange={(event) =>
                        setQuality(parseRenderQuality(event.target.value))
                    }
                >
                    <option value="low">Low</option>
                    <option value="balanced">Balanced</option>
                    <option value="high">High</option>
                </select>
            </label>
            <ExplorerHeader
                pieceCount={atlas?.parts.length}
                activePanel={explorer.activePanel}
                onOpenPanel={explorer.handleOpenPanel}
                onOpenAbout={explorer.handleOpenAbout}
            />
            <LayersPanel
                isOpen={explorer.activePanel === "layers"}
                activeSystems={explorer.activeSystems}
                systemCounts={explorer.systemCounts}
                visibleSystems={sceneState.visible}
                visiblePartCount={explorer.visiblePartCount}
                onClose={explorer.handleClosePanel}
                onShowSystems={explorer.handleShowSystems}
                onToggleSystem={explorer.handleToggleSystem}
            />
            {explorer.activePanel === "search" && (
                <SearchPanel
                    searchResults={explorer.searchResults}
                    searchQuery={explorer.searchQuery}
                    onSearchQueryChange={explorer.setSearchQuery}
                    onClose={explorer.handleClosePanel}
                    onChooseConcept={explorer.handleChooseConcept}
                />
            )}
            <ExplorerControls
                view={sceneState.view}
                explode={sceneState.explode}
                rotate={sceneState.rotate}
                isolate={sceneState.isolate}
                conceptName={explorer.chosenConcept?.name}
                onViewChange={explorer.handleViewChange}
                onToggleRotate={explorer.handleToggleRotate}
                onExplodeChange={explorer.handleExplodeChange}
                onReset={explorer.handleResetScene}
                onOpenLayers={(): void => explorer.handleOpenPanel("layers")}
                onOpenAbout={explorer.handleOpenAbout}
            />
            <LoadingStatus
                progress={progress}
                errorMessage={errorMessage}
                pieceCount={atlas?.parts.length}
            />
            <DetailsSheet
                isOpen={inspectorOpen}
                isolate={sceneState.isolate}
                chosenConcept={explorer.chosenConcept}
                selectedParts={explorer.selectedParts}
                selectedCount={sceneState.selected.length}
                onOpenChange={explorer.setIsDetailsOpen}
                onChoosePart={explorer.handleChoosePart}
                onToggleIsolate={explorer.handleToggleIsolate}
                onClearSelection={explorer.handleClearSelection}
            />
            <AboutSheet
                isOpen={explorer.isAboutOpen}
                onOpenChange={explorer.setIsAboutOpen}
            />
        </main>
    );
}
