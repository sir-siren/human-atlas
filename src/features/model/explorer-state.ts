import { DEFAULT_VISIBLE, type SceneState } from "../anatomy";

export type ExplorerPanel = "layers" | "search" | null;

export const INITIAL_SCENE_STATE: SceneState = {
    explode: 0,
    visible: DEFAULT_VISIBLE,
    selected: [],
    isolate: false,
    view: "three-quarter",
    rotate: false,
    reset: 0,
};
