import type { Part } from "./anatomy";

export interface LayoutCell {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ExplosionLayout {
    readonly cells: Map<string, LayoutCell>;
    readonly width: number;
    readonly height: number;
}

/**
 * Pack the supplied parts into centered XY cells in the same units as their bounds.
 *
 * Filter visibility before calling and provide unique part IDs. Leaves input parts unchanged;
 * returns owned cells with center coordinates and padded dimensions. Empty input has zero size.
 * @param aspect - Desired width/height ratio, clamped to 0.5..1.5; nonfinite values use 1.
 * @throws If a part's XY bounds are missing, nonfinite, or reversed.
 */
export function createExplosionLayout(
    parts: readonly Part[],
    aspect = 1,
): ExplosionLayout {
    if (parts.length === 0) {
        return {
            cells: new Map<string, LayoutCell>(),
            width: 0,
            height: 0,
        };
    }

    const cards = parts.map((p) => {
        const minBounds = p.bounds[0];
        const maxBounds = p.bounds[1];

        if (!minBounds || !maxBounds) {
            throw new Error("An anatomy part has missing bounds.");
        }

        const minX = minBounds[0];
        const minY = minBounds[1];
        const maxX = maxBounds[0];
        const maxY = maxBounds[1];

        if (
            minX === undefined ||
            minY === undefined ||
            maxX === undefined ||
            maxY === undefined ||
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY) ||
            maxX < minX ||
            maxY < minY
        ) {
            throw new Error("An anatomy part has invalid bounds.");
        }

        return {
            id: p.id,
            width: Math.max(0.035, maxX - minX) + 0.04,
            height: Math.max(0.035, maxY - minY) + 0.04,
        };
    });

    const area = cards.reduce((acc, card) => acc + card.width * card.height, 0);
    const maxWidth = cards.reduce(
        (acc, card) => Math.max(acc, card.width),
        0.3,
    );
    const safeAspect = Number.isFinite(aspect)
        ? Math.max(0.5, Math.min(1.5, aspect))
        : 1;
    const targetWidth = Math.max(maxWidth, Math.sqrt(area * safeAspect) * 1.18);

    cards.sort((a, b) => b.height - a.height || a.id.localeCompare(b.id));

    const cells = new Map<string, LayoutCell>();
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    let usedWidth = 0;

    for (const card of cards) {
        if (currentX > 0 && currentX + card.width > targetWidth) {
            currentX = 0;
            currentY += rowHeight;
            rowHeight = 0;
        }

        cells.set(card.id, {
            x: currentX + card.width / 2,
            y: -currentY - card.height / 2,
            width: card.width,
            height: card.height,
        });

        currentX += card.width;
        usedWidth = Math.max(usedWidth, currentX);
        rowHeight = Math.max(rowHeight, card.height);
    }

    const totalHeight = currentY + rowHeight;

    cells.forEach((cell) => {
        cell.x -= usedWidth / 2;
        cell.y += totalHeight / 2;
    });

    return {
        cells,
        width: usedWidth,
        height: totalHeight,
    };
}
