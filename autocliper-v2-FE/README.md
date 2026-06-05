# ClipForge Frontend

AI-powered video clipping tool untuk mengubah video YouTube panjang menjadi short clips viral secara otomatis dengan caption dan hook overlay yang menarik.

## 📋 Daftar Isi

- [Tech Stack](#tech-stack)
- [Design System](#design-system)
- [Theme Configuration](#theme-configuration)
- [Struktur Project](#struktur-project)
- [Pages](#pages)
- [Components](#components)
- [Utils & Hooks](#utils--hooks)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)

---

## 🛠 Tech Stack

| Technology | Version | Description |
|------------|---------|-------------|
| **React** | 19.2.0 | UI Library dengan React 19 features |
| **Vite** | 7.3.1 | Build tool dan dev server super cepat |
| **Tailwind CSS** | 4.2.1 | Utility-first CSS framework |
| **Framer Motion** | 12.38.0 | Animation library untuk React |
| **React Hot Toast** | 2.6.0 | Toast notifications yang ringan |

---

## 🎨 Design System

### Color Palette

Design system menggunakan CSS custom properties yang didefinisikan di `src/index.css`:

#### Primary Colors
```css
--color-primary: #6366f1;       /* Indigo - Warna utama */
--color-primary-light: #818cf8; /* Primary terang untuk hover states */
--color-primary-dark: #4f46e5;  /* Primary gelap untuk gradients */
```

#### Accent Colors
```css
--color-accent: #f472b6;   /* Pink - Untuk highlights dan CTA */
--color-accent-2: #a78bfa; /* Purple - Secondary accent */
```

#### Semantic Colors
```css
--color-success: #10b981; /* Emerald - Status sukses */
--color-warning: #f59e0b; /* Amber - Peringatan */
--color-error: #ef4444;   /* Red - Error states */
```

#### Surface Colors (Light Mode)
```css
--color-surface: #ffffff;           /* Card background */
--color-surface-2: #f8fafc;         /* Secondary surface */
--color-background-light: #f1f5f9;  /* Page background */
```

#### Surface Colors (Dark Mode)
```css
--color-background-dark: #0a0e1a;    /* Page background */
--color-card-dark: #111827;          /* Card background */
--color-card-border-dark: #1e293b;   /* Card borders */
--color-input-dark: #0f172a;         /* Input background */
--color-input-border-dark: #334155;  /* Input borders */
```

#### Text Colors
```css
--color-text-muted: #94a3b8;   /* Secondary text */
--color-text-muted-2: #64748b; /* Tertiary text */
```

### Typography

```css
--font-display: "Inter", "Spline Sans", system-ui, sans-serif;
```

Font Inter di-load via Google Fonts CDN di `index.html`.

### Border Radius

```css
--radius: 0.375rem;     /* 6px - Small elements */
--radius-lg: 0.75rem;   /* 12px - Cards, buttons */
--radius-xl: 1rem;      /* 16px - Large cards */
--radius-2xl: 1.25rem;  /* 20px - Modal, panels */
```

### Visual Effects

#### Glassmorphism
```css
.glass {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Dark mode variant */
.dark .glass {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(51, 65, 85, 0.5);
}
```

#### Gradient Text
```css
.gradient-text {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

#### Card Hover Effect
```css
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px -12px rgba(99, 102, 241, 0.15);
}
```

#### Animations
- **ambient-glow**: Subtle pulsing glow effect
- **pulse-glow**: Ring pulse animation untuk notifications
- **shimmer**: Loading shimmer effect untuk skeletons

---

## 🌓 Theme Configuration

### Dark/Light Mode

Theme diatur via class toggle pada `<html>` element:

```jsx
// ThemeToggle.jsx
const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

// Apply to DOM
if (theme === 'dark') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}
```

### Auto Detection

Sistem otomatis mendeteksi preferensi sistem user:

```jsx
const [theme, setTheme] = useState(() => {
  const saved = localStorage.getItem('theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})
```

### Persistence

Theme preference disimpan di `localStorage` dengan key `'theme'`.

---

## 📁 Struktur Project

```
src/
├── components/          # Reusable UI components
│   ├── EmptyState.jsx
│   ├── HealthBadge.jsx
│   ├── PageTransition.jsx
│   ├── PostToSocialModal.jsx
│   ├── PostToTikTokModal.jsx
│   ├── ProgressRing.jsx
│   ├── Skeleton.jsx
│   └── ThemeToggle.jsx
├── hooks/               # Custom React hooks
│   └── useKeyboardShortcuts.js
├── pages/               # Page components
│   ├── AccountsPage.jsx
│   ├── AnalyticsPage.jsx
│   ├── CreatePage.jsx
│   ├── DashboardPage.jsx
│   ├── LibraryPage.jsx
│   ├── LoginPage.jsx
│   ├── ProcessingPage.jsx
│   ├── QueuePage.jsx
│   ├── SettingsPage.jsx
│   ├── StyleApplyPage.jsx
│   ├── StylesPage.jsx
│   ├── TikTokPage.jsx
│   └── UsersPage.jsx
├── utils/               # Utility functions
│   └── api.js
├── App.jsx              # Main application component
├── index.css            # Global styles & design tokens
└── main.jsx             # Application entry point
```

---

## 📄 Pages

### 1. LoginPage (`LoginPage.jsx`)

**Fungsi**: Halaman autentikasi user dengan security features.

**Fitur**:
- Form login dengan username dan password
- Show/hide password toggle
- Rate limiting protection (cooldown 5 menit setelah terlalu banyak percobaan)
- Token storage (access_token, refresh_token)
- Error handling untuk berbagai status (401, 403, 429)
- Responsive split layout dengan decorative elements

**State Management**:
- `username`, `password`: Form inputs
- `showPass`: Password visibility toggle
- `error`: Error message display
- `loading`: Submission state
- `loginDisabled`, `cooldownSeconds`: Rate limit handling

---

### 2. DashboardPage (`DashboardPage.jsx`)

**Fungsi**: Halaman utama setelah login dengan overview sistem.

**Fitur**:
- **Welcome Card**: Greeting dengan nama user dan status
- **Stats Cards**: Total clips generated, total jobs
- **Active Jobs**: Monitoring job yang sedang diproses (auto-refresh 8s)
- **Quick Actions**: Shortcut ke Create, Library, Styles
- **Recent Activity**: Daftar job terbaru
- **System Health**: Status server, disk space, queue

**Components Used**:
- `StatsSkeleton`, `CardSkeleton` - Loading states
- `FadeInUp`, `StaggerContainer`, `StaggerItem` - Animations
- `EmptyState` - No data states

**Auto-refresh Logic**:
- Polling setiap 8 detik jika ada active jobs

---

### 3. CreatePage (`CreatePage.jsx`)

**Fungsi**: Membuat clip baru dari video YouTube.

**Fitur**:
- **URL Input**: Single atau batch (newline-separated)
- **Video Preview**: Auto-fetch thumbnail dari YouTube oEmbed
- **Mode Selection**:
  - `styled`: Apply style langsung saat processing
  - `base`: Process dulu, style nanti (non-destructive)
- **Caption Style Selector**: Carousel dengan search dan pagination
- **Hook Style Selector**: Opsional overlay untuk viral hooks
- **Customization Panel**: Real-time edit colors, typography, effects
- **Phone Preview**: Live preview tampilan caption di format 9:16
- **Analyze Mode**: Review dan pilih clips sebelum processing
- **Preview Generation**: 5-second low-res preview sebelum full process

**Sub-components**:
- `StyleCarousel`: Paginated style selector dengan search
- `HookCarousel`: Hook style selector
- `CustomizationPanel`: Collapsible style editor
- `PhonePreview`: TikTok-style phone mockup
- `ReviewPanel`: Clip selection interface untuk analyze mode

---

### 4. QueuePage (`QueuePage.jsx`)

**Fungsi**: Real-time monitoring processing queue.

**Fitur**:
- **Active Processing Card**: Current job dengan progress ring dan stages
- **Queue List**: Pending jobs dengan thumbnail dan position
- **Recent Jobs**: Completed/failed jobs history
- **WebSocket Integration**: Real-time updates via WebSocket
- **Fallback Polling**: Auto-fallback ke HTTP polling jika WebSocket gagal
- **Clear Stuck State**: Manual intervention untuk stuck jobs

**Real-time Features**:
- WebSocket connection dengan auto-reconnect
- Fallback polling setiap 5 detik
- Stage-by-stage progress visualization

---

### 5. LibraryPage (`LibraryPage.jsx`)

**Fungsi**: Browse dan manage completed clips.

**Fitur**:
- **Job List**: Expandable rows dengan clip grid
- **Clip Cards**: Thumbnail, score, duration, keywords
- **Bulk Selection**: Select all/individual clips
- **Video Modal**: Full preview player
- **Actions**:
  - Copy hook text + hashtags
  - Download video file
  - Re-style clips
  - Post to social media
- **Social Integration**: Multi-platform posting (TikTok, YouTube, Instagram, Facebook)

**Sub-components**:
- `ClipCard`: Individual clip display dengan actions
- `JobRow`: Expandable job container
- `VideoModal`: Fullscreen video player
- `SocialPostDropdown`: Platform selection dropdown

---

### 6. AccountsPage (`AccountsPage.jsx`)

**Fungsi**: Multi-platform social media account management.

**Fitur**:
- **Platform Support**: YouTube, TikTok, Instagram, Facebook, X (Twitter)
- **Account Cards**: Status, upload stats, health score
- **Add Account Modal**:
  - Platform selection
  - Login method (Manual, Google, Email, Phone)
  - Proxy configuration
  - Daily upload limit setting
- **Session Management**: Login, validate, import cookies
- **Upload Queue**: Pending/published uploads per platform

**Login Methods**:
- `manual`: Browser opens, user logs in manually
- `google`: Google OAuth login
- `email`/`phone`: Auto-login dengan credentials (encrypted)

---

### 7. AnalyticsPage (`AnalyticsPage.jsx`)

**Fungsi**: Performance insights dan statistics.

**Fitur**:
- **Overview Stats**: Total jobs, clips generated, avg score, success rate
- **Usage Chart**: Bar chart dengan daily activity
- **Score Distribution**: Horizontal bar chart (Excellent/Good/Average/Low)
- **Top Performing Clips**: Ranked list by score
- **Period Selector**: 7d, 30d, 90d

**Visualizations**:
- Animated bars dengan Framer Motion
- Hover tooltips dengan detailed info
- Color-coded score tiers

---

### 8. StylesPage (`StylesPage.jsx`)

**Fungsi**: Manage caption styles dan hook overlay styles.

**Fitur**:
- **Caption Styles Tab**:
  - Style grid dengan live preview
  - Create new style modal
  - Edit panel dengan full customization
  - Phone preview dengan live rendering
  - Global vs user styles distinction
  
- **Hook Styles Tab**:
  - Animation type selector (fade, scale, bounce, slide, etc.)
  - Text styling (normal + keyword)
  - Shadow, glow, outline effects
  - Box background with opacity
  - Underline styling

**Customization Options**:
- Font family, size, weight
- Colors: text, highlight, outline, shadow
- Outline width
- Shadow offset
- Line spacing
- Caption position (bottom margin)

---

### 9. SettingsPage (`SettingsPage.jsx`)

**Fungsi**: User settings dan admin configurations.

**Tabs**:

#### Profile Tab (All Users)
- Profile info display
- Email update
- Password change dengan validation

#### Pipeline Tab (Admin Only)
- Hook duration settings (min, max, reading speed, padding)
- Output settings (parallel clips, audio normalize, smart thumbnail)
- Words per chunk setting

#### Storage Tab (Admin Only)
- Disk cleanup tool
- Delete outputs older than X days
- Freed space report

---

### 10. UsersPage (`UsersPage.jsx`)

**Fungsi**: User management (Admin only).

**Fitur**:
- **Stats**: Total users, active users, admin count
- **User List**: Search, filter
- **Create User Modal**: Username, password, email, role
- **Edit User Modal**: Update all fields, toggle active status
- **Delete User**: Confirmation dialog

**Roles**:
- `user`: Standard access
- `admin`: Full access including admin pages

---

### 11. ProcessingPage (`ProcessingPage.jsx`)

**Fungsi**: Real-time job progress monitoring.

**Fitur**:
- **Video Card**: Thumbnail dan metadata dari YouTube
- **Progress Ring**: Overall percentage
- **Stage Progress**: Visual step indicator
- **Terminal Log**: Real-time scrolling logs dengan syntax coloring
- **Status Banners**: Completed, failed, cancelled states
- **SSE Streaming**: Server-Sent Events untuk real-time updates
- **Fallback Polling**: Auto-fallback jika SSE fails

**Stage Icons**:
- `fetching_video`: download
- `analyzing_content`: psychology
- `generating_clips`: movie_filter
- `applying_captions`: subtitles

---

### 12. StyleApplyPage (`StyleApplyPage.jsx`)

**Fungsi**: Re-style existing clips tanpa re-processing video.

**Fitur**:
- **Clip Grid**: Raw clips dengan thumbnails
- **Video Preview Modal**: Fullscreen raw clip preview
- **Caption Style Selection**: Grid dengan visual preview
- **Hook Style Selection**: Optional hook overlay
- **Step Progress**: 3-step wizard UI
- **Non-destructive**: Base clips preserved

**Workflow**:
1. Preview raw clips
2. Choose caption style + optional hook style
3. Apply & export styled clips

---

### 13. TikTokPage (`TikTokPage.jsx`)

**Fungsi**: TikTok-specific account dan upload management.

**Fitur**:
- **Stats Overview**: Total accounts, active, pending, published
- **Account Management**: Add, login, delete TikTok accounts
- **Upload Queue**: Monitor upload status
- **Service Health Check**: Verify automate service online

**Note**: Halaman ini adalah legacy page, fungsi utama sudah dipindahkan ke `AccountsPage.jsx` untuk multi-platform support.

---

## 🧩 Components

### 1. ThemeToggle (`ThemeToggle.jsx`)

**Fungsi**: Dark/light mode switcher.

**Props**: None

**Features**:
- Animated icon transition (sun/moon)
- Persist to localStorage
- Respects system preference on first load

---

### 2. PageTransition (`PageTransition.jsx`)

**Fungsi**: Animation wrappers untuk page dan element transitions.

**Exports**:

| Component | Description | Props |
|-----------|-------------|-------|
| `PageTransition` | Page-level enter/exit animations | `children`, `pageKey` |
| `FadeInUp` | Fade in dari bawah | `children`, `delay`, `className` |
| `StaggerContainer` | Container untuk staggered children | `children`, `className`, `staggerDelay` |
| `StaggerItem` | Individual stagger item | `children`, `className` |
| `ScaleIn` | Scale in untuk modals | `children`, `className` |
| `SlideInRight` | Slide dari kanan | `children`, `className` |

---

### 3. ProgressRing (`ProgressRing.jsx`)

**Fungsi**: Circular progress indicator dengan SVG.

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `progress` | number | 0 | Progress percentage (0-100) |
| `size` | number | 80 | Diameter in pixels |
| `strokeWidth` | number | 6 | Ring thickness |
| `className` | string | '' | Additional CSS classes |

---

### 4. Skeleton (`Skeleton.jsx`)

**Fungsi**: Loading skeleton components.

**Exports**:

| Component | Description |
|-----------|-------------|
| `Skeleton` | Base skeleton with pulse animation |
| `CardSkeleton` | Card layout skeleton |
| `StatsSkeleton` | Stats grid skeleton |
| `GridSkeleton` | Grid layout skeleton (count param) |
| `TableRowSkeleton` | Table rows skeleton (rows param) |

---

### 5. EmptyState (`EmptyState.jsx`)

**Fungsi**: Empty state illustrations dan messaging.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `type` | string | Illustration type: `noJobs`, `noHistory`, `noUsers`, `noStyles` |
| `title` | string | Main heading |
| `description` | string | Subtext |
| `action` | function | Optional action handler |
| `actionLabel` | string | Button text |
| `icon` | string | Fallback icon name |

---

### 6. HealthBadge (`HealthBadge.jsx`)

**Fungsi**: System health indicator di header.

**Features**:
- Server health status (healthy/unhealthy)
- Processing indicator
- Queue count
- Disk space dengan color coding (ok/warning/critical)
- Auto-refresh setiap 30 detik

---

### 7. PostToSocialModal (`PostToSocialModal.jsx`)

**Fungsi**: Multi-platform social media posting modal.

**Props**:
| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Modal visibility |
| `onClose` | function | Close handler |
| `clip` | object | Clip data |
| `jobId` | string | Parent job ID |
| `outputFile` | string | Video file path |
| `thumbnail` | string | Thumbnail path |
| `platform` | string | Target platform |
| `isBulk` | boolean | Bulk upload mode |
| `clips` | array | Multiple clips (bulk mode) |
| `onSuccess` | function | Success callback |

**Supported Platforms**:
- TikTok
- Instagram Reels
- YouTube Shorts
- Facebook Reels

---

### 8. PostToTikTokModal (`PostToTikTokModal.jsx`)

**Fungsi**: TikTok-specific posting modal (legacy).

**Features**:
- Account selection
- Caption & hashtags input
- Schedule options (Now, Schedule, Best Time AI suggestion)
- Thumbnail preview

**Note**: Dipertahankan untuk backwards compatibility, prefer `PostToSocialModal` untuk new implementations.

---

## 🔧 Utils & Hooks

### api.js (`src/utils/api.js`)

**Base URLs**:
```javascript
const BASE = 'http://localhost:8000';      // Main backend
const TIKTOK_BASE = 'http://localhost:8001'; // Automate service
```

**Key Functions**:

#### Authentication
- `login(username, password)` - User login
- `loginRaw(username, password)` - Login dengan raw response
- `logout()` - Revoke refresh token
- `getMe()` - Get current user
- `changePassword(currentPassword, newPassword)` - Change password
- `updateProfile(data)` - Update user profile

#### Jobs
- `createJob(urls, styleId, hookStyleId)` - Create processing job
- `getJobs()` - List all jobs
- `getJob(id)` - Get job details
- `deleteJob(id)` - Delete job
- `getJobLogs()` - Get current job logs
- `getJobHistory()` - Get completed jobs
- `retryJob(id)` - Retry failed job

#### Two-Step Processing
- `analyzeVideo(url, captionStyle, hookStyleId)` - Analyze untuk clip selection
- `processSelected(url, captionStyle, hookStyleId, clips)` - Process selected clips
- `baseProcess(url)` - Process tanpa styling
- `applyStyle(jobId, captionStyle, hookStyleId)` - Apply style ke base clips

#### Styles
- `getStyles()` / `getStyle(id)` - Caption styles
- `createStyle(data)` / `updateStyle(id, data)` / `deleteStyle(id)`
- `getHookStyles()` / `getHookStyle(id)` - Hook overlay styles
- `createHookStyle(data)` / `updateHookStyle(id, data)` / `deleteHookStyle(id)`
- `getFonts()` - Available fonts

#### Users (Admin)
- `getUsers()` / `getUser(id)`
- `createUser(data)` / `updateUser(id, data)` / `deleteUser(id)`

#### Stats & Analytics
- `getDashboardStats()` - Dashboard statistics
- `getUsageStats(period)` - Usage over time
- `getAnalyticsOverview()` - Analytics summary
- `getClipsAnalytics(days, limit)` - Clip performance data

#### Social Media (Automate Service)
- `getSocialPlatforms()` - Available platforms
- `getSocialAccounts(platform)` / `createSocialAccount(data)`
- `triggerSocialLogin(id, manual)` - Initiate login flow
- `importSocialCookies(id, cookies, username)` - Import browser cookies
- `getSocialQueue(platform, status)` - Upload queue
- `createSocialUpload(data)` / `cancelSocialUpload(id)` / `retrySocialUpload(id)`

#### TikTok Specific
- `getTikTokHealth()` - Service health check
- `getTikTokAccounts()` / `createTikTokAccount(data)`
- `triggerTikTokLogin(id)` / `validateTikTokSession(id)`
- `uploadToTikTok(data)` / `suggestTikTokSchedule(accountId, clipsCount)`

#### Utility Functions
- `loadGoogleFonts(fonts)` - Load fonts via Google Fonts CDN
- `getAuthenticatedMediaUrl(endpoint)` - Fetch media dengan auth as blob URL
- `fileUrl(path)` - Convert backend path ke API endpoint
- `getWebSocketUrl()` - WebSocket URL untuk real-time updates
- `flattenHookStyle(hs)` - Flatten nested config untuk UI
- `buildHookStylePayload(flat)` - Rebuild nested config dari flat form

#### Token Refresh
API client otomatis handle token refresh:
- Intercept 401 responses
- Attempt refresh dengan refresh_token
- Retry original request
- Redirect ke login jika refresh fails

---

### useKeyboardShortcuts.js (`src/hooks/useKeyboardShortcuts.js`)

**Fungsi**: Global keyboard shortcuts untuk navigasi.

**Shortcuts**:
| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + N` | Navigate ke new job |
| `Cmd/Ctrl + D` | Navigate ke dashboard |
| `Cmd/Ctrl + H` | Navigate ke history |

**Usage**:
```jsx
useKeyboardShortcuts(navigateTo)
```

**Note**: Shortcuts disabled saat focus di input/textarea.

---

## 🔌 API Reference

### Main Backend (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/login` | POST | User authentication |
| `/api/v1/auth/token/refresh` | POST | Refresh access token |
| `/api/v1/auth/logout` | POST | Revoke refresh token |
| `/api/v1/auth/me` | GET | Current user info |
| `/api/v1/jobs/` | GET/POST | List/create jobs |
| `/api/v1/jobs/{id}` | GET/DELETE | Get/delete job |
| `/api/v1/jobs/logs` | GET | Current processing logs |
| `/api/v1/jobs/logs/stream` | GET (SSE) | Real-time log stream |
| `/api/v1/jobs/analyze` | POST | Analyze video for clips |
| `/api/v1/jobs/process-selected` | POST | Process selected clips |
| `/api/v1/jobs/base-process` | POST | Process without styling |
| `/api/v1/jobs/{id}/apply-style` | POST | Apply style to base clips |
| `/api/v1/caption-styles/` | CRUD | Caption styles management |
| `/api/v1/hook-styles/` | CRUD | Hook styles management |
| `/api/v1/fonts/` | CRUD | Fonts management |
| `/api/v1/users/` | CRUD | User management (admin) |
| `/api/v1/admin/config` | GET/PUT | Pipeline configuration |
| `/api/v1/admin/cleanup` | POST | Disk cleanup |
| `/api/v1/stats/dashboard` | GET | Dashboard statistics |
| `/api/v1/analytics/overview` | GET | Analytics summary |
| `/health` | GET | Server health check |
| `/ws` | WebSocket | Real-time updates |

### Automate Service (Port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/api/v1/social/platforms` | GET | Available platforms |
| `/api/v1/social/accounts` | GET/POST | Social accounts CRUD |
| `/api/v1/social/accounts/{id}/login` | POST | Trigger login flow |
| `/api/v1/social/accounts/{id}/import-cookies` | POST | Import cookies |
| `/api/v1/social/upload/queue` | GET | Upload queue |
| `/api/v1/social/upload` | POST | Create upload |
| `/api/v1/tiktok/accounts` | CRUD | TikTok accounts |
| `/api/v1/tiktok/upload/from-clip` | POST | Upload to TikTok |
| `/api/v1/tiktok/upload/suggest-schedule` | GET | AI schedule suggestions |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm atau yarn

### Installation

```bash
# Clone repository
git clone <repo-url>
cd autocliper-v2-FE

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment

Pastikan backend services berjalan:
- Main backend: `http://localhost:8000`
- Automate service: `http://localhost:8001` (optional, untuk social media features)

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Default Login

Setelah backend berjalan, gunakan credentials dari database atau buat user baru via admin panel.

---

## 📝 Notes

### Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

### Responsive Design

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Performance Considerations

- Lazy loading untuk video modals
- Blob URLs untuk authenticated media
- WebSocket dengan HTTP polling fallback
- Debounced style updates (600ms)

---

## 📄 License

Private - All rights reserved.
