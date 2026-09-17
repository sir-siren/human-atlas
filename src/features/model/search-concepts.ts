import type { Atlas, Concept } from "../anatomy";

const DEFAULT_SEARCH_TARGETS = [
    "heart",
    "brain",
    "liver",
    "stomach",
    "spleen",
    "pancreas",
    "urinary bladder",
    "trachea",
] as const;

interface SearchEntry {
    readonly concept: Concept;
    readonly name: string;
    readonly id: string;
}

interface SearchIndex {
    readonly entries: readonly SearchEntry[];
    readonly defaults: readonly Concept[];
}

const indexes = new WeakMap<Atlas, SearchIndex>();

function indexConcepts(atlas: Atlas): SearchIndex {
    const cached = indexes.get(atlas);
    if (cached) return cached;

    const firstByName = new Map<string, Concept>();
    const entries = atlas.concepts.map((concept) => {
        const name = concept.name.toLowerCase();
        if (!firstByName.has(name)) firstByName.set(name, concept);
        return { concept, name, id: concept.id.toLowerCase() };
    });
    // Stable sorting once preserves catalogue order for equal-length names.
    entries.sort((a, b) => a.concept.name.length - b.concept.name.length);
    const defaults = DEFAULT_SEARCH_TARGETS.map((name) =>
        firstByName.get(name),
    ).filter((concept): concept is Concept => concept !== undefined);
    const index = { entries, defaults };
    indexes.set(atlas, index);
    return index;
}

/**
 * Find up to 80 case-insensitive name/ID substring matches, shortest names first.
 *
 * Trims the query; an empty query returns available default concepts, and a null atlas returns
 * no results. Equal-length matches retain catalogue order. The returned array is new but its
 * concepts are borrowed. Keep the atlas immutable: its search index is cached by identity.
 */
export function searchConcepts(
    atlas: Atlas | null,
    searchQuery: string,
): Concept[] {
    if (!atlas) return [];
    const index = indexConcepts(atlas);
    const term = searchQuery.toLowerCase().trim();
    if (!term) return [...index.defaults];

    const result: Concept[] = [];
    for (const entry of index.entries) {
        if (entry.name.includes(term) || entry.id.includes(term)) {
            result.push(entry.concept);
            if (result.length === 80) break;
        }
    }
    return result;
}
