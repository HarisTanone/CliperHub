const BASE = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;
const TIKTOK_BASE = import.meta.env.VITE_AUTOMATE_URL || `${window.location.protocol}//${window.location.hostname}:8001`;

// Load all fonts from DB via Google Fonts CDN
export function loadGoogleFonts(fonts) {
  if (!fonts?.length) return
  const families = fonts.map(f => {
    const name = f.name.replace(/ Bold$/, '')
    const isBold = f.name.includes('Bold')
    return isBold ? `${name}:wght@700` : name
  })
  const id = 'gfonts-autocliper'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?${families.map(f => `family=${encodeURIComponent(f)}`).join('&')}&display=swap`
  document.head.appendChild(link)
}

// Fetch authenticated media as blob URL (for video/thumbnail endpoints that require auth)
export async function getAuthenticatedMediaUrl(endpoint) {
  const token = localStorage.getItem('access_token');
  const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// ─── Token Refresh Logic ────────────────────────────────────────────────────
let _refreshPromise = null;

async function _tryRefreshToken() {
  // Prevent multiple simultaneous refresh attempts
  if (_refreshPromise) return _refreshPromise;
  
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;
  
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        if (data.username) localStorage.setItem('username', data.username);
        if (data.role) localStorage.setItem('role', data.role);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  
  return _refreshPromise;
}

export const api = {
  // Auth — returns raw response for status code handling
  async loginRaw(username, password) {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return { status: res.status, data: await res.json() };
  },

  async login(username, password) {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return res.json();
  },

  async _req(path, opts = {}) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
    
    // On 401, try refresh token rotation before giving up
    if (res.status === 401) {
      const refreshed = await _tryRefreshToken();
      if (refreshed) {
        // Retry the original request with new token
        const newToken = localStorage.getItem('access_token');
        const retryRes = await fetch(`${BASE}${path}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          },
          ...opts,
        });
        if (retryRes.status === 401) {
          // Refresh also failed — force logout
          localStorage.clear();
          window.location.href = '/';
        }
        return retryRes.json();
      }
      // No refresh token or refresh failed
      localStorage.clear();
      window.location.href = '/';
    }
    return res.json();
  },

  // Raw request that returns status code (for handling specific HTTP codes)
  async _reqRaw(path, opts = {}) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
    if (res.status === 401) {
      const refreshed = await _tryRefreshToken();
      if (refreshed) {
        const newToken = localStorage.getItem('access_token');
        const retryRes = await fetch(`${BASE}${path}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          },
          ...opts,
        });
        return { status: retryRes.status, data: await retryRes.json() };
      }
      localStorage.clear();
      window.location.href = '/';
    }
    return { status: res.status, data: await res.json() };
  },

  // Convert backend file path to API endpoint URL
  fileUrl: (path) => {
    if (!path) return null
    // If already a full URL, return as-is
    if (path.startsWith('http')) return path
    // If it's a relative path like ./tmp/output/VideoName/clip_1_final.mp4
    // Extract filename and use the files endpoint
    // Format: ./tmp/output/{video_name}/{filename}
    const parts = path.split('/')
    const filename = parts[parts.length - 1] // e.g. clip_1_final.mp4 or clip_1_thumb.jpg
    // We need job_id but we don't have it here, so return the direct path
    // The authenticated fetch will handle it
    return `${BASE}/api/v1/files?path=${encodeURIComponent(path)}`
  },

  // Jobs (batch support — urls can be newline-separated)
  createJob: (urls, captionTemplateId, hookTemplateId) => api._req('/api/v1/jobs/', {
    method: 'POST',
    body: JSON.stringify({ urls, caption_template_id: captionTemplateId, ...(hookTemplateId ? { hook_template_id: hookTemplateId } : {}) }),
  }),
  getJobs: () => api._req('/api/v1/jobs/'),
  getJobQueue: () => api._req('/api/v1/jobs/queue'),
  clearStuckQueue: () => api._req('/api/v1/jobs/queue/clear-stuck', { method: 'POST' }),
  getJobLogs: () => api._req('/api/v1/jobs/logs'),
  getJobHistory: () => api._req('/api/v1/jobs/history'),
  getJob: (id) => api._req(`/api/v1/jobs/${id}`),
  deleteJob: (id) => api._req(`/api/v1/jobs/${id}`, { method: 'DELETE' }),

  // Two-step clip selection
  analyzeVideo: (url, captionTemplateId, hookTemplateId) => api._req('/api/v1/jobs/analyze', {
    method: 'POST',
    body: JSON.stringify({ url, caption_template_id: captionTemplateId, ...(hookTemplateId ? { hook_template_id: hookTemplateId } : {}) }),
  }),
  processSelected: (url, captionTemplateId, hookTemplateId, clips) => api._req('/api/v1/jobs/process-selected', {
    method: 'POST',
    body: JSON.stringify({ url, caption_template_id: captionTemplateId, ...(hookTemplateId ? { hook_template_id: hookTemplateId } : {}), clips }),
  }),

  // Base Processing Pipeline (no styling)
  baseProcess: (url) => api._req('/api/v1/jobs/base-process', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }),
  getBaseClips: (jobId) => api._req(`/api/v1/jobs/${jobId}/base-clips`),
  getBaseClipUrl: (jobId, clipIndex) => `${BASE}/api/v1/jobs/${jobId}/base-clip/${clipIndex}`,
  getClipThumbnailUrl: (jobId, clipIndex) => `${BASE}/api/v1/jobs/${jobId}/thumbnail/${clipIndex}`,
  getBaseThumbnailUrl: (jobId, clipIndex) => `${BASE}/api/v1/jobs/${jobId}/base-thumbnail/${clipIndex}`,
  
  // Style Rendering Pipeline (apply style to base clips)
  applyStyle: (jobId, captionTemplateId, hookTemplateId) => api._req(`/api/v1/jobs/${jobId}/apply-style`, {
    method: 'POST',
    body: JSON.stringify({ caption_template_id: captionTemplateId, ...(hookTemplateId ? { hook_template_id: hookTemplateId } : {}) }),
  }),

  // Preview (5-second low-res preview before full processing)
  generatePreview: (url, clipIndex, startTime, endTime, hook, captionTemplateId, hookTemplateId) => api._req('/api/v1/jobs/preview', {
    method: 'POST',
    body: JSON.stringify({
      url, clip_index: clipIndex, start_time: startTime, end_time: endTime,
      hook: hook || '', caption_template_id: captionTemplateId,
      ...(hookTemplateId ? { hook_template_id: hookTemplateId } : {}),
    }),
  }),
  getPreviewUrl: (previewId) => `${BASE}/api/v1/jobs/preview/${previewId}`,

  // SSE stream for job progress
  getJobLogsStreamUrl: () => `${BASE}/api/v1/jobs/logs/stream`,

  // Caption Styles
  getStyles: () => api._req('/api/v1/caption-styles/'),
  getStyle: (id) => api._req(`/api/v1/caption-styles/${id}`),
  createStyle: (d) => api._req('/api/v1/caption-styles/', { method: 'POST', body: JSON.stringify(d) }),
  updateStyle: (id, d) => api._req(`/api/v1/caption-styles/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteStyle: (id) => api._req(`/api/v1/caption-styles/${id}`, { method: 'DELETE' }),

  // Fonts
  getFonts: () => api._req('/api/v1/fonts/'),
  getFont: (id) => api._req(`/api/v1/fonts/${id}`),
  createFont: (d) => api._req('/api/v1/fonts/', { method: 'POST', body: JSON.stringify(d) }),
  updateFont: (id, d) => api._req(`/api/v1/fonts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteFont: (id) => api._req(`/api/v1/fonts/${id}`, { method: 'DELETE' }),

  // Hook Styles
  getHookStyles: () => api._req('/api/v1/hook-styles/'),
  getHookStyle: (id) => api._req(`/api/v1/hook-styles/${id}`),
  createHookStyle: (d) => api._req('/api/v1/hook-styles/', { method: 'POST', body: JSON.stringify(d) }),
  updateHookStyle: (id, d) => api._req(`/api/v1/hook-styles/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteHookStyle: (id) => api._req(`/api/v1/hook-styles/${id}`, { method: 'DELETE' }),

  // Users (admin only)
  getUsers: () => api._req('/api/v1/users/'),
  getUser: (id) => api._req(`/api/v1/users/${id}`),
  createUser: (d) => api._req('/api/v1/users/', { method: 'POST', body: JSON.stringify(d) }),
  updateUser: (id, d) => api._req(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteUser: (id) => api._req(`/api/v1/users/${id}`, { method: 'DELETE' }),

  // Admin endpoints
  getHealth: () => fetch(`${BASE}/health`).then(r => r.json()),
  adminCleanup: (days) => api._req(`/api/v1/admin/cleanup?days=${days}`, { method: 'POST' }),
  adminClearAllData: () => api._req('/api/v1/admin/clear-all-data', { method: 'POST' }),
  getAdminConfig: () => api._req('/api/v1/admin/config'),
  updateAdminConfig: (d) => api._req('/api/v1/admin/config', { method: 'PUT', body: JSON.stringify(d) }),

  // Auth self-service
  getMe: () => api._req('/api/v1/auth/me'),
  refreshToken: () => api._req('/api/v1/auth/refresh', { method: 'POST' }),
  changePassword: (currentPassword, newPassword) => api._req('/api/v1/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }),
  updateProfile: (d) => api._req('/api/v1/auth/profile', { method: 'PUT', body: JSON.stringify(d) }),

  // Logout (revoke refresh token)
  logout: () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      fetch(`${BASE}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    }
  },

  // Job retry
  retryJob: (id) => api._req(`/api/v1/jobs/${id}/retry`, { method: 'POST' }),

  // Stats
  getDashboardStats: () => api._req('/api/v1/stats/dashboard'),
  getUsageStats: (period = '7d') => {
    // Convert period string to days number
    const days = parseInt(period) || 7
    return api._req(`/api/v1/stats/usage?days=${days}`)
  },

  // Analytics (enhanced)
  getAnalyticsOverview: () => api._req('/api/v1/analytics/overview'),
  getClipsAnalytics: (days = 30, limit = 100) => api._req(`/api/v1/analytics/clips?days=${days}`),

  // Engagement Prediction
  predictEngagement: (clips, language = 'id') => api._req('/api/v1/engagement/predict', {
    method: 'POST',
    body: JSON.stringify({ clips, language }),
  }),

  // Trending Audio
  getAudioCategories: () => api._req('/api/v1/trending/audio/categories'),
  getTrendingAudio: (category, platform = 'all', limit = 10) => {
    const params = new URLSearchParams({ platform, limit })
    if (category) params.set('category', category)
    return api._req(`/api/v1/trending/audio?${params}`)
  },
  suggestAudio: (clips) => api._req('/api/v1/trending/audio/suggest', {
    method: 'POST',
    body: JSON.stringify({ clips }),
  }),

  // WebSocket URL
  getWebSocketUrl: () => BASE.replace('http', 'ws') + '/ws',

  // ═══════════════════════════════════════════════════════════════════════════
  // TikTok Automate API (connects to port 8001)
  // ═══════════════════════════════════════════════════════════════════════════

  // TikTok helper for requests to automate server
  async _tiktokReq(path, opts = {}) {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${TIKTOK_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...opts,
    });
    
    if (res.status === 401) {
      const refreshed = await _tryRefreshToken();
      if (refreshed) {
        const newToken = localStorage.getItem('access_token');
        const retryRes = await fetch(`${TIKTOK_BASE}${path}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          },
          ...opts,
        });
        if (retryRes.status === 401) {
          localStorage.clear();
          window.location.href = '/';
        }
        return retryRes.json();
      }
      localStorage.clear();
      window.location.href = '/';
    }
    return res.json();
  },

  // TikTok Health
  getTikTokHealth: () => fetch(`${TIKTOK_BASE}/health`).then(r => r.json()).catch(() => null),

  // TikTok Accounts
  getTikTokAccounts: () => api._tiktokReq('/api/v1/tiktok/accounts'),
  getTikTokAccountsAvailable: () => api._tiktokReq('/api/v1/tiktok/accounts/available'),
  getTikTokAccount: (id) => api._tiktokReq(`/api/v1/tiktok/accounts/${id}`),
  createTikTokAccount: (d) => api._tiktokReq('/api/v1/tiktok/accounts', {
    method: 'POST',
    body: JSON.stringify(d),
  }),
  updateTikTokAccount: (id, d) => api._tiktokReq(`/api/v1/tiktok/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(d),
  }),
  deleteTikTokAccount: (id) => api._tiktokReq(`/api/v1/tiktok/accounts/${id}`, { method: 'DELETE' }),
  triggerTikTokLogin: (id) => api._tiktokReq(`/api/v1/tiktok/accounts/${id}/login`, { method: 'POST' }),
  validateTikTokSession: (id) => api._tiktokReq(`/api/v1/tiktok/accounts/${id}/validate`, { method: 'POST' }),

  // TikTok Uploads
  getTikTokQueue: (status = null) => {
    const params = status ? `?status=${status}` : '';
    return api._tiktokReq(`/api/v1/tiktok/upload/queue${params}`);
  },
  getTikTokUpload: (id) => api._tiktokReq(`/api/v1/tiktok/upload/${id}`),
  uploadToTikTok: (d) => api._tiktokReq('/api/v1/tiktok/upload/from-clip', {
    method: 'POST',
    body: JSON.stringify(d),
  }),
  bulkUploadToTikTok: (uploads) => api._tiktokReq('/api/v1/tiktok/upload/bulk', {
    method: 'POST',
    body: JSON.stringify({ uploads }),
  }),
  updateTikTokUpload: (id, d) => api._tiktokReq(`/api/v1/tiktok/upload/${id}`, {
    method: 'PUT',
    body: JSON.stringify(d),
  }),
  cancelTikTokUpload: (id) => api._tiktokReq(`/api/v1/tiktok/upload/${id}`, { method: 'DELETE' }),
  retryTikTokUpload: (id) => api._tiktokReq(`/api/v1/tiktok/upload/${id}/retry`, { method: 'POST' }),
  getTikTokUploadHistory: (id) => api._tiktokReq(`/api/v1/tiktok/upload/${id}/history`),
  suggestTikTokSchedule: (accountId, clipsCount = 1) => 
    api._tiktokReq(`/api/v1/tiktok/upload/suggest-schedule?account_id=${accountId}&clips_count=${clipsCount}`),

  // ═══════════════════════════════════════════════════════════════════════════
  // Multi-Platform Social Media API (connects to port 8001)
  // ═══════════════════════════════════════════════════════════════════════════

  // Get available platforms
  getSocialPlatforms: () => api._tiktokReq('/api/v1/social/platforms'),

  // Social Accounts (multi-platform)
  getSocialAccounts: (platform = null) => {
    const params = platform ? `?platform=${platform}` : '';
    return api._tiktokReq(`/api/v1/social/accounts${params}`);
  },
  getSocialAccount: (id) => api._tiktokReq(`/api/v1/social/accounts/${id}`),
  createSocialAccount: (d) => api._tiktokReq('/api/v1/social/accounts', {
    method: 'POST',
    body: JSON.stringify(d),
  }),
  deleteSocialAccount: (id) => api._tiktokReq(`/api/v1/social/accounts/${id}`, { method: 'DELETE' }),
  triggerSocialLogin: (id, manual = false) => api._tiktokReq(`/api/v1/social/accounts/${id}/login`, {
    method: 'POST',
    body: JSON.stringify({ manual }),
  }),
  importSocialCookies: (id, cookies, platformUsername = null) => api._tiktokReq(`/api/v1/social/accounts/${id}/import-cookies`, {
    method: 'POST',
    body: JSON.stringify({ cookies, platform_username: platformUsername }),
  }),

  // Social Uploads (multi-platform)
  getSocialQueue: (platform = null, status = null) => {
    const params = new URLSearchParams();
    if (platform) params.set('platform', platform);
    if (status) params.set('status', status);
    const query = params.toString();
    return api._tiktokReq(`/api/v1/social/upload/queue${query ? '?' + query : ''}`);
  },
  getSocialUpload: (id) => api._tiktokReq(`/api/v1/social/upload/${id}`),
  createSocialUpload: (d) => api._tiktokReq('/api/v1/social/upload', {
    method: 'POST',
    body: JSON.stringify(d),
  }),
  cancelSocialUpload: (id) => api._tiktokReq(`/api/v1/social/upload/${id}`, { method: 'DELETE' }),
  retrySocialUpload: (id) => api._tiktokReq(`/api/v1/social/upload/${id}/retry`, { method: 'POST' }),

  // ─── Remotion Templates ─────────────────────────────────────────────────
  getRemotionCaptionTemplates: (category) => {
    const params = category ? `?category=${category}` : ""
    return api._req(`/api/v1/remotion/caption-templates${params}`)
  },
  getRemotionCaptionTemplate: (id) => api._req(`/api/v1/remotion/caption-templates/${id}`),
  createRemotionCaptionTemplate: (d) => api._req("/api/v1/remotion/caption-templates", { method: "POST", body: JSON.stringify(d) }),
  updateRemotionCaptionTemplate: (id, d) => api._req(`/api/v1/remotion/caption-templates/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteRemotionCaptionTemplate: (id) => api._req(`/api/v1/remotion/caption-templates/${id}`, { method: "DELETE" }),

  getRemotionHookTemplates: (category) => {
    const params = category ? `?category=${category}` : ""
    return api._req(`/api/v1/remotion/hook-templates${params}`)
  },
  getRemotionHookTemplate: (id) => api._req(`/api/v1/remotion/hook-templates/${id}`),
  createRemotionHookTemplate: (d) => api._req("/api/v1/remotion/hook-templates", { method: "POST", body: JSON.stringify(d) }),
  updateRemotionHookTemplate: (id, d) => api._req(`/api/v1/remotion/hook-templates/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteRemotionHookTemplate: (id) => api._req(`/api/v1/remotion/hook-templates/${id}`, { method: "DELETE" }),

  getRemotionCompositions: () => api._req("/api/v1/remotion/compositions"),
  getRemotionComposition: (id) => api._req(`/api/v1/remotion/compositions/${id}`),
  createRemotionComposition: (d) => api._req("/api/v1/remotion/compositions", { method: "POST", body: JSON.stringify(d) }),
  updateRemotionComposition: (id, d) => api._req(`/api/v1/remotion/compositions/${id}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteRemotionComposition: (id) => api._req(`/api/v1/remotion/compositions/${id}`, { method: "DELETE" }),

  getRemotionRenderJobs: (requestLogId) => {
    const params = requestLogId ? `?request_log_id=${requestLogId}` : ""
    return api._req(`/api/v1/remotion/render-jobs${params}`)
  },
  createRemotionRenderJob: (d) => api._req("/api/v1/remotion/render-jobs", { method: "POST", body: JSON.stringify(d) }),
  getRemotionRenderJob: (id) => api._req(`/api/v1/remotion/render-jobs/${id}`),
  getRemotionRenderStats: () => api._req("/api/v1/remotion/render-jobs/stats"),
};

// Flatten nested hook style config into flat fields for UI use
export function flattenHookStyle(hs) {
  if (!hs) return null
  const c = hs.config || {}
  return {
    id: hs.id,
    name: hs.name,
    is_active: hs.is_active,
    text_color: c.text?.color || '#FFFFFF',
    keyword_color: c.text?.keyword_color || '#FFD700',
    font_size_normal: c.text?.font_size_normal || 48,
    font_size_keyword: c.text?.font_size_keyword || 68,
    fallback_font: c.text?.fallback_font || '',
    shadow_enable: c.shadow?.enable ?? true,
    shadow_blur: c.shadow?.blur || 10,
    shadow_color: c.shadow?.color || '#000000',
    shadow_opacity: c.shadow?.opacity || 180,
    keyword_underline_color: c.keyword?.underline?.color || '#FFD700',
    keyword_underline_opacity: c.keyword?.underline?.opacity || 200,
    box_enable: c.box?.enable ?? false,
    box_color: c.box?.color || '#000000',
    box_opacity: c.box?.opacity || 0,
    fade_in: c.animation?.fade_in || 0.4,
    fade_out: c.animation?.fade_out || 0.4,
    _raw: hs,
  }
}

// Rebuild nested config from flat form for PUT/POST
export function buildHookStylePayload(flat) {
  return {
    name: flat.name,
    is_active: flat.is_active ?? true,
    config: {
      text: {
        color: flat.text_color,
        keyword_color: flat.keyword_color,
        font_size_normal: flat.font_size_normal,
        font_size_keyword: flat.font_size_keyword,
        fallback_font: flat.fallback_font || '',
        fontfile: flat._raw?.config?.text?.fontfile || '',
        line_spacing: flat._raw?.config?.text?.line_spacing || 14,
        word_spacing: flat._raw?.config?.text?.word_spacing || 14,
        padding_horizontal: flat._raw?.config?.text?.padding_horizontal || 80,
      },
      shadow: {
        enable: flat.shadow_enable ?? true,
        blur: flat.shadow_blur,
        color: flat.shadow_color,
        opacity: flat.shadow_opacity,
        offset_y: flat._raw?.config?.shadow?.offset_y || 4,
        alpha_multiplier: flat._raw?.config?.shadow?.alpha_multiplier || 0.35,
      },
      keyword: {
        underline: {
          color: flat.keyword_underline_color,
          opacity: flat.keyword_underline_opacity,
          offset_y: flat._raw?.config?.keyword?.underline?.offset_y || 6,
          thickness: flat._raw?.config?.keyword?.underline?.thickness || 4,
        },
      },
      box: {
        enable: flat.box_enable ?? false,
        color: flat.box_color,
        opacity: flat.box_opacity,
        padding: flat._raw?.config?.box?.padding || 0,
      },
      position: flat._raw?.config?.position || { x: '(w-text_w)/2', y: '(h-text_h)/2' },
      animation: { fade_in: flat.fade_in, fade_out: flat.fade_out },
    },
  }
}
