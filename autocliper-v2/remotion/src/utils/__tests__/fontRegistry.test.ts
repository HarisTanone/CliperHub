import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FontEntry } from '../../types';

// Mock fs module
vi.mock('fs', () => ({
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    writeFileSync: vi.fn(),
    statSync: vi.fn(),
}));

// Mock path to resolve predictably
vi.mock('path', async () => {
    const actual = await vi.importActual('path');
    return {
        ...actual,
        resolve: (...args: string[]) => (actual as typeof import('path')).join('/mock/base', ...args.filter(a => !a.startsWith('/'))),
    };
});

// Mock fontLoader
vi.mock('../fontLoader', () => ({
    resolveFont: vi.fn(),
    getCachePath: vi.fn((family: string) => `/mock/cache/fonts/${family.toLowerCase().replace(/\s+/g, '-')}.ttf`),
    isCacheStale: vi.fn().mockReturnValue(true),
    CACHE_TTL_DAYS: 7,
    CACHE_BASE_DIR: '/mock/cache/fonts',
}));

describe('fontRegistry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset document mock for registerFontFace
        if (typeof document !== 'undefined') {
            document.head.innerHTML = '';
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('ensureCacheDirectories', () => {
        it('should create fonts and assets cache directories if they do not exist', async () => {
            const fs = await import('fs');
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

            const { ensureCacheDirectories } = await import('../fontRegistry');
            ensureCacheDirectories();

            expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('fonts'),
                { recursive: true },
            );
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('assets'),
                { recursive: true },
            );
        });

        it('should not create directories if they already exist', async () => {
            const fs = await import('fs');
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

            const { ensureCacheDirectories } = await import('../fontRegistry');
            ensureCacheDirectories();

            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });
    });

    describe('registerFontFace', () => {
        it('should gracefully skip when document is not defined (Node.js/SSR)', async () => {
            const { registerFontFace } = await import('../fontRegistry');
            // In Node.js test environment, document is undefined
            // registerFontFace should return without error
            expect(() => registerFontFace('Test Font', '/path/to/font.ttf')).not.toThrow();
        });
    });

    describe('loadFontsFromRegistry', () => {
        it('should handle empty registry gracefully', async () => {
            const { loadFontsFromRegistry } = await import('../fontRegistry');
            await expect(loadFontsFromRegistry([])).resolves.not.toThrow();
        });

        it('should handle null/undefined registry gracefully', async () => {
            const { loadFontsFromRegistry } = await import('../fontRegistry');
            await expect(
                loadFontsFromRegistry(null as unknown as FontEntry[]),
            ).resolves.not.toThrow();
            await expect(
                loadFontsFromRegistry(undefined as unknown as FontEntry[]),
            ).resolves.not.toThrow();
        });

        it('should warn for unknown font source', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const { loadFontsFromRegistry } = await import('../fontRegistry');

            const registry: FontEntry[] = [
                { family: 'Unknown', source: 'ftp' as any, path: 'something' },
            ];

            await loadFontsFromRegistry(registry);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Unknown font source'),
            );
            warnSpy.mockRestore();
        });

        it('should call loadLocalFont for source "local"', async () => {
            const fs = await import('fs');
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const { loadFontsFromRegistry } = await import('../fontRegistry');

            const registry: FontEntry[] = [
                { family: 'Anton', source: 'local', path: 'Anton-Regular.ttf' },
            ];

            // Should not throw, and should not warn about missing font
            await loadFontsFromRegistry(registry);

            // In Node.js environment, registerFontFace is a no-op (no document)
            // but loadLocalFont should succeed since existsSync returns true
            const missingFontWarnings = warnSpy.mock.calls.filter(
                (call) => call[0]?.includes('Local font file not found'),
            );
            expect(missingFontWarnings.length).toBe(0);
            warnSpy.mockRestore();
        });

        it('should warn and fallback when local font file not found', async () => {
            const fs = await import('fs');
            // existsSync: false for font file, false for cache dirs (to trigger mkdir)
            (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const { loadFontsFromRegistry } = await import('../fontRegistry');

            const registry: FontEntry[] = [
                { family: 'Missing Font', source: 'local', path: 'missing.ttf' },
            ];

            await loadFontsFromRegistry(registry);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Local font file not found'),
            );
            warnSpy.mockRestore();
        });
    });

    describe('GOOGLE_FONTS_MAP', () => {
        it('should contain entries for common project fonts', async () => {
            const { GOOGLE_FONTS_MAP } = await import('../fontRegistry');

            expect(GOOGLE_FONTS_MAP).toHaveProperty('anton');
            expect(GOOGLE_FONTS_MAP).toHaveProperty('bebas neue');
            expect(GOOGLE_FONTS_MAP).toHaveProperty('montserrat');
            expect(GOOGLE_FONTS_MAP).toHaveProperty('inter');
            expect(GOOGLE_FONTS_MAP).toHaveProperty('poppins');
            expect(GOOGLE_FONTS_MAP).toHaveProperty('roboto');
        });
    });

    describe('FALLBACK_FONT', () => {
        it('should be "Inter"', async () => {
            const { FALLBACK_FONT } = await import('../fontRegistry');
            expect(FALLBACK_FONT).toBe('Inter');
        });
    });
});
