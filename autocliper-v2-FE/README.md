# ClipForge Frontend

AI-powered video clipping platform — mengubah video YouTube panjang menjadi short clips viral dengan **Remotion-powered** caption dan hook overlay.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.2 | UI framework |
| Vite | 7.3 | Build tool & dev server |
| Tailwind CSS | 4.2 | Utility-first CSS |
| Framer Motion | 12.40 | Animations |
| React Hot Toast | 2.6 | Notifications |

## Quick Start

```bash
npm install
npm run dev       # → http://localhost:5173
npm run build     # Production build
```

Requires backend running on `http://localhost:8000`.

## Architecture

```
src/
├── components/
│   ├── RemotionPreview.jsx    # Animated phone preview (shared component)
│   ├── ui/                    # Reusable UI primitives
│   ├── EmptyState.jsx
│   ├── HealthBadge.jsx
│   ├── PageTransition.jsx
│   ├── PostToSocialModal.jsx
│   ├── ProgressRing.jsx
│   ├── Skeleton.jsx
│   └── ThemeToggle.jsx
├── hooks/
│   └── useKeyboardShortcuts.js
├── pages/
│   ├── CreatePage.jsx         # Create clips (compositions + custom styles)
│   ├── RemotionStylesPage.jsx # Styles management (CRUD)
│   ├── StyleApplyPage.jsx     # Re-style existing clips
│   ├── DashboardPage.jsx
│   ├── LibraryPage.jsx
│   ├── QueuePage.jsx
│   ├── ProcessingPage.jsx
│   ├── AccountsPage.jsx       # Multi-platform social accounts
│   ├── AnalyticsPage.jsx
│   ├── UsersPage.jsx          # Admin user management
│   ├── SettingsPage.jsx
│   └── LoginPage.jsx
├── utils/
│   ├── api.js                 # API client (auth, jobs, remotion, social)
│   └── remotionStyleUtils.js  # Shared style → CSS conversion utilities
├── App.jsx                    # Layout, routing, auth
├── index.css                  # Design system tokens (dark/light themes)
└── main.jsx
```

## Remotion Integration

All styling is powered by **Remotion templates** (no FFmpeg caption rendering):

| API | Purpose |
|-----|---------|
| `GET /api/v1/remotion/caption-templates` | Caption style templates |
| `GET /api/v1/remotion/hook-templates` | Hook overlay templates |
| `GET /api/v1/remotion/compositions` | Preset combinations (caption + hook) |
| `POST /api/v1/remotion/render-jobs` | Trigger Remotion render |

### Style Preview System

`src/utils/remotionStyleUtils.js` provides shared functions:
- `buildCaptionWordStyle(template, { isHighlight, scale })` — CSS for caption words
- `buildCaptionPillStyle(template, { scale })` — Background pill/container
- `buildHookWordStyle(template, { isKeyword, scale })` — Hook text styles
- `buildHookBoxStyle(template, { scale })` — Hook container/box

These are used by both **card previews** (grid thumbnails) and the **RemotionPreview** phone component to ensure visual consistency.

## Pages Overview

| Page | Route Key | Description |
|------|-----------|-------------|
| Dashboard | `dashboard` | Stats, active jobs, quick actions |
| Create Clip | `create` | YouTube URL → select composition/style → process |
| Queue | `queue` | Real-time job monitoring (WebSocket + SSE) |
| Library | `library` | Browse/download completed clips, post to social |
| Styles | `remotion-styles` | CRUD for caption templates, hook templates, compositions |
| Re-Style | `style-apply` | Apply different style to existing base clips |
| Accounts | `accounts` | Multi-platform social media management |
| Analytics | `analytics` | Performance insights |
| Users | `users` | Admin user management |
| Settings | `settings` | Profile, pipeline config, storage |

## Design System

Dual theme (dark/light) via CSS custom properties in `index.css`:
- **Dark**: Navy/plum palette with rose-crimson accent (`#c94a6e`)
- **Light**: Blush/rose palette with deep rose accent (`#7a3050`)

Theme toggle persisted in `localStorage('theme')`.

## API Endpoints Used

### Backend (port 8000)
- Auth: `/api/v1/auth/*` (login, refresh, logout, me)
- Jobs: `/api/v1/jobs/*` (create, list, process, apply-style)
- Remotion: `/api/v1/remotion/*` (templates CRUD, compositions, render jobs)
- Fonts: `/api/v1/fonts/`
- Stats: `/api/v1/stats/dashboard`, `/api/v1/analytics/*`
- Admin: `/api/v1/users/*`, `/api/v1/admin/*`
- WebSocket: `/ws` (real-time job progress)

### Automate (port 8001, optional)
- Social: `/api/v1/social/*` (accounts, uploads)
- TikTok: `/api/v1/tiktok/*` (legacy, migrating to social)

## Environment Variables

```env
VITE_API_URL=http://localhost:8000      # Backend URL
VITE_AUTOMATE_URL=http://localhost:8001  # Automate service URL
```

## Default Login

```
username: admin
password: (set during DB seed)
```
