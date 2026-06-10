import type { FontEntry } from '../types';

/** Default TTL for cached fonts in days */
const CACHE_TTL_DAYS = 7;

/**
 * Resolves a font family from the registry.
 * Returns the matching FontEntry, or null if not found (caller should fall back to "Inter").
 */
export function resolveFont(
    fontFamily: string,
    fontRegistry: FontEntry[],
): FontEntry | null {
    if (!fontFamily || !fontRegistry || fontRegistry.length === 0) {
        return null;
    }

    const entry = fontRegistry.find(
        (e) => e.family.toLowerCase() === fontFamily.toLowerCase(),
    );

    return entry ?? null;
}

/**
 * Returns the cache file path for a given font family.
 * Normalizes the family name to a filesystem-safe format.
 */
export function getCachePath(family: string): string {
    const safeName = family
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    return `cache/fonts/${safeName}.ttf`;
}

/**
 * Checks whether a cached font file is stale (older than the specified TTL in days).
 * This is a server-side only function — returns true (stale) in browser context.
 */
export function isCacheStale(cachePath: string, ttlDays: number = CACHE_TTL_DAYS): boolean {
    // In browser/bundled context, always consider cache stale (no fs access)
    if (typeof process === 'undefined' || typeof require === 'undefined') {
        return true;
    }
    try {
        // Dynamic require to avoid webpack bundling
        const fs = eval('require')('fs');
        const stats = fs.statSync(cachePath);
        const ageMs = Date.now() - stats.mtimeMs;
        const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
        return ageMs > ttlMs;
    } catch {
        return true;
    }
}

/**
 * Attempts to load a font, using cache when available.
 * Falls back to stale cache on network failure with a warning log.
 *
 * Note: File system operations only work during Remotion server-side render.
 * In browser preview, returns the path/family name for CSS loading.
 *
 * @returns The path to the font file (cached or fresh), or null if unavailable.
 */
export async function loadFont(
    fontFamily: string,
    fontRegistry: FontEntry[],
    fetchFn?: (url: string) => Promise<Buffer>,
): Promise<string | null> {
    const entry = resolveFont(fontFamily, fontRegistry);
    if (!entry) {
        console.warn(`[fontLoader] Font "${fontFamily}" not found in registry, falling back to "Inter"`);
        return null;
    }

    // For google/local sources, return the path info for the caller to handle
    if (entry.source === 'google') {
        return entry.path; // Google Fonts family name
    }

    if (entry.source === 'local') {
        return entry.path; // Local file path
    }

    // URL sources: attempt to fetch and cache (server-side only)
    if (entry.source === 'url' && fetchFn) {
        const cachePath = getCachePath(entry.family);
        const stale = isCacheStale(cachePath);

        if (!stale) {
            return cachePath;
        }

        try {
            // Dynamic imports for server-side only
            const fs = eval('require')('fs');
            const path = eval('require')('path');

            fs.mkdirSync(path.dirname(cachePath), { recursive: true });
            const buffer = await fetchFn(entry.path);
            fs.writeFileSync(cachePath, buffer);
            return cachePath;
        } catch (error) {
            console.warn(
                `[fontLoader] Network fetch failed for "${fontFamily}", attempting stale cache fallback`,
            );
            return null;
        }
    }

    return null;
}

export { CACHE_TTL_DAYS };
