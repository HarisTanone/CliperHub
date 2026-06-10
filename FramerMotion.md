# AutoCliper — Analisis Style & Roadmap Framer Motion

## Ringkasan Eksekutif

File `cek.jsx` adalah mockup hook overlay TikTok-style yang menggunakan **CSS Animations + HTML/DOM rendering** — menghasilkan output yang sangat fleksibel, ekspresif, dan eye-catching.

Sistem AutoCliper saat ini memiliki **2 layer rendering**:
1. **Frontend (Preview)**: React + Framer Motion — animasi smooth tapi terbatas pada preview saja
2. **Backend (Final Video)**: PIL/OpenCV frame-by-frame — rendering ke video tapi secara fundamental lebih terbatas secara visual

**Gap utama**: Frontend preview dengan Framer Motion sudah lumayan, tapi backend rendering (yang menghasilkan video final) jauh lebih terbatas. Dan bahkan frontend preview pun belum mencapai level fleksibilitas `cek.jsx`.

---

## 1. AUDIT SISTEM SAAT INI

### 1.1 Frontend — Framer Motion Preview

**File utama:**
- `RemotionPreview.jsx` — Animated phone mockup preview
- `remotionStyleUtils.js` — Konversi template → CSS styles
- `RemotionStylesPage.jsx` — CRUD + live preview templates

**Yang sudah ada di frontend (Framer Motion):**

| Fitur | File | Implementasi |
|-------|------|-------------|
| Animated caption (karaoke) | `RemotionPreview.jsx` → `AnimatedCaption` | Framer Motion `AnimatePresence` + variants (fade, pop, slide_up, bounce, stomp) |
| Animated hook | `RemotionPreview.jsx` → `AnimatedHook` | Framer Motion scale + opacity transition |
| Floating particles | `RemotionPreview.jsx` → `FloatingParticles` | 5 dots dengan y bounce + opacity cycle |
| Phone frame glow | `RemotionPreview.jsx` | Radial gradient + opacity pulse |
| Playback bar | `RemotionPreview.jsx` → `PlaybackBar` | Progress animation |
| LIVE badge | `RemotionPreview.jsx` | Opacity pulse animation |
| Keyword scale pulse | `RemotionPreview.jsx` | `animate={{ scale: [1, 1.05, 1] }}` infinite |
| Glow pulse (caption) | `RemotionPreview.jsx` | `animate={{ opacity: [1, 0.85, 1] }}` |
| Style → CSS conversion | `remotionStyleUtils.js` | `buildCaptionWordStyle`, `buildHookWordStyle`, `buildCaptionPillStyle`, `buildHookBoxStyle` |
| Gradient text (hook) | `remotionStyleUtils.js` | `WebkitBackgroundClip: 'text'` + linear-gradient |
| Category system | `RemotionStylesPage.jsx` | viral, minimal, gaming, edu, aesthetic, cinematic, hype |

**Yang TIDAK ada di frontend (dibanding cek.jsx):**

| Fitur cek.jsx | Status Frontend |
|---------------|----------------|
| Per-line styling berbeda (3 warna, 3 ukuran) | ❌ Hanya 2 tier: normal + keyword |
| Badge element terpisah | ❌ Tidak ada |
| Staggered enter per-word (berbeda timing + arah) | ❌ Seluruh hook masuk serentak |
| Skew transform (miring) | ❌ Tidak ada |
| Post-entrance idle shake | ❌ Tidak ada |
| Divider gradient animated | ❌ Tidak ada |
| Emoji row bounce | ❌ Tidak ada |
| Flash/burst overlay | ❌ Tidak ada |
| Gradient overlay top/bottom (estetik) | ⚠️ Ada `from-black/25 via-transparent to-black/60` tapi generic |
| 8+ particle colors+sizes | ⚠️ Ada 5 dots tapi mono-color dan sederhana |
| Cubic-bezier springy | ⚠️ Ada `[0.34, 1.56, 0.64, 1]` tapi hanya di hook |

---

### 1.2 Backend — PIL/OpenCV Renderer

**File utama:**
- `premium_renderer.py` → `PremiumHookRenderer`, `PremiumCaptionRenderer`
- `overlay_renderer.py` → `HookRenderer`, `SubtitleRenderer` (legacy)
- `remotion_renderer.py` → `RemotionRenderWorker` (FFmpeg fallback)

**Yang sudah ada di backend:**

| Fitur | Renderer | Detail |
|-------|----------|--------|
| 18+ animation presets | `PremiumHookRenderer` | fade, scale_up, pop_in, bounce, elastic, slide_up/down/left/right, blur_reveal, typewriter, zoom_burst, cinematic_slow, glitch, shake, stagger_words, kinetic, rotation_intro |
| Easing functions | `premium_renderer.py` | ease_out_cubic, elastic, bounce, back, in_out_quad |
| Glow (soft + neon) | `TextEffects` | Concentric rings / neon inner core |
| Shadow (blur + long) | `TextEffects` | draw_shadow, draw_long_shadow |
| Outline/stroke | `TextEffects` | Multi-pass circle stroke |
| Keyword background pill | `HighlightSystem` | Rounded rectangle |
| Underline animated | `HighlightSystem` | Left-to-right sweep |
| Highlight swipe | `HighlightSystem` | Marker-style sweep |
| Smart contrast | `SmartContrast` | Auto-detect brightness, adjust shadow/dim |
| Box background | `PremiumHookRenderer` | Rounded rect with border |
| Chunk enter animations | `PremiumCaptionRenderer` | fade_up, pop, slide_left |
| Background pill per line | `PremiumCaptionRenderer` | Per-line or full block |
| Word-level karaoke | `PremiumCaptionRenderer` | Time-synced highlight |

**Yang TIDAK ada di backend (dibanding cek.jsx):**

| Fitur cek.jsx | Status Backend |
|---------------|----------------|
| Per-line color/size/font berbeda | ❌ Hanya 2 tier |
| Badge element | ❌ Tidak ada |
| Staggered per-word (beda arah) | ⚠️ Ada stagger_words tapi hanya reveal, bukan beda animasi |
| Skew transform | ❌ Tidak ada di PIL |
| Post-entrance idle animation | ❌ Hold phase statis |
| Divider line | ❌ Tidak ada |
| Emoji rendering | ❌ Tidak ada |
| Particle system | ❌ Tidak ada |
| Flash overlay | ❌ Tidak ada |
| Gradient overlay | ⚠️ SmartContrast dim saja |

---

### 1.3 Backend — Remotion Render Worker

**File:** `remotion_renderer.py`

**Status saat ini:**
- ✅ Worker loop sudah jalan (poll render jobs)
- ✅ FFmpeg fallback aktif (drawtext filter — sangat basic)
- ❌ Remotion CLI (`npx remotion render`) belum aktif — butuh `REMOTION_BUNDLE_DIR`
- ❌ Remotion React project belum di-bundle
- ✅ Props builder sudah ada (`_build_remotion_props`)
- ✅ Database tables sudah ada (remotion_caption_templates, remotion_hook_templates, remotion_compositions, remotion_render_jobs)

---

### 1.4 Database — Remotion Template Schema

**Tables:** `remotion_caption_templates`, `remotion_hook_templates`

**Hook Template fields:**
- font_family, font_weight, font_size_normal, font_size_keyword
- color, keyword_color
- box (enabled, color, opacity, padding, border_radius)
- keyword_bg (enabled, color, opacity)
- keyword_underline (enabled, color, thickness)
- shadow (enabled, color, blur, offset_y)
- glow (enabled, color, radius)
- outline (enabled, color, width)
- gradient (enabled, colors[], direction)
- position (x, y, y_offset)
- animation (type, in_duration, display_duration, delay_before)
- config (JSON — extensible)

**Caption Template fields:**
- font (family, weight, size, letter_spacing, text_transform, line_height)
- colors (color, highlight_color, highlight_style)
- background (enabled, color, opacity, padding, radius, per_word)
- outline, shadow
- position (y, y_offset, max_words_per_line, max_lines)
- animation (in, out, duration, highlight_transition)
- display_mode (word_by_word, phrase, sentence)
- config (JSON — extensible)

---

## 2. PERBANDINGAN: cek.jsx vs Sistem Saat Ini

### Gap Fundamental

| Aspek | cek.jsx | Frontend (Framer Motion) | Backend (PIL/FFmpeg) |
|-------|---------|--------------------------|---------------------|
| **Multi-element composition** | ✅ Badge + 3 lines + divider + emoji + particles | ❌ Single hook block | ❌ Single text block |
| **Per-element animation** | ✅ Beda timing + beda jenis per baris | ❌ Satu animasi untuk semua | ⚠️ stagger_words (reveal only) |
| **3+ warna** | ✅ Putih, kuning, pink | ❌ 2 warna (normal + keyword) | ❌ 2 warna |
| **Skew/rotation per-word** | ✅ skewX, rotate | ❌ | ❌ |
| **Idle animation** | ✅ shake setelah entrance | ❌ | ❌ |
| **Decorative elements** | ✅ Divider, emoji row | ❌ | ❌ |
| **Particle effects** | ✅ 8 particles multi-color | ⚠️ 5 generic dots | ❌ |
| **Flash/burst** | ✅ Purple burst 0.55s | ❌ | ❌ |
| **Gradient overlays** | ✅ Top (purple) + bottom (black) | ⚠️ Generic gradient | ⚠️ SmartContrast dim |

### Kenapa Style Database Terasa "Terbatas"

1. **Single-layer text approach** — Hook = satu blok teks, bukan komposisi multi-element
2. **Uniform animation** — Seluruh overlay satu animasi serentak
3. **Hanya 2 warna** — `text_color` dan `keyword_color` saja
4. **Tidak ada decorative elements** — Tidak ada badge, divider, emoji row, particles
5. **Static hold phase** — Setelah muncul, hook statis sampai fade out
6. **Limited transforms** — Hanya scale + translate, tidak ada skew/rotation per-kata
7. **Frontend ≠ Backend** — Preview (Framer Motion) tidak 1:1 dengan output video (PIL)

---

## 3. TEMUAN UTAMA

### 3.1 cek.jsx Unggul Karena:
- Memanfaatkan **CSS Animations** (GPU accelerated, 60fps, deklaratif)
- Database kamu render pakai **PIL/OpenCV frame-by-frame** di CPU — secara fundamental lebih terbatas
- Frontend preview pakai **Framer Motion** yang lebih baik dari backend, tapi masih kalah dari cek.jsx karena belum diimplementasi fitur compositional

### 3.2 Gap Terbesar:
- **Hook = 1 blok teks** vs cek.jsx = **komposisi multi-element** (badge + 3 baris warna beda + divider + emoji + particles)
- **Animasi serentak** vs cek.jsx = **stagger per-element dengan timing berbeda**
- **2 warna** vs cek.jsx = **3+ warna per baris**
- **Frontend dan backend tidak sinkron** — preview ≠ output

### 3.3 Quick Win:
Implementasi **badge + multi-color per line + stagger animation** di KEDUA sisi (frontend + backend) sudah cukup untuk menutup ~80% gap tanpa ubah arsitektur fundamental.

### 3.4 Long-term:
Migrasi ke **Remotion pipeline** akan memberikan 100% fleksibilitas yang sama persis dengan cek.jsx, karena cek.jsx itu sudah merupakan Remotion-ready component — tinggal dijadikan React component dan di-render ke video. Worker (`remotion_renderer.py`) sudah siap, tinggal bundle Remotion project.

---

## 4. ROADMAP IMPLEMENTASI FRAMER MOTION (Frontend)

### Phase 1: Upgrade AnimatedHook Component

**Target:** Preview hook yang setara dengan cek.jsx

#### 4.1.1 Multi-Line Composition Model

Ubah `AnimatedHook` dari single-block menjadi multi-element:

```jsx
// Sebelum (saat ini):
<motion.div>
    <p style={normalWordStyle}>{line.before}</p>
    <motion.p style={keywordWordStyle}>{line.keyword}</motion.p>
    <p style={normalWordStyle}>{line.after}</p>
</motion.div>

// Sesudah (target):
<motion.div>
    {hookStyle.badge?.enable && (
        <motion.div 
            className="badge"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            style={buildBadgeStyle(hookStyle)}
        >
            {hookStyle.badge.text}
        </motion.div>
    )}
    {hookLines.map((line, i) => (
        <motion.p
            key={i}
            style={buildLineStyle(hookStyle, i)}
            initial={getLineEnterAnimation(hookStyle, i).initial}
            animate={getLineEnterAnimation(hookStyle, i).animate}
            transition={{ 
                delay: line.delay || 0.35 + i * 0.23,
                duration: 0.5,
                ease: [0.175, 0.885, 0.32, 1.275] // cubic-bezier back
            }}
        >
            {line.text}
        </motion.p>
    ))}
    {hookStyle.decorations?.divider?.enable && <AnimatedDivider {...} />}
    {hookStyle.decorations?.emoji_row?.enable && <AnimatedEmojiRow {...} />}
</motion.div>
```

#### 4.1.2 Per-Line Animation Variants

Tambahkan di `remotionStyleUtils.js`:

```js
export function getLineEnterVariant(hookStyle, lineIndex) {
    const animations = hookStyle.config?.animation?.per_line || []
    const anim = animations[lineIndex] || { type: 'fade' }
    
    const variants = {
        slam_left: {
            initial: { opacity: 0, x: -40, skewX: 8 },
            animate: { opacity: 1, x: 0, skewX: 0 },
        },
        slam_right: {
            initial: { opacity: 0, x: 40, skewX: -6 },
            animate: { opacity: 1, x: 0, skewX: 0 },
        },
        scale_rotate: {
            initial: { opacity: 0, scale: 0.4, rotate: -4 },
            animate: { opacity: 1, scale: 1, rotate: 0 },
        },
        slide_up: {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
        },
        pop: {
            initial: { opacity: 0, scale: 0.6 },
            animate: { opacity: 1, scale: 1 },
        },
    }
    
    return variants[anim.type] || variants.fade
}

export function buildLineStyle(hookStyle, lineIndex) {
    const lines = hookStyle.config?.text?.lines || []
    const lineConfig = lines[lineIndex] || {}
    
    return {
        fontFamily: lineConfig.font || hookStyle.font_family || 'Anton',
        fontSize: `${(lineConfig.font_size || hookStyle.font_size_normal || 36) * scale}px`,
        fontWeight: lineConfig.font_weight || '900',
        color: lineConfig.color || hookStyle.color || '#FFFFFF',
        letterSpacing: lineConfig.letter_spacing ? `${lineConfig.letter_spacing}px` : undefined,
        lineHeight: 0.95,
        textShadow: buildTextShadow(hookStyle, lineConfig),
    }
}
```

#### 4.1.3 Badge Component

```jsx
function AnimatedBadge({ config, delay = 0.15 }) {
    if (!config?.enable) return null
    
    return (
        <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.4, ease: 'easeOut' }}
            style={{
                display: 'inline-block',
                background: config.bg_color || 'rgba(234,68,154,0.9)',
                borderRadius: 4,
                padding: '2px 7px',
            }}
        >
            <span style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: `${config.font_size || 7}px`,
                fontWeight: 900,
                letterSpacing: `${config.letter_spacing || 2}px`,
                textTransform: 'uppercase',
                color: '#fff',
            }}>
                {config.text}
            </span>
        </motion.div>
    )
}
```

#### 4.1.4 Decorative Elements

```jsx
function AnimatedDivider({ config, delay = 1.1 }) {
    return (
        <motion.div
            initial={{ width: 0 }}
            animate={{ width: config.width || 180 }}
            transition={{ delay, duration: 0.7, ease: 'easeOut' }}
            style={{
                height: 2,
                background: `linear-gradient(90deg, ${(config.colors || ['#f472b6', '#c084fc', 'transparent']).join(', ')})`,
                borderRadius: 2,
                marginTop: 8,
            }}
        />
    )
}

function AnimatedEmojiRow({ config, delay = 1.25 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            style={{ display: 'flex', gap: 6, marginTop: 8 }}
        >
            {(config.emojis || []).map((emoji, i) => (
                <motion.span
                    key={i}
                    animate={{ y: [-0, -5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
                    style={{ fontSize: 18 }}
                >
                    {emoji}
                </motion.span>
            ))}
        </motion.div>
    )
}
```

#### 4.1.5 Post-Entrance Idle Animation

```jsx
// Di line terakhir, tambahkan idle shake setelah entrance selesai
<motion.p
    style={buildLineStyle(hookStyle, lastIdx)}
    initial={getLineEnterVariant(hookStyle, lastIdx).initial}
    animate={[
        getLineEnterVariant(hookStyle, lastIdx).animate,
        // Idle shake setelah entrance
        { x: [0, -5, 5, -4, 4, 0] }
    ]}
    transition={[
        { delay: 0.82, duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] },
        { delay: 1.55, duration: 0.45 }
    ]}
>
    {lastLine.text}
</motion.p>
```

#### 4.1.6 Particle System Upgrade

```jsx
function PremiumParticles({ config }) {
    const particles = config?.particles || [
        { x: 8, size: 5, color: '#f472b6', duration: 3.8, delay: 0.2 },
        { x: 22, size: 3, color: '#c084fc', duration: 4.5, delay: 0.9 },
        { x: 38, size: 4, color: '#818cf8', duration: 3.3, delay: 0.5 },
        { x: 55, size: 5, color: '#f472b6', duration: 5.1, delay: 1.4 },
        { x: 70, size: 3, color: '#fde68a', duration: 4.0, delay: 2.0 },
        { x: 83, size: 4, color: '#c084fc', duration: 3.6, delay: 1.1 },
        { x: 92, size: 3, color: '#818cf8', duration: 4.8, delay: 2.5 },
        { x: 15, size: 4, color: '#fde68a', duration: 5.5, delay: 3.0 },
    ]
    
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: p.size,
                        height: p.size,
                        background: p.color,
                        left: `${p.x}%`,
                        bottom: 0,
                    }}
                    initial={{ y: 0, scale: 0, opacity: 0 }}
                    animate={{ y: -440, scale: 1.3, opacity: [0, 0.9, 0.4, 0] }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        repeat: Infinity,
                        ease: 'linear',
                    }}
                />
            ))}
        </div>
    )
}
```

#### 4.1.7 Flash Effect

```jsx
function FlashOverlay({ config, trigger }) {
    if (!config?.enable) return null
    
    return (
        <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: config.color || 'rgba(192,132,252,0.3)' }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: config.delay || 0.25, duration: config.duration || 0.55 }}
            key={trigger} // re-mount to replay
        />
    )
}
```

---

### Phase 2: Upgrade AnimatedCaption Component

#### 4.2.1 Per-Word Scale Bounce

```jsx
// Saat kata aktif, tambahkan bounce transition
<motion.span
    style={isActive ? highlightWordStyle : normalWordStyle}
    animate={isActive ? { 
        scale: [1, 1.12, 1.05, 1],
        color: style.highlight_color 
    } : { scale: 1 }}
    transition={{ duration: 0.15, ease: 'easeOut' }}
>
    {word}
</motion.span>
```

#### 4.2.2 Smooth Color Transition

```jsx
// Tambah CSS transition di normalWordStyle
const normalWordStyle = {
    ...buildCaptionWordStyle(style, { isHighlight: false, scale }),
    transition: 'color 0.08s ease, transform 0.12s ease',
}
```

#### 4.2.3 Active Word Glow Pulse

```jsx
{isActive && style.highlight_style === 'glow' && (
    <motion.span
        style={{
            ...highlightWordStyle,
            textShadow: `0 0 8px ${style.highlight_color}, 0 0 16px ${style.highlight_color}60`
        }}
        animate={{ 
            textShadow: [
                `0 0 8px ${style.highlight_color}, 0 0 16px ${style.highlight_color}60`,
                `0 0 12px ${style.highlight_color}, 0 0 24px ${style.highlight_color}90`,
                `0 0 8px ${style.highlight_color}, 0 0 16px ${style.highlight_color}60`,
            ]
        }}
        transition={{ duration: 1.0, repeat: Infinity }}
    >
        {word}
    </motion.span>
)}
```

---

### Phase 3: Database Schema Extension

Tambahkan fields baru di `config` JSON (no migration needed — JSON extensible):

#### Hook Template `config` Extension:

```json
{
  "text": {
    "lines": [
      {"color": "#FFFFFF", "font_size": 46, "font": "Bebas Neue", "font_weight": "900"},
      {"color": "#FDE68A", "font_size": 52, "font": "Bebas Neue", "font_weight": "900"},
      {"color": "#F0ABFC", "font_size": 34, "letter_spacing": 4, "font": "Bebas Neue"}
    ]
  },
  "badge": {
    "enable": true,
    "text": "CERITA NYATA 🔥",
    "bg_color": "#EA449A",
    "font_size": 10,
    "font_family": "Montserrat",
    "letter_spacing": 2,
    "animation": {"type": "slide_left", "delay": 0.15, "duration": 0.4}
  },
  "animation": {
    "type": "stagger_composition",
    "per_line": [
      {"type": "slam_left", "delay": 0.35, "easing": "back"},
      {"type": "slam_right", "delay": 0.58, "easing": "back"},
      {"type": "scale_rotate", "delay": 0.82, "idle": "shake", "idle_delay": 1.55}
    ]
  },
  "decorations": {
    "divider": {
      "enable": true,
      "colors": ["#f472b6", "#c084fc", "transparent"],
      "width": 180,
      "delay": 1.1
    },
    "emoji_row": {
      "enable": true,
      "emojis": ["😱", "💔", "😭"],
      "delay": 1.25
    }
  },
  "effects": {
    "flash": {"enable": true, "color": "rgba(192,132,252,0.3)", "delay": 0.25, "duration": 0.55},
    "particles": {
      "enable": true,
      "count": 8,
      "colors": ["#f472b6", "#c084fc", "#818cf8", "#fde68a"],
      "size_range": [3, 5]
    }
  },
  "overlay": {
    "gradient_top": {"enable": true, "color": "rgba(80,10,120,0.5)", "height_percent": 40},
    "gradient_bottom": {"enable": true, "color": "rgba(0,0,0,0.85)", "height_percent": 35}
  }
}
```

---

## 5. ROADMAP IMPLEMENTASI BACKEND

### Phase 1: Extend PremiumHookRenderer (Python/PIL)

Tambahkan support untuk:
- Multi-line colors/sizes dari `config.text.lines[]`
- Badge rendering (rounded rect + text)
- Per-line stagger timing
- Gradient overlay (top/bottom) via PIL gradient fill
- Flash effect (full-frame alpha overlay fade-out)

### Phase 2: Remotion Bundle (Node.js — Recommended)

**Arsitektur target:**

```
autocliper-v2/
├── remotion/                    # NEW: Remotion React project
│   ├── src/
│   │   ├── compositions/
│   │   │   ├── ClipComposition.tsx    # Main composition
│   │   │   ├── HookOverlay.tsx        # Hook component (setara cek.jsx)
│   │   │   └── KaraokeCaption.tsx     # Caption component
│   │   ├── components/
│   │   │   ├── Badge.tsx
│   │   │   ├── AnimatedLine.tsx
│   │   │   ├── Divider.tsx
│   │   │   ├── EmojiRow.tsx
│   │   │   ├── Particles.tsx
│   │   │   └── FlashOverlay.tsx
│   │   └── utils/
│   │       ├── animations.ts          # Easing, spring configs
│   │       └── styleBuilder.ts        # Template → CSS
│   ├── remotion.config.ts
│   └── package.json
```

**Flow:**
1. Backend `remotion_renderer.py` sudah punya `_render_via_remotion()` method
2. Tinggal buat Remotion project, bundle dengan `npx remotion bundle`
3. Set `REMOTION_BUNDLE_DIR` env var ke output bundle
4. Worker akan otomatis pakai Remotion CLI untuk render

**HookOverlay.tsx (contoh setara cek.jsx):**

```tsx
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion'

export const HookOverlay: React.FC<{ config: HookConfig }> = ({ config }) => {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    
    const lines = config.text?.lines || []
    const badge = config.badge
    const decorations = config.decorations
    
    return (
        <div style={{ position: 'absolute', inset: 0 }}>
            {/* Gradient overlays */}
            {config.overlay?.gradient_top?.enable && <GradientTop {...config.overlay.gradient_top} />}
            {config.overlay?.gradient_bottom?.enable && <GradientBottom {...config.overlay.gradient_bottom} />}
            
            {/* Flash */}
            {config.effects?.flash?.enable && <FlashOverlay frame={frame} fps={fps} config={config.effects.flash} />}
            
            {/* Particles */}
            {config.effects?.particles?.enable && <Particles frame={frame} fps={fps} config={config.effects.particles} />}
            
            {/* Main hook content */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 12px' }}>
                {badge?.enable && <Badge frame={frame} fps={fps} config={badge} />}
                
                {lines.map((line, i) => (
                    <AnimatedLine 
                        key={i} 
                        frame={frame} 
                        fps={fps} 
                        line={line} 
                        animation={config.animation?.per_line?.[i]} 
                    />
                ))}
                
                {decorations?.divider?.enable && <Divider frame={frame} fps={fps} config={decorations.divider} />}
                {decorations?.emoji_row?.enable && <EmojiRow frame={frame} fps={fps} config={decorations.emoji_row} />}
            </div>
        </div>
    )
}
```

### Phase 3: Sinkronisasi Frontend ↔ Backend

**Prinsip: What You See Is What You Get (WYSIWYG)**

| Layer | Tool | Output |
|-------|------|--------|
| Preview (browser) | Framer Motion | Animasi di UI ≈ visual output |
| Final render | Remotion CLI | Video MP4 identik dengan preview |
| Shared config | JSON template (DB) | Single source of truth |

Kedua sisi (frontend preview + Remotion render) membaca template JSON yang sama, sehingga preview di browser = output video final.

---

## 6. PRIORITAS IMPLEMENTASI

| # | Priority | Fitur | Sisi | Impact | Effort |
|---|----------|-------|------|--------|--------|
| 1 | 🔴 P0 | Multi-line colors/sizes di AnimatedHook | Frontend | Tinggi | Low |
| 2 | 🔴 P0 | Stagger per-line animation | Frontend | Tinggi | Low |
| 3 | 🔴 P0 | Badge component | Frontend + Backend | Tinggi | Low |
| 4 | 🟠 P1 | Gradient overlay top/bottom | Frontend + Backend | Tinggi | Low |
| 5 | 🟠 P1 | Flash burst effect | Frontend | Medium | Low |
| 6 | 🟠 P1 | Particle system upgrade (8 dots, multi-color) | Frontend | Medium | Low |
| 7 | 🟠 P1 | Per-word scale bounce (caption) | Frontend | Medium | Low |
| 8 | 🟡 P2 | Divider + Emoji row | Frontend + Backend | Medium | Medium |
| 9 | 🟡 P2 | Idle animation (shake/pulse post-entrance) | Frontend + Backend | Medium | Low |
| 10 | 🟡 P2 | Extend PremiumHookRenderer (multi-line, badge, particles) | Backend | Tinggi | Medium |
| 11 | 🟢 P3 | Remotion project setup + bundle | Backend | Sangat Tinggi | High |
| 12 | 🟢 P3 | Sinkronisasi WYSIWYG (preview = output) | Full Stack | Sangat Tinggi | High |
| 13 | 🟢 P3 | Template marketplace / presets | Full Stack | Medium | Medium |

---

## 7. SCHEMA MIGRATION (Database)

Karena `remotion_hook_templates` sudah punya kolom `config JSON`, TIDAK perlu migrasi SQL. Cukup extend JSON config dengan fields baru. Frontend dan backend yang membaca config perlu di-update untuk handle fields baru.

**Backwards compatible** — templates lama tanpa `badge`, `decorations`, `effects` tetap jalan karena code membaca dengan default `None`/`{}`.

---

## 8. KESIMPULAN

### Immediate Action (1-2 hari):
Upgrade `AnimatedHook` di frontend untuk support **multi-line + stagger + badge** — ini sudah cukup untuk membuat preview terlihat setara cek.jsx.

### Short-term (1 minggu):
Extend `PremiumHookRenderer` di backend untuk render fitur-fitur baru ke video (particles, gradient overlay, badge, multi-color lines).

### Medium-term (2-3 minggu):
Setup Remotion project, bundle, dan aktifkan `_render_via_remotion()` di worker — ini akan membuat output video **identik** dengan preview browser.

### Long-term:
Shared component library antara frontend preview (Framer Motion) dan Remotion render (React/CSS) — satu template, dua output yang identik.
