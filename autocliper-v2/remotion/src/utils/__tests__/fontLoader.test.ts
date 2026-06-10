import { describe, it, expect, vi } from 'vitest';
import { resolveFont, getCachePath, isCacheStale } from '../fontLoader';
import type { FontEntry } from '../../types';

describe('resolveFont', () => {
    const registry: FontEntry[] = [
        { family: 'Anton', source: 'google', path: 'Anton' },
        { family: 'Montserrat', source: 'google', path: 'Montserrat' },
        { family: 'Custom Font', source: 'url', path: 'https://example.com/font.ttf' },
    ];

    it('finds matching family (case-insensitive)', () => {
        const result = resolveFont('anton', registry);
        expect(result).not.toBeNull();
        expect(result!.family).toBe('Anton');
        expect(result!.source).toBe('google');
    });

    it('finds matching family with different casing', () => {
        const result = resolveFont('MONTSERRAT', registry);
        expect(result).not.toBeNull();
        expect(result!.family).toBe('Montserrat');
    });

    it('returns null for unknown family', () => {
        const result = resolveFont('NonExistentFont', registry);
        expect(result).toBeNull();
    });

    it('returns null for empty registry', () => {
        const result = resolveFont('Anton', []);
        expect(result).toBeNull();
    });

    it('returns null for empty fontFamily string', () => {
        const result = resolveFont('', registry);
        expect(result).toBeNull();
    });

    it('returns null when registry is undefined-like', () => {
        const result = resolveFont('Anton', null as unknown as FontEntry[]);
        expect(result).toBeNull();
    });
});

describe('getCachePath', () => {
    it('generates filesystem-safe path from family name', () => {
        const path = getCachePath('Anton');
        expect(path).toContain('anton.ttf');
        expect(path).not.toContain(' ');
    });

    it('replaces spaces with hyphens', () => {
        const path = getCachePath('Open Sans');
        expect(path).toContain('open-sans.ttf');
    });

    it('removes non-alphanumeric characters (except hyphen)', () => {
        const path = getCachePath("Font's Name (v2)");
        expect(path).toContain('fonts-name-v2.ttf');
    });

    it('handles multiple consecutive spaces', () => {
        const path = getCachePath('My  Custom   Font');
        expect(path).toContain('my-custom-font.ttf');
    });
});

describe('isCacheStale', () => {
    it('returns true for non-existent file', () => {
        const result = isCacheStale('/non/existent/path/font.ttf');
        expect(result).toBe(true);
    });

    it('returns true for inaccessible path', () => {
        const result = isCacheStale('');
        expect(result).toBe(true);
    });
});
