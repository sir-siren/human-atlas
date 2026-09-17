import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { createSceneAnimation } from "./scene/scene-animation";
import { createStage } from "./scene/create-stage";
import {
    createPartTextures,
    createSystemMaterials,
} from "./scene/part-materials";
import { createRuntimeParts } from "./scene/runtime-parts";
import { createMarkers } from "./scene/create-markers";
import { createScreenTargets } from "./scene/screen-targets";
import { loadGeometry } from "./scene/load-geometry";
import { connectScenePicking } from "./scene/scene-picking";
import type { AnatomySceneProps } from "./scene/scene.types";
import {
    checkSceneCapabilities,
    RENDER_PROFILES,
} from "./scene/render-quality";
import { createSceneScheduler } from "./scene/scene-scheduler";
import { createBatchVisibility } from "./scene/batch-visibility";

export type { AnatomySceneProps } from "./scene/scene.types";

/**
 * Own a WebGL scene and its loading, picking, and frame lifecycle.
 *
 * Changing atlas identity or quality rebuilds the scene; unmount aborts loading and releases
 * GPU resources and listeners. State/callback changes reuse the scene. Progress is 0..100;
 * `onError` receives startup/loading/context-loss messages, or an empty string to clear them.
 */
export default function AnatomyScene({
    atlas,
    quality = "low",
    state,
    onSelect,
    onProgress,
    onError,
}: AnatomySceneProps): ReactNode {
    const hostRef = useRef<HTMLDivElement>(null);
    const latestPropsRef = useRef({ state, onSelect, onProgress, onError });
    const invalidateRef = useRef<(() => void) | undefined>(undefined);

    // The imperative loop must see committed props, not a render React may discard.
    useLayoutEffect(() => {
        latestPropsRef.current = { state, onSelect, onProgress, onError };
        invalidateRef.current?.();
    }, [state, onSelect, onProgress, onError]);

    useEffect(() => {
        const container = hostRef.current;
        if (!container) {
            return undefined;
        }

        let isDisposed = false;
        let isFailed = false;
        let scheduler: ReturnType<typeof createSceneScheduler> | undefined;
        const profile = RENDER_PROFILES[quality];
        const invalidate = (): void => {
            isDirty = true;
            scheduler?.invalidate();
        };
        invalidateRef.current = invalidate;
        let isDirty = true;
        let isReady = false;

        const abortController = new AbortController();
        let renderer: THREE.WebGLRenderer;

        try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("webgl2", {
                antialias: profile.antialias,
                alpha: false,
                powerPreference:
                    quality === "low" ? "low-power" : "high-performance",
            });
            if (!context)
                throw new Error(
                    "WebGL2 is unavailable. Enable hardware acceleration or try another browser. Search and structure details remain available.",
                );
            checkSceneCapabilities(
                atlas.parts.length,
                context.getParameter(context.MAX_TEXTURE_SIZE) as number,
                context.getParameter(
                    context.MAX_VERTEX_TEXTURE_IMAGE_UNITS,
                ) as number,
            );
            renderer = new THREE.WebGLRenderer({
                canvas,
                context,
                antialias: profile.antialias,
                alpha: false,
            });
        } catch (error) {
            latestPropsRef.current.onError(
                error instanceof Error
                    ? error.message
                    : "The 3D viewer could not start. Search and structure details remain available.",
            );
            invalidateRef.current = undefined;
            return undefined;
        }
        latestPropsRef.current.onError("");
        latestPropsRef.current.onProgress(0);
        const stage = createStage(renderer, container, invalidate, quality);
        const {
            scene,
            camera,
            controls,
            devicePixelRatioSafe,
            materials,
            geometries,
        } = stage;

        const textures = createPartTextures(atlas.parts.length);
        const { partTexture, selectionTexture } = textures;

        const runtimeParts = createRuntimeParts(atlas.parts);
        const batches = createBatchVisibility(scene, runtimeParts);
        let batchesDirty = true;

        const pickerMaterial = new THREE.MeshBasicMaterial();
        materials.push(pickerMaterial);

        const markerLayer = createMarkers(atlas.parts.length, scene);
        const { markerGeometry, markerMaterial } = markerLayer;

        const hoverTooltip = document.createElement("div");
        hoverTooltip.className = "part-hover";
        hoverTooltip.setAttribute("role", "tooltip");
        hoverTooltip.hidden = true;
        container.appendChild(hoverTooltip);

        const screenTargets = createScreenTargets();

        const systemMaterials = createSystemMaterials(
            textures,
            materials,
            quality,
        );

        void loadGeometry({
            atlas,
            signal: abortController.signal,
            shouldStop: () => isDisposed || isFailed,
            runtimeParts,
            geometries,
            pickerMaterial,
            systemMaterials,
            scene,
            onChunkLoaded: (progress) => {
                animation.invalidateParts();
                batches.discover();
                batchesDirty = true;
                latestPropsRef.current.onProgress(progress);
                invalidate();
            },
            onReady: () => {
                isReady = true;
                invalidate();
                if (atlas.chunks.length === 0)
                    latestPropsRef.current.onProgress(100);
            },
            onError: (message) => {
                isFailed = true;
                abortController.abort();
                latestPropsRef.current.onError(message);
            },
        });

        const animation = createSceneAnimation({
            atlas,
            container,
            stage,
            runtimeParts,
            textures,
            markerLayer,
            invalidate,
        });

        const handleResize = (): void => {
            if (container.clientWidth <= 0 || container.clientHeight <= 0) {
                return;
            }
            animation.invalidateLayout();
            const isMobileOrShort =
                container.clientWidth < 768 || container.clientHeight < 600;
            renderer.setPixelRatio(
                Math.min(
                    devicePixelRatioSafe,
                    profile.dpr,
                    isMobileOrShort ? 1.5 : 2,
                ),
            );
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            animation.fit(latestPropsRef.current.state.view);
            screenTargets.resize(container.clientWidth, container.clientHeight);
            invalidate();
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);
        handleResize();

        const disconnectPicking = connectScenePicking({
            container,
            renderer,
            camera,
            atlas,
            runtimeParts,
            hoverTooltip,
            screenTargets,
            getExplodeAmount: () => animation.extent,
            getIsReady: () => isReady,
            onSelect: (id) => latestPropsRef.current.onSelect(id),
        });

        const motionPreference = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        );
        let previousState = latestPropsRef.current.state;
        let projectedVersion = -1;
        let projectedExtent = -1;
        const projectedCamera = new THREE.Matrix4();
        const projectedLens = new THREE.Matrix4();
        scheduler = createSceneScheduler({
            target: renderer.domElement,
            document,
            motion: motionPreference,
            request: (callback) => requestAnimationFrame(callback),
            cancel: (id) => cancelAnimationFrame(id),
            frame: (deltaTime) => {
                if (isDisposed || isFailed) return false;
                const currentState = latestPropsRef.current.state;
                const active = animation.update(
                    currentState,
                    deltaTime,
                    motionPreference.matches,
                );
                if (
                    batchesDirty ||
                    previousState.visible !== currentState.visible ||
                    previousState.selected !== currentState.selected ||
                    previousState.isolate !== currentState.isolate
                ) {
                    batches.update();
                    batchesDirty = false;
                }
                previousState = currentState;
                if (isDirty) {
                    renderer.render(scene, camera);
                    if (
                        projectedVersion !== partTexture.version ||
                        projectedExtent !== animation.extent ||
                        !projectedCamera.equals(camera.matrixWorld) ||
                        !projectedLens.equals(camera.projectionMatrix)
                    ) {
                        screenTargets.update(
                            runtimeParts,
                            camera,
                            container,
                            animation.extent,
                        );
                        projectedVersion = partTexture.version;
                        projectedExtent = animation.extent;
                        projectedCamera.copy(camera.matrixWorld);
                        projectedLens.copy(camera.projectionMatrix);
                    }
                    isDirty = false;
                }
                return active;
            },
        });

        const onContextLost = (event: Event): void => {
            event.preventDefault();
            isFailed = true;
            isReady = false;
            abortController.abort();
            scheduler?.dispose();
            latestPropsRef.current.onError(
                "The 3D session was paused by your device. Reload to continue.",
            );
        };

        renderer.domElement.addEventListener("webglcontextlost", onContextLost);

        return (): void => {
            isDisposed = true;
            abortController.abort();
            scheduler?.dispose();
            invalidateRef.current = undefined;
            resizeObserver.disconnect();

            disconnectPicking();
            renderer.domElement.removeEventListener(
                "webglcontextlost",
                onContextLost,
            );

            controls.dispose();
            geometries.forEach((g) => g.dispose());
            materials.forEach((m) => m.dispose());

            scene.traverse((obj) => {
                if (
                    obj instanceof THREE.Mesh &&
                    !geometries.includes(obj.geometry)
                ) {
                    obj.geometry.dispose();
                    const objMats = Array.isArray(obj.material)
                        ? obj.material
                        : [obj.material];
                    objMats.forEach((m) => m.dispose());
                }
            });

            partTexture.dispose();
            selectionTexture.dispose();
            markerGeometry.dispose();
            markerMaterial.dispose();
            hoverTooltip.remove();
            renderer.dispose();
            renderer.domElement.remove();
        };
    }, [atlas, quality]);

    return <div className="scene" ref={hostRef} />;
}
