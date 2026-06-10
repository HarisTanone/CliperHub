import { useEffect } from 'react';
import type { FontEntry } from '../types';
import { getCachePath, isCacheStale, CACHE_TTL_DAYS } from './fontLoader';

/** Default fallback font family */
const FALLBACK_FONT = 'Inter';

/**
 * Google Fonts mapping for common fonts used in the project.
 * Maps font family names to their @remotion/google-fonts load functions.
 */
type GoogleFontLoader = () => { fontFamily: string };

const GOOGLE_FONTS_MAP: Record<string, () => Promise<{ loadFont: GoogleFontLoader }>> = {
    'anton': () => import('@remotion/google-fonts/Anton'),
    'bebas neue': () => import('@remotion/google-fonts/BebasNeue'),
    'montserrat': () => import('@remotion/google-fonts/Montserrat'),
    'inter': () => import('@remotion/google-fonts/Inter'),
    'poppins': () => import('@remotion/google-fonts/Poppins'),
    'roboto': () => import('@remotion/google-fonts/Roboto'),
};

/**
 * Ensures cache directories exist (server-side only).
 */
export function ensureCacheDirectories(): void {
    if (typeof process === 'undefined') return;
    try {
        const fs = eval('require')('fs');
        const path = eval('require')('path');
        const cacheDir = path.resolve(__dirname, '..', '..', 'cache');
        fs.mkdirSync(path.join(cacheDir, 'fonts'), { recursive: true });
        fs.mkdirSync(path.join(cacheDir, 'assets'), { recursive: true });
    } catch {
        // Non-critical — cache directories may already exist or not be needed in browser
    }
}

/**
 * Registers a @font-face CSS declaration for the given family and file path.
 */
export function registerFontFace(family: string, fontPath: string): void {
    if (typeof document === 'undefined') return;

    const styleId = `font-face-${family.toLowerCase().replace(/\s+/g, '-')}`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
@font-face {
    font-family: '${family}';
    src: url('${fontPath}') format('truetype');
    font-display: swap;
}
`;
    document.head.appendChild(style);
}

/**
 * Loads a Google Font using @remotion/google-fonts.
 */
async function loadGoogleFont(family: string): Promise<boolean> {
    const key = family.toLowerCase();
    const loaderFactory = GOOGLE_FONTS_MAP[key];

    if (!loaderFactory) {
        console.warn(`[fontRegistry] Google Font "${family}" not in local registry, falling back to "${FALLBACK_FONT}"`);
        const interLoader = GOOGLE_FONTS_MAP['inter'];
        if (interLoader) {
            try {
                const mod = await interLoader();
                mod.loadFont();
                return true;
            } catch { return false; }
        }
        return false;
    }

    try {
        const mod = await loaderFactory();
        mod.loadFont();
        return true;
    } catch (error) {
        console.warn(`[fontRegistry] Failed to load Google Font "${family}": ${error}`);
        return false;
    }
}

/**
 * Loads a local font from assets/fonts/ directory.
 */
function loadLocalFont(family: string, path: string): boolean {
    if (typeof process === 'undefined') {
        // Browser: can't check fs, just register the font-face
        registerFontFace(family, `/assets/fonts/${path}`);
        return true;
    }
    try {
        const fs = eval('require')('fs');
        const pathMod = eval('require')('path');
        const fontPath = pathMod.resolve(__dirname, '..', '..', 'assets', 'fonts', path);
        if (!fs.existsSync(fontPath)) {
            console.warn(`[fontRegistry] Local font file not found: ${fontPath}`);
            return false;
        }
        registerFontFace(family, fontPath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Downloads a font from URL and caches with 7-day TTL.
 */
async function loadUrlFont(family: string, url: string): Promise<boolean> {
    ensureCacheDirectories();
    const cachePath = getCachePath(family);
    const stale = isCacheStale(cachePath, CACHE_TTL_DAYS);

    if (!stale) {
        registerFontFace(family, cachePath);
        return true;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());

        if (typeof process !== 'undefined') {
            const fs = eval('require')('fs');
            const path = eval('require')('path');
            fs.mkdirSync(path.dirname(cachePath), { recursive: true });
            fs.writeFileSync(cachePath, buffer);
        }
        registerFontFace(family, cachePath);
        return true;
    } catch (error) {
        console.warn(`[fontRegistry] Network fetch failed for "${family}": ${error}`);
        // Try stale cache
        if (typeof process !== 'undefined') {
            try {
                const fs = eval('require')('fs');
                if (fs.existsSync(cachePath)) {
                    registerFontFace(family, cachePath);
                    return true;
                }
            } catch { /* */ }
        }
        return false;
    }
}

/**
 * Loads all fonts from a TemplateConfig's font_registry.
 */
export async function loadFontsFromRegistry(fontRegistry: FontEntry[]): Promise<void> {
    if (!fontRegistry || fontRegistry.length === 0) return;

    for (const entry of fontRegistry) {
        let success = false;
        switch (entry.source) {
            case 'google': success = await loadGoogleFont(entry.family); break;
            case 'local': success = loadLocalFont(entry.family, entry.path); break;
            case 'url': success = await loadUrlFont(entry.family, entry.path); break;
            default:
                console.warn(`[fontRegistry] Unknown source "${entry.source}" for "${entry.family}"`);
                break;
        }
        if (!success) await loadGoogleFont(FALLBACK_FONT);
    }
}

/**
 * React hook for loading fonts from font_registry during Remotion compositions.
 */
export function useFontLoader(fontRegistry: FontEntry[]): void {
    useEffect(() => {
        loadFontsFromRegistry(fontRegistry).catch((err) => {
            console.warn(`[fontRegistry] Error loading fonts: ${err}`);
        });
    }, [fontRegistry]);
}

export { FALLBACK_FONT, GOOGLE_FONTS_MAP };
