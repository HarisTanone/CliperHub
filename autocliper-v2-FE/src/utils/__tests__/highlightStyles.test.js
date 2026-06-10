import { describe, it, expect } from 'vitest'
import { buildHighlightEffect } from '../remotionStyleUtils.js'

const captionConfig = {
    highlight_color: '#FFD700',
    highlight_bg_color: '#FFD70040',
    color: '#FFFFFF',
}

describe('buildHighlightEffect', () => {
    describe('glow style (isActive = true)', () => {
        it('returns style with textShadow containing the highlight color', () => {
            const result = buildHighlightEffect('glow', true, captionConfig)
            expect(result.style.textShadow).toBeDefined()
            expect(result.style.textShadow).toContain('#FFD700')
        })

        it('returns animate with scale keyframes [1, 1.12, 1.05, 1]', () => {
            const result = buildHighlightEffect('glow', true, captionConfig)
            expect(result.animate.scale).toEqual([1, 1.12, 1.05, 1])
        })

        it('returns animate with textShadow cycling', () => {
            const result = buildHighlightEffect('glow', true, captionConfig)
            expect(result.animate.textShadow).toBeDefined()
            expect(Array.isArray(result.animate.textShadow)).toBe(true)
            expect(result.animate.textShadow.length).toBeGreaterThanOrEqual(2)
        })
    })

    describe('background style (isActive = true)', () => {
        it('returns style with backgroundColor containing highlight color', () => {
            const result = buildHighlightEffect('background', true, captionConfig)
            expect(result.style.backgroundColor).toBeDefined()
            expect(result.style.backgroundColor).toContain('#FFD700')
        })

        it('returns style with borderRadius of 4px', () => {
            const result = buildHighlightEffect('background', true, captionConfig)
            expect(result.style.borderRadius).toBe('4px')
        })

        it('returns style with padding', () => {
            const result = buildHighlightEffect('background', true, captionConfig)
            expect(result.style.padding).toBeDefined()
        })
    })

    describe('underline style (isActive = true)', () => {
        it('returns style with borderBottom using highlight color', () => {
            const result = buildHighlightEffect('underline', true, captionConfig)
            expect(result.style.borderBottom).toBeDefined()
            expect(result.style.borderBottom).toContain('#FFD700')
        })

        it('uses the highlight color in the border', () => {
            const result = buildHighlightEffect('underline', true, captionConfig)
            expect(result.style.borderBottom).toContain('#FFD700')
        })
    })

    describe('fill style (isActive = true)', () => {
        it('returns style with backgroundImage using highlight color', () => {
            const result = buildHighlightEffect('fill', true, captionConfig)
            expect(result.style.backgroundImage).toBeDefined()
            expect(result.style.backgroundImage).toContain('#FFD700')
        })

        it('uses WebkitBackgroundClip text for color fill effect', () => {
            const result = buildHighlightEffect('fill', true, captionConfig)
            expect(result.style.WebkitBackgroundClip).toBe('text')
        })
    })

    describe('scale style (isActive = true)', () => {
        it('returns animate with scale keyframes [1, 1.15, 1.0]', () => {
            const result = buildHighlightEffect('scale', true, captionConfig)
            expect(result.animate.scale).toEqual([1, 1.15, 1.0])
        })

        it('transition duration should be 200ms (0.2s)', () => {
            const result = buildHighlightEffect('scale', true, captionConfig)
            expect(result.transition.scale.duration).toBe(0.2)
        })
    })

    describe('all styles when isActive = false', () => {
        const styles = ['glow', 'background', 'underline', 'fill', 'scale']

        styles.forEach((style) => {
            it(`"${style}" returns empty style/animate/transition when isActive is false`, () => {
                const result = buildHighlightEffect(style, false, captionConfig)
                expect(result.style).toEqual({})
                expect(result.animate).toEqual({})
                expect(result.transition).toEqual({})
            })
        })
    })

    describe('unknown/unsupported highlight_style falls back to glow', () => {
        const unknownValues = ['blink', 'rainbow', null, undefined, '']

        unknownValues.forEach((value) => {
            it(`falls back to glow for value: ${JSON.stringify(value)}`, () => {
                const result = buildHighlightEffect(value, true, captionConfig)
                const glowResult = buildHighlightEffect('glow', true, captionConfig)
                expect(result).toEqual(glowResult)
            })
        })
    })
})
