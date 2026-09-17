import { useState, type ReactNode } from "react";
import type { ModelSex } from "./anatomy";
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
import { parseRenderQuality, type RenderQuality } from "./scene/render-quality";

/** Keep graphics preferences while remounting model-owned state on a reference switch. */
export default function AnatomyExplorer(): ReactNode {
    const [sex, setSex] = useState<ModelSex>("male");
    const { quality, setQuality } = useRenderQuality();
    return (
        <main className="studio">
            <ModelExplorer key={sex} sex={sex} quality={quality} />
            <div className="quality-control">
                <div
                    className="model-toggle"
                    role="group"
                    aria-label="Anatomy model"
                >
                    {(["male", "female"] as const).map((model) => (
                        <button
                            key={model}
                            type="button"
                            aria-pressed={sex === model}
                            onClick={() => setSex(model)}
                        >
                            {model === "male" ? "Male" : "Female"}
                        </button>
                    ))}
                </div>
                <label>
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
            </div>
        </main>
    );
}

/** Own one reference's catalogue, scene and selection until that reference is unmounted. */
function ModelExplorer({
    sex,
    quality,
}: {
    readonly sex: ModelSex;
    readonly quality: RenderQuality;
}): ReactNode {
    const { atlas, progress, errorMessage, onProgress, onError } =
        useAtlasCatalogue(sex);
    const explorer = useExplorerState(atlas);
    const { sceneState } = explorer;
    const inspectorOpen =
        explorer.isDetailsOpen && explorer.selectedParts.length > 0;

    return (
        <>
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
            <ExplorerHeader
                sex={sex}
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
                sex={sex}
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
        </>
    );
}
