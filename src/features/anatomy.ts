export type SystemId =
    | "skeletal"
    | "muscular"
    | "arterial"
    | "venous"
    | "nervous"
    | "digestive"
    | "respiratory"
    | "urinary"
    | "reproductive"
    | "lymphatic"
    | "endocrine"
    | "integumentary"
    | "connective"
    | "sensory"
    | "cardiac"
    | "pregnancy";

export type ModelSex = "male" | "female";

export interface System {
    readonly id: SystemId;
    readonly name: string;
    readonly color: string;
    readonly description: string;
}

export const SYSTEMS: readonly System[] = [
    {
        id: "skeletal",
        name: "Skeleton",
        color: "#e2d9ba",
        description:
            "Bones form the supporting framework of the body, protect organs, and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.",
    },
    {
        id: "muscular",
        name: "Muscles",
        color: "#a85b50",
        description:
            "Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilize posture, and produce heat.",
    },
    {
        id: "cardiac",
        name: "Heart",
        color: "#b96760",
        description:
            "The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.",
    },
    {
        id: "sensory",
        name: "Sensory organs",
        color: "#b0c8ce",
        description:
            "These structures contribute to special senses, including sight, hearing, and balance. Their specialized tissues detect stimuli and work with the nervous system to convey information.",
    },
    {
        id: "arterial",
        name: "Arteries",
        color: "#c05245",
        description:
            "The heart drives blood through the circulation. Arteries carry blood away from the heart to supply tissues or, in the pulmonary circuit, to the lungs.",
    },
    {
        id: "venous",
        name: "Veins",
        color: "#527c9f",
        description:
            "Veins return blood toward the heart. Superficial and deep networks collect blood from the tissues; the pulmonary veins bring oxygenated blood back from the lungs.",
    },
    {
        id: "nervous",
        name: "Nervous system",
        color: "#d8b565",
        description:
            "The brain, spinal cord, and peripheral nerves carry and process signals. They support sensation, movement, coordination, and automatic regulation of body functions.",
    },
    {
        id: "respiratory",
        name: "Respiratory",
        color: "#b98991",
        description:
            "The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood. Breathing depends on pressure changes produced by respiratory muscles.",
    },
    {
        id: "digestive",
        name: "Digestive",
        color: "#b8916b",
        description:
            "The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs contribute bile and digestive enzymes.",
    },
    {
        id: "urinary",
        name: "Urinary",
        color: "#b47961",
        description:
            "The kidneys filter blood and regulate fluid, electrolyte, and acid–base balance. Urine travels through the ureters to the bladder and exits through the urethra.",
    },
    {
        id: "lymphatic",
        name: "Lymphatic",
        color: "#879f7c",
        description:
            "Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune surveillance and responses.",
    },
    {
        id: "endocrine",
        name: "Endocrine",
        color: "#c5a09a",
        description:
            "Endocrine organs release hormones into the blood to coordinate processes such as metabolism, growth, stress responses, and reproduction.",
    },
    {
        id: "reproductive",
        name: "Reproductive",
        color: "#bda098",
        description:
            "Reproductive structures contribute to the production and transport of reproductive cells and sex hormones. Their anatomy differs between the reference models.",
    },
    {
        id: "integumentary",
        name: "Body surface",
        color: "#ba9b7d",
        description:
            "The body surface provides an outer anatomical reference. The integumentary system forms a protective barrier and contributes to sensation and temperature regulation.",
    },
    {
        id: "pregnancy",
        name: "Pregnancy reference",
        color: "#bda098",
        description:
            "Placental and umbilical reference structures illustrate pregnancy-related anatomy. They are separate reference assets, not evidence that the assembled body represents a pregnant individual.",
    },
    {
        id: "connective",
        name: "Connective tissue",
        color: "#aec3bb",
        description:
            "Cartilage, ligaments, and other connective tissues support, connect, and separate structures. Their roles include stabilizing joints and distributing mechanical loads.",
    },
] as const;

/**
 * Describe a mesh's ranges within a decoded chunk and its scene-coordinate bounds.
 *
 * `chunk` is a zero-based atlas chunk index; positions, normals, and indices are byte offsets
 * for Float32 XYZ positions, normalized Int16 XYZ normals, and Uint32 triangle indices.
 * Bounds contain minimum and maximum XYZ coordinates in the same units as positions.
 */
export interface Part {
    readonly id: string;
    readonly name: string;
    readonly conceptId: string;
    readonly system: SystemId;
    readonly chunk: number;
    readonly positions: number;
    readonly normals: number;
    readonly indices: number;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly bounds: readonly [readonly number[], readonly number[]];
}

export interface Concept {
    readonly id: string;
    readonly name: string;
    readonly elements: readonly string[];
}

export interface ChunkInfo {
    readonly url: string;
    readonly bytes: number;
    readonly gzip?: string;
    readonly gzipBytes?: number;
}

/**
 * Describe a catalogue whose part order also indexes worker results and GPU state slots.
 *
 * Treat the catalogue as immutable after loading; search and React derivations cache by identity.
 */
export interface Atlas {
    readonly version: string;
    readonly sex?: ModelSex;
    readonly source?: string;
    readonly scope?: string;
    readonly parts: readonly Part[];
    readonly concepts: readonly Concept[];
    readonly chunks: readonly ChunkInfo[];
    readonly triangles: number;
}

export type View = "three-quarter" | "front" | "back" | "side";

/**
 * Describe a render snapshot; replace arrays rather than mutating them for change detection.
 *
 * Selected part IDs remain visible outside enabled systems; isolation displays only selection.
 * Increment `reset` to refit an unchanged view. Explosion uses a 0..1 fraction, not a percentage.
 */
export interface SceneState {
    readonly inspectorOpen?: boolean;
    readonly explode: number;
    readonly visible: readonly SystemId[];
    readonly selected: readonly string[];
    readonly isolate: boolean;
    readonly view: View;
    readonly rotate: boolean;
    readonly reset: number;
}

export const DEFAULT_VISIBLE: readonly SystemId[] = [
    "cardiac",
    "sensory",
    "skeletal",
    "muscular",
    "arterial",
    "venous",
    "nervous",
    "respiratory",
    "digestive",
    "urinary",
    "lymphatic",
    "endocrine",
    "reproductive",
    "connective",
] as const;

export const EXPLANATIONS: Readonly<Record<string, string>> = {
    heart: "A muscular pump in the chest. Its right side sends blood to the lungs; its left side sends blood through the systemic circulation.",
    liver: "A large organ beneath the right side of the diaphragm. It processes absorbed nutrients, produces bile, and synthesizes many proteins carried in the blood.",
    brain: "The central organ of the nervous system. Its interconnected regions support perception, movement, memory, language, and the regulation of bodily functions.",
    stomach:
        "A muscular chamber between the esophagus and small intestine. It stores and mixes food with acid and enzymes before releasing it into the duodenum.",
    spleen: "A lymphoid organ in the upper left abdomen. It filters blood, removes aging blood cells, and participates in immune responses.",
    pancreas:
        "An abdominal organ with digestive and endocrine roles. It supplies enzymes to the small intestine and releases hormones including insulin and glucagon.",
    "urinary bladder":
        "A muscular reservoir in the pelvis that stores urine arriving from the kidneys through the ureters.",
    trachea:
        "The main airway connecting the larynx to the bronchi. Its cartilage supports keep the airway open during breathing.",
    diaphragm:
        "A broad muscle separating the chest and abdomen. When it contracts, it increases chest volume and helps draw air into the lungs.",
};

export function explanation(name: string, system: SystemId): string {
    const custom = EXPLANATIONS[name.toLowerCase()];
    if (custom) {
        return custom;
    }
    const matched = SYSTEMS.find((s) => s.id === system);
    return matched?.description ?? "";
}
