/* ====== SUPABASE CONNECTION ====== */
const SUPABASE_URL = 'https://azqbzyxknfdwfuqevbrd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OcR9EJnNuPqBWtZrmNVUdA_tt_CMCmR';
const configured = Boolean(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_KEY.includes('YOUR_PUBLISHABLE_KEY'));
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' }
}) : null;
/* ====== UPLOAD LOADING INDICATOR ======
   Every storage upload (songs, covers, podcast episodes, karaoke tracks, profile photos) shows a floating
   "Uploading…" card with a spinner, the file name, its size and a timer, so people can tell it is working. */
let swUploadsActive = 0, swUploadTimer = 0, swUploadStart = 0;
function swFmtBytes(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; }
function swUploadCard() {
  let el = document.getElementById('sw-upload-card');
  if (!el) {
    el = document.createElement('div'); el.id = 'sw-upload-card'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="sw-upload-spin" aria-hidden="true"></span><div class="sw-upload-text"><strong class="sw-upload-title"></strong><small class="sw-upload-sub"></small></div><span class="sw-upload-bar" aria-hidden="true"><i></i></span>';
    document.body.append(el);
  }
  return el;
}
function swUploadTick() {
  const s = Math.floor((Date.now() - swUploadStart) / 1000), txt = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  document.querySelectorAll('.sw-upload-time').forEach(t => { t.textContent = txt; });
  swSyncUploadUi();
}
// A modal <dialog> sits in the browser's top layer, above anything on the page, so the floating card cannot be seen
// while an upload dialog is open. While one is open the loading state is drawn INSIDE it (a full overlay that also
// stops the dialog being closed mid-upload); with no dialog open the floating card is used.
function swSyncUploadUi() {
  const card = document.getElementById('sw-upload-card');
  const open = [...document.querySelectorAll('dialog[open]')].filter(d => { try { return d.matches(':modal'); } catch { return true; } });
  const dlg = swUploadsActive ? open[open.length - 1] : null;
  document.querySelectorAll('.sw-dialog-busy').forEach(o => { if (o.parentElement !== dlg) { o.parentElement?.removeAttribute('aria-busy'); o.remove(); } });
  if (!card) return;
  if (!swUploadsActive) { card.classList.remove('show'); return; }
  if (!dlg) { card.classList.add('show'); return; }
  let o = dlg.querySelector(':scope > .sw-dialog-busy');
  if (!o) {
    o = document.createElement('div'); o.className = 'sw-dialog-busy'; o.setAttribute('role', 'status'); o.setAttribute('aria-live', 'polite');
    o.innerHTML = '<span class="sw-upload-spin" aria-hidden="true"></span><strong class="sw-upload-title"></strong><small class="sw-upload-sub"></small><span class="sw-upload-bar" aria-hidden="true"><i></i></span><em>Please keep this window open until it finishes.</em>';
    dlg.append(o); dlg.setAttribute('aria-busy', 'true');
  }
  o.style.top = dlg.scrollTop + 'px'; o.style.height = dlg.clientHeight + 'px';
  const t = o.querySelector('.sw-upload-title'), sub = o.querySelector('.sw-upload-sub');
  const nt = card.querySelector('.sw-upload-title').textContent, ns = card.querySelector('.sw-upload-sub').innerHTML;
  if (t.textContent !== nt) t.textContent = nt; if (sub.innerHTML !== ns) sub.innerHTML = ns;
  o.classList.toggle('determinate', card.classList.contains('determinate')); o.style.setProperty('--pct', card.style.getPropertyValue('--pct') || '0%');
  card.classList.remove('show');
}
// Esc must not cancel a dialog while its upload is running.
document.addEventListener('cancel', e => { if (swUploadsActive && e.target?.tagName === 'DIALOG') e.preventDefault(); }, true);
// ---- Publish session -------------------------------------------------------------------------------------
// A publish is several steps (check file -> upload audio -> upload artwork -> save row -> lyrics -> instrumental ->
// reload library). The loading overlay used to be tied to each single storage upload, so it vanished the moment the
// audio finished and the dialog looked idle/frozen while the rest ran. A session keeps the overlay up for the WHOLE
// publish, shows which stage it is on, and shows a real percentage while a file is uploading.
let swSession = null;
function swSetCard(title, detail) {
  const el = swUploadCard(); el.querySelector('.sw-upload-title').textContent = title;
  const sub = el.querySelector('.sw-upload-sub'); sub.innerHTML = '';
  const name = document.createElement('span'); name.textContent = detail || 'Please keep this window open';
  const time = document.createElement('span'); time.className = 'sw-upload-time';
  const s = Math.floor((Date.now() - swUploadStart) / 1000); time.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  sub.append(name, ' · ', time); swSyncUploadUi();
}
function swStage(title, detail) {
  if (!swSession) return; swSession.title = title; swSession.detail = detail || '';
  const el = swUploadCard(); el.classList.remove('determinate'); el.style.removeProperty('--pct'); swSetCard(title, detail);
}
function swProgress(frac) {
  if (!swSession) return; const pct = Math.max(0, Math.min(100, Math.round(frac * 100)));
  const el = swUploadCard(); el.classList.add('determinate'); el.style.setProperty('--pct', pct + '%');
  swSetCard(`${swSession.title.replace(/\s*\d+%$/, '')} ${pct}%`, swSession.detail);
}
async function swRun(title, fn) {
  const nested = Boolean(swSession); if (nested) return fn();
  swSession = { title, detail: '' }; swUploadsActive++;
  if (swUploadsActive === 1) { swUploadStart = Date.now(); clearInterval(swUploadTimer); swUploadTimer = setInterval(swUploadTick, 500); }
  try { const el = swUploadCard(); el.classList.remove('done'); el.classList.add('show'); swSetCard(title, 'Getting ready…'); } catch { }
  try { return await fn(); }
  finally {
    swSession = null; swUploadsActive = Math.max(0, swUploadsActive - 1);
    try { if (!swUploadsActive) clearInterval(swUploadTimer); const el = document.getElementById('sw-upload-card'); el?.classList.remove('determinate'); el?.style.removeProperty('--pct'); swSyncUploadUi(); } catch { }
  }
}
// supabase-js cannot report upload progress, so during a publish session files go straight to the Storage REST
// endpoint with XHR (same URL, auth and headers supabase-js uses). Returns null when it can't be used, so the
// caller falls back to the normal supabase-js upload.
async function swXhrUpload(bucket, path, file, opts = {}) {
  if (!(file instanceof Blob)) return null;
  let token = ''; try { token = (await db.auth.getSession())?.data?.session?.access_token || ''; } catch { }
  if (!token) return null;
  const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest(), fd = new FormData();
    fd.append('cacheControl', String(opts.cacheControl || '3600'));
    fd.append('', opts.contentType ? new Blob([file], { type: opts.contentType }) : file, file.name || 'file');
    xhr.open('POST', url); xhr.setRequestHeader('Authorization', 'Bearer ' + token); xhr.setRequestHeader('apikey', SUPABASE_KEY); xhr.setRequestHeader('x-upsert', opts.upsert ? 'true' : 'false');
    xhr.upload.onprogress = ev => { if (ev.lengthComputable && ev.total > 0) swProgress(ev.loaded / ev.total); };
    xhr.onerror = xhr.ontimeout = () => resolve({ data: null, error: { message: 'The upload was interrupted. Check your connection and try again.' } });
    xhr.onload = () => {
      let body = {}; try { body = JSON.parse(xhr.responseText || '{}'); } catch { }
      if (xhr.status >= 200 && xhr.status < 300) { swProgress(1); resolve({ data: { path: body.Key ? path : path, id: body.Id, fullPath: body.Key }, error: null }); }
      else resolve({ data: null, error: { message: body.message || body.error || `Upload failed (${xhr.status})`, statusCode: String(xhr.status), status: xhr.status } });
    };
    xhr.send(fd);
  });
}
function swUploadBusy(file, promise, what) {
  let label = 'file';
  try { if (file && file.name) label = `${file.name} (${swFmtBytes(file.size)})`; else if (file && file.size) label = swFmtBytes(file.size); } catch { }
  try {
    swUploadsActive++;
    const el = swUploadCard();
    if (!swSession) { // inside a publish session the session owns the text (stage + percentage)
      el.querySelector('.sw-upload-title').textContent = swUploadsActive > 1 ? `Uploading ${swUploadsActive} files…` : (what ? `Uploading your ${what}…` : 'Uploading…');
      el.querySelector('.sw-upload-sub').innerHTML = '';
      const name = document.createElement('span'); name.textContent = swUploadsActive > 1 ? 'Please keep this window open' : label;
      const time = document.createElement('span'); time.className = 'sw-upload-time'; time.textContent = '0:00';
      el.querySelector('.sw-upload-sub').append(name, ' · ', time);
    }
    el.classList.remove('done'); el.classList.add('show'); swSyncUploadUi();
    if (swUploadsActive === 1) { swUploadStart = Date.now(); clearInterval(swUploadTimer); swUploadTimer = setInterval(swUploadTick, 500); }
  } catch { }
  const finish = () => {
    try {
      swUploadsActive = Math.max(0, swUploadsActive - 1);
      if (!swUploadsActive) clearInterval(swUploadTimer); swSyncUploadUi();
    } catch { }
  };
  return Promise.resolve(promise).then(r => { finish(); return r; }, e => { finish(); throw e; });
}
if (db && db.storage && typeof db.storage.from === 'function') {
  const rawFrom = db.storage.from.bind(db.storage);
  db.storage.from = (bucket) => {
    const b = rawFrom(bucket), what = ({ 'song-audio': 'song', 'podcast-audio': 'podcast episode', covers: 'artwork', 'profile-images': 'photo' })[bucket] || '';
    if (b && typeof b.upload === 'function') {
      const rawUpload = b.upload.bind(b);
      b.upload = (path, file, opts) => swUploadBusy(file, swSession ? swXhrUpload(bucket, path, file, opts).then(r => r || rawUpload(path, file, opts)) : rawUpload(path, file, opts), what);
    }
    return b;
  };
}
/* ====== APP ====== */


const $ = (selector) => document.querySelector(selector);
// Supabase result guard used throughout the app. It intentionally lives near
// bootstrap so every auth/storage/database path can call it safely.
function check(result) {
  if (result && typeof result === 'object' && result.error) throw result.error;
  return result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
}
const escapeHtml = (v = '') => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { user: null, profile: null, artist: null, admin: false, page: 'discover', songs: [], artists: [], favorites: [], playlists: [], playlistSongs: [], playlistCollaborators: [], playlistMemberLabels: {}, albums: [], genres: [], plans: [], subscriptions: [], podcasts: [], episodes: [], myShows: [], history: [], members: [], selectedShow: null, selectedPlaylist: null, selectedArtist: null, podcastHistory: [], followers: [], following: [], player: null, playerToken: 0, loading: false, error: '', coverUrls: {}, subscriptionMembers: [], sharedMemberships: [], paymentRows: [], uiFilter: 'all', libraryExpanded: true, navStack: [], navForward: [], songMenu: null, offlineDownloads: [], entitlement: null, socialSource: 'user_follow', liked: [], likedIds: new Set(), likesAvailable: true, selectedAlbum: null, searchQuery: '', searchGenre: null, searchTab: 'all', libFilter: 'all', discoverFilter: 'all', railTab: 'now', hist: { i: 0, max: 0 }, routeReady: false, installEvent: null, tint: null, focusSearch: null, libQuery: '', libSearchOpen: false };
Object.assign(state, { peopleResults: [], peopleQueryLoaded: '', peopleLoading: false, selectedPerson: null, personFollowing: new Set(), peopleRequestId: 0, historyError: '', historyWriteError: '', episodeTitles: {}, likesMode: 'remote', artistFollowers: [], followerCounts: {}, socialProfiles: {}, socialRpc: { counts: false, mine: false, profiles: false }, profileStats: null, studioStats: null, royaltySummary: null, adminData: null, subscriptionRequests: [], lyricsCache: {}, profilePhotoUrl: null, ownedSongs: [], adminSelectedAlbum: null, adminTab: 'accounts', adminQuery: '', adminStatus: 'all', adminPriority: false, playlistInviteHandled: false, adminUserIds: [], adminView: 'overview', artistStudioView: 'overview', podcastStudioView: 'overview', selectedPodcastStudioShow: null, selectedStudioAlbum: null, albumStreamCounts: {}, albumStreamLoading: {}, crossDeviceRefreshBound: false, mayaPaymentNotice: null, mayaReturnProcessing: false, subscriptionInviteProcessing: false, deactivationStatus: null });
let accountStatusChannel = null;
let accountStatusTimer = null;
let accountStatusChecking = false;
let genreOutsideClickHandler = null;
const dialogOpeners = new WeakMap();
const TRUSTED_COVER_HOSTS = new Set([location.hostname, new URL(SUPABASE_URL).hostname]);
let playlistCache = {}, showCache = {}, playlistShownSig = null, showShownSig = null; const playlistPrefetching = new Set();
function cleanupSessionRuntime() {
  resetNotifications(); cleanupCrowdQueue(); myRestrictedSongs = new Set(); playlistCache = {}; showCache = {}; playlistShownSig = null; showShownSig = null; state.prefetchedPlaylists = false;
  clearInterval(accountStatusTimer); accountStatusTimer = null;
  if (typeof streamMetricsRefreshTimer !== 'undefined') clearTimeout(streamMetricsRefreshTimer);
  if (typeof podcastMetricsRefreshTimer !== 'undefined') clearTimeout(podcastMetricsRefreshTimer);
  for (const channel of [accountStatusChannel, realtimeChannel, playlistPresenceChannel, adminStreamChannel, creatorStreamChannel, podcastCreatorChannel, releaseAlertChannel]) { try { if (channel) db?.removeChannel(channel); } catch { } }
  accountStatusChannel = null; realtimeChannel = null; playlistPresenceChannel = null; adminStreamChannel = null; creatorStreamChannel = null; podcastCreatorChannel = null; releaseAlertChannel = null;
  clearInterval(releaseAlertTimer); releaseAlertTimer = null; clearSleepTimer(); state.releaseAlerts = { items: [], upcoming: [], available: true, loaded: false, known: null }; state.podLib = { available: true, loaded: false, follows: [], saved: [], newIds: [], episodes: {} };
}

const HISTORY_CACHE_LIMIT = 80;
const PODCAST_HISTORY_CACHE_LIMIT = 50;
function localKey(kind, userId = state.user?.id) { return userId ? `soundwave-${kind}-${userId}` : ''; }
function readLocalJson(key, fallback) { if (!key) return fallback; try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function writeLocalJson(key, value) { if (!key) return; try { localStorage.setItem(key, JSON.stringify(value)); } catch { } }
function sortByStreamDate(rows = []) { return [...rows].sort((a, b) => new Date(b?.stream_date || 0) - new Date(a?.stream_date || 0)); }
function uniquePodcastRows(rows = []) { const seen = new Set(); return rows.filter((r) => { const key = r?.podcast_stream_id != null ? `id:${r.podcast_stream_id}` : `${r?.episode_id || ''}:${r?.stream_date || ''}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function mergeStreamHistory(remote = [], cached = []) { return sortByStreamDate(uniqueStreamRows([...(remote || []), ...(cached || [])])).slice(0, HISTORY_CACHE_LIMIT); }
function mergePodcastHistory(remote = [], cached = []) { return sortByStreamDate(uniquePodcastRows([...(remote || []), ...(cached || [])])).slice(0, PODCAST_HISTORY_CACHE_LIMIT); }
function readCachedHistory(userId = state.user?.id) { return mergeStreamHistory([], (readLocalJson(localKey('history', userId), []) || []).map((row) => ({ ...row, user_id: row?.user_id || userId }))); }
function readCachedPodcastHistory(userId = state.user?.id) { return mergePodcastHistory([], readLocalJson(localKey('podcast-history', userId), [])); }
function readCachedEpisodeTitles(userId = state.user?.id) { return readLocalJson(localKey('episode-titles', userId), {}); }
function readPlayerSnapshot(userId = state.user?.id) { return readLocalJson(localKey('last-player', userId), null); }

function readAllCachedHistories() {
  try {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('soundwave-history-')) continue;
      const userId = key.slice('soundwave-history-'.length);
      const data = readLocalJson(key, []);
      if (Array.isArray(data)) rows.push(...data.map((row) => ({ ...row, user_id: row?.user_id || userId })));
    }
    return mergeStreamHistory(rows, []);
  } catch {
    return [];
  }
}
function readAllCachedPodcastHistories() {
  try {
    const rows = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (!key.startsWith('soundwave-podcast-history-')) continue;
      const userId = key.slice('soundwave-podcast-history-'.length);
      const data = readLocalJson(key, []);
      if (Array.isArray(data)) rows.push(...data.map((row) => ({ ...row, user_id: row?.user_id || userId })));
    }
    return mergePodcastHistory(rows, []);
  } catch {
    return [];
  }
}
function isQualifiedPodcastStream(row) {
  const seconds = Number(row?.duration_played_seconds) || 0;
  return String(row?.completion_status || '').toLowerCase() === 'completed' || seconds >= 30;
}
function persistHistoryCache() {
  if (!state.user) return;
  writeLocalJson(localKey('history'), mergeStreamHistory((state.history || []).map((row) => ({ ...row, user_id: row?.user_id || state.user?.id })), []).slice(0, HISTORY_CACHE_LIMIT));
  writeLocalJson(localKey('podcast-history'), mergePodcastHistory((state.podcastHistory || []).map((row) => ({ ...row, user_id: row?.user_id || state.user?.id })), []).slice(0, PODCAST_HISTORY_CACHE_LIMIT));
  writeLocalJson(localKey('episode-titles'), state.episodeTitles || {});
}
function persistPlayerSnapshot(data = state.player, resumeAt = null) {
  if (!state.user || !data || data.kind !== 'song') return;
  const song = songById(data.id);
  writeLocalJson(localKey('last-player'), {
    id: data.id,
    kind: data.kind,
    title: data.title,
    artist: data.artist,
    duration: Number(data.duration || song?.duration_seconds || 0) || 0,
    resumeAt: Math.max(0, Math.floor(Number(resumeAt ?? data.resumeAt ?? 0) || 0)),
    savedAt: new Date().toISOString()
  });
}
Object.assign(state, { podLib: { available: true, loaded: false, follows: [], saved: [], newIds: [], episodes: {} }, releaseAlerts: { items: [], upcoming: [], available: true, loaded: false, known: null }, insightHistory: [], listeningStats: null, topWeekSongs: [], personalTopSongs: [], topSongsLoading: false, friendActivity: [], friendNow: [], artistThirtyDay: [], artistTopListeners: [], adminAnalyticsHistory: [], analyticsSongNames: {}, artistPopularity: {}, recentSearches: [], playlistPresence: [], competitionLoaded: false, podcastStudioHistory: [], podcastRecSignals: { categories: {}, shows: [] }, discoverExpanded: { albums: false, curated: false } });
const nice = (n) => Number.isFinite(Number(n)) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '—';
const ANALYTICS_WINDOW_DAYS = 30;
const val = (id) => document.getElementById(id)?.value?.trim();
const opts = (rows, key, label) => rows.map(x => `<option value="${escapeHtml(x[key])}">${escapeHtml(x[label])}</option>`).join('');
// ===================================================================
// SoundWave "Spotify-style" upgrade layer
// ===================================================================
const esc = escapeHtml;
const PREF_KEY = 'soundwave-prefs-v1';
const prefs = (() => {
  const d = { volume: .85, shuffle: false, repeat: 'off', muted: false, railHidden: false, podcastRate: 1 };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return d; }
})();
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { } };
// Keep the desktop Now Playing rail visible after a refresh. Hide/show remains session-interactive.
prefs.railHidden = false;
const shuffled = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[r[i], r[j]] = [r[j], r[i]]; } return r; };
const yearOf = (d) => (d ? String(d).slice(0, 4) : '');
const totalTime = (songs) => { const s = songs.reduce((t, x) => t + (Number(x.duration_seconds) || 0), 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} hr ${m} min` : `${Math.max(1, m)} min`; };
const TINTS = ['#3a4658', '#1f4e79', '#7a4d8f', '#2f6f6a', '#8f2f6b', '#7a2a3a', '#2c6e3a', '#3a4f8f', '#8a3a55', '#505e74', '#6b6b2a', '#3a6f8a'];
const tintFor = (n = 0) => TINTS[Math.abs(Number(n) || 0) % TINTS.length];
const BROWSE_COLORS = ['#62748e', '#006450', '#5f6f88', '#1e3264', '#e8115b', '#477d95', '#e13300', '#9ca8bb', '#148a08', '#bc5900', '#374150', '#0d73ec'];

// Resolve artwork saved in several formats used by older SoundWave builds.
// New uploads store a Storage object path, while some seed/legacy rows contain
// a full URL or a path prefixed with "covers/".
function normalizedCoverPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const markers = ['/storage/v1/object/public/covers/', '/storage/v1/object/sign/covers/', '/storage/v1/object/authenticated/covers/'];
      for (const marker of markers) {
        const at = u.pathname.indexOf(marker);
        if (at >= 0) return decodeURIComponent(u.pathname.slice(at + marker.length));
      }
      return raw;
    } catch { return raw; }
  }
  return raw.replace(/^\/+/, '').replace(/^covers\//i, '');
}
async function resolveCoverUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  // Only same-origin or this project's Supabase host may be used for remote artwork.
  if (/^https?:\/\//i.test(raw) && !/\/storage\/v1\/object\//i.test(raw)) {
    try { const u = new URL(raw); return u.protocol === 'https:' && TRUSTED_COVER_HOSTS.has(u.hostname) ? u.href : null; } catch { return null; }
  }
  const path = normalizedCoverPath(raw);
  if (/^https?:\/\//i.test(path)) return path;
  const signed = await db.storage.from('covers').createSignedUrl(path, 3600);
  if (!signed.error && signed.data?.signedUrl) return signed.data.signedUrl;
  // Public buckets do not need a signed URL. This fallback also makes migrations
  // between private/public cover buckets less fragile.
  const pub = db.storage.from('covers').getPublicUrl(path);
  return pub.data?.publicUrl || null;
}

// ---------- Routing (URL <-> state) so refresh, deep links and the browser Back button all work ----------
const ROUTES = ['not-found', 'charts', 'song-streams', 'discover', 'home', 'listener-dashboard', 'artist-dashboard', 'admin-dashboard', 'music', 'artists', 'artist-detail', 'album-detail', 'liked-artists', 'liked-songs', 'top-songs', 'mix', 'mood', 'karaoke', 'followers', 'notifications', 'song-reports', 'crowdqueue', 'profile', 'playlists', 'history', 'downloads', 'podcasts', 'podcast-studio', 'plans', 'studio', 'admin'];
function pageToHash() {
  const p = state.page;
  const id = p === 'playlists' ? state.selectedPlaylist : p === 'artist-detail' ? state.selectedArtist : p === 'album-detail' ? state.selectedAlbum : p === 'podcasts' ? state.selectedShow : p === 'mix' ? state.selectedMix : p === 'mood' ? state.selectedMood : null;
  return `#/${p}${id ? '/' + id : ''}`;
}
function applyHash(hash) {
  const m = /^#\/([a-z-]+)(?:\/(\d+))?$/.exec(hash || '');
  if (!m || !ROUTES.includes(m[1])) { if (hash) { state.page = 'not-found'; return true; } return false; }
  let [, page, id] = m;
  if (page === 'home') page = 'discover';
  if (!pageAllowed(page)) return false;
  state.page = page;
  state.selectedPlaylist = page === 'playlists' && id ? Number(id) : null;
  state.selectedArtist = page === 'artist-detail' && id ? Number(id) : null;
  state.selectedAlbum = page === 'album-detail' && id ? Number(id) : null;
  state.selectedShow = page === 'podcasts' && id ? Number(id) : null;
  state.selectedMix = page === 'mix' && id ? Number(id) : null;
  state.selectedMood = page === 'mood' && id ? Number(id) : null;
  return true;
}
async function routeLoad() {
  if (state.page === 'playlists' && state.selectedPlaylist) {
    if (!state.playlists.some((p) => p.playlist_id === state.selectedPlaylist)) { state.selectedPlaylist = null; render(); return; }
    await playlistDetail();
  } else if (state.page === 'podcasts' && state.selectedShow) {
    await showDetail();
  } else if (state.page === 'artist-detail' && state.selectedArtist) {
    await loadArtistPopularity(state.selectedArtist);
    render();
    void refreshViewedArtistCover(state.selectedArtist);
  } else if (state.page === 'podcast-studio') {
    await refreshPodcastStudioMetrics();
    render();
  } else if (state.page === 'studio') {
    await refreshStreamMetrics();
    render();
  } else if (state.page === 'charts') {
    render(); await loadCharts();
  } else render();
}
function afterRender() {
  document.body.dataset.page = state.page;
  document.body.classList.toggle('rail-hidden', !!prefs.railHidden);
  if (!state.user) return;
  syncHearts(); markPlaying(); prefetchAllPlaylists();
  if (state.page === 'artist-detail') bindArtistScrollBehavior();
  try { runEnhancers(); } catch (e) { console.warn('enhancers', e); }
  const h = pageToHash();
  if (!state.routeReady) { state.routeReady = true; window.history.replaceState({ i: state.hist.i }, '', h); }
  else if (location.hash !== h) { state.hist.i++; state.hist.max = state.hist.i; window.history.pushState({ i: state.hist.i }, '', h); }
}
window.addEventListener('popstate', (e) => {
  if (!state.user || !configured) return;
  state.hist.i = e.state?.i ?? 0;
  if (applyHash(location.hash)) action(routeLoad, { skeleton: skeletonKindForPage(state.page) });
});
function openPlaylist(id) {
  state.page = 'playlists'; state.selectedPlaylist = Number(id);
  const hit = playlistCache[Number(id)];
  if (hit) { // seen before: show it instantly, then refresh quietly in the background
    state.playlistSongs = hit.songs; state.playlistCollaborators = hit.collabs; if (hit.labels) state.playlistMemberLabels = hit.labels;
    playlistShownSig = hit.sig; render(); action(playlistDetail, { quiet: true });
  } else action(playlistDetail, { skeleton: 'detail' });
}
function openShow(id) {
  state.page = 'podcasts'; state.selectedShow = Number(id);
  const hit = showCache[Number(id)];
  if (hit) { state.episodes = hit.eps; showShownSig = hit.sig; render(); action(showDetail, { quiet: true }); }
  else action(showDetail, { skeleton: 'detail' });
}

// ---------- Catalog helpers ----------
let _albumCache = { src: null, val: [] };
function catalogAlbums() {
  if (_albumCache.src === state.songs) return _albumCache.val;
  const m = new Map();
  for (const s of state.songs) {
    const a = s.album; if (!a) continue;
    if (!m.has(a.album_id)) m.set(a.album_id, { album_id: a.album_id, title: a.album_title, description: a.description, release_type: a.release_type || 'Album', cover_path: a.cover_path, release_date: a.release_date, is_active: a.is_active !== false, artist: a.artist, songs: [] });
    m.get(a.album_id).songs.push(s);
  }
  for (const [albumId, al] of m) { if (!al.songs.some(s => s.is_active !== false) || al.is_active === false) m.delete(albumId); }
  for (const al of m.values()) al.songs.sort((x, y) => (x.track_number ?? 1e9) - (y.track_number ?? 1e9) || x.song_id - y.song_id);
  _albumCache = { src: state.songs, val: [...m.values()] };
  return _albumCache.val;
}
const albumById = (id) => catalogAlbums().find((a) => Number(a.album_id) === Number(id));
const songsByArtist = (artistId) => state.songs.filter((s) => Number(s.album?.artist?.artist_id) === Number(artistId));
const songById = (id) => state.songs.find((s) => Number(s.song_id) === Number(id));
const ids = (songs) => songs.map((s) => s.song_id);

// ---------- Liked songs ----------
const isLiked = (id) => state.likedIds.has(Number(id));
function heartBtn(id, cls = '') {
  const on = isLiked(id);
  return `<button type="button" class="heart-btn ${cls} ${on ? 'on' : ''}" data-like="${id}" aria-pressed="${on}" aria-label="${on ? 'Remove from Liked Songs' : 'Save to Liked Songs'}" title="${on ? 'Remove from Liked Songs' : 'Save to Liked Songs'}">${icon('heart')}</button>`;
}
// Likes are saved to your account (Supabase table saved_song). If that table has not been installed yet we
// fall back to saving on this device, so the heart ALWAYS works — and the likes move to your account later.
const likeKey = () => `soundwave-likes-${state.user?.id || 'anon'}`;
const readLocalLikes = () => { try { return JSON.parse(localStorage.getItem(likeKey()) || '[]').map(Number).filter(Boolean); } catch { return []; } };
const writeLocalLikes = (list) => { try { localStorage.setItem(likeKey(), JSON.stringify(list)); } catch { } };
const isMissingTable = (e) => /does not exist|schema cache|PGRST20\d|42P01|undefined_table/i.test(`${e?.code || ''} ${e?.message || ''}`);
const likesInFlight = new Set();
function applyLike(id, on) {
  state.likedIds[on ? 'add' : 'delete'](id);
  state.liked = state.liked.filter((x) => Number(x.song_id) !== id);
  if (on) state.liked.unshift({ song_id: id, liked_at: new Date().toISOString() });
  syncHearts(); renderLibraryList();
  if (state.page === 'liked-songs') render();
}
async function toggleLike(id) {
  id = Number(id);
  if (!id || likesInFlight.has(id)) return;
  likesInFlight.add(id);
  const wasLiked = isLiked(id);
  applyLike(id, !wasLiked); // instant feedback; rolled back below if saving fails
  try {
    if (state.likesMode === 'remote') {
      try {
        if (wasLiked) check(await db.from('saved_song').delete().eq('user_id', state.user.id).eq('song_id', id));
        else { const r = await db.from('saved_song').insert({ user_id: state.user.id, song_id: id }); if (r.error && r.error.code !== '23505') throw r.error; }
      } catch (e) {
        if (!isMissingTable(e)) throw e;
        state.likesMode = 'local';
        toast('Saved on this device. Run sql/RUN_ME_likes_and_followers.sql in Supabase to sync likes to your account.');
      }
    }
    if (state.likesMode === 'local') writeLocalLikes(state.liked.map((x) => Number(x.song_id)));
    if (!wasLiked) burstHearts(id); toast(wasLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');
  } catch (e) {
    applyLike(id, wasLiked);
    throw e;
  } finally { likesInFlight.delete(id); }
}
async function migrateLocalLikes(uid) {
  const local = readLocalLikes();
  if (!local.length) return;
  const have = new Set(state.liked.map((x) => Number(x.song_id)));
  let moved = 0;
  for (const sid of local) {
    if (have.has(sid)) continue;
    const r = await db.from('saved_song').insert({ user_id: uid, song_id: sid });
    if (!r.error || r.error.code === '23505') { moved++; state.liked.push({ song_id: sid, liked_at: new Date().toISOString() }); state.likedIds.add(sid); }
  }
  try { localStorage.removeItem(likeKey()); } catch { }
  if (moved) console.info(`Moved ${moved} on-device likes to your account.`);
}
const likesNotice = () => (state.likesMode === 'local' ? `<div class="notice">These likes are saved on this device only. To keep them on your account (and every device), run <code>sql/RUN_ME_likes_and_followers.sql</code> once in the Supabase SQL Editor, then refresh — your likes will move over automatically.</div>` : '');

// ---------- Following artists ----------
// "Follow" is stored in favorite_artist (the same table the app already used for saved artists).
const isFollowing = (artistId) => state.favorites.some((f) => Number(f.artist_id) === Number(artistId));
const isOwnArtist = (a) => Boolean(a && state.user && a.user_id && String(a.user_id) === String(state.user.id));
function followerText(artistId) {
  const n = state.followerCounts?.[Number(artistId)];
  return n == null ? '' : `${n} ${n === 1 ? 'follower' : 'followers'}`;
}
function mergeFollowerCountsPayload(payload, target = {}) {
  if (payload == null) return target;
  if (typeof payload === 'string') {
    try { return mergeFollowerCountsPayload(JSON.parse(payload), target); } catch { return target; }
  }
  if (Array.isArray(payload)) { payload.forEach((row) => mergeFollowerCountsPayload(row, target)); return target; }
  if (typeof payload !== 'object') return target;
  const artistId = Number(payload.artist_id ?? payload.artistid ?? payload.artistId ?? payload.id);
  const rawCount = payload.follower_count ?? payload.followers_count ?? payload.followerCount ?? payload.followers ?? payload.count ?? payload.total_followers ?? payload.total;
  const count = Number(rawCount);
  if (Number.isFinite(artistId) && Number.isFinite(count)) target[artistId] = Math.max(0, count);
  for (const key of ['data', 'rows', 'counts', 'result', 'artists']) {
    if (payload[key] != null) mergeFollowerCountsPayload(payload[key], target);
  }
  for (const [key, value] of Object.entries(payload)) {
    if (/^\d+$/.test(key) && Number.isFinite(Number(value))) target[Number(key)] = Math.max(0, Number(value));
  }
  return target;
}
function followBtn(a, cls = '') {
  if (!a || isOwnArtist(a)) return '';
  if (isOwnArtist(a)) return '<span class="muted small">Your artist profile</span>';
  const on = isFollowing(a.artist_id);
  return `<button type="button" class="follow-btn ${cls} ${on ? 'on' : ''}" data-fav="${a.artist_id}" aria-pressed="${on}" aria-label="${on ? `Unfollow ${esc(a.artist_name || 'artist')}` : `Follow ${esc(a.artist_name || 'artist')}`}">${on ? 'Unfollow' : 'Follow'}</button>`;
}
const followInFlight = new Set();
function applyFollow(artistId, on, { adjustCount = true } = {}) {
  state.favorites = state.favorites.filter((f) => Number(f.artist_id) !== artistId);
  if (on) state.favorites.push({ user_id: state.user.id, artist_id: artistId });
  if (adjustCount && state.followerCounts && artistId in state.followerCounts) state.followerCounts[artistId] = Math.max(0, state.followerCounts[artistId] + (on ? 1 : -1));
  document.querySelectorAll(`[data-fav="${artistId}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Unfollow' : 'Follow'; b.setAttribute('aria-label', on ? 'Unfollow artist' : 'Follow artist'); });
  document.querySelectorAll(`[data-follower-count="${artistId}"]`).forEach((el) => { el.textContent = followerText(artistId); });
  renderLibraryList(); refreshRail();
  if (state.page === 'liked-artists' || state.page === 'followers') render();
}
async function refreshFollowState() {
  if (!state.user) return;
  const fav = await db.from('favorite_artist').select('user_id,artist_id').eq('user_id', state.user.id);
  if (!fav.error) state.favorites = fav.data || [];
  const counts = await db.rpc('get_artist_follower_counts');
  if (!counts.error) { const next = {}; for (const a of state.artists || []) next[Number(a.artist_id)] = 0; mergeFollowerCountsPayload(counts.data, next); state.followerCounts = next; state.socialRpc.counts = true; }
  if (state.artist) { const mine = await db.rpc('get_my_artist_followers'); if (!mine.error && Array.isArray(mine.data)) { state.artistFollowers = mine.data; state.followerCounts[Number(state.artist.artist_id)] = mine.data.length; state.socialRpc.mine = true; } }
}
async function toggleFollow(artistId) {
  artistId = Number(artistId);
  const artist = state.artists.find((a) => Number(a.artist_id) === artistId);
  if (isOwnArtist(artist)) throw Error('This is your own artist profile.');
  if (!artistId || followInFlight.has(artistId)) return;
  followInFlight.add(artistId);
  const was = isFollowing(artistId), next = !was;
  applyFollow(artistId, next);
  try {
    const rpc = await db.rpc('soundwave_toggle_artist_follow', { p_artist_id: artistId, p_follow: next });
    if (rpc.error) {
      if (was) check(await db.from('favorite_artist').delete().eq('user_id', state.user.id).eq('artist_id', artistId));
      else { const r = await db.from('favorite_artist').insert({ user_id: state.user.id, artist_id: artistId }); if (r.error && r.error.code !== '23505') throw r.error; }
    }
    await refreshFollowState();
    applyFollow(artistId, isFollowing(artistId), { adjustCount: false });
    toast(next ? `Following ${artist?.artist_name || 'artist'}` : `Unfollowed ${artist?.artist_name || 'artist'}`);
    void loadReleaseAlerts();
  } catch (e) {
    applyFollow(artistId, was);
    throw e;
  } finally { followInFlight.delete(artistId); }
}

function syncHearts() {
  document.querySelectorAll('[data-like]').forEach((b) => {
    const on = isLiked(b.dataset.like);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    const label = on ? 'Remove from Liked Songs' : 'Save to Liked Songs';
    b.setAttribute('aria-label', label); b.title = label;
  });
  document.querySelectorAll('[data-liked-count]').forEach((el) => { el.textContent = `${state.liked.length} ${state.liked.length === 1 ? 'song' : 'songs'}`; });
}

// ---------- Track list (Spotify-style table) ----------
function trackTable(songs, o = {}) {
  const { queue = ids(songs), remove = false, showAlbum = true, header = true, extraLabel = '', extraClass = '', extraCell = null } = o;
  if (!songs.length) return '<div class="empty">Nothing here yet.</div>';
  const q = queue.join(',');
  const hasExtra = Boolean(extraLabel && typeof extraCell === 'function');
  const extraTrackClass = `${showAlbum ? '' : ' no-album'}${hasExtra ? ' has-extra' : ''}${hasExtra && extraClass ? ` extra-${extraClass}` : ''}`;
  return `<div class="tracks${extraTrackClass}" role="table">${header ? `<div class="tracks-head" role="row"><span class="t-num">#</span><span>Title</span>${showAlbum ? '<span class="t-album">Album</span>' : ''}${hasExtra ? `<span class="t-extra ${extraClass ? `t-extra-${extraClass}` : ''}">${esc(extraLabel)}</span>` : ''}<span class="t-like"></span><span class="t-time" title="Duration">${icon('clock')}</span><span class="t-more"></span></div>` : ''}${songs.map((s, i) => trackRow(s, i, q, { showAlbum, remove, extraCell, extraClass, hasExtra })).join('')}</div>`;
}
function trackRow(s, i, q, { showAlbum, remove, albumHtml, histId, extraCell, extraClass, hasExtra }) {
  const artist = s.album?.artist;
  const downloaded = hasDownloadedSong(s.song_id);
  const extraHtml = hasExtra ? `<span class="t-extra ${extraClass ? `t-extra-${extraClass}` : ''}">${extraCell?.(s, i) ?? '—'}</span>` : '';
  return `<div class="track ${downloaded ? 'is-downloaded' : ''}" role="row" tabindex="0" data-song="${s.song_id}" data-queue="${q}"><span class="t-num"><b>${i + 1}</b><button type="button" class="t-play" data-play="${s.song_id}" aria-label="Play ${esc(s.song_title)}">${icon('play')}</button><i class="eq" aria-hidden="true"><s></s><s></s><s></s></i></span><span class="t-title">${albumArt(s, 'tiny')}<span class="t-text"><strong>${esc(s.song_title)}${downloaded ? `<span class="track-state-badge" title="Downloaded for offline listening">${icon('download')} Downloaded</span>` : ''}</strong><small>${artist ? `<a href="#/artist-detail/${artist.artist_id}" data-open-artist="${artist.artist_id}">${esc(artist.artist_name)}</a>` : 'SoundWave'}${moodPillsHtml(s, 2)}</small></span></span>${showAlbum ? `<span class="t-album">${albumHtml ?? (s.album ? `<a href="#/album-detail/${s.album.album_id}" data-open-album="${s.album.album_id}">${esc(s.album.album_title)}</a>` : '')}</span>` : ''}${extraHtml}<span class="t-like">${heartBtn(s.song_id)}</span><span class="t-time">${downloaded ? `<span class="track-download-icon" title="Downloaded">${icon('download')}</span>` : ''}${nice(s.duration_seconds)}</span><span class="t-more">${(typeof crowdQueue !== "undefined" && crowdQueue.session?.status === "active") ? `<button type="button" class="t-cq-add" data-quick-add-cq="${s.song_id}" aria-label="Add ${esc(s.song_title)} to CrowdQueue" title="Add to CrowdQueue"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}<button type="button" class="song-more" data-song-menu="${s.song_id}" aria-label="More options for ${esc(s.song_title)}">${icon('dots')}</button>${remove ? `<button type="button" class="t-remove" data-remove="${s.song_id}" aria-label="Remove from playlist">${icon('close')}</button>` : ''}${histId ? `<button type="button" class="t-remove" data-histdelete="${histId}" aria-label="Remove from history" title="Remove from history">${icon('close')}</button>` : ''}</span></div>`;
}
function playRow(r) { const q = (r.dataset.queue || '').split(',').filter(Boolean).map(Number); playAction(() => playSong(Number(r.dataset.song), q)); }

// ---------- Shared tiles ----------
function albumTile(a) {
  const q = ids(a.songs).join(',');
  return `<article class="release-tile card-link" tabindex="0" role="link" data-open-album="${a.album_id}" data-queue="${q}"><span class="release-art">${albumArt({ song_id: a.album_id, album: a }, 'large')}<button type="button" class="hover-play" data-play="${a.songs[0].song_id}" aria-label="Play ${esc(a.title)}">${icon('play')}</button></span><strong>${esc(a.title)}</strong><small>${yearOf(a.release_date) ? yearOf(a.release_date) + ' · ' : ''}${esc(a.artist?.artist_name || 'SoundWave')}</small></article>`;
}
function publiclyReleasedArtist(a) { return isOwnArtist(a) || songsByArtist(a.artist_id).some(s => s.is_active !== false && s.album?.is_active !== false); }
// Artist avatars belong to the linked users record; covers remain independent.
// Public images do not need expensive signed-URL requests.
const artistPhotoRequests = new Map();
const artistPhotoUrls = new Map();
function publicProfileImageUrl(profile) {
  if (!profile) return null;
  const value = String(profile.profile_photo_url || profile.profile_photo_path || '').trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) {
    try { const url = new URL(value); return url.protocol === 'https:' && TRUSTED_COVER_HOSTS.has(url.hostname) ? url.href : null; } catch { return null; }
  }
  return db.storage.from('profile-images').getPublicUrl(value).data?.publicUrl || null;
}
function artistAvatarUrl(a) {
  if (!a) return null;
  if (String(a.user_id) === String(state.user?.id)) return publicProfileImageUrl(state.profile) || state.profilePhotoUrl || null;
  return artistPhotoUrls.get(String(a.user_id)) || publicProfileImageUrl(state.socialProfiles?.[String(a.user_id)]);
}
async function ensureArtistPhoto(a) {
  if (!a?.user_id || artistAvatarUrl(a) || !state.user) return;
  const uid = String(a.user_id);
  if (artistPhotoRequests.has(uid)) return artistPhotoRequests.get(uid);
  // Reuse the existing, field-restricted People Search function. Never query private users directly.
  // Search by artist name, then validate the linked user_id (not artist_id).
  const request = (async () => {
    const q = String(a.artist_name || '').trim(); if (q.length < 2) return;
    try {
      const { data, error } = await db.rpc('soundwave_search_public_people', { p_query: q.slice(0, 80), p_limit: 30 });
      if (error) return;
      const profile = (data || []).find(p => String(p.user_id) === uid);
      if (!profile) return;
      state.socialProfiles[uid] = { ...(state.socialProfiles[uid] || {}), ...profile };
      const url = publicProfileImageUrl(profile);
      if (url) { artistPhotoUrls.set(uid, url); updateArtistArtwork(a); }
    } catch (e) { console.info('Artist avatar lookup unavailable', e); }
  })();
  artistPhotoRequests.set(uid, request);
  return request;
}
function artistCircleArtwork(a) {
  const url = artistAvatarUrl(a);
  if (!url) void ensureArtistPhoto(a);
  return url ? `<img class="artist-avatar-photo" data-artist-photo="${Number(a.artist_id)}" src="${esc(url)}" alt="" decoding="async">` : `<span data-artist-initial="${Number(a.artist_id)}">${esc(a?.artist_name?.[0] || 'A')}</span>`;
}
function artistArtwork(a, initialClass = 'artist-search-photo') {
  const id = Number(a?.artist_id) || 0;
  const url = artistAvatarUrl(a);
  if (!url) void ensureArtistPhoto(a);
  return url ? `<img ${initialClass === 'rail-artist-avatar' ? 'style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;border-radius:inherit"' : ''} class="${initialClass}" data-artist-photo="${id}" src="${esc(url)}" alt="" loading="lazy" decoding="async">` : `<span class="artist-initial" data-artist-initial="${id}">${esc(a?.artist_name?.[0] || 'A')}</span>`;
}
function updateArtistArtwork(a) {
  if (!a) return;
  const id = Number(a.artist_id), url = artistAvatarUrl(a);
  if (!url) return;
  document.querySelectorAll(`[data-artist-photo-host="${id}"]`).forEach(host => {
    let img = host.querySelector('img[data-artist-photo]');
    if (!img) { img = document.createElement('img'); img.className = host.classList.contains('library-artist-photo') ? 'artist-avatar-photo' : 'artist-search-photo'; img.dataset.artistPhoto = String(id); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; host.prepend(img); }
    if (host.classList.contains('about-art')) { img.className = 'rail-artist-avatar'; Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: 'inherit' }); }
    if (img.src !== url) img.src = url;
    host.querySelectorAll('[data-artist-initial]').forEach(el => el.remove());
  });
}
async function hydrateArtistCovers(artists = state.artists) {
  const paths = [...new Set((artists || []).map(a => a.cover_path).filter(p => p && !state.coverUrls[p]))];
  if (!paths.length) return;
  // Resolve in small groups to avoid flooding Storage with parallel signed-URL requests.
  for (let i = 0; i < paths.length; i += 8) {
    const batch = paths.slice(i, i + 8);
    await Promise.all(batch.map(async path => {
      try { const url = await resolveCoverUrl(path); if (url) { state.coverUrls[path] = url; (artists || []).filter(a => a.cover_path === path).forEach(a => { updateArtistArtwork(a); if (state.page === 'artist-detail' && Number(state.selectedArtist) === Number(a.artist_id)) applyArtistBanner(a.artist_id, path, url); }); } }
      catch (e) { console.warn('Artist artwork unavailable:', e); }
    }));
  }
}
function artistCard(a, i = 0, o = {}) {
  const songs = songsByArtist(a.artist_id);
  const ownVerified = isOwnArtist(a) && state.socialRpc?.mine;
  const hasVerifiedCount = state.socialRpc?.counts || ownVerified;
  const followerCount = hasVerifiedCount && state.followerCounts?.[Number(a.artist_id)] != null ? Number(state.followerCounts[Number(a.artist_id)]) : null;
  const followerLabel = followerCount == null ? 'Follower count unavailable' : `${followerCount.toLocaleString()} ${followerCount === 1 ? 'follower' : 'followers'}`;
  const rank = Number(o?.rank || 0);
  return `<article class="artist-card clickable ${o?.showFollowers ? 'ranked-artist-card' : ''}" tabindex="0" role="link" data-open-artist="${a.artist_id}" ${songs.length ? `data-queue="${ids(songs).join(',')}"` : ''}>${rank ? `<span class="artist-rank" aria-label="Rank ${rank}">#${rank}</span>` : ''}<span class="artist-round" data-artist-photo-host="${a.artist_id}" style="background:${grad(i)}">${artistArtwork(a)}${songs.length ? `<button type="button" class="hover-play" data-play="${songs[0].song_id}" aria-label="Play ${esc(a.artist_name)}">${icon('play')}</button>` : ''}</span><strong>${esc(a.artist_name)}</strong><small>Artist</small>${o?.showFollowers ? `<span class="artist-follower-proof" data-follower-count="${a.artist_id}">${esc(followerLabel)}</span>` : (followerCount != null ? `<small data-follower-count="${a.artist_id}">${esc(followerLabel)}</small>` : '')}${o && o.follow === true ? followBtn(a, 'sm') : ''}</article>`;
}
function showCard(p, i = 0) {
  const art = p.cover_path && state.coverUrls[p.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.show_title)}">` : icon('mic');
  return `<button type="button" class="cover-card" data-open-show="${p.show_id}"><span class="cover-art" style="background:${grad(i)}">${art}</span><strong>${esc(p.show_title)}</strong><small>${esc(p.category || 'Podcast')}</small></button>`;
}
// F-11: limited, deduplicated and dismissible notification stack.
const toastTimers = new WeakMap();
function toast(msg, error = false) {
  let stack = document.getElementById('soundwave-toasts');
  if (!stack) { stack = document.createElement('div'); stack.id = 'soundwave-toasts'; stack.className = 'toast-stack'; stack.setAttribute('aria-live', 'polite'); if (HTMLElement.prototype.showPopover) stack.setAttribute('popover', 'manual'); document.body.append(stack); }
  const key = (error ? 'error:' : 'info:') + String(msg);
  const old = [...stack.children].find(x => x.dataset.toastKey === key);
  if (old) { clearTimeout(toastTimers.get(old)); old.remove(); } // same message again: restart it instead of stacking
  const ms = error ? 7000 : 4000;
  const el = document.createElement('div'); el.className = `toast ${error ? 'error' : ''}`; el.dataset.toastKey = key; el.setAttribute('role', error ? 'alert' : 'status'); el.style.setProperty('--toast-ms', ms + 'ms');
  const mark = document.createElement('span'); mark.className = 'toast-mark'; mark.innerHTML = error ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v7" pathLength="1"/><path d="M12 17.4v.2" pathLength="1"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 8" pathLength="1"/></svg>';
  const message = document.createElement('span'); message.className = 'toast-text'; message.textContent = String(msg);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'toast-close'; close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>'; close.setAttribute('aria-label', 'Dismiss notification'); close.onclick = () => leave(el);
  el.append(mark, message, close); stack.append(el);
  while (stack.children.length > 3) stack.firstElementChild.remove();
  const leave = (node) => { clearTimeout(toastTimers.get(node)); node.classList.add('leaving'); setTimeout(() => node.remove(), 200); };
  const dismiss = (t = ms) => { clearTimeout(toastTimers.get(el)); toastTimers.set(el, setTimeout(() => leave(el), t)); };
  el.onmouseenter = () => clearTimeout(toastTimers.get(el)); el.onmouseleave = () => dismiss(1500);
  dismiss(); requestAnimationFrame(() => el.classList.add('show'));
  // Open dialogs live in the browser's top layer, above everything else. Put the toasts in the top layer too
  // (and back on top every time), otherwise they are hidden behind the dialog.
  try {
    if (stack.hasAttribute('popover')) { if (stack.matches(':popover-open')) stack.hidePopover(); stack.showPopover(); }
    else { (document.querySelector('dialog[open]') || document.body).append(stack); }
  } catch { }
}

function authErrorMessage(e) {
  const code = String(e?.code || e?.error_code || '').toLowerCase();
  const msg = String(e?.message || e?.error_description || e || '');
  const hay = `${code} ${msg}`.toLowerCase();
  if (/invalid_credentials|invalid login credentials|wrong password/.test(hay)) return 'Incorrect email or password. Check your credentials and try again.';
  if (/email_not_confirmed|email not confirmed/.test(hay)) return 'Your email is not confirmed yet. Open the confirmation email first, then sign in.';
  if (/user_banned|banned|disabled user/.test(hay)) return 'This sign-in account has been disabled. Contact an administrator if you think this is a mistake.';
  if (/user_already_exists|already registered|already been registered/.test(hay)) return 'That email is already registered. Sign in instead, or use a different email.';
  if (/weak_password|password.*weak|password should/.test(hay)) return 'That password is too weak. Use a longer password with letters, numbers, and symbols.';
  if (/email_address_invalid|invalid email|unable to validate email/.test(hay)) return 'Enter a valid email address.';
  if (/signup_disabled|signups not allowed/.test(hay)) return 'New account registration is currently disabled.';
  if (/provider_disabled|unsupported provider|provider is not enabled/.test(hay)) return 'Google sign-in is not enabled correctly for this project.';
  if (/flow_state_not_found|flow state.*not found|code verifier/.test(hay)) return 'The Google sign-in session expired or was opened in a different browser context. Start Google sign-in again from SoundWave.';
  if (/flow_state_expired|invalid grant|authorization code.*expired/.test(hay)) return 'The Google sign-in link expired. Start Google sign-in again.';
  if (/identity_already_exists/.test(hay)) return 'This Google identity is already linked to another account.';
  if (/over_request_rate_limit|rate limit|too many requests|429/.test(hay)) return 'Too many attempts were made. Wait a short while, then try again.';
  if (/captcha_failed|captcha/.test(hay)) return 'The security check failed. Refresh the page and try again.';
  if (/otp_expired|token.*expired|expired.*token/.test(hay)) return 'That sign-in or confirmation link has expired. Request a new one.';
  if (/same_password/.test(hay)) return 'Choose a password different from your current password.';
  if (/reauthentication_needed/.test(hay)) return 'Please sign in again before making this security-sensitive change.';
  if (/access_denied|popup_closed|cancelled|canceled|user denied/.test(hay)) return 'Google sign-in was cancelled before it finished.';
  if (/redirect_uri|redirect.*mismatch/.test(hay)) return 'Google sign-in is misconfigured: the callback or redirect URL does not match the OAuth settings.';
  if (/provider|oauth|google/.test(hay)) return `Google sign-in could not finish${msg ? `: ${msg}` : ''}`;
  return '';
}
function humanErr(e) {
  const authMsg = authErrorMessage(e); if (authMsg) return authMsg;
  const code = String(e?.code || ''); const msg = e?.message || String(e || ''); const hay = `${code} ${msg}`;
  if (/conflict of interest/i.test(hay)) return 'Conflict of interest: you cannot moderate your own uploaded track.';
  if (/row-level security|permission denied|42501/i.test(hay)) return 'You do not have permission to perform that action with this account.';
  if (/23505|duplicate key|unique constraint/i.test(hay)) return 'That value is already in use. Choose a different name or title.';
  if (/23514|check constraint/i.test(hay)) return "One of the values does not follow SoundWave's rules. Review the highlighted fields and try again.";
  if (/23502|null value.*violates/i.test(hay)) return 'A required field is missing. Complete all required fields and try again.';
  if (/23503|foreign key/i.test(hay)) return 'That item is linked to another record and cannot be changed this way.';
  if (/payload too large|entity too large|maximum.*size|file.*too large/i.test(hay)) return 'That file is too large. Choose a smaller file and try again.';
  if (/resource already exists|duplicate.*object/i.test(hay)) return 'A file with that name already exists. Rename it or choose another file.';
  if (/failed to fetch|network|offline/i.test(hay)) return 'SoundWave cannot reach the server right now. Check your connection and try again.';
  if (/jwt|session|auth/i.test(hay)) return 'Your session is no longer valid. Sign in again.';
  return msg && msg.length < 180 ? msg : 'Something went wrong. Please try again.';
}
async function action(fn, opts = {}) { if (state.loading) { toast('Please wait for the current action to finish.'); return; } state.loading = true; if (!opts.quiet) showAsyncSkeleton(opts.skeleton); try { await fn(); } catch (e) { console.error(e); toast(humanErr(e), true); } finally { state.loading = false; if (!opts.quiet) hideAsyncSkeleton(); document.querySelectorAll('[data-busy]').forEach(b => b.disabled = false); } }
// Playing music never waits for another action to finish, so a quick second click is not ignored.
const playAction = async (fn) => { try { await fn(); } catch (e) { console.error(e); toast(humanErr(e), true); } };
function requireConfig() { if (configured) return false; $('#app').innerHTML = `<main class="main" style="max-width:820px;padding-top:90px"><div class="brand"><span class="brand-icon">♫</span> SoundWave</div><div class="card"><span class="eyebrow">Setup required</span><h1 class="page-title">Connect your Supabase project</h1><p class="muted">Make a copy of <code>.env.example</code> named <code>.env</code> and add your real project URL and publishable key. Restart the development server.</p><pre style="overflow:auto;background:#0d1526;padding:20px;border-radius:13px">VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY</pre><p class="footnote">Never place your database password, secret key or service_role key in this application.</p></div></main>`; return true; }
const nav = [['music', '♫', 'Search'], ['artists', '♥', 'Artists'], ['playlists', '▤', 'Your library'], ['history', '◷', 'Recently played'], ['podcasts', '◉', 'Podcasts'], ['plans', '♢', 'Premium']];
// Dashboard and capability are separate: Admin is an additional grant, while
// Listener tools are shared by Listener, Artist and Admin sessions.
function hasArtistAccess() { return Boolean(state.artist?.is_active && state.user && String(state.artist.user_id) === String(state.user.id)); }
function hasAdminAccess() { return state.admin === true; }
function primaryDashboard() { return hasAdminAccess() ? 'admin-dashboard' : hasArtistAccess() ? 'artist-dashboard' : 'discover'; }
function defaultLanding() { return hasAdminAccess() ? 'admin-dashboard' : hasArtistAccess() ? 'artist-dashboard' : 'discover'; }
// Refresh the public artist record when opening a profile. The browse catalog
// can be older than a newly uploaded artist banner (including across accounts).
let artistCoverRequestSequence = 0;
// Keep an in-flight resolution per cover, so changing pages does not restart requests.
const artistBannerLoads = new Map();
function applyArtistBanner(artistId, path, url) {
  if (state.page !== 'artist-detail' || Number(state.selectedArtist) !== Number(artistId)) return;
  const artist = state.artists.find(a => Number(a.artist_id) === Number(artistId));
  if (!artist || artist.cover_path !== path) return;
  for (const node of [document.getElementById('artist-profile-hero'), document.getElementById('artist-sticky-bar')]) {
    if (!node) continue;
    if (url) node.style.setProperty('--artist-cover', `url("${url.replaceAll('"', '%22')}")`);
    else node.style.removeProperty('--artist-cover');
  }
}
function preloadArtistBanner(path, url) {
  if (artistBannerLoads.has(url)) return artistBannerLoads.get(url);
  const promise = new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  artistBannerLoads.set(url, promise);
  return promise;
}
async function refreshViewedArtistCover(artistId) {
  if (!db || !artistId) return;
  const sequence = ++artistCoverRequestSequence;
  const artist = state.artists.find(a => Number(a.artist_id) === Number(artistId));
  if (!artist) return;
  // Show the cached cover at once; never wait for another database request.
  if (artist.cover_path && state.coverUrls[artist.cover_path])
    applyArtistBanner(artistId, artist.cover_path, state.coverUrls[artist.cover_path]);
  try {
    const response = await db.from('artist').select('artist_id,cover_path').eq('artist_id', Number(artistId)).eq('is_active', true).maybeSingle();
    if (response.error || !response.data || sequence !== artistCoverRequestSequence) return;
    const path = response.data.cover_path || null;
    artist.cover_path = path;
    if (!path) { applyArtistBanner(artistId, path, null); return; }
    // Existing signed URLs can expire or be stale. Verify once and renew only on failure.
    let url = state.coverUrls[path] || await resolveCoverUrl(path);
    if (!url || !(await preloadArtistBanner(path, url))) {
      delete state.coverUrls[path];
      url = await resolveCoverUrl(path);
      if (!url || !(await preloadArtistBanner(path, url))) return;
    }
    state.coverUrls[path] = url;
    if (sequence === artistCoverRequestSequence) applyArtistBanner(artistId, path, url);
  } catch (error) { console.warn('Artist banner unavailable:', error); }
}

function navigate(page, extras = {}) {
  closeKaraokeSearchOverlay();
  if (!pageAllowed(page)) return toast('This page is not available for your account.', true);
  if (page === 'playlists' && !('selectedPlaylist' in extras)) state.selectedPlaylist = null;
  state.page = page; Object.assign(state, extras);
  // Karaoke is a dedicated music view; navigating elsewhere restores the requested page.
  state.karaokeMode = false;
  document.body.classList.toggle('karaoke-mode', Boolean(state.karaokeMode && state.player?.kind === 'song'));
  render();
  if (page === 'top-songs') void refreshPersonalTopSongs();
  if (page === 'charts') void loadCharts();
  if (page === 'artist-detail') {
    const viewed = state.artists.find(a => Number(a.artist_id) === Number(state.selectedArtist));
    if (viewed?.cover_path && state.coverUrls[viewed.cover_path]) applyArtistBanner(state.selectedArtist, viewed.cover_path, state.coverUrls[viewed.cover_path]);
    void refreshViewedArtistCover(state.selectedArtist);
  }
  const main = document.getElementById('main-content'); if (main) main.scrollTop = 0;
  if (page === 'artist-detail' && state.selectedArtist) {
    // Search-card navigation renders immediately; the popularity RPC is async.
    // Refresh the visible artist only after the correct artist's counts arrive.
    const openedArtist = Number(state.selectedArtist);
    void loadArtistPopularity(openedArtist).then(() => {
      if (state.page === 'artist-detail' && Number(state.selectedArtist) === openedArtist) {
        const main = document.getElementById('main-content');
        const previousScroll = main?.scrollTop || 0;
        render();
        const currentArtist = state.artists.find(a => Number(a.artist_id) === openedArtist);
        if (currentArtist?.cover_path && state.coverUrls[currentArtist.cover_path]) applyArtistBanner(openedArtist, currentArtist.cover_path, state.coverUrls[currentArtist.cover_path]);
        const updatedMain = document.getElementById('main-content');
        if (updatedMain) updatedMain.scrollTop = previousScroll;
      }
    }).catch(error => console.warn('Artist stream counts could not load:', error));
  }
  if (page === 'admin' || page === 'admin-dashboard' || page === 'song-streams') scheduleStreamMetricsRefresh();
  if (page === 'history') void refreshHistory(true);
}
// Persistent admin-dashboard navigation: survives every shell redraw and does not
// rely on handlers attached to individual buttons during rendering.
function openAdminDashboardSection(target) {
  if (!hasAdminAccess()) { toast('Admin access is required.', true); return; }
  const destination = String(target || '').toLowerCase();
  const valid = ['moderation', 'analytics', 'catalog', 'payments'];
  if (!valid.includes(destination)) return;
  if (destination === 'analytics') { navigate('admin-dashboard'); setTimeout(() => document.getElementById('admin-analytics')?.scrollIntoView({ behavior: 'smooth' }), 60); return; }
  state.adminView = destination === 'payments' ? 'payments' : 'moderation';
  if (destination === 'catalog') state.adminTab = 'songs';
  else if (destination === 'moderation') state.adminTab = 'accounts';
  state.adminQuery = '';
  state.adminStatus = 'all';
  state.adminPriority = false;
  navigate('admin');
  // Protect against route transitions that leave the former page rendered.
  if (state.page === 'admin') {
    const section = document.querySelector(`[data-admin-view="${state.adminView}"]`);
    if (section) section.hidden = false;
  }
}
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-admin-dashboard-action]');
  if (!button || !button.isConnected) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openAdminDashboardSection(button.dataset.adminDashboardAction);
}, true);

// F-07: search accessory controls work after rerenders and at the search route.
document.addEventListener('input', event => {
  if (!event.target.matches?.('#global-search,#page-search')) return;
  const wrap = event.target.closest('.global-search,.page-search'); if (!wrap) return;
  const hasValue = Boolean(event.target.value.trim()); wrap.dataset.hasValue = String(hasValue);
  const clear = wrap.querySelector('.search-clear'), browse = wrap.querySelector('.search-browse'), divider = wrap.querySelector('.search-divider');
  if (clear) clear.hidden = !hasValue; if (browse) browse.hidden = hasValue; if (divider) divider.hidden = hasValue;
});
document.addEventListener('click', event => {
  const browse = event.target.closest?.('.search-browse'); if (!browse) return;
  if (state.page !== 'music') return;
  event.preventDefault(); event.stopImmediatePropagation();
  state.searchQuery = ''; state.searchGenre = null; state.searchTab = 'all';
  document.querySelectorAll('#global-search,#page-search').forEach(input => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); });
  renderSearchResults();
}, true);


// FR-01: karaoke surface lives in the main dashboard region, not the right rail.
Object.assign(state, { karaokeMode: false, lyricsOnly: false, mobileLyricsOpen: false, mobileQueueOpen: false });
async function ensureLyricsLoaded(songId) {
  if (!songId) return '';
  if (Object.prototype.hasOwnProperty.call(state.lyricsCache, songId)) return state.lyricsCache[songId];
  const result = await db.from('song_lyrics').select('*').eq('song_id', songId).maybeSingle();
  if (result.error) { console.warn('Lyrics could not be loaded', result.error); return ''; }
  const lyrics = String(result.data?.lyrics_text ?? result.data?.lyrics ?? result.data?.content ?? '');
  state.lyricsCache[songId] = lyrics; return lyrics;
}
// ---- Synced lyrics (LRC) ----------------------------------------------------------------
// Lyrics are stored as text in song_lyrics.lyrics_text. If the text has [mm:ss.xx] time tags (LRC format)
// the lines are highlighted in time with the audio; otherwise it is shown as plain text, as before.
// Enhanced LRC adds a <mm:ss.xx> tag before each word: [00:12.00]<00:12.00>Hello <00:12.50>world
const LRC_WORD_TAG = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
function parseLrcWords(body) {
  const marks = [...body.matchAll(LRC_WORD_TAG)]; if (!marks.length) return null;
  const at = (m) => Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / Math.pow(10, m[3].length) : 0);
  const words = [];
  marks.forEach((m, i) => {
    const seg = body.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : body.length).replace(LRC_WORD_TAG, '');
    if (!seg) return;
    if (!seg.trim() && words.length) { words[words.length - 1].text += seg; return; }
    words.push({ t: at(m), text: seg });
  });
  if (words.length) { words[words.length - 1].text = words[words.length - 1].text.replace(/\s+$/, ''); words[0].text = words[0].text.replace(/^\s+/, ''); }
  return words.length ? words : null;
}
function parseLrc(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n');
  const tag = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const lines = []; let offset = 0;
  for (const row of raw.split('\n')) {
    const off = row.match(/^\s*\[offset:\s*(-?\d+)\s*\]/i);
    if (off) { offset = Number(off[1]) / 1000; continue; }
    const stamps = [...row.matchAll(tag)];
    if (!stamps.length) continue;
    const rawBody = row.replace(tag, '');
    const words = parseLrcWords(rawBody);
    const body = (words ? words.map(w => w.text).join('') : rawBody.replace(LRC_WORD_TAG, '')).trim();
    let firstStamp = null;
    for (const m of stamps) {
      const frac = m[3] ? Number(m[3]) / Math.pow(10, m[3].length) : 0;
      const t = Number(m[1]) * 60 + Number(m[2]) + frac;
      if (firstStamp === null) firstStamp = t;
      // A repeated line ([00:12.00][00:30.00]...) shifts its word times by the distance between the stamps.
      lines.push({ t, text: body, words: words ? words.map(w => ({ ...w, t: w.t + (t - firstStamp) })) : null });
    }
  }
  if (lines.length < 2) return { synced: false, lines: [], plain: raw.replace(/^\s*\[[a-z]{2,}:[^\]]*\]\s*$/gim, '').replace(LRC_WORD_TAG, '').trim() };
  lines.sort((a, b) => a.t - b.t);
  for (const l of lines) { l.t = Math.max(0, l.t + offset); if (l.words) for (const w of l.words) w.t = Math.max(0, w.t + offset); }
  return { synced: true, lines, plain: '' };
}
function renderLyricsInto(el, text, emptyMessage) {
  if (!el) return;
  const parsed = parseLrc(text);
  el._lrc = parsed.synced ? parsed.lines : null; el._lrcActive = -1;
  el.classList.toggle('lrc-synced', parsed.synced);
  el.textContent = '';
  if (!String(text || '').trim()) { el.textContent = emptyMessage; return; }
  if (!parsed.synced) { const d = document.createElement('div'); d.className = 'lrc-plain'; d.textContent = parsed.plain || String(text).trim(); el.append(d); return; }
  const frag = document.createDocumentFragment();
  parsed.lines.forEach((l, i) => {
    const d = document.createElement('div'); d.className = 'lrc-line' + (l.text ? '' : ' lrc-gap'); d.dataset.i = String(i); d.dataset.t = String(l.t);
    if (l.words) { l.words.forEach(w => { const sp = document.createElement('span'); sp.className = 'lrc-w'; sp.dataset.t = String(w.t); sp.textContent = w.text; d.append(sp); }); }
    else d.textContent = l.text || '♪';
    frag.append(d);
  });
  el.append(frag);
  updateLyricsHighlight(true); ensureLrcTicker();
}
function lyricsLineAt(lines, time) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= time + 0.05) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
// Countdown dots: shown in karaoke mode during the last 3 seconds before a line that follows a long wait
// (an intro of 5s+ or an instrumental break of 8s+), so the singer knows when to come in.
function updateKaraokeCountdown(el, lines, idx, now) {
  const panel = el.closest('.karaoke-panel'); if (!panel) return;
  let cd = panel.querySelector('.karaoke-countdown');
  if (!cd) { cd = document.createElement('div'); cd.className = 'karaoke-countdown'; cd.setAttribute('aria-hidden', 'true'); cd.innerHTML = '<i></i><i></i><i></i>'; el.before(cd); }
  const next = lines[idx + 1]; let lit = 0;
  if (next) {
    const remaining = next.t - now, gap = next.t - (idx >= 0 ? lines[idx].t : 0);
    if (remaining > 0 && remaining <= 3 && gap >= (idx < 0 ? 5 : 8)) lit = Math.min(3, Math.ceil(remaining));
  }
  if (cd.dataset.n === String(lit)) return;
  cd.dataset.n = String(lit); cd.classList.toggle('show', lit > 0);
  [...cd.children].forEach((dot, i) => dot.classList.toggle('on', i < lit));
}
// Word-by-word: words of the active line light up as their time is reached.
function updateWordProgress(el, lines, idx, now) {
  const line = lines[idx]; if (!line || !line.words) return;
  const node = el.children[idx]; if (!node) return;
  const spans = node._ws || (node._ws = node.querySelectorAll('.lrc-w'));
  for (let i = 0; i < spans.length; i++) { const on = line.words[i] && line.words[i].t <= now + 0.02; if (spans[i].classList.contains('sung') !== on) spans[i].classList.toggle('sung', on); }
}
// ---- Karaoke stage: two big lines, words sweep from white to cyan as they are sung ----------------
// Line n always lives in slot n % 2. While one line is sung the next one waits in the other slot; when the sung
// line ends the next one starts, and its slot is refilled with the line after that. Lyrics without word timings
// get estimated ones, so any synced (LRC) lyrics work.
function karaokeStageLines(raw) {
  const out = [];
  raw.forEach((l, j) => {
    if (!l.text) return;
    const next = raw[j + 1], end = next ? next.t : l.t + 4; let words;
    if (l.words && l.words.length) {
      words = l.words.map((w, i) => { const nt = l.words[i + 1] ? l.words[i + 1].t : null; return { t: w.t, e: Math.max(nt ?? Math.min(end - 0.05, w.t + 1.5), w.t + 0.15), text: w.text }; });
    } else {
      const toks = l.text.split(/\s+/).filter(Boolean), total = toks.reduce((a, x) => a + x.length, 0) || 1;
      const span = Math.max(0.3, Math.min(end - l.t - 0.15, Math.max(1.2, total * 0.32))); let acc = 0;
      words = toks.map((x, i) => { const t0 = l.t + span * acc / total; acc += x.length; return { t: t0, e: l.t + span * acc / total, text: x + (i < toks.length - 1 ? ' ' : '') }; });
    }
    if (!words.length) return;
    out.push({ t: l.t, words, done: words[words.length - 1].e + 0.4 });
  });
  return out;
}
function fillKaraokeSlot(slot, line) {
  slot._line = line || null; slot._ws = []; slot.textContent = ''; slot.classList.remove('done');
  slot.classList.toggle('empty', !line); slot.dataset.t = line ? String(line.t) : '';
  if (!line) return;
  line.words.forEach(w => {
    const m = w.text.match(/^([\s\S]*?)(\s*)$/); if (!m[1]) { if (m[2]) slot.append(document.createTextNode(m[2])); return; }
    const sp = document.createElement('span'); sp.className = 'kw'; sp.textContent = m[1]; slot.append(sp); slot._ws.push(sp);
    if (m[2]) slot.append(document.createTextNode(m[2]));
  });
  slot.classList.remove('kin'); void slot.offsetWidth; slot.classList.add('kin');
}
function renderKaraokeStage(el, text) {
  const parsed = parseLrc(text);
  el.textContent = ''; el.classList.remove('lrc-synced', 'karaoke-empty'); el.classList.add('kstage');
  el._lrc = null; el._k = karaokeStageLines(parsed.lines); el._kActive = -2;
  el._kSlots = [0, 1].map(() => { const d = document.createElement('div'); d.className = 'kline empty'; el.append(d); return d; });
  updateLyricsHighlight(true); ensureLrcTicker();
}
function updateKaraokeStage(el, audio, force) {
  const L = el._k; if (!L || !el.offsetParent) return;
  const now = Number(audio.currentTime) || 0, idx = lyricsLineAt(L, now), slots = el._kSlots;
  updateKaraokeCountdown(el, L, idx, now);
  if (force || idx !== el._kActive) {
    el._kActive = idx; const c = Math.max(idx, 0);
    [c, c + 1].forEach(n => { const slot = slots[n % 2], line = L[n] || null; if (force || slot._line !== line) fillKaraokeSlot(slot, line); });
    slots.forEach((s, i) => s.classList.toggle('cur', idx >= 0 && i === idx % 2));
  }
  slots.forEach(slot => {
    const line = slot._line; if (!line) return;
    slot.classList.toggle('done', now > line.done && L[Math.max(el._kActive, 0)] === line);
    for (let i = 0; i < slot._ws.length; i++) {
      const w = line.words[i], sp = slot._ws[i], p = now <= w.t ? 0 : now >= w.e ? 100 : Math.round((now - w.t) / (w.e - w.t) * 500) / 5;
      if (sp._p !== p) { sp._p = p; sp.style.setProperty('--p', String(p)); }
    }
  });
}
let lrcTicker = 0;
function ensureLrcTicker() {
  if (lrcTicker) return;
  const tick = () => {
    const audio = document.getElementById('sw-audio');
    if (!audio || audio.paused || !document.querySelector('.lrc-synced .lrc-w, .kstage')) { lrcTicker = 0; return; }
    updateLyricsHighlight(false); lrcTicker = requestAnimationFrame(tick);
  };
  lrcTicker = requestAnimationFrame(tick);
}
document.addEventListener('play', e => { if (e.target?.id === 'sw-audio') ensureLrcTicker(); }, true);
function updateLyricsHighlight(force) {
  const audio = document.getElementById('sw-audio'); if (!audio) return;
  // If the karaoke view is open for a different song than the one playing, rebuild it.
  if (state.karaokeMode && state.player?.kind === 'song') {
    const panel = document.querySelector('.karaoke-panel');
    if (panel && panel.dataset.songId && Number(panel.dataset.songId) !== Number(state.player.id)) { void syncKaraokePanel(); return; }
  }
  document.querySelectorAll('.lrc-synced').forEach(el => {
    const lines = el._lrc; if (!lines || !el.offsetParent) return;
    const now = Number(audio.currentTime) || 0;
    const idx = lyricsLineAt(lines, now);
    updateKaraokeCountdown(el, lines, idx, now);
    if (force || idx !== el._lrcActive) {
      const old = el._lrcActive, nodes = el.children;
      if (old >= 0 && nodes[old] && old !== idx) nodes[old].querySelectorAll('.sung').forEach(w => w.classList.remove('sung'));
      el._lrcActive = idx;
      for (let i = 0; i < nodes.length; i++) { nodes[i].classList.toggle('active', i === idx); nodes[i].classList.toggle('past', i < idx); }
      const cur = nodes[idx];
      if (cur && !(el._lrcPause && Date.now() < el._lrcPause)) { if (el.dataset.railPreview) { el.scrollTo({ top: Math.max(0, cur.offsetTop - 4), behavior: force ? 'auto' : 'smooth' }); } else if (el.dataset.railScroll) { el.scrollTo({ top: Math.max(0, cur.offsetTop - (el.clientHeight - cur.offsetHeight) / 2), behavior: force ? 'auto' : 'smooth' }); } else cur.scrollIntoView({ block: 'center', behavior: force ? 'auto' : 'smooth' }); }
    }
    updateWordProgress(el, lines, idx, now);
  });
  document.querySelectorAll('.kstage').forEach(el => updateKaraokeStage(el, audio, force));
}
document.addEventListener('click', e => {
  const line = e.target.closest?.('.lrc-line'); if (!line) return;
  const audio = document.getElementById('sw-audio'); const t = Number(line.dataset.t);
  if (audio && Number.isFinite(t)) { audio.currentTime = t; const host = line.parentElement; if (host) host._lrcPause = 0; updateLyricsHighlight(true); }
});
document.addEventListener('click', e => {
  const line = e.target.closest?.('.kline[data-t]'); if (!line || !line.dataset.t) return;
  const audio = document.getElementById('sw-audio'), t = Number(line.dataset.t);
  if (audio && Number.isFinite(t)) { audio.currentTime = Math.max(0, t - 0.05); updateLyricsHighlight(true); }
});
// Let the listener scroll freely for a few seconds without the view snapping back.
['wheel', 'touchmove'].forEach(evt => document.addEventListener(evt, e => { const host = e.target.closest?.('.lrc-synced'); if (host) host._lrcPause = Date.now() + 4000; }, { passive: true }));
document.addEventListener('seeked', e => { if (e.target?.id === 'sw-audio') updateLyricsHighlight(true); }, true);
// Artists: choose an .lrc/.txt file and it fills the lyrics box.
document.addEventListener('change', async e => {
  const input = e.target.closest?.('[data-lyrics-file]'); if (!input) return;
  const file = input.files?.[0]; if (!file) return;
  const box = document.getElementById(input.dataset.lyricsFile);
  try {
    if (file.size > 200 * 1024) throw Error('That file is too large for lyrics (200 KB max).');
    const text = await file.text();
    if (box) { box.value = text.replace(/^﻿/, ''); box.dispatchEvent(new Event('input', { bubbles: true })); }
    toast(parseLrc(text).synced ? (parseLrc(text).lines.some(l => l.words) ? 'Timed lyrics loaded. Words will light up as they are sung.' : 'Timed lyrics loaded. They will sync with the song.') : 'Lyrics loaded. No time tags found, so they will show as plain text.');
  } catch (err) { toast(humanErr(err), true); }
  input.value = '';
});
async function saveSongLyrics(songId, text) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (clean.length > 30000) throw Error('Lyrics are too long (30,000 characters max).');
  if (!clean) { check(await db.from('song_lyrics').delete().eq('song_id', songId)); delete state.lyricsCache[songId]; if (typeof staleKaraokeCatalog === 'function') staleKaraokeCatalog(); return; }
  check(await db.from('song_lyrics').upsert({ song_id: songId, lyrics_text: clean, updated_at: new Date().toISOString() }, { onConflict: 'song_id' }));
  state.lyricsCache[songId] = clean; if (typeof staleKaraokeCatalog === 'function') staleKaraokeCatalog();
}
function lyricsFieldHtml(textareaId, disabled) {
  return `<div class="single-field lyrics-field"><label class="field-label" for="${textareaId}">Lyrics <span class="field-optional">Optional</span></label><textarea id="${textareaId}" class="lyrics-input" maxlength="30000" spellcheck="false" ${disabled ? 'disabled' : ''} placeholder="[00:12.50] First line of the song&#10;[00:17.80] Second line&#10;&#10;Or paste plain lyrics without times."></textarea><div class="lyrics-tools"><label class="lyrics-tool-btn">${icon('upload')}<span>Load .lrc file</span><input type="file" accept=".lrc,.txt,text/plain" data-lyrics-file="${textareaId}" hidden></label><button type="button" class="lyrics-tool-btn" data-lyrics-sync="${textareaId}">${icon('clock')}<span>Sync lyrics to the song</span></button></div><small class="field-help">Timed lyrics (LRC) highlight line by line as the song plays. For word-by-word highlighting, add a time before each word: [00:12.00]&lt;00:12.00&gt;Hello &lt;00:12.50&gt;world. Plain lyrics show without highlighting.</small></div>`;
}
// ---- Lyrics sync tool (v88) ------------------------------------------------------------------------------
// Artists paste plain lyrics, play the song and tap once per line. The taps become [mm:ss.xx] time tags (LRC)
// in the lyrics box, so nobody needs an outside LRC editor.
function lrcStamp(sec) { const cs = Math.max(0, Math.round(sec * 100)); const m = Math.floor(cs / 6000); const r = (cs % 6000) / 100; return `[${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}]`; }
function lyricsToPlainLines(text) {
  const rows = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(r => r.trim())
    .filter(r => !/^\[[a-z]{2,}:[^\]]*\]$/i.test(r))
    .map(r => r.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '').trim());
  const out = []; for (const r of rows) { if (!r && (!out.length || !out[out.length - 1])) continue; out.push(r); }
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}
async function openLyricsSync(textareaId) {
  const box = document.getElementById(textareaId);
  if (!box || box.disabled) { toast('Choose a song first, then sync its lyrics.', true); return; }
  const lines = lyricsToPlainLines(box.value);
  if (!lines.some(Boolean)) { toast('Add the lyrics first, one line per row, then sync them to the song.', true); return; }
  let src = '', blobUrl = null;
  try {
    if (textareaId === 'songlyrics') {
      const f = document.getElementById('song-file')?.files?.[0];
      if (!f) { toast('Choose your audio file first, then sync the lyrics.', true); return; }
      src = blobUrl = URL.createObjectURL(f);
    } else {
      const song = songById(Number(document.getElementById('owned-song')?.value));
      if (!song?.audio_path) { toast('Choose a song first, then sync its lyrics.', true); return; }
      src = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 3600)).signedUrl;
    }
  } catch (err) { toast(humanErr(err), true); return; }
  const hadTimes = parseLrc(box.value).synced;
  document.getElementById('lyrics-sync-dialog')?.remove();
  const dlg = document.createElement('dialog'); dlg.className = 'sw-modal sync-dialog'; dlg.id = 'lyrics-sync-dialog'; dlg.setAttribute('aria-label', 'Sync lyrics to the song');
  dlg.innerHTML = `<div class="sync-head"><div><span class="eyebrow">LYRICS SYNC</span><h2>Tap along to time your lyrics</h2><p>Press play, then tap <kbd>Space</kbd> or the big button the moment each highlighted line starts being sung.</p></div><button type="button" class="modal-close" data-sync-close aria-label="Close lyrics sync">${icon('close')}</button></div>
<audio id="sync-audio" controls preload="auto"></audio>
<div class="sync-lines" id="sync-lines"></div>
<div class="sync-controls"><button type="button" class="button sync-tap" id="sync-tap">Tap: line starts now</button><button type="button" class="button secondary" id="sync-undo">Undo <small>(Backspace)</small></button><button type="button" class="button secondary" id="sync-back">Back 5s</button><button type="button" class="button secondary" id="sync-reset">Start over</button><label class="sync-offset">Tap delay fix<select id="sync-offset" aria-label="Tap delay correction"><option value="0">None</option><option value="-0.1">−0.1 s</option><option value="-0.2" selected>−0.2 s</option><option value="-0.3">−0.3 s</option><option value="-0.4">−0.4 s</option></select></label></div>
<div class="sync-foot"><span class="sync-progress" id="sync-progress" aria-live="polite"></span><div class="sync-actions"><button type="button" class="button secondary" data-sync-close>Cancel</button><button type="button" class="button" id="sync-apply" disabled>Use these timings</button></div></div>`;
  document.body.appendChild(dlg);
  const audio = dlg.querySelector('#sync-audio'); audio.src = src;
  const list = dlg.querySelector('#sync-lines'), tapBtn = dlg.querySelector('#sync-tap'), applyBtn = dlg.querySelector('#sync-apply'), prog = dlg.querySelector('#sync-progress'), offSel = dlg.querySelector('#sync-offset');
  const stamps = lines.map(() => null); let pos = 0;
  const nextReal = (i) => { while (i < lines.length && !lines[i]) i++; return i; };
  const prevReal = (i) => { while (i >= 0 && !lines[i]) i--; return i; };
  pos = nextReal(0);
  const total = lines.filter(Boolean).length;
  const fmt = (t) => lrcStamp(t).slice(1, -1);
  const draw = () => {
    list.innerHTML = lines.map((l, i) => l ? `<button type="button" class="sync-line ${stamps[i] != null ? 'done' : ''} ${i === pos ? 'current' : ''}" data-i="${i}"><span class="sync-time">${stamps[i] != null ? fmt(stamps[i]) : '--:--.--'}</span><span class="sync-text">${esc(l)}</span></button>` : '<div class="sync-gap" aria-hidden="true"></div>').join('');
    const done = stamps.filter(t => t != null).length;
    prog.textContent = pos >= lines.length ? `All ${total} lines timed. Review them, then press Use these timings.` : `${done} of ${total} lines timed`;
    applyBtn.disabled = done < total; tapBtn.disabled = pos >= lines.length;
    list.querySelector('.sync-line.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const tap = () => {
    if (pos >= lines.length) return;
    const t = Math.max(0, (audio.currentTime || 0) + Number(offSel.value || 0));
    stamps[pos] = t; pos = nextReal(pos + 1); draw();
  };
  const undo = () => {
    const p = prevReal((pos >= lines.length ? lines.length : pos) - 1); if (p < 0) return;
    const t = stamps[p]; stamps[p] = null; pos = p; draw();
    if (t != null) { try { audio.currentTime = Math.max(0, t - 2); } catch { } }
  };
  const jumpTo = (i) => {
    if (!lines[i]) return;
    const before = prevReal(i - 1);
    for (let k = i; k < lines.length; k++)stamps[k] = null;
    pos = i; draw();
    try { audio.currentTime = before >= 0 && stamps[before] != null ? Math.max(0, stamps[before]) : 0; } catch { }
  };
  const close = () => { try { audio.pause(); } catch { } document.removeEventListener('keydown', onKey, true); document.removeEventListener('keyup', onKeyUp, true); if (blobUrl) URL.revokeObjectURL(blobUrl); if (dlg.open) dlg.close(); dlg.remove(); };
  const isTypingTarget = (t) => t && (t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' && t.type !== 'range');
  function onKey(e) {
    if (!dlg.open || isTypingTarget(e.target)) return;
    if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) tap(); }
    else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); undo(); }
  }
  function onKeyUp(e) { if (dlg.open && e.code === 'Space' && !isTypingTarget(e.target)) { e.preventDefault(); e.stopPropagation(); } }
  document.addEventListener('keydown', onKey, true); document.addEventListener('keyup', onKeyUp, true);
  tapBtn.addEventListener('click', () => { tap(); tapBtn.blur(); });
  dlg.querySelector('#sync-undo').addEventListener('click', e => { undo(); e.currentTarget.blur(); });
  dlg.querySelector('#sync-back').addEventListener('click', e => { try { audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5); } catch { } e.currentTarget.blur(); });
  dlg.querySelector('#sync-reset').addEventListener('click', e => { stamps.fill(null); pos = nextReal(0); draw(); try { audio.currentTime = 0; } catch { } e.currentTarget.blur(); });
  list.addEventListener('click', e => { const b = e.target.closest('.sync-line'); if (b) jumpTo(Number(b.dataset.i)); });
  dlg.addEventListener('click', e => { if (e.target.closest('[data-sync-close]')) close(); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  applyBtn.addEventListener('click', () => {
    if (stamps.some((t, i) => lines[i] && t == null)) return;
    if (hadTimes && !window.confirm('This replaces the timings already in the lyrics box. Continue?')) return;
    box.value = lines.map((l, i) => l ? `${lrcStamp(stamps[i])} ${l}` : '').join('\n');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    close(); toast('Timings added to the lyrics box. Save the song to keep them.');
  });
  draw(); dlg.showModal();
}
document.addEventListener('click', e => { const b = e.target.closest?.('[data-lyrics-sync]'); if (!b) return; e.preventDefault(); void openLyricsSync(b.dataset.lyricsSync); });
function mobileQueueRowHtml(song, idx = null) {
  if (!song) return '';
  const action = idx == null ? ' aria-current="true"' : ` data-mobile-queue-jump="${idx}"`;
  const label = idx == null ? '<small>Now playing</small>' : `<small>Up next</small>`;
  const rowHtml = `<button type="button" class="mobile-queue-row ${idx == null ? 'current' : ''}"${action}><span class="mobile-queue-art">${albumArt(song, 'tiny')}</span><span class="mobile-queue-copy"><strong>${esc(song.song_title || 'Unknown track')}</strong><span>${esc(song.album?.artist?.artist_name || 'SoundWave')}</span>${label}</span></button>`;
  return `<div class="mobile-queue-wrap">${rowHtml}<button type="button" class="queue-report" data-report-song="${Number(song.song_id)}" aria-label="Report ${esc(song.song_title || 'song')}">${icon('flag')}</button></div>`;
}
function mobileQueueMarkup() {
  const p = state.player;
  if (!p || p.kind !== 'song') return '<p class="muted small">Nothing queued yet.</p>';
  const current = songById(p.id);
  const up = (p.order || []).slice((p.pos || 0) + 1).map((id, offset) => ({ s: songById(id), idx: (p.pos || 0) + 1 + offset })).filter((x) => x.s && x.s.is_active !== false);
  return `<div class="mobile-queue-group"><h3>Now playing</h3>${current ? mobileQueueRowHtml(current, null) : '<p class="muted small">No current song.</p>'}</div><div class="mobile-queue-group"><h3>Next up</h3>${up.length ? up.slice(0, 40).map((x) => mobileQueueRowHtml(x.s, x.idx)).join('') : '<p class="muted small">Nothing else in the queue yet.</p>'}</div>`;
}
// Spotify-style takeover: on desktop the lyrics / karaoke view covers the whole workspace (library, page and side
// panel), leaving only the top bar and the player bar. We measure those two bars so it fits any screen size.
function layoutLyricsCover() {
  const panel = document.querySelector('.karaoke-panel'); if (!panel) return;
  const cover = window.innerWidth > 700;
  panel.classList.toggle('kp-cover', cover);
  if (!cover) return;
  const top = document.querySelector('.app-top')?.getBoundingClientRect().bottom ?? 96;
  const bar = document.querySelector('.custom-playbar')?.getBoundingClientRect().top ?? (window.innerHeight - 96);
  panel.style.setProperty('--kp-top', Math.round(top + 4) + 'px');
  panel.style.setProperty('--kp-bottom', Math.max(0, Math.round(window.innerHeight - bar + 4)) + 'px');
}
window.addEventListener('resize', () => { if (document.querySelector('.karaoke-panel')) layoutLyricsCover(); });
// Full screen for the lyrics / karaoke view. The page itself goes full screen and the panel covers it (body.lyrics-fs),
// so it keeps working when the next song loads and the panel is rebuilt. Esc leaves full screen.
function setLyricsFullscreen(on) {
  const was = document.body.classList.contains('lyrics-fs');
  document.body.classList.toggle('lyrics-fs', Boolean(on));
  document.querySelectorAll('[data-lyrics-fullscreen]').forEach(b => { const l = on ? 'Exit full screen' : 'Full screen'; b.setAttribute('aria-label', l); b.title = l; b.setAttribute('aria-pressed', String(Boolean(on))); });
  try {
    if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => { });
    else if (!on && document.fullscreenElement) void document.exitFullscreen?.().catch(() => { });
  } catch { }
  if (was !== Boolean(on)) setTimeout(() => updateLyricsHighlight(true), 80);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('lyrics-fs')) setLyricsFullscreen(false); });
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-lyrics-fullscreen]')) { e.preventDefault(); setLyricsFullscreen(!document.body.classList.contains('lyrics-fs')); return; }
  const c = e.target.closest?.('[data-lyrics-ctl]');
  if (c) { e.preventDefault(); document.getElementById(({ prev: 'sw-prev', toggle: 'sw-toggle', next: 'sw-next' })[c.dataset.lyricsCtl])?.click(); }
});
async function syncKaraokePanel() {
  const main = document.getElementById('main-content'); if (!main) return;
  main.querySelector('.karaoke-panel')?.remove();
  document.body.classList.toggle('karaoke-mode', Boolean(state.karaokeMode && state.player?.kind === 'song'));
  if (!document.body.classList.contains('karaoke-mode')) { state.karaokeHostPage = null; setLyricsFullscreen(false); void reconcileKaraokeAudio(); if (state.renderPending) render(); return; }
  state.karaokeHostPage = state.page; // remember where karaoke was opened so background refreshes of that page don't close it
  const panel = document.createElement('section'); panel.className = 'karaoke-panel'; panel.dataset.songId = String(state.player.id); panel.setAttribute('aria-label', state.lyricsOnly ? 'Lyrics' : 'Karaoke lyrics'); panel.classList.toggle('lyrics-only', Boolean(state.lyricsOnly)); panel.classList.toggle('ksing', !state.lyricsOnly);
  // Stable, artist-based color families; the base Midnight Violet surface remains the fallback.
  const currentSong = songById(state.player?.id);
  const artistKey = String(currentSong?.album?.artist?.artist_id ?? state.player?.artist ?? state.player?.id ?? '0');
  let artistHash = 0; for (const character of artistKey) artistHash = ((artistHash * 31) + character.charCodeAt(0)) >>> 0;
  const artistThemes = [['#536278', '#1e232a'], ['#536278', '#201b41'], ['#485467', '#21272f'], ['#35537b', '#191e3c'], ['#4c596d', '#21272f'], ['#4f548a', '#1e1e3f']];
  const colors = artistThemes[artistHash % artistThemes.length];
  panel.style.setProperty('--karaoke-artist-color', colors[0]);
  panel.style.setProperty('--karaoke-artist-dark', colors[1]);
  const heading = document.createElement('div'); heading.className = 'karaoke-heading'; heading.innerHTML = `<span class="karaoke-kicker">${state.lyricsOnly ? 'LYRICS' : 'KARAOKE MODE'}</span><h2></h2><small class="karaoke-subtitle"></small>`; heading.querySelector('h2').textContent = state.player.title || 'Karaoke'; heading.querySelector('.karaoke-subtitle').textContent = state.player.artist || '';
  const lines = document.createElement('div'); lines.className = 'karaoke-lines'; lines.textContent = 'Loading lyrics…'; const sizeBar = document.createElement('div'); sizeBar.className = 'lyrics-size-bar'; sizeBar.innerHTML = lyricsSizeControlsHtml() + `<button type="button" class="lyrics-close" data-lyrics-close aria-label="${state.lyricsOnly ? 'Close lyrics' : 'Exit karaoke'}" title="${state.lyricsOnly ? 'Close lyrics' : 'Exit karaoke'}">✕</button>`;
  sizeBar.insertAdjacentHTML('afterbegin', `<button type="button" class="lyrics-fs-btn" data-lyrics-fullscreen aria-label="Full screen" title="Full screen"><svg class="fs-enter" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><svg class="fs-exit" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg></button>`); const fsControls = document.createElement('div'); fsControls.className = 'lyrics-fs-controls'; fsControls.innerHTML = '<button type="button" data-lyrics-ctl="prev" aria-label="Previous song">⏮</button><button type="button" data-lyrics-ctl="toggle" aria-label="Play or pause">⏯</button><button type="button" data-lyrics-ctl="next" aria-label="Next song">⏭</button>';
  const modeBar = document.createElement('div'); modeBar.className = 'karaoke-mode-bar';
  modeBar.innerHTML = `<div class="karaoke-mode-switch" role="group" aria-label="View"><button type="button" data-karaoke-view="lyrics" aria-pressed="${Boolean(state.lyricsOnly)}">Lyrics</button><button type="button" data-karaoke-view="karaoke" aria-pressed="${!state.lyricsOnly}">Karaoke</button></div><small class="karaoke-mode-note" hidden></small>`;
  panel.append(sizeBar, heading, modeBar, lines, fsControls); main.append(panel); applyLyricsScale(); layoutLyricsCover();
  const songId = state.player.id;
  const lyrics = await ensureLyricsLoaded(songId);
  if (panel.isConnected && state.player?.id === songId) {
    const useStage = !state.lyricsOnly && parseLrc(lyrics).synced;
    panel.classList.toggle('ksing', !state.lyricsOnly);
    if (useStage) renderKaraokeStage(lines, lyrics);
    else { renderLyricsInto(lines, lyrics, 'Lyrics aren’t available for this track yet.'); lines.classList.toggle('karaoke-empty', !lyrics); updateLyricsHighlight(true); }
  }
  void updateKaraokeModeSwitch(panel, songId);
  if (!state.lyricsOnly) await renderKaraokeVoice(panel, songId);
  await reconcileKaraokeAudio(); updateKaraokeVoiceUi();
}
// The Karaoke side of the Lyrics | Karaoke switch is only usable when the artist added an instrumental for this song.
async function updateKaraokeModeSwitch(panel, songId) {
  const path = await ensureKaraokeTrack(songId);
  if (!panel.isConnected || Number(state.player?.id) !== Number(songId)) return;
  const kb = panel.querySelector('[data-karaoke-view="karaoke"]'), note = panel.querySelector('.karaoke-mode-note'); if (!kb) return;
  const unavailable = !path && Boolean(state.lyricsOnly);
  kb.disabled = unavailable; kb.classList.toggle('is-unavailable', unavailable);
  kb.title = unavailable ? 'The artist has not added a karaoke instrumental for this song yet' : '';
  if (note) { note.hidden = !unavailable; note.textContent = unavailable ? 'Karaoke isn’t available for this song yet' : ''; }
}
// Karaoke toggle button handler (instrumental + lyrics)
function updateKaraokeButtons() { document.querySelectorAll('[data-karaoke-toggle]').forEach(b => { b.setAttribute('aria-pressed', String(Boolean(state.karaokeMode))); }); }
// The player-bar mic button opens Lyrics first. Inside the panel, a Lyrics | Karaoke switch lets the listener
// choose whether to move on to karaoke mode (instrumental). Clicking the button again closes the panel.
document.addEventListener('click', e => { const t = e.target.closest?.('[data-karaoke-toggle]'); if (!t) return; e.preventDefault(); state.karaokeMode = !state.karaokeMode; state.lyricsOnly = state.karaokeMode; state.railTab = state.karaokeMode ? 'now' : state.railTab; updateKaraokeButtons(); void syncKaraokePanel(); });
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-karaoke-view]'); if (!b) return;
  e.preventDefault();
  const wantLyrics = b.dataset.karaokeView === 'lyrics';
  if (Boolean(state.lyricsOnly) === wantLyrics && state.karaokeMode) return;
  state.karaokeMode = true; state.lyricsOnly = wantLyrics;
  updateKaraokeButtons(); void syncKaraokePanel();
});


// ---- Karaoke instrumentals (v84) -------------------------------------------------------------
// Artists can attach one instrumental (no-vocals) file per song. In karaoke mode that file replaces the original on
// the same <audio> element, so position, play/pause, volume and the seek bar all keep working. Leaving karaoke
// mode (or choosing "Original") swaps back at the same position.
let karaokeTable = 'unknown'; // 'unknown' | 'yes' | 'no': does the song_karaoke table exist yet?
async function probeKaraokeTable() {
  if (karaokeTable !== 'unknown' || !db) return;
  try { const r = await db.from('song_karaoke').select('song_id').limit(1); karaokeTable = r.error ? 'no' : 'yes'; if (r.error) console.info('Karaoke instrumentals unavailable. Run sql/RUN_ME_v84_karaoke_instrumental.sql.', r.error.message); }
  catch { karaokeTable = 'no'; }
}
Object.assign(state, { karaokeVoice: 'instrumental', karaokeTracks: {}, karaokeSwapId: 0 });
async function ensureKaraokeTrack(songId) {
  if (!songId || karaokeTable === 'no') return null;
  if (Object.prototype.hasOwnProperty.call(state.karaokeTracks, songId)) return state.karaokeTracks[songId];
  await probeKaraokeTable(); if (karaokeTable !== 'yes') return null;
  const r = await db.from('song_karaoke').select('audio_path').eq('song_id', songId).maybeSingle();
  if (r.error) { console.warn('Instrumental could not be loaded', r.error); return null; }
  const path = r.data?.audio_path || null; state.karaokeTracks[songId] = path; return path;
}
function swapAudioSource(audio, url, label) {
  const t = audio.currentTime, wasPlaying = !audio.paused;
  audio.dataset.track = label; audio.src = url;
  audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = t; } catch { } if (wasPlaying) audio.play().catch(() => { }); }, { once: true });
}
// Make the audio element match the karaoke state: instrumental while karaoke mode is on (and the listener has not
// chosen "Original"), original otherwise. Safe to call any time; it only acts when something needs to change.
async function reconcileKaraokeAudio() {
  const p = state.player; if (!p || p.kind !== 'song' || p.offline) return;
  const wantInstrumental = Boolean(state.karaokeMode && !state.lyricsOnly && state.karaokeVoice === 'instrumental');
  const path = wantInstrumental ? await ensureKaraokeTrack(p.id) : null;
  if (state.player !== p) return; // song changed while loading
  const audio = document.getElementById('sw-audio'); if (!audio) return;
  const want = (wantInstrumental && path) ? 'instrumental' : 'original';
  if ((audio.dataset.track || 'original') === want) return;
  const swapId = ++state.karaokeSwapId;
  try {
    const song = songById(p.id); const target = want === 'instrumental' ? path : song?.audio_path;
    if (!target) return;
    const signed = check(await db.storage.from('song-audio').createSignedUrl(target, 3600));
    const stillWanted = Boolean(state.karaokeMode && !state.lyricsOnly && state.karaokeVoice === 'instrumental') === (want === 'instrumental');
    if (swapId !== state.karaokeSwapId || state.player !== p || !audio.isConnected || !stillWanted) return;
    swapAudioSource(audio, signed.signedUrl, want);
  } catch (err) { console.warn('Could not switch karaoke track', err); if (want === 'instrumental') toast('The instrumental could not be loaded. Playing the original.', true); }
  updateKaraokeVoiceUi();
}
function updateKaraokeVoiceUi() {
  const audio = document.getElementById('sw-audio'), current = audio?.dataset.track || 'original';
  document.querySelectorAll('[data-karaoke-voice]').forEach(b => { const on = b.dataset.karaokeVoice === state.karaokeVoice; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
  document.querySelectorAll('.karaoke-voice-note').forEach(n => { n.hidden = !(state.karaokeVoice === 'instrumental' && current !== 'instrumental'); });
}
async function renderKaraokeVoice(panel, songId) {
  const path = await ensureKaraokeTrack(songId);
  if (!panel.isConnected || Number(state.player?.id) !== Number(songId)) return;
  panel.querySelector('.karaoke-voice')?.remove();
  const bar = document.createElement('div'); bar.className = 'karaoke-voice';
  if (path) {
    return; // instrumental exists: no extra Karaoke / Original vocals switch (the Lyrics tab covers the original)
  } else {
    bar.innerHTML = '<small class="karaoke-voice-none">No instrumental has been added for this song yet, so you will hear the original vocals.</small>';
  }
  (panel.querySelector('.karaoke-mode-bar') || panel.querySelector('.karaoke-heading'))?.after(bar);
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-karaoke-voice]'); if (!b) return;
  e.preventDefault(); state.karaokeVoice = b.dataset.karaokeVoice === 'original' ? 'original' : 'instrumental';
  updateKaraokeVoiceUi(); void reconcileKaraokeAudio();
});
// Artists: attach, replace or remove the instrumental for a song.
function karaokeFieldHtml(id, edit) {
  if (karaokeTable !== 'yes') return '';
  // The picker is a <label> wrapping a hidden input. A bare <input type="file"> inside an open <dialog> cannot be
  // clicked (see "dialog[open] input[type=file]" in style.css), the label is what opens the system file picker.
  return `<div class="single-field karaoke-field" id="${id}"><span class="field-label">Karaoke instrumental <span class="field-optional">Optional</span></span><div class="karaoke-pick" id="${id}-pick"><label class="karaoke-drop" for="${id}-file"><span class="karaoke-drop-icon">${icon('music')}</span><span class="karaoke-drop-text"><strong>No file chosen</strong><small>MP3, WAV, M4A or FLAC. Click to browse or drop a file here.</small></span><span class="karaoke-drop-btn">Choose file</span><input type="file" id="${id}-file" data-karaoke-input accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" hidden ${edit ? 'disabled' : ''}></label><button type="button" class="karaoke-clear" data-karaoke-clear="${id}" aria-label="Clear the chosen file" title="Clear the chosen file" hidden>${icon('close')}</button></div><small class="field-help" id="${id}-status">A version of the song without vocals. Listeners hear it in Karaoke mode while the lyrics scroll. Keep the same length and timing as the original so the lyrics stay in sync.</small>${edit ? `<label class="karaoke-remove" id="${id}-remove-wrap" hidden><input type="checkbox" id="${id}-remove"> Remove the current instrumental</label>` : ''}</div>`;
}
// Keeps the picker's text in step with the real (hidden) file input: filename, size, Change / Clear.
function syncKaraokePick(input) {
  const pick = input?.closest?.('.karaoke-pick'); if (!pick) return;
  const file = input.files?.[0], name = pick.querySelector('.karaoke-drop-text strong'), meta = pick.querySelector('.karaoke-drop-text small');
  if (!pick.dataset.idleMeta) pick.dataset.idleMeta = meta.textContent;
  pick.classList.toggle('has-file', Boolean(file));
  name.textContent = file ? file.name : 'No file chosen';
  meta.textContent = file ? `${(file.size / 1048576).toFixed(file.size >= 10485760 ? 0 : 1)} MB. It will be saved when you select Save changes.` : pick.dataset.idleMeta;
  pick.querySelector('.karaoke-drop-btn').textContent = file ? 'Change' : 'Choose file';
  pick.querySelector('[data-karaoke-clear]').hidden = !file;
}
document.addEventListener('change', e => { const i = e.target.closest?.('[data-karaoke-input]'); if (i) syncKaraokePick(i); });
document.addEventListener('click', e => { const b = e.target.closest?.('[data-karaoke-clear]'); if (!b) return; e.preventDefault(); const i = document.getElementById(`${b.dataset.karaokeClear}-file`); if (i) { i.value = ''; syncKaraokePick(i); } });
document.addEventListener('dragover', e => { const z = e.target.closest?.('.karaoke-drop'); if (!z || z.querySelector('input')?.disabled) return; e.preventDefault(); z.classList.add('drag-over'); });
document.addEventListener('dragleave', e => { e.target.closest?.('.karaoke-drop')?.classList.remove('drag-over'); });
document.addEventListener('drop', e => {
  const z = e.target.closest?.('.karaoke-drop'); if (!z) return; z.classList.remove('drag-over');
  const i = z.querySelector('input[type=file]'); if (!i || i.disabled) return; e.preventDefault();
  const f = e.dataTransfer?.files?.[0]; if (!f) return;
  const dt = new DataTransfer(); dt.items.add(f); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true }));
});
async function saveKaraokeTrack(songId, file, songSeconds) {
  const bad = audioProblem(file); if (bad) throw Error('Instrumental: ' + bad);
  const seconds = await audioDuration(file);
  if (Number.isFinite(songSeconds) && songSeconds > 0 && Math.abs(seconds - songSeconds) > 5) throw Error(`The instrumental is ${Math.round(seconds)}s long but the song is ${Math.round(songSeconds)}s. It needs the same timing as the original or the lyrics will drift.`);
  const path = `${state.user.id}/karaoke/${crypto.randomUUID()}_${safeUploadFilename(file)}`;
  const previous = await ensureKaraokeTrack(songId).catch(() => null);
  check(await db.storage.from('song-audio').upload(path, file, { upsert: false, contentType: file.type || 'audio/mpeg' }));
  try { check(await db.from('song_karaoke').upsert({ song_id: songId, audio_path: path, updated_at: new Date().toISOString() }, { onConflict: 'song_id' })); }
  catch (err) { await db.storage.from('song-audio').remove([path]); throw err; }
  state.karaokeTracks[songId] = path; staleKaraokeCatalog();
  if (previous && previous !== path) await db.storage.from('song-audio').remove([previous]).catch(() => { });
}
async function removeKaraokeTrack(songId) {
  const previous = await ensureKaraokeTrack(songId);
  check(await db.from('song_karaoke').delete().eq('song_id', songId));
  state.karaokeTracks[songId] = null; staleKaraokeCatalog();
  if (previous) await db.storage.from('song-audio').remove([previous]).catch(() => { });
}

// ---- Karaoke discovery (v87) -----------------------------------------------------------------
// A song is "karaoke-ready" when it has an instrumental (song_karaoke) AND timed (LRC) lyrics. The catalog of
// ready songs is loaded lazily the first time a surface that shows it opens, then cached for a few minutes.
Object.assign(state, { karaokeCatalog: { ids: [], loaded: false, at: 0 } });
let karaokeCatalogLoading = null;
const KARAOKE_CATALOG_TTL = 5 * 60 * 1000;
async function loadKaraokeCatalog() {
  await probeKaraokeTable();
  let withInstrumental = [];
  if (karaokeTable === 'yes') {
    const r = await fetchAllPages(() => db.from('song_karaoke').select('song_id'));
    if (r.error) console.warn('Karaoke songs could not be loaded', r.error);
    else withInstrumental = [...new Set((r.data || []).map(x => Number(x.song_id)).filter(Boolean))];
  }
  const ready = [];
  for (let i = 0; i < withInstrumental.length; i += 40) {
    const chunk = withInstrumental.slice(i, i + 40);
    const l = await db.from('song_lyrics').select('song_id,lyrics_text').in('song_id', chunk);
    if (l.error) { console.warn('Lyrics check failed', l.error); continue; }
    for (const row of l.data || []) {
      const text = String(row.lyrics_text || ''); if (!text.trim()) continue;
      state.lyricsCache[row.song_id] = text;            // karaoke mode will not need to fetch these again
      if (parseLrc(text).synced) ready.push(Number(row.song_id));
    }
  }
  state.karaokeCatalog = { ids: ready, loaded: true, at: Date.now() };
}
function ensureKaraokeCatalog() {
  if (!db || !state.user || karaokeTable === 'no') return Promise.resolve();
  if (karaokeCatalogLoading) return karaokeCatalogLoading;
  if (state.karaokeCatalog.loaded && Date.now() - state.karaokeCatalog.at < KARAOKE_CATALOG_TTL) return Promise.resolve();
  karaokeCatalogLoading = (async () => { try { await loadKaraokeCatalog(); } catch (err) { console.warn('Karaoke catalog failed', err); state.karaokeCatalog = { ids: [], loaded: true, at: Date.now() }; } finally { karaokeCatalogLoading = null; } refreshKaraokeSurfaces(); })();
  return karaokeCatalogLoading;
}
const staleKaraokeCatalog = () => { if (state.karaokeCatalog) state.karaokeCatalog.at = 0; };
const karaokeSongs = () => (state.karaokeCatalog?.ids || []).map(id => songById(id)).filter(s => s && s.is_active !== false && s.album?.is_active !== false && s.album?.artist?.is_active !== false);
// Songs from artists you follow, like and play come first.
const karaokeRanked = () => { const list = karaokeSongs(); try { return rankMoodSongs(list); } catch { return list; } };
function karaokeTile(song) {
  const artist = song.album?.artist?.artist_name || 'SoundWave artist';
  return `<article class="release-tile karaoke-tile" tabindex="0" role="button" data-karaoke-sing="${song.song_id}" aria-label="Sing ${esc(song.song_title)} by ${esc(artist)}"><span class="release-art">${albumArt(song, 'large')}<span class="karaoke-badge">${icon('mic')} Karaoke</span><span class="hover-play" aria-hidden="true">${icon('mic')}</span></span><strong>${esc(song.song_title)}</strong><small>${esc(artist)}</small></article>`;
}
function karaokeShelfHtml() {
  const list = karaokeRanked(); if (!list.length) return '';
  return `<section class="shelf-section karaoke-shelf"><div class="section-heading discover-heading"><div><h2>Sing along</h2><p>Songs with an instrumental and timed lyrics. Tap one to start karaoke.</p></div>${list.length > 12 ? '<button type="button" class="text-link" data-nav="karaoke">Show all</button>' : ''}</div><div class="shelf">${list.slice(0, 12).map(karaokeTile).join('')}</div></section>`;
}
function karaokePromoHtml() {
  const n = karaokeSongs().length; if (!n) return '';
  return `<button type="button" class="karaoke-promo" data-nav="karaoke"><span class="karaoke-promo-icon">${icon('mic')}</span><span><strong>Karaoke</strong><small>${n} ${n === 1 ? 'song' : 'songs'} with an instrumental and timed lyrics. Sing along.</small></span><i>${icon('forward')}</i></button>`;
}
function refreshKaraokeSurfaces() {
  const shelf = document.getElementById('karaoke-shelf-slot'); if (shelf) shelf.innerHTML = karaokeShelfHtml();
  const promo = document.getElementById('karaoke-promo-slot'); if (promo) promo.innerHTML = karaokePromoHtml();
  if (state.page === 'karaoke' && !state.karaokeMode) render();
}
function karaokePage() {
  void ensureKaraokeCatalog();
  const list = karaokeRanked(), loaded = state.karaokeCatalog.loaded;
  state.tint = '#4a2260';
  if (!list.length) {
    shell(`<div class="empty-state"><h3>${loaded ? 'No karaoke songs yet' : 'Finding karaoke songs…'}</h3><p>${loaded ? 'Artists make a song available for karaoke by adding an instrumental and timed lyrics. Check back soon.' : 'One moment.'}</p><button class="button" type="button" data-nav="music">Back to Search</button></div>`, '', '');
    return;
  }
  const grad = 'linear-gradient(145deg,#c2398b,#5b2a9e)';
  shell(`<header class="coll-hero"><div class="coll-cover mix-art mix-cover" style="background:${grad}"><span class="mix-art-inner"><span class="mix-art-label">Sing along</span><span class="mix-art-title">Karaoke</span></span></div><div class="coll-meta"><span class="coll-kind">Karaoke</span><h1 class="coll-title">Karaoke</h1><p class="coll-desc">Songs with an instrumental track and lyrics that follow the music. Pick one and the vocals step aside.</p><p class="coll-sub"><strong>${list.length} ${list.length === 1 ? 'song' : 'songs'}</strong> · artists you follow and like come first</p></div></header>
 <div class="coll-actions"><button type="button" class="button" data-karaoke-start>${icon('mic')} Start karaoke</button><button type="button" class="sw-quiet-action" data-karaoke-start="shuffle">${icon('shuffle')} Shuffle</button></div>
 <div class="shelf wrap karaoke-grid">${list.map(karaokeTile).join('')}</div>`, '', '');
}
// Start a song with karaoke mode already on, so it begins on the instrumental (no flash of the original vocals).
async function singAlong(songId, listIds) {
  const id = Number(songId), queue = (Array.isArray(listIds) && listIds.length ? listIds : [id]).map(Number);
  const cur = state.player, audio = document.getElementById('sw-audio');
  const wasOn = state.karaokeMode, wasVoice = state.karaokeVoice, wasLyrics = state.lyricsOnly;
  state.karaokeVoice = 'instrumental'; state.karaokeMode = true; state.lyricsOnly = false;
  try {
    if (cur?.kind === 'song' && Number(cur.id) === id && audio) { if (audio.paused) await audio.play(); }
    else await playSong(id, queue);
  } catch (err) { state.karaokeMode = wasOn; state.karaokeVoice = wasVoice; state.lyricsOnly = wasLyrics; throw err; }
  updateKaraokeButtons();
  await syncKaraokePanel();
}
document.addEventListener('click', e => {
  const tile = e.target.closest?.('[data-karaoke-sing]');
  if (tile) { e.preventDefault(); const id = Number(tile.dataset.karaokeSing), list = karaokeRanked().map(s => Number(s.song_id)); playAction(() => singAlong(id, list)); return; }
  const start = e.target.closest?.('[data-karaoke-start]');
  if (start) {
    const list = karaokeRanked().map(s => Number(s.song_id)); if (!list.length) return;
    const first = start.dataset.karaokeStart === 'shuffle' ? list[Math.floor(Math.random() * list.length)] : list[0];
    playAction(() => singAlong(first, list));
  }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-karaoke-sing]')) { e.preventDefault(); e.target.click(); }
});

// F-09: independent lyrics overlay does not rebuild audio (avoids interrupted playback).
document.addEventListener('click', async e => {
  const btn = e.target.closest?.('#mobile-lyrics-toggle'); if (!btn) return;
  e.preventDefault(); state.mobileLyricsOpen = !state.mobileLyricsOpen;
  const panel = document.getElementById('mobile-now-lyrics'); if (!panel) return;
  panel.hidden = !state.mobileLyricsOpen; btn.setAttribute('aria-pressed', String(state.mobileLyricsOpen));
  document.getElementById('mobile-now-playing')?.classList.toggle('show-lyrics', state.mobileLyricsOpen);
  if (state.mobileLyricsOpen) {
    applyLyricsScale();
    state.mobileQueueOpen = false;
    const qPanel = document.getElementById('mobile-now-queue'); if (qPanel) qPanel.hidden = true;
    document.getElementById('mobile-now-playing')?.classList.remove('show-queue');
  }
  if (state.mobileLyricsOpen && state.player?.kind === 'song') {
    const id = state.player.id, lines = panel.querySelector('#mobile-now-lyrics-content');
    const lyrics = await ensureLyricsLoaded(id); if (lines && state.player?.id === id) renderLyricsInto(lines, lyrics, 'Lyrics haven’t been added to this track yet.');
  }
});
document.addEventListener('click', e => {
  const btn = e.target.closest?.('#mobile-queue-toggle'); if (!btn) return;
  e.preventDefault();
  state.mobileQueueOpen = !state.mobileQueueOpen;
  state.mobileLyricsOpen = false;
  const root = document.getElementById('mobile-now-playing');
  const panel = document.getElementById('mobile-now-queue');
  const lyricsPanel = document.getElementById('mobile-now-lyrics');
  if (panel) { panel.hidden = !state.mobileQueueOpen; const content = panel.querySelector('#mobile-now-queue-content'); if (content) content.innerHTML = mobileQueueMarkup(); }
  if (lyricsPanel) lyricsPanel.hidden = true;
  root?.classList.toggle('show-queue', state.mobileQueueOpen);
  root?.classList.remove('show-lyrics');
  btn.setAttribute('aria-pressed', String(state.mobileQueueOpen));
  const lyricBtn = document.getElementById('mobile-lyrics-toggle'); if (lyricBtn) lyricBtn.setAttribute('aria-pressed', 'false');
});
document.addEventListener('click', e => {
  const row = e.target.closest?.('[data-mobile-queue-jump]'); if (!row) return;
  e.preventDefault();
  const p = state.player; if (!p || p.kind !== 'song') return;
  const idx = Number(row.dataset.mobileQueueJump);
  playAction(() => playSong(p.order[idx], p.queue, { order: p.order, pos: idx }));
});

function goBack() { window.history.back(); }
function goForward() { window.history.forward(); }
function albumArt(song, size = 'tile') {
  const path = song?.cover_path || song?.album?.cover_path, url = path && state.coverUrls?.[path];
  return url ? `<img class="real-cover ${size}" src="${escapeHtml(url)}" alt="" loading="lazy">` : `<span class="placeholder-art ${size}" style="background:${grad(song?.song_id || 0)}" aria-hidden="true">${icon('music')}</span>`;
}
function icon(name) { const paths = { pin: '<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" fill="currentColor"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', list: '<path d="M4 6h16M4 12h16M4 18h16"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>', shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>', repeat1: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="M11 10.5l1.5-1V15" stroke-width="1.5"/>', queue: '<path d="M3 6h13M3 11h13M3 16h7"/><path d="m15 14 6 3.5-6 3.5z" fill="currentColor"/>', mute: '<path d="M3 9v6h4l5 4V5L7 9zM16 9l5 6m0-6-5 6"/>', download: '<path d="M12 3v13m-5-5 5 5 5-5M4 21h16"/>', home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>', search: '<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/>', library: '<path d="M5 4v16M10 4v16M15 7l6 12"/>', music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>', plus: '<path d="M12 5v14M5 12h14"/>', play: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>', pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>', next: '<path d="m5 5 11 7-11 7zM19 5v14"/>', prev: '<path d="m19 5-11 7 11 7zM5 5v14"/>', heart: '<path d="M20.8 5.6c-2.5-2.5-5.8-1.8-8.8 1.1-3-2.9-6.3-3.6-8.8-1.1-2.5 2.6-1.4 5.6.6 7.8L12 21l8.2-7.6c2-2.2 3.1-5.2.6-7.8z"/>', mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M8 21h8"/>', album: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>', back: '<path d="m14 5-7 7 7 7"/>', forward: '<path d="m10 5 7 7-7 7"/>', bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>', moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>', lyrics: '<path d="M3 7h10M3 12h7M3 17h7"/><circle cx="16.5" cy="17" r="2.5"/><path d="M19 17V6l3 1.5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>', check: '<path d="m4 12 5 5L20 6"/>', dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', close: '<path d="M5 5 19 19M19 5 5 19"/>', users: '<circle cx="9" cy="8" r="3"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M16 6a3 3 0 0 1 0 6m2 2c3 1 4 3 4 6"/>', shield: '<path d="m12 2 9 4v6c0 6-5 9-9 10-4-1-9-4-9-10V6z"/><path d="m8 12 3 3 5-6"/>', chevron: '<path d="m8 10 4 4 4-4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>', flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>', volume: '<path d="M3 9v6h4l5 4V5L7 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>' }; return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true">${paths[name] || paths.music}</svg>`; }
function quickTile(label, meta, body, target, kind = 'album', number = 0, attrs = '') {
  const route = target.startsWith('playlist:') ? `data-openplaylist="${target.split(':')[1]}"` : target.startsWith('artist:') ? `data-open-artist="${target.split(':')[1]}"` : target.startsWith('show:') ? `data-open-show="${target.split(':')[1]}"` : `data-nav="${target}"`;
  const inner = kind === 'artist' ? esc(label[0] || 'A') : icon(kind === 'podcast' ? 'mic' : kind === 'liked' ? 'heart' : kind === 'album' ? 'album' : 'music');
  return `<div class="quick-tile" role="link" tabindex="0" ${route} ${attrs} data-tint="${kind === 'liked' ? '#3a4658' : tintFor(number)}"><span class="tile-cover ${kind}" ${kind === 'liked' ? '' : `style="background:${grad(number)}"`}>${inner}</span><span class="tile-copy"><strong>${esc(label)}</strong><small>${esc(meta)}</small></span>${body || ''}</div>`;
}
function listeningShelf() {
  const f = state.uiFilter || 'all', tiles = [];
  if (f !== 'podcasts') {
    if (state.likesAvailable) {
      const liked = state.liked.map((x) => songById(x.song_id)).filter(Boolean);
      tiles.push(quickTile('Liked Songs', `${state.liked.length} ${state.liked.length === 1 ? 'song' : 'songs'}`, liked.length ? `<button type="button" class="hover-play small" data-play="${liked[0].song_id}" aria-label="Play Liked Songs">${icon('play')}</button>` : '', 'liked-songs', 'liked', 0, liked.length ? `data-queue="${ids(liked).join(',')}"` : ''));
    }
    state.playlists.slice(0, 3).forEach((p, i) => tiles.push(quickTile(p.playlist_name, 'Playlist', '', 'playlist:' + p.playlist_id, 'album', i + 1)));
    state.artists.filter((a) => state.favorites.some((x) => x.artist_id === a.artist_id)).slice(0, 3).forEach((a, i) => {
      const songs = songsByArtist(a.artist_id);
      tiles.push(quickTile(a.artist_name, 'Artist', songs.length ? `<button type="button" class="hover-play small" data-play="${songs[0].song_id}" aria-label="Play ${esc(a.artist_name)}">${icon('play')}</button>` : '', 'artist:' + a.artist_id, 'artist', i + 4, songs.length ? `data-queue="${ids(songs).join(',')}"` : ''));
    });
  }
  if (f !== 'music') state.podcasts.slice(0, f === 'podcasts' ? 8 : 2).forEach((p, i) => tiles.push(quickTile(p.show_title, 'Podcast', '', 'show:' + p.show_id, 'podcast', i + 6)));
  const picks = tiles.slice(0, 8);
  return `<div class="quick-grid">${picks.length ? picks.join('') : `${quickTile('Your library', 'Start your first playlist', '', 'playlists', 'album', 0)}${quickTile('Search', 'Explore the catalog', '', 'music', 'album', 1)}${quickTile('Podcasts', 'Find a show', '', 'podcasts', 'podcast', 2)}`}</div>`;
}
function artTile(song) {
  const album = song.album ? albumById(song.album.album_id) : null;
  const q = (album ? ids(album.songs) : [song.song_id]).join(',');
  return `<article class="release-tile card-link" tabindex="0" role="link" ${song.album ? `data-open-album="${song.album.album_id}"` : ''} data-queue="${q}"><span class="release-art">${albumArt(song, 'large')}<button type="button" class="hover-play" data-play="${song.song_id}" aria-label="Play ${esc(song.song_title)}">${icon('play')}</button></span><strong>${esc(song.song_title)}</strong><small>${esc(song.album?.artist?.artist_name || 'SoundWave artist')}</small></article>`;
}
function menu() {
  const items = [['discover', 'home', 'Discover'], ['charts', 'chart', 'Charts'], ['music', 'search', 'Search'], ['playlists', 'library', 'Your library'], ['artists', 'heart', 'Artists'], ['podcasts', 'mic', 'Podcasts'], ['podcast-studio', 'upload', 'Podcast Studio'], ['history', 'clock', 'Recently played'], ['plans', 'users', 'Premium']];
  if (hasArtistAccess()) items.push(['studio', 'upload', 'Artist Studio']);
  if (hasAdminAccess()) { items.push(['song-streams', 'chart', 'Song streams']); items.push(['admin', 'shield', 'Moderation']); items.push(['song-reports', 'flag', 'Song reports']); }
  return items;
}
function pageAllowed(page) {
  if (['artist-dashboard', 'studio'].includes(page)) return hasArtistAccess();
  if (['admin-dashboard', 'admin', 'song-streams', 'song-reports'].includes(page)) return hasAdminAccess();
  return true;
}

/* One plain-language sentence under each page title so first-time users know what the page is for. */
const PAGE_HINTS = {
  music: 'Search and browse every song, album and artist on SoundWave.',
  artists: 'Find artists and follow the ones you like. Their new releases show up in your Wave.',
  'liked-artists': 'The artists you follow. Open one to see their albums and songs.',
  followers: 'People who follow you on SoundWave.',
  notifications: 'Follows, new releases, account and Premium updates, and announcements.',
  crowdqueue: 'Listen together with friends and vote on the shared queue in real-time.',
  'song-reports': 'Review reported songs, AI assessments and moderation decisions.',
  playlists: 'Your playlists and saved music. Create a playlist to start collecting songs.',
  podcasts: 'Browse podcast shows and episodes, and pick up where you left off.',
  history: 'Songs you played recently, newest first.',
  downloads: 'Music saved on this device so you can listen offline.',
  charts: 'What listeners are playing most on SoundWave right now.',
  plans: 'Compare plans and manage your subscription.',
  profile: 'Your account details and how other people see you.'
};
function pageHint(desc) { return (desc && String(desc).trim()) || PAGE_HINTS[state.page] || ''; }

function shell(content, title, desc) {
  const display = state.profile?.display_name || state.user?.email?.split('@')[0] || 'Listener';
  const role = hasAdminAccess() ? (hasArtistAccess() ? 'Artist + Admin' : 'Admin') : hasArtistAccess() ? 'Artist' : 'Listener';
  const prevMain = document.getElementById('main-content'), key = pageToHash();
  const keep = prevMain && shell.lastKey === key ? prevMain.scrollTop : 0; shell.lastKey = key;
  const tint = state.tint || '#202522'; state.tint = null;
  const roleKey = hasAdminAccess() ? (hasArtistAccess() ? 'artist-admin' : 'admin') : hasArtistAccess() ? 'artist' : 'listener';
  document.body.dataset.role = roleKey;
  const roleMenuItems = ''; // Role dashboards remain available from the home logo and mobile dock.
  const mobileDashboard = hasAdminAccess() ? ['admin-dashboard', 'shield', 'Admin'] : hasArtistAccess() ? ['artist-dashboard', 'upload', 'Artist'] : ['discover', 'home', 'Discover'];
  const homeTarget = primaryDashboard();
  const homeLabel = hasAdminAccess() ? 'Admin Dashboard' : hasArtistAccess() ? 'Artist Dashboard' : 'Discover';
  const premiumMenuBadge = isPremiumUser() ? `<span class="mini-premium-chip">${icon('check')} Premium</span>` : '';
  const profileMenu = `<div class="profile-menu" id="profile-menu" hidden><div class="profile-menu-head"><div class="profile-menu-user"><strong>${esc(display)}</strong><small>${esc(role)}</small></div>${premiumMenuBadge}</div><span class="profile-menu-sep" aria-hidden="true"></span><button data-nav="profile">${icon('users')} Profile</button><button data-nav="${followNav()}">${icon('users')} ${followLabel()}</button><button data-nav="crowdqueue">${icon('queue')} CrowdQueue</button><button data-nav="podcast-studio">${icon('mic')} Podcast Studio</button><button data-nav="plans">${icon('check')} ${isPremiumUser() ? 'Manage Premium' : 'Upgrade to Premium'}</button>${isPremiumUser() ? `<button data-nav="downloads">${icon('download')} Downloads</button>` : ''}<button data-nav="history">${icon('clock')} Recently played</button><button type="button" id="profile-shortcuts">${icon('settings')} Keyboard shortcuts</button><span class="profile-menu-sep" aria-hidden="true"></span><button id="profile-signout">${icon('forward')} Log out</button></div>`;
  $('#app').innerHTML = `<div class="app-top"><div class="app-top-left"><button type="button" class="top-logo home-btn" data-nav="${homeTarget}" aria-label="Open ${homeLabel}">${icon('home')}</button><button type="button" class="history-btn top-listen-icon" data-nav="discover" aria-label="Listen: open Discover music" title="Listen">${icon('music')}</button><button type="button" class="history-btn" id="nav-back" aria-label="Go back" ${state.hist.i > 0 ? '' : 'disabled'}>${icon('back')}</button><button type="button" class="history-btn" id="nav-forward" aria-label="Go forward" ${state.hist.i < state.hist.max ? '' : 'disabled'}>${icon('forward')}</button>${searchFieldHtml('global-search', 'global-search', 'What do you want to play?', 'Search SoundWave')}</div><div class="top-actions">${themeToggleHtml()}${notifBellHtml()}<span class="role-badge">${esc(role)}</span><div class="profile-wrap"><button type="button" class="avatar top-avatar ${isPremiumUser() ? 'premium-user' : ''}" id="profile-toggle" aria-label="Open profile menu" title="${esc(display)}">${state.profilePhotoUrl ? `<img src="${esc(state.profilePhotoUrl)}" alt="${esc(display)}">` : esc(display[0]?.toUpperCase() || 'S')}</button>${profileMenu}</div></div></div>
<div class="workspace"><aside class="sidebar ${state.libraryExpanded ? '' : 'library-collapsed'}" aria-label="Your library"><div class="library-head"><button type="button" class="library-toggle" id="library-toggle" aria-expanded="${state.libraryExpanded}" title="${state.libraryExpanded ? 'Collapse' : 'Expand'} your library">${icon('library')}<span>Your Library</span></button><button type="button" class="library-create-btn" data-create-playlist aria-label="Create playlist" title="Create playlist">${icon('plus')}</button></div>${crowdQueueLibraryCardHtml()}<div class="library-tools" id="library-tools">${libraryToolsHtml()}</div><div class="library-filter-shell"><div class="library-filter-row" id="library-filters">${libraryChips()}</div><button type="button" class="library-filter-arrow" id="library-filter-arrow" aria-label="Scroll library filters right" title="Scroll filters right">${icon('forward')}</button></div><div class="library-scroll" id="library-list">${libraryListHtml()}</div></aside>
<main class="main" id="main-content" style="--tint:${tint}"><div class="dashboard-content"><div class="page-intro"><h1 class="page-title">${esc(title)}</h1>${(title && pageHint(desc)) ? `<p class="page-hint">${esc(pageHint(desc))}</p>` : ''}</div><div class="page-body">${content}</div></div></main>
<aside class="context-rail" id="context-rail" aria-label="Now playing">${railHtml()}</aside></div>
<nav class="mobile-dock" aria-label="Mobile navigation">${[mobileDashboard, ['music', 'search', 'Search'], ['playlists', 'library', 'Library'], ['podcasts', 'mic', 'Podcasts'], ['profile', 'users', 'You']].map(([id, ico, label]) => `<button type="button" data-nav="${id}" class="${state.page === id ? 'active' : ''}">${icon(ico)}<small>${label}</small></button>`).join('')}</nav>
${addToPlaylistDialog()}`;
  const main = document.getElementById('main-content'); if (keep) main.scrollTop = keep;
  bindShared(); bindMusic(); bindRail(); bindLibrary(); renderIdlePlayer();
  // Rebuild karaoke after any necessary shell redraw (for example, saved
  // preferences or other library changes), rather than leaving an empty page.
  if (state.karaokeMode && state.player?.kind === 'song') void syncKaraokePanel(); else void reconcileKaraokeAudio();
  const g = $('#global-search');
  if (g) {
    g.addEventListener('input', () => setSearch(g.value, g));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { rememberSearch(g.value); if (karaokeViewOpen()) renderKaraokeSearchOverlay(); else if (state.page !== 'music' && g.value.trim()) navigate('music'); } });
  }
  document.querySelectorAll('[data-clear-search]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById(btn.dataset.clearSearch);
    if (!input) return;
    state.searchQuery = '';
    closeKaraokeSearchOverlay();
    document.querySelectorAll('#global-search,#page-search').forEach((el) => { el.value = ''; });
    if (state.page === 'music') renderSearchResults();
    else render();
    requestAnimationFrame(() => document.getElementById(btn.dataset.clearSearch)?.focus());
  }));
  if (state.focusSearch) { const el = document.getElementById(state.focusSearch); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch { } } state.focusSearch = null; }
  $('#library-toggle')?.addEventListener('click', () => {
    state.libraryExpanded = !state.libraryExpanded;
    // Collapse the library without recreating the entire app shell. Recreating
    // #main-content discards the currently displayed karaoke lyrics.
    const sidebar = document.querySelector('.workspace > .sidebar');
    if (!sidebar) { render(); return; }
    sidebar.classList.toggle('library-collapsed', !state.libraryExpanded);
    const toggle = document.getElementById('library-toggle');
    toggle?.setAttribute('aria-expanded', String(state.libraryExpanded));
    if (toggle) toggle.title = `${state.libraryExpanded ? 'Collapse' : 'Expand'} your library`;
  });
  $('#nav-back')?.addEventListener('click', goBack); $('#nav-forward')?.addEventListener('click', goForward);
  $('#profile-shortcuts')?.addEventListener('click', () => { const m = $('#profile-menu'); if (m) m.hidden = true; openShortcutsDialog(); });
  $('#profile-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); closeBellPanel(); const m = $('#profile-menu'); m.hidden = !m.hidden; });
  $('#bell-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); toggleBellPanel(); });
  $('#theme-toggle')?.addEventListener('click', () => applyTheme(currentTheme() === 'light' ? 'dark' : 'light'));
  $('#profile-signout')?.addEventListener('click', () => action(async () => { await stopAudio(); cleanupSessionRuntime(); document.getElementById('soundwave-player')?.remove(); check(await db.auth.signOut()); }));
  bindSongMenus();
  bindNotifications();
}
function grad(i = 0) { return ['linear-gradient(135deg,#6564aa,#3a8069)', 'linear-gradient(135deg,#97734b,#527e5b)', 'linear-gradient(135deg,#5e6e87,#9a6c6d)', 'linear-gradient(135deg,#2f7b77,#a4a45f)'][Number(i) % 4] }
function bindShared() {
  bindContent(document);
  document.querySelectorAll('[data-create-playlist]').forEach((b) => b.onclick = () => action(quickCreatePlaylist));
  const libraryFilters = $('#library-filters'), libraryFilterArrow = $('#library-filter-arrow');
  if (libraryFilters && libraryFilterArrow) {
    // The arrow reveals clipped chips. It never selects or changes a filter.
    const pills = () => [...libraryFilters.querySelectorAll('.filter-pill')];
    const updateArrow = () => {
      const max = Math.max(0, libraryFilters.scrollWidth - libraryFilters.clientWidth);
      const atEnd = libraryFilters.scrollLeft >= max - 3;
      libraryFilterArrow.hidden = max < 3;
      libraryFilterArrow.disabled = max < 3;
      libraryFilterArrow.classList.toggle('at-end', atEnd);
      libraryFilterArrow.setAttribute('aria-label', atEnd ? 'Reveal hidden filters on the left' : 'Reveal hidden filters on the right');
      libraryFilterArrow.title = atEnd ? 'Reveal previous hidden filters' : 'Reveal next hidden filters';
    };
    libraryFilterArrow.addEventListener('click', (event) => {
      event.preventDefault(); event.stopPropagation();
      const max = Math.max(0, libraryFilters.scrollWidth - libraryFilters.clientWidth);
      if (max < 3) return;
      const atEnd = libraryFilters.scrollLeft >= max - 3;
      const row = libraryFilters.getBoundingClientRect();
      const items = pills();
      const margin = 5;
      let delta = 0;
      if (atEnd) {
        const clipped = [...items].reverse().find(el => el.getBoundingClientRect().left < row.left - margin);
        if (clipped) delta = clipped.getBoundingClientRect().left - row.left - margin;
        else delta = -Math.min(libraryFilters.clientWidth * .8, libraryFilters.scrollLeft);
      } else {
        const clipped = items.find(el => el.getBoundingClientRect().right > row.right + margin);
        if (clipped) delta = clipped.getBoundingClientRect().right - row.right + margin;
        else delta = Math.min(libraryFilters.clientWidth * .8, max - libraryFilters.scrollLeft);
      }
      libraryFilters.scrollBy({ left: delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      window.setTimeout(updateArrow, 300);
    });
    libraryFilters.addEventListener('scroll', updateArrow, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateArrow);
      observer.observe(libraryFilters);
    }
    requestAnimationFrame(updateArrow);
  }
  document.querySelectorAll('[data-open-modal]').forEach((b) => b.onclick = () => { const d = document.getElementById(b.dataset.openModal); if (!d) return; dialogOpeners.set(d, b); d.showModal(); });
  document.querySelectorAll('[data-close-modal]').forEach((b) => b.onclick = () => b.closest('dialog')?.close()); document.querySelectorAll('dialog').forEach(d => { if (d.dataset.focusReturnBound) return; d.dataset.focusReturnBound = '1'; d.addEventListener('close', () => dialogOpeners.get(d)?.focus()); });
  document.querySelectorAll('[data-switch-modal]').forEach((b) => b.onclick = () => { b.closest('dialog')?.close(); document.getElementById(b.dataset.switchModal)?.showModal(); });
  document.querySelectorAll('dialog.sw-modal').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
  $('#signout')?.addEventListener('click', () => action(async () => { await stopAudio(); cleanupSessionRuntime(); document.getElementById('soundwave-player')?.remove(); check(await db.auth.signOut()); }));
  $('#refresh')?.addEventListener('click', () => action(async () => { await loadData(); render(); toast('Library refreshed'); }));
  document.querySelectorAll('[data-open-add]').forEach((b) => b.onclick = () => openAddToPlaylist(Number(b.dataset.openAdd)));
}
// Binds navigation-style controls inside a container (used for the page, the search results and the right rail).
function bindContent(root = document) {
  bindReleaseAlerts(root);
  root.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => { if (b.classList.contains('active') && b.closest('.home-chips')) return; navigate(b.dataset.nav); });
  root.querySelectorAll('[data-admin-target]').forEach((b) => { if (b.closest('.admin-overview')) return; b.onclick = () => { state.adminTab = b.dataset.adminTarget || 'accounts'; state.adminView = 'moderation'; navigate('admin'); }; });
  root.querySelectorAll('[data-openplaylist]').forEach((b) => b.onclick = () => openPlaylist(b.dataset.openplaylist));
  root.querySelectorAll('[data-open-show]').forEach((b) => b.onclick = () => openShow(b.dataset.openShow));
  root.querySelectorAll('[data-open-artist]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigate('artist-detail', { selectedArtist: Number(b.dataset.openArtist) }); });
  // Bind follower rows directly on every render; do not depend on bubbling document clicks.
  root.querySelectorAll('[data-open-follower]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); void openFollowerPublicProfile(b.dataset.openFollower, b.dataset.followerName).catch(err => { console.warn('Follower navigation failed', err); toast('Could not open this profile. Please try again.', true); }); });
  root.querySelectorAll('[data-unfollow-listener]').forEach(b => b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    const uid = b.dataset.unfollowListener;
    if (!uid || !state.user) return;
    action(async () => {
      check(await db.from('user_follow').delete().eq('follower_user_id', state.user.id).eq('followed_user_id', uid));
      state.following = (state.following || []).filter(r => String(r.followed_user_id) !== uid);
      state.personFollowing?.delete(uid);
      render(); toast('Unfollowed');
    });
  });
  root.querySelectorAll('[data-open-album]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigate('album-detail', { selectedAlbum: Number(b.dataset.openAlbum) }); });
  root.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { state.uiFilter = b.dataset.filter; render(); });
  root.querySelectorAll('[data-discover-filter]').forEach((b) => b.onclick = () => { state.discoverFilter = b.dataset.discoverFilter || 'all'; render(); });
  root.querySelectorAll('[data-discover-showall]').forEach((b) => b.onclick = () => {
    const key = b.dataset.discoverShowall;
    state.discoverExpanded[key] = !state.discoverExpanded[key];
    render();
  });
  root.querySelectorAll('.quick-tile[data-tint]').forEach((t) => {
    const main = document.getElementById('main-content');
    t.addEventListener('mouseenter', () => main?.style.setProperty('--tint', t.dataset.tint));
    t.addEventListener('mouseleave', () => main?.style.setProperty('--tint', '#2d2d3d'));
  });
}
function playerRoot() { let el = document.getElementById('soundwave-player'); if (!el) { el = document.createElement('div'); el.id = 'soundwave-player'; document.body.appendChild(el) } return el }
function syncIdleLayout() { document.body.classList.toggle('is-idle', !state.player); }
function renderIdlePlayer() {
  syncIdleLayout();
  const existing = document.getElementById('soundwave-player');
  // Do not mount an empty player. The app shell expands to the viewport while idle.
  if (!state.user || !state.player) { existing?.remove(); return; }
}
function playerBarHtml(d) {
  const idle = !d, podcast = d?.kind === 'podcast', dis = idle ? 'disabled' : '';
  const song = d?.kind === 'song' ? songById(d.id) : null;
  const artistId = song?.album?.artist?.artist_id;
  const vol = prefs.muted ? 0 : Math.round(prefs.volume * 100);
  const thumb = idle ? icon('music') : podcast ? icon('mic') : albumArt(song, 'tiny');
  const fullArt = podcast ? `<span class="mobile-now-placeholder">${icon('mic')}</span>` : albumArt(song, 'large');
  const contextLabel = podcast ? 'Playing podcast' : 'Now playing';
  const mobileQuickActions = !idle && !podcast ? `<div class="mobile-now-actions"><button type="button" id="mobile-queue-toggle" class="mobile-now-icon-action" aria-pressed="${Boolean(state.mobileQueueOpen)}" aria-label="Open queue">${icon('queue')}<span class="sr-only">Queue</span></button><button type="button" id="mobile-lyrics-toggle" class="mobile-now-icon-action" aria-pressed="${Boolean(state.mobileLyricsOpen)}" aria-label="Open lyrics">${icon('music')}<span class="sr-only">Lyrics</span></button>${playerToolButtons(false, 'mobile-now-icon-action', 'mobile')}</div>` : '';
  const mobileQueuePanel = !idle && !podcast ? `<section class="mobile-now-queue" id="mobile-now-queue" hidden><div class="mobile-now-sheet-head"><h3>Queue</h3></div><div id="mobile-now-queue-content">${mobileQueueMarkup()}</div></section>` : '';
  return `<div class="custom-playbar ${idle ? 'idle-playbar' : ''}">
 <div class="player-song"><div class="mobile-now-open" id="mobile-now-open" role="button" tabindex="0" aria-label="Open now playing details"><span class="player-thumb ${idle ? 'idle-thumb' : ''}">${thumb}</span><span class="player-song-text"><strong>${esc(d?.title || 'SoundWave')}</strong><small>${idle ? 'Choose something to play' : artistId ? `<a href="#/artist-detail/${artistId}" data-open-artist="${artistId}">${esc(d.artist)}</a>` : esc(d.artist)}${song ? moodPillsHtml(song, 2) : ''}</small></span></div>${song ? heartBtn(song.song_id, 'player-heart') : ''}</div>
 <div class="player-center"><div class="play-controls">
  ${podcast ? '' : `<button type="button" id="sw-shuffle" class="icon-quiet mode ${prefs.shuffle ? 'active' : ''}" aria-pressed="${prefs.shuffle}" aria-label="Shuffle" title="Shuffle" ${dis}>${icon('shuffle')}</button>`}
  <button type="button" id="sw-prev" class="icon-quiet" aria-label="${podcast ? 'Back 15 seconds' : 'Previous song'}" title="${podcast ? 'Back 15 seconds' : 'Previous'}" ${dis}>${podcast ? '<span class="skip-15">−15</span>' : icon('prev')}</button>
  <span class="mini-visualizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span><button type="button" id="sw-toggle" class="player-main-play" aria-label="${idle ? 'Play' : 'Pause'}" ${dis}>${icon(idle ? 'play' : 'pause')}</button>
  <button type="button" id="sw-next" class="icon-quiet" aria-label="${podcast ? 'Forward 15 seconds' : 'Next song'}" title="${podcast ? 'Forward 15 seconds' : 'Next'}" ${dis}>${podcast ? '<span class="skip-15">+15</span>' : icon('next')}</button>
  ${podcast ? '' : `<button type="button" id="sw-repeat" class="icon-quiet mode ${prefs.repeat !== 'off' ? 'active' : ''}" data-mode="${prefs.repeat}" aria-label="Repeat: ${prefs.repeat}" title="Repeat" ${dis}>${icon(prefs.repeat === 'one' ? 'repeat1' : 'repeat')}</button>`}
 </div><div class="player-timeline"><span id="sw-elapsed">0:00</span><input id="sw-seek" type="range" min="0" max="1000" value="0" style="--pct:0%" aria-label="Seek position" ${dis}><span id="sw-total">${nice(d?.duration || 0)}</span></div></div>
 <div class="player-right">${!idle && !podcast ? `<button type="button" class="icon-quiet" data-karaoke-toggle="karaoke" aria-label="Lyrics and karaoke" aria-pressed="${Boolean(state.karaokeMode)}" title="Lyrics &amp; karaoke (Y)">${icon('mic')}</button>` : ''}${idle ? '' : playerToolButtons(podcast, 'icon-quiet', 'sw')}<button type="button" id="sw-queue" class="icon-quiet ${(state.railTab === 'queue' || state.railTab === 'crowdqueue') && !prefs.railHidden ? 'active' : ''} ${crowdQueue?.session?.status === 'active' ? 'has-cq-session' : ''}" aria-label="Queue" title="Queue">${icon('queue')}${crowdQueue?.session?.status === 'active' ? '<span class="cq-dot-badge"></span>' : ''}</button><button type="button" id="sw-mute" class="icon-quiet" aria-label="Mute" title="Mute">${icon(vol === 0 ? 'mute' : 'volume')}</button><input id="sw-volume" type="range" min="0" max="100" value="${vol}" style="--pct:${vol}%" aria-label="Volume"></div>
 ${idle ? '' : `<audio id="sw-audio" preload="metadata" src="${esc(d.url)}"></audio><section class="mobile-now-playing" id="mobile-now-playing" aria-hidden="true"><div class="mobile-now-bg" aria-hidden="true"></div><section class="mobile-now-lyrics" id="mobile-now-lyrics" hidden><div class="mobile-now-sheet-head"><h3>Lyrics</h3></div><div class="lyrics-size-bar">${lyricsSizeControlsHtml()}</div><div id="mobile-now-lyrics-content">Loading lyrics…</div></section>${mobileQueuePanel}<div class="mobile-now-head"><button type="button" id="mobile-now-close" class="mobile-now-icon" aria-label="Close now playing">${icon('back')}</button><strong>${contextLabel}</strong><span class="mobile-now-spacer" aria-hidden="true"></span></div><div class="mobile-now-art">${fullArt}</div><div class="mobile-now-copy"><div><h2>${esc(d.title)}</h2><p>${esc(d.artist)}</p></div>${song ? heartBtn(song.song_id, 'mobile-now-heart') + `<button type="button" class="mobile-now-icon mobile-now-report" data-report-song="${song.song_id}" aria-label="Report song">${icon('flag')}</button>` : ''}</div><div class="mobile-now-progress"><input id="mobile-now-seek" type="range" min="0" max="1000" value="0" aria-label="Seek position"><div><span id="mobile-now-elapsed">0:00</span><span id="mobile-now-total">${nice(d.duration || 0)}</span></div></div><div class="mobile-now-controls"><button type="button" id="mobile-now-prev" aria-label="${podcast ? 'Back 15 seconds' : 'Previous song'}">${podcast ? '<span class="skip-15">−15</span>' : icon('prev')}</button><button type="button" id="mobile-now-toggle" class="mobile-now-play" aria-label="Pause">${icon('pause')}</button><button type="button" id="mobile-now-next" aria-label="${podcast ? 'Forward 15 seconds' : 'Next song'}">${podcast ? '<span class="skip-15">+15</span>' : icon('next')}</button></div>${mobileQuickActions}${podcast ? `<div class="mobile-now-actions mobile-now-tools">${playerToolButtons(true, 'mobile-now-icon-action', 'mobile')}</div>` : ''}</section>`}</div>`;
}
async function stopAudio() {
  const audio = document.getElementById('sw-audio');
  if (audio) {
    const duration = Number(audio.duration) || Number(state.player?.duration) || 0;
    const finished = audio.ended || (duration > 0 && Number(audio.currentTime || 0) >= Math.max(0, duration - 1));
    try { await saveListening(finished); } catch (e) { console.warn('Could not persist playback before closing the player:', e); }
    audio.pause();
    if (audio.src?.startsWith('blob:')) URL.revokeObjectURL(audio.src);
  }
  clearSleepTimer(); state.player = null; state.playerToken++; state.karaokeMode = false; document.body.classList.remove('karaoke-mode', 'mobile-player-open');
  document.title = 'SoundWave | Music for every moment';
  try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = null; } catch { }
  const root = document.getElementById('soundwave-player');
  if (!state.user) { root?.remove(); return; }
  renderIdlePlayer(); refreshRail(); markPlaying();
}
function buildPlayback(songId, queueIds, opts = {}) {
  const id = Number(songId);
  const queue = (queueIds && queueIds.length ? queueIds : ids(state.songs)).map(Number);
  if (!queue.includes(id)) queue.unshift(id);
  let order = opts.order, pos = opts.pos;
  if (!order) {
    if (prefs.shuffle) { order = [id, ...shuffled(queue.filter((x) => x !== id))]; pos = 0; }
    else { order = [...queue]; pos = order.indexOf(id); }
  }
  return { queue, order, pos };
}
// Instant feedback: the song list highlights the chosen song immediately, instead of waiting for the
// audio link to come back from the server. Also clears the old click-selection so two rows never look active.
function showSongPending(id) {
  document.querySelectorAll('.track[data-song]').forEach((r) => {
    if (r.closest('.history-tracks')) return;
    const on = Number(r.dataset.song) === Number(id);
    r.classList.remove('selected', 'paused'); r.classList.toggle('playing', on);
    const b = r.querySelector('.t-play'); if (b) b.innerHTML = icon(on ? 'pause' : 'play');
  });
}
async function playSong(songId, queueIds = null, opts = {}) {
  const cur = state.player, audio = document.getElementById('sw-audio');
  const toggling = !opts.order && cur?.kind === 'song' && Number(cur.id) === Number(songId) && audio;
  if (!toggling) showSongPending(songId);
  try { return await playSongNow(songId, queueIds, opts); }
  catch (e) { markPlaying(); throw e; } // restore the real state if playback could not start
}
// The server hides restricted songs and refuses to sign their audio. Treat those failures as "unavailable", not as a bug.
function isSongUnavailableError(e) { if (!navigator.onLine) return false; return /object not found|not found|denied|unauthori[sz]ed|forbidden|row-level|policy|\b40[34]\b/i.test(String(e?.message || e?.error || e || '')); }
function dropUnavailableSong(id) {
  state.songs = state.songs.filter((x) => Number(x.song_id) !== Number(id));
  const p = state.player; if (p?.kind === 'song') { p.queue = p.queue.filter((x) => Number(x) !== Number(id)); p.order = p.order.filter((x) => Number(x) !== Number(id)); }
}
async function playSongNow(songId, queueIds = null, opts = {}) {
  await requirePlaybackAccess();
  const id = Number(songId);
  const cur = state.player, audio = document.getElementById('sw-audio');
  if (!opts.order && cur?.kind === 'song' && Number(cur.id) === id && audio) { if (audio.paused) await audio.play(); else audio.pause(); return; }
  const pb = buildPlayback(id, queueIds, opts);
  if (!navigator.onLine && state.offlineDownloads.some((x) => Number(x.songId) === id)) return playDownloaded(id, pb);
  const song = songById(id);
  if (!song) throw Error('This song is no longer available.');
  if (!song.audio_path) throw Error('This song has no playable audio uploaded yet.');
  const myRequest = state.playRequest = (state.playRequest || 0) + 1;
  let result;
  try { result = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 3600)); }
  catch (e) {
    if (myRequest !== state.playRequest) return;
    if (!isSongUnavailableError(e)) throw e;
    const p = state.player, idx = Number.isInteger(opts.pos) ? opts.pos : -1;
    dropUnavailableSong(id);
    if (opts.fromSkip && p?.kind === 'song' && p.order.length && idx >= 0) {   // keep the music going: skip the unavailable song
      const dir = opts.dir < 0 ? -1 : 1; let next = dir > 0 ? idx : idx - 1;
      if (next >= p.order.length) next = 0; if (next < 0) next = p.order.length - 1;
      toast('A song in your queue is unavailable, so it was skipped.');
      return playSongNow(p.order[next], p.queue, { order: p.order, pos: next, fromSkip: true, dir });
    }
    throw Error('This song is currently unavailable.');
  }
  if (myRequest !== state.playRequest) return; // a newer song was chosen while this one was loading
  let playUrl = result.signedUrl, karaokeTrack = 'original';
  if (state.karaokeMode && !state.lyricsOnly && state.karaokeVoice === 'instrumental') {
    try { const kp = await ensureKaraokeTrack(song.song_id); if (kp) { playUrl = check(await db.storage.from('song-audio').createSignedUrl(kp, 3600)).signedUrl; karaokeTrack = 'instrumental'; } } catch (e) { console.warn('Instrumental unavailable', e); }
    if (myRequest !== state.playRequest) return;
  }
  startPlayer({ kind: 'song', id: song.song_id, title: song.song_title, artist: song.album?.artist?.artist_name || 'SoundWave', url: playUrl, karaokeTrack, duration: song.duration_seconds, fromSkip: !!opts.fromSkip, ...pb });
}
function reorderQueue() {
  const p = state.player; if (!p || p.kind !== 'song') return;
  const cur = Number(p.id);
  if (prefs.shuffle) { p.order = [cur, ...shuffled(p.queue.filter((x) => x !== cur))]; p.pos = 0; }
  else { p.order = [...p.queue]; p.pos = Math.max(0, p.order.indexOf(cur)); }
}
function updateModeButtons() {
  const sh = $('#sw-shuffle'), rp = $('#sw-repeat');
  if (sh) { sh.classList.toggle('active', prefs.shuffle); sh.setAttribute('aria-pressed', String(prefs.shuffle)); }
  if (rp) { rp.classList.toggle('active', prefs.repeat !== 'off'); rp.dataset.mode = prefs.repeat; rp.setAttribute('aria-label', `Repeat: ${prefs.repeat}`); rp.innerHTML = icon(prefs.repeat === 'one' ? 'repeat1' : 'repeat'); }
  document.querySelectorAll('[data-toggle-shuffle]').forEach((b) => b.classList.toggle('active', prefs.shuffle));
}
function toggleShuffle() { prefs.shuffle = !prefs.shuffle; savePrefs(); reorderQueue(); updateModeButtons(); refreshRail(); }
function addToQueue(id) {
  id = Number(id);
  const p = state.player;
  if (!p || p.kind !== 'song') { playAction(() => playSong(id, [id])); return; }
  if (!p.queue.includes(id)) p.queue.push(id);
  p.order.splice(p.pos + 1, 0, id);
  refreshRail(); toast('Added to queue');
}

function relatedSongsAfterQueue(player) {
  const current = songById(player?.id);
  const genreId = Number(current?.genre_id || 0);
  const already = new Set((player?.queue || []).map(Number));
  let pool = (state.songs || []).filter(s => s?.is_active !== false && s.audio_path && !already.has(Number(s.song_id)) && (genreId ? Number(s.genre_id) === genreId : true));
  if (!pool.length) pool = (state.songs || []).filter(s => s?.is_active !== false && s.audio_path && !already.has(Number(s.song_id)));
  return shuffled(pool).slice(0, 20).map(s => Number(s.song_id));
}
async function continueWithRelatedSongs(player) {
  const related = relatedSongsAfterQueue(player);
  if (!related.length) return false;
  await playSong(related[0], related, { order: related, pos: 0, fromSkip: true });
  toast('Playing similar music');
  return true;
}
async function skip(dir, auto = false) {
  const p = state.player, audio = document.getElementById('sw-audio');
  if (!p || !audio) return;
  if (p.kind !== 'song') { audio.currentTime = Math.max(0, audio.currentTime + (dir > 0 ? 15 : -15)); return; }
  if (dir < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (auto && prefs.repeat === 'one') { audio.currentTime = 0; await audio.play().catch(() => { }); return; }
  let pos = p.pos + dir;
  if (pos >= p.order.length) {
    if (auto && prefs.repeat !== 'all') {
      if (await continueWithRelatedSongs(p)) return;
      audio.currentTime = 0; audio.pause(); return;
    }
    if (prefs.shuffle) p.order = shuffled(p.queue);
    pos = 0;
  }
  if (pos < 0) pos = p.order.length - 1;
  await playSong(p.order[pos], p.queue, { order: p.order, pos, fromSkip: true, dir });
}
function startPlayer(details) {
  const old = document.getElementById('sw-audio');
  if (old) { void saveListening(old.ended); old.pause(); if (old.src?.startsWith('blob:')) URL.revokeObjectURL(old.src); }
  const wasIdle = !state.player;
  if (details.kind !== 'song') { state.karaokeMode = false; document.body.classList.remove('karaoke-mode'); }
  state.player = details; const token = ++state.playerToken; syncIdleLayout();
  if (details.kind === 'song') persistPlayerSnapshot(details, details.resumeAt || 0);
  // Restored players are intentionally quiet: they rebuild the bottom bar after login
  // without opening the right rail or creating a new listening-history row.
  if (!details.restored) {
    if (wasIdle) state.railTab = 'now';
    if (wasIdle || !details.fromSkip) toggleRail(false);
  }
  playerRoot().innerHTML = playerBarHtml(details);
  const audio = $('#sw-audio'); audio.volume = prefs.muted ? 0 : prefs.volume;
  if (details.karaokeTrack === 'instrumental') audio.dataset.track = 'instrumental';
  audio.defaultPlaybackRate = audio.playbackRate = details.kind === 'podcast' ? prefs.podcastRate : 1;
  if (details.resumeAt > 5) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = details.resumeAt; } catch { } }, { once: true });
  bindPlayerBar(audio, details, token);
  refreshRail(); markPlaying(); updateMediaSession(details);
  document.title = `${details.title} · ${details.artist}`;
  if (details.autoplay !== false) audio.play().catch(() => { toast('Press Play to start audio.'); });
}
function bindPlayerBar(audio, details, token) {
  let seeking = false;
  audio.addEventListener('play', () => { void (async () => { if (!(await verifyAccountAccess({ silent: true }))) { audio.pause(); } })(); });
  const podcast = details.kind === 'podcast';
  const live = () => token === state.playerToken;
  const dur = () => (audio.duration > 0 && isFinite(audio.duration) ? audio.duration : Number(details.duration) || 0);
  const sync = () => {
    if (!live() || !$('#sw-toggle')) return;
    $('#sw-toggle').innerHTML = icon(audio.paused ? 'play' : 'pause');
    $('#sw-toggle').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
    const mt = $('#mobile-now-toggle'); if (mt) { mt.innerHTML = icon(audio.paused ? 'play' : 'pause'); mt.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause'); }
    $('#sw-total').textContent = nice(dur());
    if (!seeking) {
      const pct = dur() > 0 ? Math.min(1000, Math.floor((audio.currentTime / dur()) * 1000)) : 0;
      $('#sw-elapsed').textContent = nice(audio.currentTime);
      const sk = $('#sw-seek'); sk.value = String(pct); sk.style.setProperty('--pct', `${pct / 10}%`);
      const msk = $('#mobile-now-seek'); if (msk) { msk.value = String(pct); msk.style.setProperty('--pct', `${pct / 10}%`); }
      if ($('#mobile-now-elapsed')) $('#mobile-now-elapsed').textContent = nice(audio.currentTime);
      if ($('#mobile-now-total')) $('#mobile-now-total').textContent = nice(dur());
    }
    try { if ('mediaSession' in navigator && dur() > 0) navigator.mediaSession.setPositionState({ duration: dur(), position: Math.min(audio.currentTime, dur()), playbackRate: audio.playbackRate }); } catch { }
  };
  $('#sw-toggle').onclick = () => { if (audio.paused) audio.play().catch((e) => toast(humanErr(e), true)); else audio.pause(); };
  $('#mobile-now-open')?.addEventListener('click', (e) => { if (e.target.closest('.heart-btn') || e.target.closest('a') || e.target.closest('.mood-pill')) return; const panel = $('#mobile-now-playing'); if (panel) { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); panel.classList.toggle('show-lyrics', Boolean(state.mobileLyricsOpen)); panel.classList.toggle('show-queue', Boolean(state.mobileQueueOpen)); document.body.classList.add('mobile-player-open'); const lp = $('#mobile-now-lyrics'); if (lp) lp.hidden = !state.mobileLyricsOpen; const qp = $('#mobile-now-queue'); if (qp) qp.hidden = !state.mobileQueueOpen; } });
  $('#mobile-now-open')?.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); $('#mobile-now-open').click(); } });
  $('#mobile-now-close')?.addEventListener('click', () => { const panel = $('#mobile-now-playing'); if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); panel.classList.remove('show-lyrics', 'show-queue'); document.body.classList.remove('mobile-player-open'); } state.mobileLyricsOpen = false; state.mobileQueueOpen = false; const lp = $('#mobile-now-lyrics'); if (lp) lp.hidden = true; const qp = $('#mobile-now-queue'); if (qp) qp.hidden = true; });
  $('#mobile-now-toggle')?.addEventListener('click', () => { if (audio.paused) audio.play().catch((e) => toast(humanErr(e), true)); else audio.pause(); });
  $('#mobile-now-prev')?.addEventListener('click', () => action(() => skip(-1)));
  $('#mobile-now-next')?.addEventListener('click', () => action(() => skip(1)));
  const mobileSeek = $('#mobile-now-seek'); if (mobileSeek) { mobileSeek.oninput = (e) => { seeking = true; const v = Number(e.target.value); e.target.style.setProperty('--pct', `${v / 10}%`); if ($('#mobile-now-elapsed')) $('#mobile-now-elapsed').textContent = nice((dur() * v) / 1000) }; mobileSeek.onchange = (e) => { if (dur() > 0) audio.currentTime = (dur() * Number(e.target.value)) / 1000; seeking = false; sync(); }; }
  $('#sw-prev').onclick = () => action(() => skip(-1));
  $('#sw-next').onclick = () => action(() => skip(1));
  $('#sw-shuffle')?.addEventListener('click', toggleShuffle);
  $('#sw-repeat')?.addEventListener('click', () => { prefs.repeat = { off: 'all', all: 'one', one: 'off' }[prefs.repeat]; savePrefs(); updateModeButtons(); toast(prefs.repeat === 'off' ? 'Repeat off' : prefs.repeat === 'all' ? 'Repeating the queue' : 'Repeating this song'); });
  const seek = $('#sw-seek');
  seek.oninput = (e) => { seeking = true; const v = Number(e.target.value); e.target.style.setProperty('--pct', `${v / 10}%`); $('#sw-elapsed').textContent = nice((dur() * v) / 1000); };
  seek.onchange = (e) => { if (dur() > 0) audio.currentTime = (dur() * Number(e.target.value)) / 1000; seeking = false; sync(); };
  const vol = $('#sw-volume');
  const paintVol = () => { const v = prefs.muted ? 0 : Math.round(prefs.volume * 100); vol.value = String(v); vol.style.setProperty('--pct', `${v}%`); $('#sw-mute').innerHTML = icon(v === 0 ? 'mute' : 'volume'); audio.volume = v / 100; };
  vol.oninput = (e) => { prefs.volume = Number(e.target.value) / 100; prefs.muted = prefs.volume === 0; savePrefs(); paintVol(); };
  $('#sw-mute').onclick = () => { prefs.muted = !prefs.muted; if (!prefs.muted && prefs.volume === 0) prefs.volume = .5; savePrefs(); paintVol(); };
  $('#sw-queue').onclick = () => {
    const inCq = Boolean(crowdQueue.session && crowdQueue.session.status === 'active');
    const isShowing = !prefs.railHidden && (state.railTab === 'queue' || (inCq && state.railTab === 'crowdqueue'));
    state.railTab = isShowing ? 'now' : (inCq ? 'crowdqueue' : 'queue');
    if (prefs.railHidden) toggleRail(false);
    refreshRail();
  };
  const swView = $('#sw-view'); if (swView) swView.onclick = () => { toggleRail(); swView.classList.toggle('active', !prefs.railHidden); refreshRail(); };
  audio.addEventListener('timeupdate', () => {
    sync();
    updateLyricsHighlight();
    if (!live()) return;
    const seconds = Math.floor(Number(audio.currentTime) || 0);
    if (seconds >= 5 && (!details.checkpointAt || seconds - details.checkpointAt >= 10)) {
      details.checkpointAt = seconds;
      void saveListening(false);
    }
  }); audio.addEventListener('loadedmetadata', sync); audio.addEventListener('durationchange', sync);
  audio.onplay = () => { sync(); markPlaying(); if (live()) details.createPromise = createListening(); };
  audio.onpause = () => { sync(); markPlaying(); if (live()) void saveListening(false); };
  audio.onended = () => {
    sync(); markPlaying();
    const cqLive = Boolean(crowdQueue.session && crowdQueue.session.status === 'active' && details.kind === 'song');
    if (cqLive && live()) {
      // In a CrowdQueue room the host's queue decides what plays next; listeners simply wait for the host.
      action(async () => { await saveListening(true); if (sleepAfterTrack()) return; if (crowdQueue.session?.is_host) await hostPlayNextInCrowdQueue({ auto: true }); }, { quiet: true });
      return;
    }
    if (live()) action(async () => { await saveListening(true); if (sleepAfterTrack()) return; if (details.kind === 'song') await skip(1, true); });
  };
  audio.onerror = async () => {
    if (audio.dataset.track === 'instrumental' && live() && details.kind === 'song') { state.karaokeVoice = 'original'; toast('The karaoke track could not be played. Switched to the original.', true); updateKaraokeVoiceUi(); void reconcileKaraokeAudio(); return; }
    if (!live() || details.retried || details.offline || details.kind !== 'song') { if (live()) toast('This track could not be played.', true); return; }
    details.retried = true;
    try { const song = songById(details.id); const r = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 3600)); const t = audio.currentTime; audio.src = r.signedUrl; audio.currentTime = t; await audio.play(); } catch (e) { toast(humanErr(e), true); }
  };
}
function markPlaying() {
  const p = state.player, audio = document.getElementById('sw-audio'), playing = !!(audio && !audio.paused);
  document.querySelectorAll('.track[data-song]').forEach((r) => {
    if (r.closest('.history-tracks')) { r.classList.remove('playing', 'paused'); const b = r.querySelector('.t-play'); if (b) b.innerHTML = icon('play'); return; }
    const on = p?.kind === 'song' && Number(r.dataset.song) === Number(p.id);
    r.classList.toggle('playing', on); r.classList.toggle('paused', on && !playing);
    const b = r.querySelector('.t-play'); if (b) b.innerHTML = icon(on && playing ? 'pause' : 'play');
  });
}
function updateMediaSession(d) {
  if (!('mediaSession' in navigator)) return;
  try {
    const song = d.kind === 'song' ? songById(d.id) : null;
    const art = song?.album?.cover_path && state.coverUrls[song.album.cover_path];
    navigator.mediaSession.metadata = new MediaMetadata({ title: d.title, artist: d.artist, album: song?.album?.album_title || 'SoundWave', artwork: art ? [{ src: art, sizes: '512x512' }] : [] });
  } catch { }
}
function initMediaKeys() {
  if (!('mediaSession' in navigator)) return;
  const a = () => document.getElementById('sw-audio');
  const set = (n, f) => { try { navigator.mediaSession.setActionHandler(n, f); } catch { } };
  set('play', () => action(async () => { await requirePlaybackAccess(); await a()?.play(); })); set('pause', () => a()?.pause());
  set('previoustrack', () => action(() => skip(-1))); set('nexttrack', () => action(() => skip(1)));
  set('seekto', (e) => { if (a() && e.seekTime != null) a().currentTime = e.seekTime; });
}
/* ---------- Keyboard shortcuts (v86) ----------
   One global handler that drives the same controls the player buttons use. Press ? to see the list.
   Shortcuts never fire while typing in a field, while a dialog is open, or with Ctrl/Cmd/Alt held. */
const SHORTCUT_GROUPS = [
  ['Playback', [
    ['Space', 'Play or pause'],
    ['←|→', 'Seek back or forward 5 seconds (15 on podcasts)'],
    ['N|P', 'Next or previous'],
    ['Shift+↑|Shift+↓', 'Volume up or down'],
    ['M', 'Mute or unmute'],
    ['S', 'Shuffle on or off'],
    ['R', 'Repeat: off, all, one']
  ]],
  ['Around the app', [
    ['L', 'Like the current song'],
    ['Y', 'Lyrics on or off (then pick Karaoke)'],
    ['Q', 'Show or hide the queue'],
    ['/', 'Search'],
    ['?', 'Show this list']
  ]]
];
const shortcutKeysHtml = (keys) => keys.split('|').map((alt) => alt.split('+').map((k) => `<kbd>${esc(k)}</kbd>`).join('<span class="kbd-plus">+</span>')).join('<span class="kbd-or">or</span>');
let shortcutHudTimer = null;
function shortcutHud(text) {
  let hud = document.getElementById('shortcut-hud');
  if (!hud) { hud = document.createElement('div'); hud.id = 'shortcut-hud'; hud.className = 'shortcut-hud'; hud.setAttribute('role', 'status'); hud.setAttribute('aria-live', 'polite'); document.body.appendChild(hud); }
  hud.textContent = text; hud.classList.add('show');
  clearTimeout(shortcutHudTimer); shortcutHudTimer = setTimeout(() => hud.classList.remove('show'), 1100);
}
function closeShortcutsDialog() { const d = document.getElementById('shortcuts-dialog'); if (d) { try { d.close(); } catch { } d.remove(); } }
function openShortcutsDialog() {
  if (document.getElementById('shortcuts-dialog')) { closeShortcutsDialog(); return; }
  const d = document.createElement('dialog');
  d.id = 'shortcuts-dialog'; d.className = 'sw-modal shortcuts-dialog'; d.setAttribute('aria-labelledby', 'shortcuts-title');
  d.innerHTML = `<div class="modal-head"><div><span class="eyebrow">KEYBOARD</span><h2 id="shortcuts-title">Keyboard shortcuts</h2></div><button type="button" class="modal-close" data-shortcuts-close aria-label="Close keyboard shortcuts">${icon('close')}</button></div><div class="shortcuts-body">${SHORTCUT_GROUPS.map(([group, rows]) => `<section><h3>${esc(group)}</h3><dl>${rows.map(([keys, what]) => `<div><dt>${shortcutKeysHtml(keys)}</dt><dd>${esc(what)}</dd></div>`).join('')}</dl></section>`).join('')}</div><p class="shortcuts-note">Shortcuts pause while you are typing in a box or while a dialog is open.</p>`;
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-shortcuts-close]')) closeShortcutsDialog(); });
  document.body.appendChild(d);
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  d.querySelector('[data-shortcuts-close]')?.focus();
}
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (!state.user) return;
  const t = e.target;
  if (t?.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"]')) return;
  const dialogOpen = document.querySelector('dialog[open]');
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (dialogOpen) { if (key === '?' && dialogOpen.id === 'shortcuts-dialog') { e.preventDefault(); closeShortcutsDialog(); } return; }
  if (document.getElementById('player-pop')) return;   // the speed / sleep menu has its own keys
  const onControl = !!t?.closest?.('button,a,summary,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="option"]');
  const audio = document.getElementById('sw-audio'), p = state.player;
  const playing = !!(audio && p && (p.kind === 'song' || p.kind === 'podcast'));
  const isSong = playing && p.kind === 'song';
  const handled = () => e.preventDefault();

  if (key === '?') { handled(); openShortcutsDialog(); return; }
  if (key === '/') {
    handled();
    const box = document.querySelector('#global-search') || document.querySelector('#page-search');
    if (box) { box.focus(); box.select?.(); } else { navigate('music'); setTimeout(() => { const b = document.querySelector('#page-search,#global-search'); b?.focus(); }, 80); }
    return;
  }
  if (!playing) return;
  if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;

  switch (key) {
    case ' ': case 'Spacebar':
      if (onControl) return;                    // Space on a focused button should press that button
      handled();
      if (audio.paused) { audio.play().catch((err) => toast(humanErr(err), true)); shortcutHud('Play'); } else { audio.pause(); shortcutHud('Paused'); }
      return;
    case 'ArrowLeft': case 'ArrowRight': {
      if (e.shiftKey) return;
      const step = p.kind === 'podcast' ? 15 : 5, dir = key === 'ArrowRight' ? 1 : -1;
      const total = audio.duration > 0 && isFinite(audio.duration) ? audio.duration : (Number(p.duration) || 0);
      handled();
      audio.currentTime = Math.max(0, Math.min(total || Infinity, audio.currentTime + dir * step));
      shortcutHud(`${dir > 0 ? '+' : '−'}${step}s`);
      return;
    }
    case 'ArrowUp': case 'ArrowDown': {
      if (!e.shiftKey) return;                  // plain arrows keep scrolling the page
      handled();
      const vol = document.getElementById('sw-volume'); if (!vol) return;
      const now = prefs.muted ? 0 : Math.round(prefs.volume * 100), next = Math.max(0, Math.min(100, now + (key === 'ArrowUp' ? 5 : -5)));
      vol.value = String(next); vol.dispatchEvent(new Event('input', { bubbles: true }));
      shortcutHud(next === 0 ? 'Muted' : `Volume ${next}%`);
      return;
    }
    case 'n': handled(); action(() => skip(1)); shortcutHud('Next'); return;
    case 'p': handled(); action(() => skip(-1)); shortcutHud('Previous'); return;
    case 'm': {
      handled(); document.getElementById('sw-mute')?.click();
      shortcutHud(prefs.muted ? 'Muted' : `Volume ${Math.round(prefs.volume * 100)}%`); return;
    }
    case 's': if (!isSong) return; handled(); toggleShuffle(); shortcutHud(prefs.shuffle ? 'Shuffle on' : 'Shuffle off'); return;
    case 'r': {
      if (!isSong) return; handled(); document.getElementById('sw-repeat')?.click();
      shortcutHud(prefs.repeat === 'off' ? 'Repeat off' : prefs.repeat === 'all' ? 'Repeat all' : 'Repeat one'); return;
    }
    case 'l': if (!isSong) return; handled(); { const id = Number(p.id); const was = isLiked(id); void toggleLike(id); shortcutHud(was ? 'Removed from liked songs' : 'Added to liked songs'); } return;
    case 'k':
    case 'y': if (!isSong) return; handled(); document.querySelector('[data-karaoke-toggle]')?.click(); shortcutHud(state.karaokeMode ? 'Lyrics on' : 'Lyrics off'); return;
    case 'q': handled(); document.getElementById('sw-queue')?.click(); return;
  }
});

function isQualifiedStream(row) {
  const seconds = Number(row?.duration_played_seconds) || 0;
  return String(row?.completion_status || '').toLowerCase() === 'completed' || seconds >= 30;
}
function uniqueStreamRows(rows = []) {
  const seen = new Set();
  return rows.filter(r => { const key = r.stream_id != null ? `id:${r.stream_id}` : `${r.user_id || ''}:${r.song_id || ''}:${r.stream_date || ''}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
async function restoreLastSongPlayer() {
  if (!state.user || state.player || !db) return;
  const recent = (state.history || []).find(r => Number(r.song_id) && isQualifiedStream(r)) || (state.history || []).find(r => Number(r.song_id));
  const snapshot = readPlayerSnapshot();
  const targetSongId = Number(recent?.song_id || snapshot?.id || 0);
  if (!targetSongId) return;
  const song = songById(targetSongId);
  if (!song?.audio_path) return;
  try {
    const signed = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 3600));
    const pb = buildPlayback(song.song_id, ids(state.songs));
    const resumeAt = recent && String(recent.completion_status || '').toLowerCase() !== 'completed'
      ? Math.max(0, Number(recent.duration_played_seconds) || 0)
      : Math.max(0, Number(snapshot?.resumeAt) || 0);
    startPlayer({ kind: 'song', id: song.song_id, title: song.song_title, artist: song.album?.artist?.artist_name || 'SoundWave', url: signed.signedUrl, duration: song.duration_seconds, autoplay: false, restored: true, resumeAt, ...pb });
  } catch (e) { console.warn('Could not restore last played song:', e); }
}

async function createListening() {
  const p = state.player; if (!p || p.recorded || p.creating || !state.user) return;
  p.creating = true; p.historyEventId = p.historyEventId || crypto.randomUUID();
  const isPodcast = p.kind === 'podcast', table = isPodcast ? 'podcast_listening_history' : 'listening_history', idKey = isPodcast ? 'podcast_stream_id' : 'stream_id';
  const payload = isPodcast ? { user_id: state.user.id, episode_id: p.id, duration_played_seconds: 0, resume_position_seconds: 0, completion_status: 'Partial', device_type: 'Web', client_event_id: p.historyEventId } : { user_id: state.user.id, song_id: p.id, duration_played_seconds: 0, completion_status: 'Partial', device_type: 'Web', stream_quality: 'Standard', client_event_id: p.historyEventId };
  try {
    let insert = await db.from(table).insert(payload).select(idKey).maybeSingle();
    if (insert.error && String(insert.error.code) === '23505') insert = await db.from(table).select(idKey).eq('client_event_id', p.historyEventId).maybeSingle();
    const q = check(insert); if (!q?.[idKey]) throw Error('Listening history record could not be resolved.');
    p.historyId = q[idKey]; p.recorded = true; p.historyRetryNeeded = false; state.historyWriteError = '';
    const row = isPodcast ? { podcast_stream_id: p.historyId, user_id: state.user.id, episode_id: p.id, stream_date: new Date().toISOString(), duration_played_seconds: 0, resume_position_seconds: 0, completion_status: 'Partial' } : { stream_id: p.historyId, user_id: state.user.id, song_id: p.id, stream_date: new Date().toISOString(), duration_played_seconds: 0, completion_status: 'Partial' };
    const list = isPodcast ? state.podcastHistory : state.history; if (!list.some(x => Number(x[idKey]) === Number(p.historyId))) list.unshift(row);
    if (isPodcast) { state.episodeTitles[p.id] = p.title; schedulePodcastMetricsRefresh(); } else { scheduleStreamMetricsRefresh(); persistPlayerSnapshot(p, 0); }
    persistHistoryCache(); if (state.page === 'history') render();
  } catch (e) {
    console.warn('Listening-history write failed:', e); state.historyWriteError = humanErr(e); p.historyRetryNeeded = true; p.recorded = false;
    toast('Playback works, but history could not be recorded yet. SoundWave will retry.', true); if (state.page === 'history') render();
  } finally { p.creating = false; }
}
async function retryHistoryUpdate(table, key, id, payload, attempt = 1) {
  await new Promise(resolve => setTimeout(resolve, Math.min(8000, 1000 * 2 ** (attempt - 1))));
  const r = await db.from(table).update(payload).eq(key, id);
  if (r.error) { if (attempt < 3) return retryHistoryUpdate(table, key, id, payload, attempt + 1); console.warn('Playback history remained unsynced after retries:', r.error); return false; }
  const isPodcast = table === 'podcast_listening_history', list = isPodcast ? state.podcastHistory : state.history, row = list.find(x => Number(x[key]) === Number(id)); if (row) Object.assign(row, payload); persistHistoryCache(); return true;
}
async function saveListening(ended = false) {
  const p = state.player, audio = document.getElementById('sw-audio'); if (!p || !audio) return;
  if (!p.historyId && !p.creating) { p.createPromise = createListening(); await p.createPromise; } else if (p.createPromise) await p.createPromise;
  if (!p.historyId) return;
  const elapsed = Math.floor(Number(audio.currentTime) || 0), maximum = Number(p.duration) || Math.ceil(audio.duration) || elapsed, seconds = Math.min(elapsed, maximum);
  if (seconds === p.lastSaved && !ended) return;
  const isPodcast = p.kind === 'podcast', payload = { duration_played_seconds: seconds, completion_status: ended ? 'Completed' : seconds < 5 ? 'Skipped' : 'Partial' }; if (isPodcast) payload.resume_position_seconds = ended ? 0 : seconds;
  const table = isPodcast ? 'podcast_listening_history' : 'listening_history', key = isPodcast ? 'podcast_stream_id' : 'stream_id';
  const r = await db.from(table).update(payload).eq(key, p.historyId);
  if (r.error) { console.warn('Could not update playback history:', r.error); state.historyWriteError = humanErr(r.error); p.pendingHistoryPayload = { ...payload }; void retryHistoryUpdate(table, key, p.historyId, payload); return; }
  p.lastSaved = seconds; p.pendingHistoryPayload = null; state.historyWriteError = '';
  const list = isPodcast ? state.podcastHistory : state.history, row = list.find(x => Number(x[key]) === Number(p.historyId)); if (row) Object.assign(row, payload);
  if (!isPodcast) persistPlayerSnapshot(p, ended ? 0 : seconds); persistHistoryCache();
  if (isPodcast) { if (ended) await refreshPodcastStudioMetrics(); else schedulePodcastMetricsRefresh(); }
  else { if (ended) await refreshStreamMetrics(); else scheduleStreamMetricsRefresh(); }
}
let streamMetricsRefreshTimer = null;
let podcastMetricsRefreshTimer = null;
function schedulePodcastMetricsRefresh() {
  clearTimeout(podcastMetricsRefreshTimer);
  podcastMetricsRefreshTimer = setTimeout(() => { void refreshPodcastStudioMetrics(); }, 450);
}
function scheduleStreamMetricsRefresh() {
  clearTimeout(streamMetricsRefreshTimer);
  streamMetricsRefreshTimer = setTimeout(() => { void refreshStreamMetrics(); }, 450);
}
async function refreshPodcastStudioMetrics() {
  if (!state.user || !db) return;
  try {
    const ownShowIds = (state.myShows || []).map(x => Number(x.show_id)).filter(Boolean);
    if (!ownShowIds.length) { state.podcastStudioHistory = []; return; }
    let episodes = state.episodes.filter(ep => ownShowIds.includes(Number(ep.show_id)));
    if (!episodes.length) {
      const er = await db.from('podcast_episode').select('episode_id,show_id,episode_title,description,duration_seconds,audio_path,release_at,is_active').in('show_id', ownShowIds).order('release_at', { ascending: false });
      if (!er.error) { episodes = er.data || []; state.episodes = episodes; }
    }
    const episodeIds = episodes.map(x => Number(x.episode_id)).filter(Boolean);
    if (!episodeIds.length) { state.podcastStudioHistory = []; return; }
    // Page through the history (the API returns at most ~1000 rows per request) so large shows are not undercounted.
    const PAGE = 1000, MAX_ROWS = 20000, remoteRows = []; let remoteFailed = false;
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const pg = await db.from('podcast_listening_history').select('podcast_stream_id,user_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').in('episode_id', episodeIds).order('stream_date', { ascending: false }).order('podcast_stream_id', { ascending: false }).range(from, from + PAGE - 1);
      if (pg.error) { remoteFailed = !remoteRows.length; break; }
      const chunk = pg.data || []; remoteRows.push(...chunk);
      if (chunk.length < PAGE) break;
    }
    const remote = { error: remoteFailed ? true : null, data: remoteRows };
    const cached = readAllCachedPodcastHistories().filter(r => episodeIds.includes(Number(r.episode_id)));
    state.podcastStudioHistory = mergePodcastHistory(remote.error ? [] : (remote.data || []), cached);
    if (state.page === 'podcast-studio') render();
  } catch (e) { console.warn('Could not refresh Podcast Studio analytics:', e); }
}

// Resolve creator analytics labels from a permission-scoped database directory.
// The analytics stream rows contain user IDs, not public profile names.
const topListenerLabelCache = new Map();
let topListenerLabelRequest = null;
function analyticsListenerName(uid) {
  const p = topListenerLabelCache.get(String(uid)) || state.socialProfiles?.[String(uid)];
  if (p?.profile_visibility && String(p.profile_visibility).trim().toLowerCase() !== 'public') return 'Private listener';
  return p?.display_name?.trim() || p?.username?.trim() || 'Listener';
}
async function hydrateArtistTopListenerLabels() {
  if (!state.user || !state.artist || !db) return;
  const uid = String(state.user.id);
  const artistId = Number(state.artist.artist_id);
  const unresolved = [...new Set((state.artistTopListeners || []).map(x => String(x.uid)).filter(x => x && !topListenerLabelCache.has(x)))];
  if (!unresolved.length) return;
  if (topListenerLabelRequest) { await topListenerLabelRequest; return; }
  topListenerLabelRequest = (async () => {
    try {
      const { data, error } = await db.rpc('soundwave_my_top_listener_labels', { p_user_ids: unresolved });
      if (error) { console.warn('Top listener directory unavailable:', error.message); return; }
      for (const p of data || []) {
        const key = String(p.user_id);
        topListenerLabelCache.set(key, p);
        if (String(p.profile_visibility || '').toLowerCase() === 'public') state.socialProfiles[key] = { ...(state.socialProfiles[key] || {}), ...p };
      }
      for (const key of unresolved) if (!topListenerLabelCache.has(key)) topListenerLabelCache.set(key, { profile_visibility: 'private' });
      if (!state.user || String(state.user.id) !== uid || Number(state.artist?.artist_id) !== artistId) return;
      state.artistTopListeners = (state.artistTopListeners || []).map(x => ({ ...x, name: analyticsListenerName(x.uid) }));
      if (['artist-dashboard', 'studio'].includes(state.page)) render();
    } catch (e) { console.warn('Top listener directory lookup failed:', e); }
  })();
  try { await topListenerLabelRequest; } finally { topListenerLabelRequest = null; }
}
async function refreshStreamMetrics() {
  if (!state.user || !db) return;
  try {
    const now = Date.now(), since90 = new Date(now - 90 * 86400000).toISOString(), since30 = new Date(now - 30 * 86400000).toISOString();
    const hist = await db.from('listening_history').select('stream_id,user_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id', state.user.id).gte('stream_date', since90).order('stream_date', { ascending: false }).limit(1500);
    if (!hist.error) {
      state.insightHistory = mergeStreamHistory(hist.data || [], readCachedHistory());
      state.listeningStats = computeListeningStats(state.insightHistory); state.personalTopSongs = rankedPersonalTopSongs(state.insightHistory);
      const weekCut = now - 7 * 86400000, counts = new Map();
      state.insightHistory.filter(r => new Date(r.stream_date).getTime() >= weekCut).forEach(r => counts.set(Number(r.song_id), (counts.get(Number(r.song_id)) || 0) + 1));
      state.topWeekSongs = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => songById(id)).filter(Boolean).slice(0, 20);
    }
    const ps = await db.rpc('profile_stats');
    if (!ps.error) state.profileStats = Array.isArray(ps.data) ? ps.data[0] : ps.data;
    if (state.artist && state.ownedSongs.length) {
      const [serverRows, ss, roy] = await Promise.all([
        loadArtistRows(),
        db.rpc('artist_studio_stats'),
        db.rpc('artist_royalty_summary')
      ]);
      // Creator analytics must use only the authoritative server RPC. Never merge
      // browser-local history here, otherwise desktop and mobile can disagree.
      const listeners = new Map(); state.artistThirtyDay.forEach(r => listeners.set(String(r.user_id), (listeners.get(String(r.user_id)) || 0) + 1));
      state.artistTopListeners = [...listeners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, count]) => ({ uid, count, name: analyticsListenerName(uid) })); void hydrateArtistTopListenerLabels();
      if (!ss.error) state.studioStats = Array.isArray(ss.data) ? ss.data[0] : ss.data;
      if (!roy.error) state.royaltySummary = Array.isArray(roy.data) ? roy.data[0] : roy.data;
    }
    if (hasAdminAccess()) {
      // Admin and Artist dashboards intentionally use the same 30-day qualified-stream
      // window so totals are directly comparable across roles and devices.
      await loadAdminRows();
    }
    if (['discover', 'listener-dashboard', 'artist-dashboard', 'studio', 'history', 'profile', 'admin', 'admin-dashboard'].includes(state.page)) backgroundRender();
  } catch (e) { console.warn('Could not refresh stream-dependent metrics:', e); }
}

// Shown after sign-up (and when someone tries to sign in before confirming): tells them to check their inbox, with a resend button.
function confirmView(email) {
  authView(false);
  const box = document.querySelector('.auth-box'); if (!box) return;
  box.innerHTML = `<div class="eyebrow">One more step</div><h2>Check your email</h2><p class="muted">We sent a confirmation link to <strong>${esc(email)}</strong>. Open it to activate your account, then sign in. It can take a minute, and may land in spam.</p><div class="form"><button type="button" class="button" id="resend-confirm">Resend confirmation email</button><button type="button" class="button secondary" id="back-to-login">Back to sign in</button></div><p class="footnote" id="resend-note"></p>`;
  $('#back-to-login').onclick = () => authView(false);
  let wait = 0, timer = null;
  $('#resend-confirm').onclick = () => action(async () => {
    if (wait > 0) return;
    check(await db.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } }));
    toast('Confirmation email sent again');
    const btn = $('#resend-confirm'); wait = 60; btn.disabled = true;
    timer = setInterval(() => { wait--; if (!document.body.contains(btn)) return clearInterval(timer); if (wait <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = 'Resend confirmation email'; } else btn.textContent = `Resend in ${wait}s`; }, 1000);
  });
}
const MAYA_RETURN_KEY = 'soundwave-pending-maya-return-v22';
function captureMayaReturn() {
  const params = new URLSearchParams(location.search);
  const result = params.get('maya');
  if (!result) return null;
  const payload = { result, reference: params.get('rrn') || sessionStorage.getItem('soundwave-maya-reference') || '', captured_at: Date.now() };
  try { sessionStorage.setItem(MAYA_RETURN_KEY, JSON.stringify(payload)); } catch { }
  params.delete('maya'); params.delete('rrn');
  sessionStorage.removeItem('soundwave-maya-reference');
  const query = params.toString();
  window.history.replaceState(window.history.state || {}, document.title, `${location.pathname}${query ? `?${query}` : ''}${location.hash || '#/plans'}`);
  return payload;
}
function pendingMayaReturn() {
  try { return JSON.parse(sessionStorage.getItem(MAYA_RETURN_KEY) || 'null'); } catch { return null; }
}
function clearPendingMayaReturn() { try { sessionStorage.removeItem(MAYA_RETURN_KEY); } catch { } }
function resolveMayaReturnFromActivePremium(message = 'Payment completed. Your Premium benefits are active.') {
  if (!isPremiumUser()) return false;
  clearPendingMayaReturn();
  state.mayaPaymentNotice = { type: 'success', message };
  return true;
}
async function edgeFunctionMessage(error) {
  try {
    const res = error?.context;
    if (res?.clone) { const body = await res.clone().json().catch(() => null); if (body?.error) return String(body.error); }
  } catch { }
  return error?.message || String(error || 'Unknown error');
}
function schedulePendingPaymentVerification(delay = 250) {
  if (!state.user || !pendingMayaReturn()) return;
  setTimeout(() => { processPendingMayaReturn().catch(e => console.warn('Maya verification deferred:', e)); }, delay);
}
async function processPendingMayaReturn() {
  if (!state.user || state.mayaReturnProcessing) return false;
  const pending = pendingMayaReturn(); if (!pending) return false;
  state.mayaReturnProcessing = true;
  try {
    state.page = 'plans';
    // The subscription table / entitlement is the final source of truth inside SoundWave.
    // If Premium is already active, a leftover Maya return token must never keep the UI
    // stuck in a pending state or trigger repeated confirmation calls after login.
    if (resolveMayaReturnFromActivePremium('Your payment has already been applied. Premium is active.')) {
      render();
      return true;
    }
    if (pending.result === 'cancelled') {
      state.mayaPaymentNotice = { type: 'info', message: 'Checkout was cancelled. No subscription was activated.' };
      clearPendingMayaReturn(); render(); return true;
    }
    if (pending.result !== 'success') {
      state.mayaPaymentNotice = { type: 'error', message: 'The payment was not completed. You can choose a plan and try again.' };
      clearPendingMayaReturn(); render(); return true;
    }
    if (!pending.reference) {
      state.mayaPaymentNotice = { type: 'error', message: 'The checkout returned without a payment reference. Your account is safe; start a new checkout when ready.' };
      clearPendingMayaReturn(); render(); return true;
    }
    state.mayaPaymentNotice = { type: 'pending', message: 'Confirming your payment… You can keep using SoundWave while verification finishes.' };
    render();
    const { data, error } = await db.functions.invoke('maya-confirm-payment', { body: { reference: pending.reference } });
    if (error) {
      // Confirmation may race with the webhook. Reload entitlement before showing a warning.
      try { await loadData(); } catch { }
      if (resolveMayaReturnFromActivePremium('Payment confirmed through your active subscription. Premium is ready.')) { render(); return true; }
      const msg = await edgeFunctionMessage(error);
      state.mayaPaymentNotice = { type: 'pending', message: `Payment verification is pending. Your account is still signed in. ${msg}` };
      render(); return true;
    }
    if (data?.pending) {
      try { await loadData(); } catch { }
      if (resolveMayaReturnFromActivePremium('Payment confirmed through your active subscription. Premium is ready.')) { render(); return true; }
      state.mayaPaymentNotice = { type: 'pending', message: data?.message || 'The payment is still being finalized. Retry verification in a moment.' };
      render(); return true;
    }
    if (data?.error) {
      try { await loadData(); } catch { }
      if (resolveMayaReturnFromActivePremium('Payment confirmed through your active subscription. Premium is ready.')) { render(); return true; }
      state.mayaPaymentNotice = { type: 'pending', message: `Payment verification is pending. ${data.error}` };
      render(); return true;
    }
    clearPendingMayaReturn();
    await loadData();
    state.page = 'plans';
    state.mayaPaymentNotice = { type: 'success', message: 'Payment verified. Your Premium benefits are now active.' };
    render();
    toast('Welcome to SoundWave Premium!');
    setTimeout(() => document.getElementById('premium-welcome-dialog')?.showModal(), 80);
    return true;
  } catch (e) {
    console.error('Maya return processing failed:', e);
    state.mayaPaymentNotice = { type: 'pending', message: `Payment verification could not finish yet. Your login remains active. ${await edgeFunctionMessage(e)}` };
    render(); return true;
  } finally { state.mayaReturnProcessing = false; }
}
async function acceptPendingSubscriptionInvite() {
  if (!state.user || state.subscriptionInviteProcessing) return false;
  const params = new URLSearchParams(location.search), token = params.get('subscription_invite');
  if (!token) return false;
  state.subscriptionInviteProcessing = true;
  try {
    const { data, error } = await db.rpc('accept_subscription_invite', { p_token: token });
    if (error) throw error;
    params.delete('subscription_invite'); const q = params.toString(); window.history.replaceState(window.history.state || {}, document.title, `${location.pathname}${q ? `?${q}` : ''}#/plans`);
    await loadData(); state.page = 'plans'; render(); toast('Premium plan invitation accepted.'); return true;
  } catch (e) { console.error(e); toast(`Could not accept subscription invite: ${e?.message || 'Please try again.'}`, true); return false; }
  finally { state.subscriptionInviteProcessing = false; }
}
async function finishInteractiveSignIn(session) {
  const user = session?.user;
  if (!user) throw Error('Sign-in succeeded but no session was returned. Please try again.');
  state.user = user;
  state.coverUrls = {};
  state.selectedPlaylist = null;
  state.routeReady = false;
  await loadData();
  await loadCompetitionData();
  await restoreLastSongPlayer();
  setupRealtime();
  bindCrossDeviceRefresh();
  state.playlistInviteHandled = false;
  await acceptPendingPlaylistInvite();
  state.page = defaultLanding();
  render();
  // Payment and subscription-invite callbacks are intentionally processed only
  // after the authenticated app is already rendered. They can never reject login.
  setTimeout(() => acceptPendingSubscriptionInvite(), 120);
  schedulePendingPaymentVerification(180);
}
async function checkArtistIdentityAvailability(displayName, artistName) {
  const { data, error } = await db.rpc('artist_identity_available_v31', { p_display_name: String(displayName || '').trim(), p_artist_name: String(artistName || '').trim() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { displayAvailable: row?.display_available !== false, artistAvailable: row?.artist_available !== false };
}
async function checkSongTitleAvailability(title, excludeSongId = null) {
  const { data, error } = await db.rpc('song_title_available_v31', { p_title: normalizedContentTitle(title), p_exclude_song_id: excludeSongId });
  if (error) throw error;
  return Boolean(Array.isArray(data) ? data[0] : data);
}
async function checkAlbumTitleAvailability(title, excludeAlbumId = null) {
  if (!state.artist?.artist_id) return true;
  const normalized = normalizedContentTitle(title).toLowerCase();
  const { data, error } = await db.from('album').select('album_id,album_title').eq('artist_id', state.artist.artist_id);
  if (error) throw error;
  return !(data || []).some((row) => Number(row.album_id) !== Number(excludeAlbumId || 0) && normalizedContentTitle(row.album_title).toLowerCase() === normalized);
}
async function checkShowTitleAvailability(title, excludeShowId = null) {
  if (!state.user?.id) return true;
  const normalized = normalizedContentTitle(title).toLowerCase();
  const { data, error } = await db.from('podcast_show').select('show_id,show_title').eq('user_id', state.user.id);
  if (error) throw error;
  return !(data || []).some((row) => Number(row.show_id) !== Number(excludeShowId || 0) && normalizedContentTitle(row.show_title).toLowerCase() === normalized);
}
function setFieldState(input, small, ok, message) {
  if (!input || !small) return;
  input.classList.toggle('field-invalid', ok === false);
  input.classList.toggle('field-valid', ok === true);
  small.className = `field-help availability ${ok === false ? 'bad' : ok === true ? 'good' : ''}`;
  small.textContent = message || '';
}
function authView(register = false) {
  document.getElementById('soundwave-player')?.remove();
  const emailOpen = register ? ' open' : '';
  $('#app').innerHTML = `<div class="auth-wrap auth-v28">
    <section class="auth-show">
      <div class="brand"><span class="brand-icon">♫</span> SoundWave</div>
      <div class="auth-mobile-hero-copy">
        <div class="eyebrow">YOUR SOUND. YOUR SPACE.</div>
        <h1>${register ? 'Create your SoundWave account.' : 'Everything sounds better together.'}</h1>
        <p class="muted">Music, podcasts, playlists and creator tools in one place.</p>
      </div>
      <div class="small auth-show-note">Listen. Create. Share.</div>
    </section>
    <section class="auth-panel">
      <div class="auth-box">
        <div class="auth-mobile-heading">
          <span class="eyebrow">SOUNDWAVE</span>
          <h2>Log in or sign up</h2>
          <p class="muted">Continue with Google or use your email.</p>
        </div>
        ${register ? `<fieldset class="oauth-role-choice" aria-label="Create an account as"><legend>Register as</legend><label><input type="radio" name="google-role" value="Listener" checked> Listener</label><label><input type="radio" name="google-role" value="Artist"> Artist</label></fieldset><div class="oauth-artist-name" id="oauth-artist-name-wrap" hidden><label for="oauth-artist-name">Artist name</label><input id="oauth-artist-name" maxlength="100" placeholder="Your stage name"><small class="field-help availability" id="artist-name-status"></small></div>` : ''}
        <button type="button" class="button secondary auth-google" id="auth-google"><span class="auth-google-mark">G</span><span>Continue with Google</span></button>
        <button type="button" class="button secondary auth-email-toggle" id="auth-email-toggle">${icon('forward')}<span>Use email instead</span></button>
        <div class="auth-email-shell${emailOpen}" id="auth-email-shell">
          <div class="auth-mode"><button class="button ${register ? 'secondary' : ''}" id="mode-login">Sign in</button><button class="button ${register ? '' : 'secondary'}" id="mode-register">Sign up</button></div>
          <form class="form" id="authform" novalidate>
            <div class="auth-form-alert" id="auth-form-alert" role="alert" hidden></div>
            ${register ? `<div class="field"><label>Display name</label><input id="display-name" required maxlength="90" placeholder="Alex Rivera"/><small class="field-help availability" id="display-name-status"></small></div>` : ''}
            <div class="field"><label>Email</label><input id="auth-email" type="email" autocomplete="email" required placeholder="you@example.com"/><small class="field-help auth-field-error" id="auth-email-error"></small></div>
            <div class="field"><label>Password</label><input id="auth-password" type="password" minlength="6" autocomplete="${register ? 'new-password' : 'current-password'}" required placeholder="At least 6 characters"/><small class="field-help auth-field-error" id="auth-password-error"></small></div>
            <button class="button auth-email-submit" data-busy>${register ? 'Create account' : 'Sign in'}</button>
          </form>
        </div>
        <p class="footnote auth-legal">By continuing, you agree to use SoundWave responsibly. Email confirmation may be required depending on your Supabase Auth settings.</p>
      </div>
    </section>
  </div>`;
  enhanceAuth();
  const shell = $('#auth-email-shell');
  const showAuthError = (message, field = '') => { const box = $('#auth-form-alert'); if (box) { box.textContent = message || ''; box.hidden = !message; } if (field === 'email') setFieldState($('#auth-email'), $('#auth-email-error'), false, message); if (field === 'password') setFieldState($('#auth-password'), $('#auth-password-error'), false, message); };
  const clearAuthErrors = () => { const box = $('#auth-form-alert'); if (box) { box.hidden = true; box.textContent = ''; } [$('#auth-email'), $('#auth-password')].forEach(el => el?.classList.remove('field-invalid', 'field-valid'));[$('#auth-email-error'), $('#auth-password-error')].forEach(el => { if (el) { el.textContent = ''; el.className = 'field-help auth-field-error'; } }); };
  $('#auth-email-toggle')?.addEventListener('click', () => {
    shell?.classList.toggle('open');
    if (shell?.classList.contains('open')) setTimeout(() => $('#auth-email')?.focus(), 80);
  });
  $('#mode-login').onclick = () => authView(false);
  $('#mode-register').onclick = () => authView(true);
  const registrationRole = () => document.querySelector('input[name="google-role"]:checked')?.value === 'Artist' ? 'Artist' : 'Listener';
  document.querySelectorAll('input[name="google-role"]').forEach(el => el.addEventListener('change', () => {
    const artist = registrationRole() === 'Artist';
    const wrap = $('#oauth-artist-name-wrap'); if (wrap) wrap.hidden = !artist;
    const input = $('#oauth-artist-name'); if (input) input.required = artist;
    if (artist) setTimeout(() => input?.focus(), 0);
  }));
  $('#auth-google')?.addEventListener('click', () => action(async () => {
    clearAuthErrors();
    const redirectTo = `${window.location.origin}/auth-callback.html`;
    const pendingParams = new URLSearchParams(location.search); const pendingInvite = { playlist_invite: pendingParams.get('playlist_invite'), subscription_invite: pendingParams.get('subscription_invite') }; if (pendingInvite.playlist_invite || pendingInvite.subscription_invite) sessionStorage.setItem('soundwave-pending-invite', JSON.stringify(pendingInvite));
    if (register) {
      const role = document.querySelector('input[name="google-role"]:checked')?.value === 'Artist' ? 'Artist' : 'Listener';
      const artistName = role === 'Artist' ? String($('#oauth-artist-name')?.value || '').trim() : '';
      if (role === 'Artist' && !artistName) { showAuthError('Enter your artist name before continuing with Google.'); return; }
      sessionStorage.setItem('soundwave-google-registration', JSON.stringify({ role, artistName }));
    } else sessionStorage.removeItem('soundwave-google-registration');
    sessionStorage.setItem('soundwave-oauth-return', 'google');
    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, scopes: 'openid email profile', queryParams: { prompt: 'select_account' }, skipBrowserRedirect: true }
    });
    if (error) { showAuthError(authErrorMessage(error) || humanErr(error)); throw error; }
    if (!data?.url) throw Error('Google did not return an authorization URL. Check the Google provider configuration in Supabase.');
    window.location.assign(data.url);
  }));

  if (register) {
    const validateIdentity = async () => { if (registrationRole() !== 'Artist') return true; const display = val('display-name'), artist = val('oauth-artist-name'); if (!display || !artist) return true; try { const r = await checkArtistIdentityAvailability(display, artist); setFieldState($('#display-name'), $('#display-name-status'), r.displayAvailable, r.displayAvailable ? 'Display name is available.' : 'That display name is already taken.'); setFieldState($('#oauth-artist-name'), $('#artist-name-status'), r.artistAvailable, r.artistAvailable ? 'Artist name is available.' : 'That artist name is already taken.'); return r.displayAvailable && r.artistAvailable; } catch (err) { console.warn('Name availability check failed', err); return true; } };
    $('#display-name')?.addEventListener('blur', validateIdentity); $('#oauth-artist-name')?.addEventListener('blur', validateIdentity);
  }
  $('#authform').onsubmit = e => {
    e.preventDefault(); action(async () => {
      clearAuthErrors();
      const email = val('auth-email'), password = $('#auth-password').value;
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) { showAuthError('Enter a valid email address.', 'email'); return; }
      if (!password) { showAuthError('Enter your password.', 'password'); return; }
      if (password.length < 6) { showAuthError('Password must contain at least 6 characters.', 'password'); return; }
      if (!register) {
        const r = await db.auth.signInWithPassword({ email, password });
        if (r.error) { if (/email_not_confirmed|not confirmed/i.test(`${r.error.code || ''} ${r.error.message || ''}`)) { confirmView(email); return; } const friendly = authErrorMessage(r.error) || humanErr(r.error); showAuthError(friendly, /invalid_credentials|password/i.test(`${r.error.code || ''} ${r.error.message || ''}`) ? 'password' : ''); return; }
        await finishInteractiveSignIn(r.data?.session); toast('Signed in'); return;
      }
      // The artist name box is #oauth-artist-name (it was wrongly read from a non-existent #artist-name, so every artist sign-up failed).
      const account_type = registrationRole(), display_name = val('display-name'), artist_name = account_type === 'Artist' ? (val('oauth-artist-name') || '') : null;
      const displayProblem = plainNameProblem(display_name, 'Display name', 90); if (displayProblem) { showAuthError(displayProblem); return; }
      if (account_type === 'Artist') {
        if (!artist_name) { showAuthError('Enter your artist name.'); $('#oauth-artist-name')?.focus(); return; }
        const artistProblem = plainNameProblem(artist_name, 'Artist name', 100); if (artistProblem) { showAuthError(artistProblem); $('#oauth-artist-name')?.focus(); return; }
        let available = null;
        try { available = await checkArtistIdentityAvailability(display_name, artist_name); }
        catch (err) { console.warn('Name availability check failed; continuing sign-up', err); }
        if (available && !available.displayAvailable) { showAuthError('That display name is already taken. Choose another one.'); return; }
        if (available && !available.artistAvailable) { showAuthError('That artist name is already taken. Choose another one.'); return; }
      }
      const signup = await db.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}`, data: { name: display_name, full_name: display_name, account_type, artist_name } } });
      if (signup.error) { showAuthError(authErrorMessage(signup.error) || humanErr(signup.error)); return; }
      const data = signup.data;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { toast('That email is already registered. Please sign in instead.', true); authView(false); return; }
      if (data.session) { toast('Registration complete'); await finishInteractiveSignIn(data.session); } else { confirmView(email); }
    });
  };
}
async function fetchAllPages(buildQuery, { pageSize = 500, maxRows = 5000 } = {}) {
  const rows = []; for (let from = 0; from < maxRows; from += pageSize) { const r = await buildQuery().range(from, from + pageSize - 1); if (r.error) return r; rows.push(...(r.data || [])); if ((r.data || []).length < pageSize) break; } return { data: rows, error: null };
}
async function loadData() {
  if (!state.user) return; const id = state.user.id; try { await db.rpc('publish_due_releases_v78'); } catch { } await probeMoodColumn(); await probeKaraokeTable(); const requests = [
    db.from('users').select('user_id,display_name,account_type,is_active,profile_photo_path').eq('user_id', id).maybeSingle(),
    db.from('artist').select('artist_id,user_id,artist_name,is_active,cover_path').eq('user_id', id).maybeSingle(),
    db.rpc('is_active_admin'),
    fetchAllPages(() => db.from('song').select('song_id,song_title,description,cover_path,genre_id,track_number,duration_seconds,audio_path,is_active' + moodColumnSql() + ',album:album_id(album_id,album_title,description,release_type,cover_path,release_date,is_active,artist:artist_id(artist_id,user_id,artist_name,is_active))').eq('is_active', true).order('song_id', { ascending: false })),
    fetchAllPages(() => db.from('artist').select('artist_id,user_id,artist_name,country,bio,is_active,cover_path').eq('is_active', true).order('artist_name')),
    db.from('favorite_artist').select('user_id,artist_id').eq('user_id', id),
    db.from('playlist').select('playlist_id,playlist_name,description,visibility,cover_path,is_active').eq('user_id', id).eq('is_active', true).order('playlist_id', { ascending: false }),
    db.from('genre').select('genre_id,genre_name').order('genre_name'),
    db.from('subscription_plan').select('plan_id,plan_name,monthly_price,max_members,is_active').eq('is_active', true),
    db.from('subscription').select('subscription_id,status,start_date,end_date,plan:plan_id(plan_name,max_members,monthly_price)').eq('user_id', id).order('subscription_id', { ascending: false }),
    fetchAllPages(() => db.from('podcast_show').select('show_id,user_id,show_title,category,description,cover_path,is_active').eq('is_active', true).order('show_id', { ascending: false })),
    fetchAllPages(() => db.from('podcast_show').select('show_id,user_id,show_title,category,description,cover_path,is_active').eq('user_id', id).order('show_id', { ascending: false })),
    db.from('listening_history').select('stream_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id', id).order('stream_date', { ascending: false }).limit(35),
    db.from('podcast_listening_history').select('podcast_stream_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').eq('user_id', id).order('stream_date', { ascending: false }).limit(30)
  ]; const result = await Promise.all(requests); const names = ['profile', 'artist', 'admin', 'songs', 'artists', 'favorites', 'playlists', 'genres', 'plans', 'subscriptions', 'podcasts', 'myShows', 'history', 'podcastHistory']; const requiredFailures = []; result.forEach((r, i) => { if (r.error) { console.warn(`Could not load ${names[i]}`, r.error); if (i === 2) { state.admin = false; } else if (i === 1) { state.artist = null; } else if (i === 0 || i === 3 || i === 7) { requiredFailures.push({ name: names[i], error: r.error }); } return; } state[names[i]] = r.data ?? ((i === 2) ? false : []); }); if (requiredFailures.length) { const first = requiredFailures[0]; const err = new Error(`Required SoundWave data could not load (${first.name}): ${first.error?.message || 'unknown error'}`); err.code = first.error?.code; throw err; }
  // Safety net: an account registered as an Artist that has no artist row yet (for example the sign-up trigger did not
  // create one) gets its profile now, so Artist Studio opens instead of failing right after registration.
  try {
    if (state.profile?.account_type === 'Artist' && !state.artist && !result[1]?.error) {
      const meta = state.user?.user_metadata || {};
      const name = String(meta.artist_name || state.profile.display_name || '').trim().slice(0, 100);
      if (name.length >= 2) {
        const added = await db.from('artist').insert({ user_id: id, artist_name: name, is_active: true }).select('artist_id,user_id,artist_name,is_active,cover_path').maybeSingle();
        if (added.error && !/23505|duplicate|already exists/i.test(String(added.error.message || added.error.code || ''))) console.warn('Could not create the artist profile automatically', added.error);
        else if (added.data) state.artist = added.data;
        else { const again = await db.from('artist').select('artist_id,user_id,artist_name,is_active,cover_path').eq('user_id', id).maybeSingle(); if (again.data) state.artist = again.data; }
      }
    }
  } catch (e) { console.warn('Artist profile safety net failed', e); }
  // Listener discovery uses an episode-backed publication gate, not the existence of a draft show row.
  // Fetch the active episode show IDs once; owners still see their drafts in Podcast Studio.
  const publicShowIds = (state.podcasts || []).map(p => Number(p.show_id)).filter(Boolean);
  if (publicShowIds.length) {
    const published = await fetchAllPages(() => db.from('podcast_episode').select('episode_id,show_id,release_at').in('show_id', publicShowIds).eq('is_active', true));
    if (!published.error) {
      const now = Date.now(), eligible = new Set((published.data || []).filter(e => !e.release_at || new Date(e.release_at).getTime() <= now).map(e => Number(e.show_id)));
      state.podcasts = state.podcasts.filter(p => eligible.has(Number(p.show_id)));
    } else console.warn('Unable to filter public podcast drafts', published.error);
  }
  // Draft artist profiles are not promoted to listener discovery without a published track.
  const visibleCreatorIds = new Set((state.songs || []).filter(song => song.is_active !== false && song.album?.is_active !== false).map(song => Number(song.album?.artist?.artist_id)));
  state.artists = (state.artists || []).filter(a => visibleCreatorIds.has(Number(a.artist_id)) || String(a.user_id) === String(state.user.id));
  state.history = mergeStreamHistory(state.history || [], readCachedHistory(id));
  state.podcastHistory = mergePodcastHistory(state.podcastHistory || [], readCachedPodcastHistory(id));
  state.episodeTitles = { ...readCachedEpisodeTitles(id), ...(state.episodeTitles || {}) };
  persistHistoryCache();
  // Only an explicitly classified Artist with an active matching profile receives Artist Studio access.
  // An orphan/stale artist row does not turn a Listener account into an Artist.
  if (!hasArtistAccess()) {
    if (state.profile?.account_type === 'Listener' && state.artist) {
      console.warn('Account mismatch: this Listener also has an artist row. Check public.users/account_type and public.artist.');
    }
    state.artist = null;
  }
  if (state.artist) { const r = await db.from('album').select('album_id,album_title,description,release_type,release_date,cover_path,is_active').eq('artist_id', state.artist.artist_id).order('album_id', { ascending: false }); state.albums = r.error ? [] : r.data; { const sc = await db.from('album').select('album_id,scheduled_at').eq('artist_id', state.artist.artist_id).not('scheduled_at', 'is', null); state.albumSchedule = sc.error ? {} : Object.fromEntries((sc.data || []).map(x => [Number(x.album_id), x.scheduled_at])); } const albumIds = state.albums.map(a => a.album_id); if (albumIds.length) { const sr = await db.from('song').select('song_id,album_id,genre_id,song_title,description,cover_path,duration_seconds,track_number,audio_path,is_active' + moodColumnSql()).in('album_id', albumIds).order('song_id', { ascending: false }); state.ownedSongs = sr.error ? [] : (sr.data || []).map(song => { const a = state.albums.find(x => Number(x.album_id) === Number(song.album_id)); return { ...song, album: a ? { ...a, artist: state.artist } : null }; }); } else state.ownedSongs = []; } else { state.albums = []; state.ownedSongs = []; } if (state.selectedPlaylist && !state.playlists.some(p => p.playlist_id === state.selectedPlaylist)) { state.selectedPlaylist = null; state.playlistSongs = []; }
  // Keep Podcast Studio statistics accurate even before a show is opened.
  // showDetail() may later replace state.episodes with one selected show's rows.
  const ownShowIdsForStudio = state.myShows.map(x => Number(x.show_id)).filter(Boolean);
  state.podcastStudioHistory = [];
  if (ownShowIdsForStudio.length) {
    const er = await db.from('podcast_episode').select('episode_id,show_id,episode_title,description,duration_seconds,audio_path,release_at,is_active').in('show_id', ownShowIdsForStudio).order('release_at', { ascending: false });
    if (!er.error) {
      state.episodes = er.data || [];
      const ownEpisodeIdsForStudio = state.episodes.map(x => Number(x.episode_id)).filter(Boolean);
      if (ownEpisodeIdsForStudio.length) {
        const ph = await db.from('podcast_listening_history').select('podcast_stream_id,user_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').in('episode_id', ownEpisodeIdsForStudio).order('stream_date', { ascending: false }).limit(3000);
        if (!ph.error) { const cached = readAllCachedPodcastHistories().filter(r => ownEpisodeIdsForStudio.includes(Number(r.episode_id))); state.podcastStudioHistory = mergePodcastHistory(ph.data || [], cached); } else { state.podcastStudioHistory = readAllCachedPodcastHistories().filter(r => ownEpisodeIdsForStudio.includes(Number(r.episode_id))); }
      }
    } else console.warn('Podcast Studio episodes unavailable', er.error);
  } else if (!state.selectedShow) { state.episodes = []; }

  // Load owned subscription members; no auth.users enumeration in the browser.
  state.subscriptionMembers = []; state.sharedMemberships = []; state.paymentRows = [];
  const shared = await db.from('subscription_member').select('subscription_id,user_id').eq('user_id', id); if (!shared.error) state.sharedMemberships = shared.data || []; else console.warn('Shared memberships unavailable', shared.error);
  const ids = state.subscriptions.map(x => x.subscription_id);
  if (ids.length) {
    const [m, p] = await Promise.all([db.from('subscription_member').select('subscription_id,user_id').in('subscription_id', ids), db.from('payment').select('subscription_id,payment_amount,payment_status,payment_date,payment_method').in('subscription_id', ids).order('payment_date', { ascending: false }).limit(15)]);
    if (!m.error) state.subscriptionMembers = m.data || []; else console.warn('Subscription members unavailable', m.error);
    if (!p.error) state.paymentRows = p.data || []; else console.warn('Payment history unavailable', p.error);
  }
  state.followers = []; state.following = []; state.ownFollowerNamesLoaded = false; state.ownFollowerNames = {};
  // RLS already limits social rows to relationships involving the signed-in user.
  // Select * so the frontend tolerates the two column-name variants that existed
  // across the SoundWave documentation and deployed schema.
  let social = await db.from('user_follow').select('*');
  if (social.error) {
    const fallback = await db.from('user_follower').select('*');
    if (!fallback.error) { social = fallback; state.socialSource = 'user_follower'; }
  }
  if (!social.error) {
    const normalized = (social.data || []).map(r => ({
      follower_user_id: r.follower_user_id || r.follower_id || r.user_id || null,
      followed_user_id: r.followed_user_id || r.followed_id || null,
      date_followed: r.date_followed || r.datefollowed || r.dateFollowed || null
    })).filter(r => r.follower_user_id && r.followed_user_id);
    state.followers = normalized.filter(r => String(r.followed_user_id) === String(id));
    state.following = normalized.filter(r => String(r.follower_user_id) === String(id));
  } else console.warn('Followers unavailable', social.error);
  // Artist followers (people who tapped Follow on an artist). Needs the RPCs in sql/RUN_ME_likes_and_followers.sql.
  state.artistFollowers = []; state.socialProfiles = {}; state.followerCounts = {}; state.socialRpc = { counts: false, mine: false, profiles: false };
  const [fcnt, fmine, fprof] = await Promise.all([db.rpc('get_artist_follower_counts'), state.artist ? db.rpc('get_my_artist_followers') : Promise.resolve({ data: [], error: null }), db.rpc('get_social_profiles')]);
  if (!fcnt.error) {
    // A successful count RPC is authoritative, including legitimate zero-follower artists.
    // Seed every visible artist at zero, then merge the totals returned by Supabase.
    const parsed = mergeFollowerCountsPayload(fcnt.data, {});
    const complete = {};
    (state.artists || []).forEach(a => { const aid = Number(a.artist_id); if (Number.isFinite(aid)) complete[aid] = 0; });
    Object.assign(complete, parsed);
    state.followerCounts = complete;
    state.socialRpc.counts = true;
    state.socialRpc.countSource = 'rpc';
  } else console.info('Follower-count RPC unavailable:', fcnt.error.message);
  // Safe fallback: only trust a direct favorite_artist aggregate when the session can
  // demonstrably see rows belonging to other users. This avoids displaying false 0s
  // when RLS exposes only the signed-in user's own favorite_artist rows.
  if (!state.socialRpc.counts) {
    const allFav = await db.from('favorite_artist').select('user_id,artist_id');
    if (!allFav.error) {
      const rows = allFav.data || [];
      const seesOtherUsers = rows.some(r => String(r.user_id) !== String(state.user.id));
      if (seesOtherUsers) {
        const counts = {};
        rows.forEach(r => { const id = Number(r.artist_id); if (Number.isFinite(id)) counts[id] = (counts[id] || 0) + 1; });
        state.followerCounts = counts;
        state.socialRpc.counts = true;
        state.socialRpc.countSource = 'favorite_artist';
      }
    }
  }
  if (!fmine.error) {
    state.socialRpc.mine = true;
    const mineRows = Array.isArray(fmine.data) ? fmine.data : (fmine.data ? [fmine.data] : []);
    state.artistFollowers = mineRows.map(r => ({
      ...r,
      follower_user_id: r.follower_user_id ?? r.user_id ?? r.follower_id ?? null,
      display_name: r.display_name ?? r.name ?? r.full_name ?? 'SoundWave listener',
      profile_photo_path: r.profile_photo_path ?? r.profile_photo_url ?? null
    })).filter(r => r.follower_user_id);
    // get_my_artist_followers is authoritative for the signed-in artist even when
    // global follower counts are hidden by RLS. Keep the artist's own profile accurate.
    if (state.artist?.artist_id != null) {
      state.followerCounts[Number(state.artist.artist_id)] = state.artistFollowers.length;
    }
  } else console.info('Artist followers unavailable:', fmine.error.message);
  if (!fprof.error) { state.socialRpc.profiles = true; (fprof.data || []).forEach(p => { state.socialProfiles[String(p.user_id)] = p; }); (state.artists || []).forEach(updateArtistArtwork); }
  state.artistFollowers.forEach(r => { if (r.display_name && !state.socialProfiles[String(r.follower_user_id)]) state.socialProfiles[String(r.follower_user_id)] = { user_id: r.follower_user_id, display_name: r.display_name }; });
  // Premium entitlement is primarily derived from the user's active subscription.
  // If the optional helper RPC is installed it also resolves Duo/Family members.
  state.entitlement = null;
  let ent = await db.rpc('soundwave_my_entitlement');
  if (ent.error) ent = await db.rpc('get_my_entitlement');
  if (!ent.error) { state.entitlement = Array.isArray(ent.data) ? ent.data[0] : ent.data; }
  else {
    const own = state.subscriptions.find(x => String(x.status).toLowerCase() === 'active');
    if (own) state.entitlement = { is_premium: true, plan_name: own.plan?.plan_name || 'Premium', subscription_id: own.subscription_id, plan_id: own.plan_id, relationship: 'Owner', owner_user_id: id };
  }
  if (state.entitlement?.subscription_id) {
    const memberRpc = await db.rpc('subscription_members_for_current_plan', { p_subscription_id: Number(state.entitlement.subscription_id) });
    if (!memberRpc.error && Array.isArray(memberRpc.data)) state.subscriptionMembers = memberRpc.data;
  }
  // Liked Songs: saved to your account; if the liked_song table is not installed yet, fall back to this device.
  const likedRes = await db.from('saved_song').select('song_id,date_saved').eq('user_id', id).order('date_saved', { ascending: false });
  state.likesAvailable = true;
  if (likedRes.error) { state.likesMode = 'local'; const local = readLocalLikes(); state.liked = local.map(x => ({ song_id: x, liked_at: null })); state.likedIds = new Set(local); console.info('saved_song table unavailable, saving likes on this device:', likedRes.error.message); }
  else { state.likesMode = 'remote'; state.liked = (likedRes.data || []).map(x => ({ ...x, liked_at: x.liked_at || x.date_saved || null })); state.likedIds = new Set(state.liked.map(x => Number(x.song_id))); await migrateLocalLikes(id); }
  state.offlineDownloads = await listOfflineDownloads(id);
  if (!isPremiumUser() && state.offlineDownloads.length) { await clearOfflineDownloads(id); state.offlineDownloads = []; }
  const newPaths = [...new Set([...state.songs.flatMap(x => [x.cover_path, x.album?.cover_path]), ...state.ownedSongs.map(x => x.cover_path), ...state.albums.map(x => x.cover_path)].filter(x => x && !state.coverUrls[x]))].slice(0, 220);
  if (newPaths.length) { const urls = await Promise.all(newPaths.map(async path => [path, await resolveCoverUrl(path)])); urls.forEach(([path, url]) => { if (url) state.coverUrls[path] = url; }); }
  void hydrateArtistCovers(state.artists);
  // Mission 4 feature append: use the newer helper RPCs when installed, but keep the original UI/data fallbacks.
  const [ps, ss, roy, ent2, adm, reqs, lib, social2, af2] = await Promise.all([
    db.rpc('profile_stats'),
    state.artist ? db.rpc('artist_studio_stats') : Promise.resolve({ data: null, error: null }),
    state.artist ? db.rpc('artist_royalty_summary') : Promise.resolve({ data: null, error: null }),
    db.rpc('soundwave_my_entitlement'),
    state.admin ? db.rpc('admin_moderation_data') : Promise.resolve({ data: null, error: null }),
    db.from('subscription_request').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    db.rpc('my_library_playlists'),
    db.rpc('social_connections'),
    state.artist ? db.rpc('artist_follower_list') : Promise.resolve({ data: [], error: null })
  ]);
  state.profileStats = !ps.error ? (Array.isArray(ps.data) ? ps.data[0] : ps.data) : null;
  state.studioStats = !ss.error ? (Array.isArray(ss.data) ? ss.data[0] : ss.data) : null;
  state.royaltySummary = !roy.error ? (Array.isArray(roy.data) ? roy.data[0] : roy.data) : null;
  if (!ent2.error) { const e = Array.isArray(ent2.data) ? ent2.data[0] : ent2.data; if (e) state.entitlement = { ...e, is_premium: String(e.status || '').toLowerCase() === 'active' && String(e.plan_name || '').toLowerCase() !== 'free' }; }
  state.adminData = !adm.error ? adm.data : null;
  if (state.admin) {
    let albumRows = await db.from('album').select('album_id,artist_id,album_title,cover_path,is_active,admin_locked');
    if (albumRows.error && /admin_locked|column/i.test(String(albumRows.error.message || ''))) {
      albumRows = await db.from('album').select('album_id,artist_id,album_title,cover_path,is_active');
    }
    state.adminAlbumLoadError = albumRows.error?.message || '';
    if (!albumRows.error) state.adminAllAlbums = albumRows.data || [];
    else { state.adminAllAlbums = []; console.error('Admin cannot read all albums:', albumRows.error); }
    // The public album SELECT policy may hide inactive rows. The guarded RPC
    // lists all releases only for administrators, including moderation-locked ones.
    const canonical = await db.rpc('soundwave_admin_list_all_albums');
    if (!canonical.error) { state.adminAllAlbums = canonical.data || []; state.adminAlbumLoadError = ''; }
    else if (!albumRows.error) { state.adminAlbumLoadError = 'Admin-only album-list RPC unavailable. Inactive albums may be hidden by RLS. Install admin_album_access.sql.'; }
  }

  state.adminUserIds = [];
  if (state.admin) { const ar = await db.rpc('admin_list_admin_user_ids'); if (!ar.error) state.adminUserIds = (Array.isArray(ar.data) ? ar.data : []).map(x => String(x.user_id ?? x)); else console.info('Admin list helper unavailable:', ar.error.message); }
  state.subscriptionRequests = reqs.error ? [] : (reqs.data || []);
  if (!lib.error && Array.isArray(lib.data)) state.playlists = lib.data;
  // The legacy social_connections RPC may report stale/mixed artist counts.
  // user_follow above remains authoritative for both incoming/outgoing relationships.
  if (!af2.error && Array.isArray(af2.data)) { state.artistFollowers = af2.data.map(x => ({ follower_user_id: x.user_id, display_name: x.display_name, profile_photo_path: x.profile_photo_path || x.profile_photo_url || null })); state.socialRpc.mine = true; }
  if (state.profile?.profile_photo_path) { const pr = db.storage.from('profile-images').getPublicUrl(state.profile.profile_photo_path); state.profilePhotoUrl = pr.data?.publicUrl || null; } else state.profilePhotoUrl = null;
  const extraCoverPaths = [...new Set([...state.playlists.map(x => x.cover_path), ...state.podcasts.map(x => x.cover_path), ...state.myShows.map(x => x.cover_path), ...state.artists.map(x => x.cover_path), state.artist?.cover_path].filter(x => x && !state.coverUrls[x]))].slice(0, 220);
  if (extraCoverPaths.length) { const urls = await Promise.all(extraCoverPaths.map(async path => [path, await resolveCoverUrl(path)])); urls.forEach(([path, url]) => { if (url) state.coverUrls[path] = url; }); }
  void ensurePlaylistSignal(true); void showDeactivationNotices(); void loadReleaseAlerts(); void loadPodcastLibrary();
}

function isPremiumUser() {
  const e = state.entitlement; if (e && (e.is_premium === true || String(e.is_premium) === 'true')) return true;
  return state.subscriptions.some(s => String(s.status).toLowerCase() === 'active' && !/^free$/i.test(s.plan?.plan_name || ''));
}
function hasDownloadedSong(songId) {
  return state.offlineDownloads.some((x) => Number(x.songId) === Number(songId));
}
function premiumAccountBadge(label = 'Premium') {
  return `<button type="button" class="premium-account-pill" data-nav="plans" aria-label="Open subscription">${icon('check')}<span>${esc(label)}</span></button>`;
}

const OFFLINE_DB = 'soundwave-offline-v1', OFFLINE_DB_VERSION = 3, OFFLINE_STORE = 'tracks', KEY_STORE = 'keys';
function requireOfflineCrypto() {
  if (!window.isSecureContext || !window.crypto || !window.crypto.subtle) {
    throw new Error('Encrypted offline downloads require HTTPS or localhost. On this computer open http://localhost:5173. For phones or other devices, deploy SoundWave over HTTPS before using Download.');
  }
  return window.crypto;
}
function openOfflineDb() { return new Promise((resolve, reject) => { const req = indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION); req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(OFFLINE_STORE)) d.createObjectStore(OFFLINE_STORE, { keyPath: 'key' }); if (!d.objectStoreNames.contains(KEY_STORE)) d.createObjectStore(KEY_STORE, { keyPath: 'userId' }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); req.onblocked = () => reject(new Error('SoundWave offline storage upgrade is blocked. Close other SoundWave tabs and try again.')); }); }
async function getOfflineKey(userId) { const c = requireOfflineCrypto(); const d = await openOfflineDb(); const existing = await new Promise((resolve, reject) => { const r = d.transaction(KEY_STORE).objectStore(KEY_STORE).get(userId); r.onsuccess = () => resolve(r.result?.cryptoKey || null); r.onerror = () => reject(r.error); }); if (existing) return existing; const cryptoKey = await c.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await new Promise((resolve, reject) => { const tx = d.transaction(KEY_STORE, 'readwrite'); tx.objectStore(KEY_STORE).put({ userId, cryptoKey }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); return cryptoKey; }
async function listOfflineDownloads(userId) { if (!('indexedDB' in window) || !userId) return []; try { const d = await openOfflineDb(); return await new Promise((resolve, reject) => { const r = d.transaction(OFFLINE_STORE).objectStore(OFFLINE_STORE).getAll(); r.onsuccess = () => resolve((r.result || []).filter(x => x.userId === userId)); r.onerror = () => reject(r.error); }); } catch (e) { console.warn('Offline library unavailable', e); return []; } }
async function saveOfflineSong(song) { if (!state.user || !isPremiumUser()) throw Error('Offline downloads are available only with an active Premium plan.'); if (!song?.audio_path) throw Error('This song has no downloadable audio.'); const signed = check(await db.storage.from('song-audio').createSignedUrl(song.audio_path, 900)); const response = await fetch(signed.signedUrl); if (!response.ok) throw Error('Could not download the audio file.'); const plain = await response.arrayBuffer(); const c = requireOfflineCrypto(); const iv = c.getRandomValues(new Uint8Array(12)); const key = await getOfflineKey(state.user.id); const cipher = await c.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain); const d = await openOfflineDb(); const row = { key: `${state.user.id}:song:${song.song_id}`, userId: state.user.id, songId: song.song_id, title: song.song_title, artist: song.album?.artist?.artist_name || 'SoundWave', album: song.album?.album_title || 'Single', duration: song.duration_seconds, mime: response.headers.get('content-type') || 'audio/mpeg', iv: Array.from(iv), cipher, validatedAt: Date.now() }; await new Promise((resolve, reject) => { const tx = d.transaction(OFFLINE_STORE, 'readwrite'); tx.objectStore(OFFLINE_STORE).put(row); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); state.offlineDownloads = await listOfflineDownloads(state.user.id); toast('Downloaded for offline listening'); }
async function removeOfflineSong(songId) { const d = await openOfflineDb(); await new Promise((resolve, reject) => { const tx = d.transaction(OFFLINE_STORE, 'readwrite'); tx.objectStore(OFFLINE_STORE).delete(`${state.user.id}:song:${songId}`); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); state.offlineDownloads = await listOfflineDownloads(state.user.id); }
async function clearOfflineDownloads(userId) { if (!('indexedDB' in window)) return; const rows = await listOfflineDownloads(userId); const d = await openOfflineDb(); await new Promise((resolve, reject) => { const tx = d.transaction(OFFLINE_STORE, 'readwrite'); for (const r of rows) tx.objectStore(OFFLINE_STORE).delete(r.key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
async function offlineBlobUrl(row) { const c = requireOfflineCrypto(); const key = await getOfflineKey(row.userId); const plain = await c.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(row.iv) }, key, row.cipher); return URL.createObjectURL(new Blob([plain], { type: row.mime || 'audio/mpeg' })); }
async function playDownloaded(songId, pb = null) {
  await requirePlaybackAccess();
  const row = state.offlineDownloads.find((x) => Number(x.songId) === Number(songId));
  if (!row) throw Error('This song is not downloaded.');
  const url = await offlineBlobUrl(row);
  const dl = state.offlineDownloads.map((x) => Number(x.songId));
  const keep = pb?.order && pb.order.every((x) => dl.includes(x));
  const b = buildPlayback(songId, dl, keep ? { order: pb.order, pos: pb.pos } : {});
  startPlayer({ kind: 'song', id: Number(row.songId), title: row.title, artist: row.artist, url, duration: row.duration, offline: true, ...b });
}

// ---------- Right-hand "Now playing / Queue" panel ----------
function downloadsPage() { if (!isPremiumUser()) return plans(); const rows = state.offlineDownloads; shell(`<section class="workspace-hero premium-hero"><div><span class="eyebrow">OFFLINE LIBRARY</span><h2>Your downloads.</h2><p>Premium downloads are stored encrypted in this browser for the signed-in account.</p></div><span class="hero-vinyl">↓</span></section><div class="section-heading"><h2>Downloaded music <span class="muted small">(${rows.length})</span></h2></div>${rows.length ? `<div class="songlist">${rows.map((r, i) => `<div class="songrow"><span class="tag">${i + 1}</span><span class="placeholder-art tiny" style="background:${grad(i)}">♫</span><div class="grow"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.artist)} · ${escapeHtml(r.album)}</small></div><span class="muted small">${nice(r.duration)}</span><button class="track-play" data-offline-play="${r.songId}">${icon('play')}</button><button class="button secondary sm" data-offline-remove="${r.songId}">Remove</button></div>`).join('')}</div>` : '<div class="empty">No downloads yet. Use a song’s ••• menu and choose Download.</div>'}<p class="footnote">The app rechecks Premium entitlement whenever you sign in. If entitlement expires, this local offline library is removed. Offline audio is encrypted at rest in this browser, but this does not protect it from malicious code running on the same SoundWave origin.</p>`, 'Downloads', state.entitlement?.plan_name ? `${state.entitlement.plan_name} offline listening` : 'Premium offline listening'); document.querySelectorAll('[data-offline-play]').forEach(b => b.onclick = () => action(() => playDownloaded(Number(b.dataset.offlinePlay)))); document.querySelectorAll('[data-offline-remove]').forEach(b => b.onclick = () => action(async () => { await removeOfflineSong(Number(b.dataset.offlineRemove)); render(); toast('Download removed'); })); }

async function loadArtistPopularity(artistId) {
  const id = Number(artistId);
  if (!id || !db) return;
  const key = String(id);
  try {
    const { data, error } = await db.rpc('public_artist_song_stream_counts_v47', { p_artist_id: id });
    if (error) throw error;
    state.artistPopularity[key] = Object.fromEntries((data || []).map(row => [Number(row.song_id), Number(row.stream_count) || 0]));
  } catch (error) {
    console.warn('Public artist popularity unavailable:', error);
    state.artistPopularity[key] = state.artistPopularity[key] || {};
  }
}
function artistDetail() {
  const artist = state.artists.find((a) => Number(a.artist_id) === Number(state.selectedArtist) && (a.is_published !== false || isOwnArtist(a)));
  if (!artist) return artists();
  const popularity = state.artistPopularity?.[String(artist.artist_id)] || {};
  const popularityLoaded = Object.prototype.hasOwnProperty.call(state.artistPopularity || {}, String(artist.artist_id));
  const releases = [...songsByArtist(artist.artist_id)].sort((a, b) => (Number(popularity[b.song_id] || 0) - Number(popularity[a.song_id] || 0)) || (Number(b.song_id) - Number(a.song_id)));
  const own = isOwnArtist(artist), fc = followerText(artist.artist_id);
  const albums = catalogAlbums().filter((a) => Number(a.artist?.artist_id) === Number(artist.artist_id) && (a.is_published !== false || own));
  const banner = artist.cover_path && state.coverUrls[artist.cover_path];
  const bannerStyle = banner ? `--artist-cover:url("${esc(banner)}");` : '';
  state.tint = tintFor(artist.artist_id);
  shell(`<div class="artist-sticky-bar" id="artist-sticky-bar" style="--artist-accent:${tintFor(artist.artist_id)};${bannerStyle}"><span class="artist-sticky-avatar" data-artist-photo-host="${artist.artist_id}" style="background:${grad(artist.artist_id)}">${artistCircleArtwork(artist)}</span><strong>${esc(artist.artist_name)}</strong>${releases.length ? `<button type="button" class="artist-sticky-play" data-play-ids="${ids(releases).join(',')}" aria-label="Play ${esc(artist.artist_name)}">${icon('play')}</button>` : ''}</div><section class="artist-profile-hero" id="artist-profile-hero" style="--artist-accent:${tintFor(artist.artist_id)};${bannerStyle}"><span class="artist-profile-avatar" data-artist-photo-host="${artist.artist_id}" style="background:${grad(artist.artist_id)}">${artistCircleArtwork(artist)}</span><div><span class="coll-kind">Artist</span><h1 class="coll-title">${esc(artist.artist_name)}</h1><p class="coll-sub">${fc ? `<strong data-follower-count="${artist.artist_id}">${fc}</strong> · ` : ''}${albums.length} ${albums.length === 1 ? 'release' : 'releases'} · ${releases.length} ${releases.length === 1 ? 'song' : 'songs'}${artist.country ? ' · ' + esc(artist.country) : ''}</p></div></section>
<div class="coll-actions artist-primary-actions">${releases.length ? `<button type="button" class="sw-big-play" data-play-ids="${ids(releases).join(',')}" aria-label="Play ${esc(artist.artist_name)}">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle aria-label="Shuffle">${icon('shuffle')}</button>` : ''}${own ? `<button type="button" class="follow-btn" data-nav="followers">View your followers</button>` : followBtn(artist)}</div>
<div id="artist-upcoming-slot">${artistUpcomingHtml(artist.artist_id)}</div>
${releases.length ? `<section class="artist-section"><div class="section-heading"><div><h2>Popular</h2><span class="muted small">Ranked by qualified stream count</span></div></div>${trackTable(releases.slice(0, 10), { queue: ids(releases), showAlbum: false, extraLabel: 'Streams', extraClass: 'streams', extraCell: (song) => popularityLoaded ? Number(popularity[song.song_id] || 0).toLocaleString() : '…' })}</section>` : ''}
${albums.length ? `<section class="shelf-section artist-section"><div class="section-heading"><h2>Discography</h2></div><div class="shelf">${albums.map(albumTile).join('')}</div></section>` : '<div class="empty">No published releases yet.</div>'}
${artist.bio ? `<section class="about-card artist-section"><h2>About</h2><p>${esc(artist.bio)}</p></section>` : ''}`, '', '');
}
function bindArtistScrollBehavior() {
  const main = document.querySelector('.main'), hero = document.getElementById('artist-profile-hero'), bar = document.getElementById('artist-sticky-bar');
  if (!main || !hero || !bar) return;
  let shown = false, raf = 0;
  const update = () => {
    raf = 0;
    const threshold = Math.max(96, hero.offsetHeight * .58), top = main.scrollTop;
    const next = shown ? top > Math.max(24, threshold - 28) : top > threshold;
    if (next !== shown) { shown = next; bar.classList.toggle('show', shown); document.body.classList.toggle('artist-scrolled', shown); }
    if (top <= 2) { shown = false; bar.classList.remove('show'); document.body.classList.remove('artist-scrolled'); }
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
  main.addEventListener('scroll', onScroll, { passive: true });
  update();
}
function songRows(rows, showAdd = false, queueIds = null) { return trackTable(rows, { queue: queueIds?.length ? queueIds : ids(rows) }); }
function recommendationShelf() {
  const picks = recommendationPicksDetailed();
  return `<div class="section-heading"><div><span class="eyebrow">CURATED FOR YOU</span><h2>Curated for you</h2></div><span class="muted small">Based on your likes, follows and listening</span></div><div class="shelf">${picks.map(curatedTile).join('') || '<div class="empty discover-empty"><span>♫</span><h3>Start listening to shape your recommendations</h3><p>Play songs, like tracks and follow artists. SoundWave will use those signals here.</p><button class="button" data-nav="music">Explore music</button></div>'}</div>`;
}
function curatedTile(pick) {
  const song = pick.song, album = song.album ? albumById(song.album.album_id) : null, q = (album ? ids(album.songs) : [song.song_id]).join(',');
  return `<article class="release-tile curated-card card-link" tabindex="0" role="link" ${song.album ? `data-open-album="${song.album.album_id}"` : ''} data-queue="${q}"><span class="release-art">${albumArt(song, 'large')}<button type="button" class="hover-play" data-play="${song.song_id}" aria-label="Play ${esc(song.song_title)}">${icon('play')}</button></span><strong>${esc(song.song_title)}</strong><small>${esc(song.album?.artist?.artist_name || 'SoundWave artist')}</small><span class="reason-caption">${esc(pick.reason)}</span></article>`.replace('<span class="release-art">', `<span class="release-art"><span class="match-chip ${matchMeta(pick.score).cls}">${matchMeta(pick.score).label}</span>`);
}
async function refreshPodcastRecommendationSignals() {
  const categoryCounts = new Map(), showCounts = new Map();
  const episodeIds = [...new Set((state.podcastHistory || []).map(r => Number(r.episode_id)).filter(Boolean))];
  if (episodeIds.length) {
    const ep = await db.from('podcast_episode').select('episode_id,show_id').in('episode_id', episodeIds);
    if (!ep.error) {
      const byEpisode = new Map((ep.data || []).map(x => [Number(x.episode_id), Number(x.show_id)]));
      for (const row of state.podcastHistory || []) {
        const sid = byEpisode.get(Number(row.episode_id));
        if (!sid) continue;
        showCounts.set(sid, (showCounts.get(sid) || 0) + 1);
        const show = state.podcasts.find(p => Number(p.show_id) === sid);
        const cat = String(show?.category || '').trim();
        if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    }
  }
  state.podcastRecSignals = { categories: Object.fromEntries(categoryCounts), shows: [...showCounts.entries()].map(([show_id, count]) => ({ show_id, count })) };
}
function recommendedPodcastsDetailed(limit = 7) {
  const cats = state.podcastRecSignals?.categories || {}, listened = new Map((state.podcastRecSignals?.shows || []).map(x => [Number(x.show_id), Number(x.count) || 0]));
  const hasSignals = Object.keys(cats).length > 0 || listened.size > 0;
  const rows = (state.podcasts || []).filter(p => p?.is_active !== false).map(show => {
    const cat = String(show.category || '').trim(); let score = 0, reason = '';
    if (cat && cats[cat]) { score += Number(cats[cat]) * 30; reason = `Because you listen to ${cat}`; }
    const times = listened.get(Number(show.show_id)) || 0;
    if (!times) score += hasSignals ? 12 : 0; else score += Math.min(8, times * 2);
    if (!reason) reason = hasSignals ? (times ? 'Continue listening' : 'Explore something new') : 'Popular on SoundWave';
    return { show, score, reason };
  }).sort((a, b) => b.score - a.score || String(a.show.show_title || '').localeCompare(String(b.show.show_title || '')));
  return rows.slice(0, limit);
}
function podcastRecommendationCard(pick, i = 0) {
  const p = pick.show, art = p.cover_path && state.coverUrls[p.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.show_title)}">` : icon('mic');
  return `<button type="button" class="cover-card podcast-recommend-card" data-open-show="${p.show_id}"><span class="cover-art" style="background:${grad(i)}">${art}</span><strong>${esc(p.show_title)}</strong><small>${esc(p.category || 'Podcast')}</small><span class="reason-caption">${esc(pick.reason)}</span></button>`;
}
function discoverFilterChips() {
  return `<div class="discover-filter-wrap"><div class="discover-filter-bar" role="tablist" aria-label="Filter Discover">${[['all', 'All'], ['music', 'Music'], ['podcasts', 'Podcasts']].map(([key, label]) => `<button type="button" class="discover-filter-chip ${state.discoverFilter === key ? 'active' : ''}" data-discover-filter="${key}" role="tab" aria-selected="${state.discoverFilter === key}"><span>${label}</span></button>`).join('')}</div></div>`;
}
function hasListeningActivity() {
  return (state.history || []).some(r => Number(r.song_id)) || (state.podcastHistory || []).some(r => Number(r.episode_id));
}
function newListenerDashboard() {
  state.tint = '#1d362b';
  shell(`<div id="release-alerts-slot">${followedReleasesShelf()}</div><div id="podcast-new-slot">${newEpisodesShelfHtml()}</div>\n  <section class="new-listener-dashboard"><div class="new-listener-copy"><span class="eyebrow">WELCOME TO SOUNDWAVE</span><h2>Discover music.</h2><p>Your recommendations will appear here after you start listening. For now, explore the SoundWave catalog and find your first track.</p><div class="new-listener-actions"><button type="button" class="button" data-nav="music">${icon('search')} Discover music</button></div></div><div class="new-listener-art" aria-hidden="true"><span>${icon('music')}</span><i></i><i></i><i></i></div></section>`, 'Discover music', 'Start listening to build your SoundWave recommendations.');
}
function discoverPage() {
  if (!hasArtistAccess() && !hasAdminAccess() && !hasListeningActivity()) return newListenerDashboard();
  const all = [...catalogAlbums()].filter(a => a?.artist && a.is_active !== false && a.artist?.is_active !== false && a.songs?.some(s => s.is_active !== false)).sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')) || Number(b.album_id) - Number(a.album_id));
  const uniqueByArtist = (rows, limit = 7) => { const seen = new Set(), out = []; for (const a of rows) { const id = Number(a.artist?.artist_id); if (!id || seen.has(id)) continue; seen.add(id); out.push(a); if (out.length === limit) break; } return out; };
  const available = uniqueByArtist(all, all.length || 1);
  const cutoff = Date.now() - 60 * 86400000;
  const freshRows = all.filter(a => a.release_date && new Date(a.release_date).getTime() >= cutoff); const fresh = uniqueByArtist(freshRows, freshRows.length || 1);
  const popular = [...state.artists].sort((a, b) => (Number(state.followerCounts?.[Number(b.artist_id)] || 0) - Number(state.followerCounts?.[Number(a.artist_id)] || 0)) || String(a.artist_name || '').localeCompare(String(b.artist_name || ''))).slice(0, 7);
  const shelf = (title, subtitle, action, html) => `<section class="shelf-section"><div class="section-heading discover-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action || ''}</div>${html}</section>`;
  const albumsExpanded = !!state.discoverExpanded.albums, curatedExpanded = !!state.discoverExpanded.curated;
  const visibleAlbums = albumsExpanded ? available : available.slice(0, 7);
  void ensurePlaylistSignal(); void ensureKaraokeCatalog();
  const curated = recommendationPicksDetailed(30);
  const freshRanked = fresh.map(album => ({ album, ...albumAffinity(album) })).sort((a, b) => b.score - a.score || String(b.album.release_date || '').localeCompare(String(a.album.release_date || '')));
  const podcastPicks = recommendedPodcastsDetailed(7);
  const filter = state.discoverFilter || 'all';
  const showMusic = filter === 'all' || filter === 'music';
  const showPodcasts = filter === 'all' || filter === 'podcasts';
  const expandBtn = (key, expanded, canExpand) => canExpand ? `<button type="button" class="text-link" data-discover-showall="${key}">${expanded ? 'Show less' : 'Show all'}</button>` : '';
  const musicSections = showMusic ? `${madeForYouShelfHtml()}<div id="karaoke-shelf-slot">${karaokeShelfHtml()}</div>${shelf('Browse all albums', 'Every active release on SoundWave', expandBtn('albums', albumsExpanded, available.length > 7), available.length ? `<div class="shelf ${albumsExpanded ? 'wrap discover-expanded' : ''}">${visibleAlbums.map(albumTile).join('')}</div>` : '<div class="empty discover-empty"><span>▣</span><h3>No albums are available yet</h3><p>Active releases will appear here as artists publish them.</p></div>')}
  ${shelf('Curated for you', 'Built from your liked songs, your playlists, the artists you follow and what you play', curated.length > 1 ? `<div class="curated-slider-controls"><button type="button" data-curated-slide="prev" aria-label="Previous recommendations" title="Previous" disabled>${icon('back')}</button><button type="button" data-curated-slide="next" aria-label="Next recommendations" title="Next">${icon('forward')}</button></div>` : '', curated.length ? `<div class="shelf curated-slider" id="curated-slider" aria-label="Curated recommendations">${curated.map(curatedTile).join('')}</div>` : '<div class="empty discover-empty"><span>✦</span><h3>Your recommendations are warming up</h3><p>Play music, like tracks and follow artists to personalize this shelf.</p><button class="button secondary" data-nav="music">Find music</button></div>')}
  ${shelf('New releases', 'Last 60 days, ordered by your likes, playlists and follows', '<button type="button" class="text-link" data-nav="music">Browse catalog</button>', fresh.length ? `<div class="shelf">${freshRanked.map(freshTile).join('')}</div>` : '<div class="empty discover-empty"><span>◷</span><h3>No fresh releases in the last 60 days</h3><p>Browse all albums for the full active catalog.</p></div>')}
  ${shelf('Popular artists', state.socialRpc?.counts ? 'Ranked by verified follower count' : 'Follower ranking unavailable until follower-count data loads', '<button type="button" class="text-link" data-nav="artists">Show all</button>', popular.length ? `<div class="shelf popular-artist-shelf">${popular.map((a, i) => artistCard(a, i, { showFollowers: true, rank: i + 1 })).join('')}</div>` : '<div class="empty discover-empty"><span>◎</span><h3>Artists will appear here</h3><p>Follower activity will rank artists as the community grows.</p></div>')}` : '';
  const podcastSubtitle = (Object.keys(state.podcastRecSignals?.categories || {}).length || state.podcastRecSignals?.shows?.length) ? 'Based on the podcast categories and shows you listen to' : 'Active shows to help you start discovering podcasts';
  const podcastSections = showPodcasts ? shelf('Podcasts for you', podcastSubtitle, '<button type="button" class="text-link" data-nav="podcasts">Show all</button>', podcastPicks.length ? `<div class="shelf">${podcastPicks.map(podcastRecommendationCard).join('')}</div>` : '<div class="empty discover-empty"><span>◉</span><h3>No podcasts published yet</h3><p>Published shows will appear here automatically.</p><button class="button secondary" data-nav="podcasts">Explore podcasts</button></div>') : '';
  shell(`<section class="discover-hero"><div><span class="eyebrow">YOUR WAVE</span><h2>Music that learns from you</h2><p>Like a song, build a playlist or follow an artist and your shelves reshape themselves. Each pick tells you why it is there.</p><div class="hero-actions"><button type="button" class="button" data-nav="charts">${icon('chart')} See the charts</button><button type="button" class="button secondary" data-nav="music">${icon('search')} Explore the catalog</button></div></div><span class="discover-orbit" aria-hidden="true">${icon('music')}</span></section>
  ${discoverFilterChips()}
  <div id="release-alerts-slot">${followedReleasesShelf()}</div>
  <div id="podcast-new-slot">${newEpisodesShelfHtml()}</div>
  <div class="discover-filter-content">${musicSections}${podcastSections}</div>`, 'Discover', '');
}

function artistDashboard() {
  if (!hasArtistAccess()) return discoverPage();
  const owned = state.ownedSongs || [];
  shell(`<section class="workspace-hero artist-hero"><div><span class="eyebrow">ARTIST STUDIO</span><h2>Your sound. Your space.</h2><p>See how your releases are performing, then jump into publishing when you are ready.</p><div class="hero-actions"><button class="button" data-nav="studio">${icon('upload')} Manage releases</button></div></div><span class="hero-vinyl">${icon('album')}</span></section>${artistAnalyticsHtml()}<div class="section-heading"><h2>Recent releases</h2><button class="text-link" data-nav="studio">Manage →</button></div><div class="release-grid">${owned.filter(x => x.is_active).slice(0, 5).map(artTile).join('') || quickTile('Create your first album', 'Start in Artist Studio', '', 'studio', 'album', 2)}</div>`, 'Artist Dashboard', `Welcome back, ${state.artist?.artist_name || 'Artist'}.`);
}
function adminDashboard() {
  if (!hasAdminAccess()) return discoverPage();
  const d = state.adminData || {}, users = d.users || [], artists = d.artists || [], songs = d.songs || state.songs || [], pods = d.podcasts || [];
  const activeUsers = users.filter(x => x.is_active !== false).length, activeArtists = artists.filter(x => x.is_active !== false).length;
  const inactiveContent = songs.filter(x => x.is_active === false).length + pods.filter(x => x.is_active === false).length;
  const chart = adminChartData();
  shell(`<section class="workspace-hero admin-hero"><div><span class="eyebrow">SOUNDWAVE ADMIN</span><h2>Platform at a glance</h2><div class="hero-actions"><button class="button" data-nav="song-streams">${icon('chart')} View all song streams</button><button class="button secondary" data-admin-dashboard-action="moderation">${icon('shield')} Open moderation</button></div></div></section>
 <section class="studio-stat-strip four admin-dashboard-stats"><button type="button" class="stat-tile" data-drill="users"><small>Total users</small><strong data-count="${users.length}">${users.length}</strong><span>${activeUsers} active · view all</span></button><button type="button" class="stat-tile" data-drill="creators"><small>Active creators</small><strong data-count="${activeArtists}">${activeArtists}</strong><span>${artists.length} artist profiles · view all</span></button><button type="button" class="stat-tile" data-drill="streams"><small>Qualified streams</small><strong data-count="${chart.total}">${chart.total}</strong><span>Last 30 days · view by day</span></button><button type="button" class="stat-tile" data-drill="attention"><small>Needs attention</small><strong data-count="${inactiveContent}">${inactiveContent}</strong><span>Inactive content · review</span></button></section>
 
 ${adminChartsHtml(users)}`, 'Admin Dashboard', `Welcome back, ${state.profile?.display_name || 'Admin'}.`);
  // Admin dashboard actions use the persistent delegated handler below.
}
function home() { const target = primaryDashboard(); if (target === 'admin-dashboard') return adminDashboard(); if (target === 'artist-dashboard') return artistDashboard(); return discoverPage(); }
function music() {
  state.tint = '#1d3a2f';
  shell(`${searchFieldHtml('page-search', 'page-search mobile-search', 'What do you want to play?', 'Search SoundWave')}${recentSearchesHtml()}<div id="search-results">${searchResultsHtml()}</div>`, 'Search', '');
  const pg = $('#page-search'); if (pg) { pg.addEventListener('input', () => setSearch(pg.value, pg)); pg.addEventListener('keydown', searchKeyboardNav); } document.querySelectorAll('[data-recent-search]').forEach(b => b.onclick = () => { state.searchQuery = b.dataset.recentSearch; render(); });
  bindSearchBits(document.getElementById('search-results'));
  if (!state.searchQuery && !state.searchGenre && matchMedia('(hover: hover)').matches && !state.focusSearch) $('#global-search')?.focus();
}
function bindMusic(root = document) {
  root.querySelectorAll('[data-jump]').forEach((b) => b.onclick = () => navigate(b.dataset.jump));
  root.querySelectorAll('[data-play]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation(); e.preventDefault();
    playAction(async () => { const row = b.closest('[data-queue]'); const q = row?.dataset.queue ? row.dataset.queue.split(',').filter(Boolean).map(Number) : null; await playSong(Number(b.dataset.play), q); });
  });
  root.querySelectorAll('[data-play-ids]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const list = b.dataset.playIds.split(',').filter(Boolean).map(Number); if (!list.length) return;
    const start = prefs.shuffle ? list[Math.floor(Math.random() * list.length)] : list[0];
    playAction(() => playSong(start, list));
  });
  root.querySelectorAll('[data-toggle-shuffle]').forEach((b) => { b.classList.toggle('active', prefs.shuffle); b.onclick = toggleShuffle; });
  bindSongMenus();
}

// ---------- Library sidebar (Spotify-style "Your Library") ----------
function libraryChips() {
  const counts = { playlists: state.playlists.length, artists: state.artists.filter(a => state.favorites.some(x => x.artist_id === a.artist_id)).length, podcasts: state.myShows.filter(s => s.is_active).length };
  return [['playlists', 'Playlists'], ['podcasts', 'Podcasts'], ['artists', 'Artists']].map(([k, label]) => `<button type="button" class="filter-pill ${state.libFilter === k ? 'active' : ''}" data-lib-filter="${k}" aria-pressed="${state.libFilter === k}"><span class="pill-label">${label}</span><span class="filter-count">${counts[k]}</span></button>`).join('');
}
function libraryToolsHtml() {
  const open = state.libSearchOpen || state.libQuery;
  return `<button type="button" class="icon-quiet" id="lib-search-toggle" aria-label="Search in Your Library" title="Search in Your Library">${icon('search')}</button><input id="lib-search" class="lib-search" type="search" autocomplete="off" placeholder="Search in Your Library" aria-label="Search in Your Library" value="${esc(state.libQuery || '')}" ${open ? '' : 'hidden'}><button type="button" class="lib-sort" id="lib-sort" aria-haspopup="menu" aria-label="Sort library"><span id="lib-sort-label">${prefs.libSort === 'alpha' ? 'Alphabetical' : 'Recents'}</span>${icon('list')}</button>`;
}
function libraryEntries() {
  const f = state.libFilter, q = (state.libQuery || '').trim().toLowerCase(), out = [];
  const add = (name, meta, art, attrs, active, cls = '') => out.push({ name, meta, art, attrs, active, cls });
  if (f === 'all' || f === 'playlists') state.playlists.slice(0, 80).forEach((p, i) => {
    const playlistArt = p.cover_path && state.coverUrls[p.cover_path]
      ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.playlist_name)} cover" loading="lazy">`
      : icon('music');
    add(p.playlist_name, `Playlist · ${p.visibility}`, `<span class="library-art playlist-library-art" style="background:${grad(i)}">${playlistArt}</span>`, `data-openplaylist="${p.playlist_id}"`, state.page === 'playlists' && state.selectedPlaylist === p.playlist_id);
  });
  if (f === 'all' || f === 'playlists') {
    const pinnedAlbums = libraryPinnedIds();
    catalogAlbums().filter(a => pinnedAlbums.has('album:' + a.album_id)).forEach(a => {
      if (q && !String(a.title).toLowerCase().includes(q)) return;
      add(a.title, `Album · ${a.artist?.artist_name || 'SoundWave'}`, `<span class="library-art playlist-library-art">${albumArt({ album: a }, 'tiny')}</span>`, `data-open-album="${a.album_id}"`, state.page === 'album-detail' && Number(state.selectedAlbum) === Number(a.album_id));
    });
  }
  if (f === 'all' || f === 'podcasts') state.myShows.filter((s) => s.is_active).slice(0, 40).forEach((s, i) => {
    const podcastArt = s.cover_path && state.coverUrls[s.cover_path]
      ? `<img class="cover-img" src="${esc(state.coverUrls[s.cover_path])}" alt="${esc(s.show_title)}">`
      : icon('mic');
    add(s.show_title, 'Podcast · Your show', `<span class="library-art" style="background:${grad(i + 2)}">${podcastArt}</span>`, `data-open-show="${s.show_id}"`, state.page === 'podcasts' && state.selectedShow === s.show_id);
  });
  if (f === 'all' || f === 'podcasts') (state.podLib?.follows || []).map(podShowById).filter((s) => s && !state.myShows.some((m) => Number(m.show_id) === Number(s.show_id))).slice(0, 40).forEach((s, i) => {
    add(s.show_title, 'Podcast · Following', `<span class="library-art" style="background:${grad(i + 4)}">${podArt(s)}</span>`, `data-open-show="${s.show_id}"`, state.page === 'podcasts' && Number(state.selectedShow) === Number(s.show_id));
  });
  if (f === 'all' || f === 'artists') state.artists.filter((a) => state.favorites.some((x) => x.artist_id === a.artist_id)).slice(0, 80).forEach((a, i) => add(a.artist_name, 'Artist', `<span class="library-art round library-artist-photo" data-artist-photo-host="${Number(a.artist_id)}" style="background:${grad(i + 1)}">${artistArtwork(a, 'artist-avatar-photo')}</span>`, `data-open-artist="${a.artist_id}"`, state.page === 'artist-detail' && Number(state.selectedArtist) === Number(a.artist_id), 'is-artist'));
  let rows = q ? out.filter((e) => e.name.toLowerCase().includes(q)) : out;
  if (prefs.libSort === 'alpha') rows = [...rows].sort((x, y) => x.name.localeCompare(y.name));
  return rows;
}
const PIN_KEY = 'soundwave-library-pins-v1';
function libraryPinnedIds() { try { const values = JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); return new Set(Array.isArray(values) ? values : []) } catch { return new Set() } }
function toggleLibraryPin(key) { const pins = libraryPinnedIds(); pins.has(key) ? pins.delete(key) : pins.add(key); localStorage.setItem(PIN_KEY, JSON.stringify([...pins])); renderLibraryList(); }
document.addEventListener('click', e => { const b = e.target.closest?.('.album-pin-control[data-pin-key]'); if (!b) return; e.preventDefault(); e.stopPropagation(); toggleLibraryPin(b.dataset.pinKey); b.setAttribute('aria-label', libraryPinnedIds().has(b.dataset.pinKey) ? 'Unpin album' : 'Pin album'); b.title = b.getAttribute('aria-label'); });
// A single right-click action for library entries. Keep the pin button in DOM for keyboard fallback.
let libraryContextMenu = null;
function dismissLibraryContextMenu() { libraryContextMenu?.remove(); libraryContextMenu = null; }
document.addEventListener('contextmenu', event => {
  const entry = event.target.closest?.('.sidebar .library-pin-row');
  if (!entry) return;
  const button = entry.querySelector('.library-pin-action[data-pin-key]');
  if (!button) return;
  event.preventDefault(); dismissLibraryContextMenu();
  const key = button.dataset.pinKey;
  const unpin = key.endsWith(':unpinned') ? !libraryPinnedIds().has(key) : libraryPinnedIds().has(key);
  const label = unpin ? 'Unpin from library' : 'Pin to library';
  const menu = document.createElement('div'); menu.className = 'library-context-menu'; menu.setAttribute('role', 'menu');
  const option = document.createElement('button'); option.type = 'button'; option.setAttribute('role', 'menuitem'); option.textContent = label;
  option.addEventListener('click', e => { e.stopPropagation(); dismissLibraryContextMenu(); toggleLibraryPin(key); });
  menu.append(option); document.body.append(menu); libraryContextMenu = menu;
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(event.clientX, innerWidth - rect.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(event.clientY, innerHeight - rect.height - 8)) + 'px';
  option.focus();
});
document.addEventListener('pointerdown', event => { if (libraryContextMenu && !libraryContextMenu.contains(event.target)) dismissLibraryContextMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') dismissLibraryContextMenu(); });

function libraryListHtml() {
  const f = state.libFilter, q = (state.libQuery || '').trim().toLowerCase(), grid = prefs.libView === 'grid';
  const item = (cls, art, name, metaHtml, attrs, active) => `<button type="button" class="library-item ${cls} ${active ? 'active' : ''}" ${attrs} title="${esc(name)}">${art}<span class="library-item-label"><strong>${esc(name)}</strong><small>${metaHtml}</small></span></button>`;
  const pinned = libraryPinnedIds();
  const parts = [];
  // Built-in collections remain in the library, but may be unpinned.
  if ((f === 'all' || f === 'playlists') && (!q || 'liked songs'.includes(q))) {
    const meta = state.likesAvailable ? `${state.liked.length} ${state.liked.length === 1 ? 'song' : 'songs'}` : 'Set up needed';
    const isPinned = !pinned.has('builtin:liked:unpinned');
    parts.push(`<div class="library-pin-row ${isPinned ? 'is-pinned' : ''}">${item('liked', `<span class="library-art liked-art">${icon('heart')}</span>`, 'Liked Songs', `${isPinned ? `<span class="pin-ico">${icon('pin')}</span>` : ''}Playlist · ${meta}`, 'data-nav="liked-songs"', state.page === 'liked-songs')}<button type="button" class="library-pin-action" data-pin-key="builtin:liked:unpinned" aria-label="${isPinned ? 'Unpin' : 'Pin'} Liked Songs" title="${isPinned ? 'Unpin' : 'Pin'} Liked Songs">${icon('pin')}</button></div>`);
  }
  if ((f === 'all' || f === 'playlists') && (!q || 'your top songs of the week'.includes(q) || 'your top songs'.includes(q))) {
    const isPinned = !pinned.has('builtin:top:unpinned');
    parts.push(`<div class="library-pin-row ${isPinned ? 'is-pinned' : ''}">${item('weekly', `<span class="library-art weekly-art">${icon('music')}</span>`, 'Your Top Songs', `${isPinned ? `<span class="pin-ico">${icon('pin')}</span>` : ''}Auto playlist · ${state.personalTopSongs.length} songs`, 'data-nav="top-songs"', state.page === 'top-songs')}<button type="button" class="library-pin-action" data-pin-key="builtin:top:unpinned" aria-label="${isPinned ? 'Unpin' : 'Pin'} Your Top Songs" title="${isPinned ? 'Unpin' : 'Pin'} Your Top Songs">${icon('pin')}</button></div>`);
  }
  const libEntries = libraryEntries();
  const pinKey = e => { const attrs = e.attrs || ''; const p = attrs.match(/data-openplaylist="(\d+)"/); if (p) return 'playlist:' + p[1]; const a = attrs.match(/data-open-album="(\d+)"/); return a ? 'album:' + a[1] : null; };
  const ordered = [...libEntries].sort((a, b) => Number(pinned.has(pinKey(b))) - Number(pinned.has(pinKey(a))));
  ordered.forEach(e => {
    const key = pinKey(e);
    if (!key) { parts.push(item(e.cls, e.art, e.name, esc(e.meta), e.attrs, e.active)); return; }
    const on = pinned.has(key);
    parts.push(`<div class="library-pin-row ${on ? 'is-pinned' : ''}">${item(e.cls, e.art, e.name, `${on ? '<span class="pin-ico">' + icon('pin') + '</span>' : ''}${esc(e.meta)}`, e.attrs, e.active)}<button class="library-pin-action" type="button" data-pin-key="${key}" aria-label="${on ? 'Unpin' : 'Pin'} ${esc(e.name)}" title="${on ? 'Unpin' : 'Pin'} ${esc(e.name)}">${icon('pin')}</button></div>`);
  });
  if (parts.length === ((f === 'all' || f === 'playlists') && (!q || 'liked songs'.includes(q)) ? 1 : 0) && !libraryEntries().length) {
    if (q) return parts.join('') + `<div class="library-empty"><strong>Couldn’t find “${esc(state.libQuery)}”</strong><p>Try searching again using a different spelling or keyword.</p></div>`;
    if (f === 'artists') return `<div class="library-empty-card"><strong>Follow your first artist</strong><p>Follow artists you like and they’ll show up here.</p><button type="button" class="button sm" data-nav="artists">Browse artists</button></div>`;
    if (f === 'podcasts') return `<div class="library-empty-card"><strong>Create your first podcast show</strong><p>Share a story with the world.</p><button type="button" class="button sm" data-create-show>Create show</button></div>`;
    return parts.join('') + `<div class="library-empty-card"><strong>Create your first playlist</strong><p>It’s easy, we’ll help you.</p><button type="button" class="button sm" data-create-playlist>Create playlist</button></div>`;
  }
  return parts.join('');
}
function renderLibraryList() {
  const list = document.getElementById('library-list'); if (!list) return;
  list.className = 'library-scroll';
  list.innerHTML = libraryListHtml();
  const chips = document.getElementById('library-filters'); if (chips) chips.innerHTML = libraryChips();
  const lab = document.getElementById('lib-sort-label'); if (lab) lab.textContent = prefs.libSort === 'alpha' ? 'Alphabetical' : 'Recents';
  const sortBtn = document.getElementById('lib-sort'); if (sortBtn) { sortBtn.querySelector('svg')?.remove(); sortBtn.insertAdjacentHTML('beforeend', icon('list')); }
  bindLibrary();
}
function popMenu(anchor, html, wire) {
  document.querySelector('.song-action-popover')?.remove();
  const pop = document.createElement('div'); pop.className = 'song-action-popover'; pop.setAttribute('role', 'menu'); pop.innerHTML = html; document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left))}px`;
  pop.style.top = `${Math.min(window.innerHeight - (pop.offsetHeight || 200) - 100, r.bottom + 6)}px`;
  wire(pop, (sel, fn) => pop.querySelector(sel)?.addEventListener('click', () => { pop.remove(); fn(); }));
}
function openCreateShow() { navigate('podcasts'); setTimeout(() => document.getElementById('create-show-dialog')?.showModal(), 60); }
function bindLibrary() {
  const sb = document.querySelector('.sidebar'); if (!sb) return;
  bindContent(sb); bindMusic(sb);
  sb.querySelector('.sidebar-motion-indicator')?.remove();
  sb.querySelectorAll('[data-pin-key]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); toggleLibraryPin(b.dataset.pinKey); });
  sb.querySelectorAll('[data-create-playlist]').forEach((b) => b.onclick = () => action(quickCreatePlaylist));
  sb.querySelectorAll('[data-create-show]').forEach((b) => b.onclick = openCreateShow);
  sb.querySelectorAll('[data-lib-filter]').forEach((b) => b.onclick = () => { state.libFilter = b.dataset.libFilter; renderLibraryList(); });
  const create = document.getElementById('library-create');
  if (create) create.onclick = (e) => { e.stopPropagation(); popMenu(create, `<button data-c-pl>${icon('music')} <span>Playlist<small class="menu-sub">Build a playlist with songs</small></span></button><button data-c-show>${icon('mic')} <span>Podcast show<small class="menu-sub">Start your own show</small></span></button><button data-c-cq>${icon('users')} <span>CrowdQueue room<small class="menu-sub">Listen and vote together</small></span></button>`, (pop, on) => { on('[data-c-pl]', () => action(quickCreatePlaylist)); on('[data-c-show]', openCreateShow); on('[data-c-cq]', () => navigate('crowdqueue')); }); };
  const tog = document.getElementById('lib-search-toggle'), box = document.getElementById('lib-search');
  if (tog && box) {
    tog.onclick = () => { state.libSearchOpen = !state.libSearchOpen; if (!state.libSearchOpen) { state.libQuery = ''; box.value = ''; renderLibraryList(); } box.hidden = !(state.libSearchOpen || state.libQuery); if (!box.hidden) box.focus(); };
    box.oninput = () => { state.libQuery = box.value; renderLibraryList(); };
  }
  const sort = document.getElementById('lib-sort');
  if (sort) sort.onclick = (e) => { e.stopPropagation(); const chk = (c) => (c ? `<span class="menu-check">${icon('check')}</span>` : ''); popMenu(sort, `<div class="menu-label">Sort by</div><button data-s="recents">Recents ${chk(prefs.libSort !== 'alpha')}</button><button data-s="alpha">Alphabetical ${chk(prefs.libSort === 'alpha')}</button>`, (pop, on) => { on('[data-s="recents"]', () => { prefs.libSort = 'recents'; savePrefs(); renderLibraryList(); }); on('[data-s="alpha"]', () => { prefs.libSort = 'alpha'; savePrefs(); renderLibraryList(); }); }); };
}

// ---------- Search ----------
function searchFieldHtml(id, className, placeholder, label) {
  const hasValue = !!String(state.searchQuery || '').trim();
  return `<div class="${className}" data-has-value="${hasValue ? 'true' : 'false'}" role="search"><span class="search-icon" aria-hidden="true">${icon('search')}</span><input id="${id}" type="search" maxlength="80" autocomplete="off" spellcheck="false" placeholder="${placeholder}" aria-label="${label}" value="${esc(state.searchQuery || '')}"><button type="button" class="search-clear" data-clear-search="${id}" aria-label="Clear search" ${hasValue ? '' : 'hidden'}>${icon('close')}</button><span class="search-divider" aria-hidden="true" ${hasValue ? 'hidden' : ''}></span><button type="button" class="search-browse" data-nav="music" aria-label="Browse music" title="Browse" ${hasValue ? 'hidden' : ''}>${icon('library')}</button></div>`;
}

function setSearch(q, from) {
  state.searchQuery = q;
  schedulePeopleSearch();
  document.querySelectorAll('#global-search,#page-search').forEach((el) => { if (el !== from && el.value !== q) el.value = q; });
  if (karaokeViewOpen()) {
    renderKaraokeSearchOverlay();
    return;
  }
  closeKaraokeSearchOverlay();
  if (state.page !== 'music') {
    if (!String(q || '').trim()) return;
    state.focusSearch = from?.id || 'global-search';
    state.page = 'music';
    render();
    return;
  }
  renderSearchResults();
}
// Karaoke search displays over the lyrics view rather than routing away.
// The special search overlay belongs to the karaoke / lyrics view only. If a stale karaoke flag is left over on
// another page (no karaoke panel on screen), clear it so search behaves normally.
function karaokeViewOpen() {
  if (!state.karaokeMode || state.player?.kind !== 'song') return false;
  if (document.body.classList.contains('karaoke-mode') && document.querySelector('.karaoke-panel')) return true;
  state.karaokeMode = false; state.lyricsOnly = false;
  document.body.classList.remove('karaoke-mode', 'lyrics-fs');
  try { updateKaraokeButtons(); } catch { }
  return false;
}
function closeKaraokeSearchOverlay() { document.getElementById('karaoke-search-overlay')?.remove(); }
function renderKaraokeSearchOverlay() {
  const term = String(state.searchQuery || '').trim();
  if (!state.karaokeMode || state.player?.kind !== 'song' || !term) { closeKaraokeSearchOverlay(); return; }
  let overlay = document.getElementById('karaoke-search-overlay');
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.id = 'karaoke-search-overlay'; overlay.className = 'karaoke-search-overlay';
    overlay.setAttribute('aria-label', 'Search results over karaoke');
    overlay.innerHTML = '<div class="karaoke-search-toolbar"><strong>Search SoundWave</strong><button type="button" id="karaoke-search-close" aria-label="Close search results">✕</button></div><div id="karaoke-search-results"></div>';
    document.body.appendChild(overlay);
  }
  const results = overlay.querySelector('#karaoke-search-results');
  results.innerHTML = searchResultsHtml();
  bindContent(results); bindMusic(results); bindSearchBits(results); syncHearts(); markPlaying();
  overlay.querySelector('#karaoke-search-close').onclick = () => { closeKaraokeSearchOverlay(); };
}
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeKaraokeSearchOverlay(); });
document.addEventListener('input', event => { if (event.target.matches?.('#global-search,#page-search')) schedulePeopleSearch(); });
document.addEventListener('click', (event) => { if (event.target.closest?.('[data-karaoke-toggle]') && state.karaokeMode) closeKaraokeSearchOverlay(); }, true);
function fuzzyScore(text, query) {
  text = String(text || '').toLowerCase(); query = String(query || '').trim().toLowerCase(); if (!query) return 1;
  if (text === query) return 120; if (text.startsWith(query)) return 100 - query.length; if (text.includes(query)) return 80 - query.length;
  let qi = 0, score = 0, last = -2; for (let i = 0; i < text.length && qi < query.length; i++) { if (text[i] === query[qi]) { score += i === last + 1 ? 6 : 2; last = i; qi++; } }
  return qi === query.length ? score : 0;
}
function searchData() {
  const q = (state.searchQuery || '').trim().toLowerCase(), g = state.searchGenre;
  let songs = state.songs, albums = catalogAlbums(), artists = state.artists, playlists = state.playlists, shows = state.podcasts;
  if (g) { songs = songs.filter(s => Number(s.genre_id) === Number(g)); albums = albums.filter(a => a.songs.some(s => Number(s.genre_id) === Number(g))); const aids = new Set(songs.map(s => s.album?.artist?.artist_id)); artists = artists.filter(a => aids.has(a.artist_id)); playlists = []; shows = []; }
  const rank = (rows, fields) => q ? rows.map(row => ({ row, score: Math.max(...fields.map(f => fuzzyScore(f(row), q))) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.row) : rows;
  songs = rank(songs, [s => s.song_title, s => s.album?.album_title, s => s.album?.artist?.artist_name]);
  albums = rank(albums, [a => a.title, a => a.artist?.artist_name]); artists = rank(artists, [a => a.artist_name, a => a.country]); playlists = rank(playlists, [p => p.playlist_name, p => p.description]); shows = rank(shows, [p => p.show_title, p => p.category]);
  return { q, songs, albums, artists, playlists, shows };
}
// Search only public, active accounts through a column-restricted RPC.
async function loadPeopleSearch(term = state.searchQuery) {
  const query = String(term || '').trim(); const id = ++state.peopleRequestId;
  if (query.length < 2) { state.peopleResults = []; state.peopleQueryLoaded = query; renderSearchResults(); return; }
  state.peopleLoading = true;
  const [profiles, following] = await Promise.all([
    db.rpc('soundwave_search_public_people', { p_query: query, p_limit: 30 }),
    db.from('user_follow').select('followed_user_id').eq('follower_user_id', state.user.id)
  ]);
  if (id !== state.peopleRequestId) return;
  state.peopleLoading = false; state.peopleQueryLoaded = query;
  if (profiles.error) { state.peopleResults = []; console.warn('People search unavailable', profiles.error); }
  else { const artistAccounts = new Set((state.artists || []).map(a => String(a.user_id)).filter(Boolean)); state.peopleResults = (profiles.data || []).filter(p => !artistAccounts.has(String(p.user_id)) && String(p.account_type || '').toLowerCase() !== 'artist'); }
  if (!following.error) state.personFollowing = new Set((following.data || []).map(x => String(x.followed_user_id)));
  if (state.page === 'music') renderSearchResults();
}
function personAvatar(p) {
  const src = p.profile_photo_url && /^https:\/\//i.test(p.profile_photo_url) ? p.profile_photo_url :
    p.profile_photo_path ? db.storage.from('profile-images').getPublicUrl(p.profile_photo_path).data?.publicUrl : null;
  return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` :
    `<span aria-hidden="true">${esc((p.display_name || p.username || 'U')[0].toUpperCase())}</span>`;
}
function personActions(p) {
  const linkedArtist = (state.artists || []).find(a => String(a.user_id) === String(p.user_id));
  if (linkedArtist) return followBtn(linkedArtist, 'sm');
  const own = String(p.user_id) === String(state.user?.id);
  return own ? '<span class="muted small">You</span>' : `<button type="button" class="button secondary sm" data-person-follow="${esc(p.user_id)}">${state.personFollowing.has(String(p.user_id)) ? 'Following' : 'Follow'}</button>`;
}
function peopleCards(rows) { return `<div class="sw-people-grid">${rows.map(p => `<article class="sw-person-card"><button type="button" class="sw-person-main" data-open-person="${esc(p.user_id)}"><span class="sw-person-avatar">${personAvatar(p)}</span><span class="sw-person-info"><strong>${esc(p.display_name || p.username || 'SoundWave user')}</strong><small>@${esc(p.username || 'listener')} · ${esc(p.account_type || 'Listener')}</small></span></button>${personActions(p)}</article>`).join('')}</div>`; }
function peopleSearchSection() {
  if (state.peopleLoading) return '<p class="muted">Searching people…</p>';
  if (state.peopleQueryLoaded !== String(state.searchQuery || '').trim()) return '<p class="muted">Searching people…</p>';
  return state.peopleResults.length ? peopleCards(state.peopleResults) : '<p class="muted">No public people matched this search.</p>';
}
// Other users' playlists use their own read-only view, never the owner's editor.
const publicPersonPlaylists = { ownerId: null, rows: [], loading: false, error: '', selected: null, tracks: [] };
let publicPlaylistRequestId = 0;
async function loadPublicPersonPlaylists(userId) {
  const request = ++publicPlaylistRequestId;
  publicPersonPlaylists.ownerId = String(userId); publicPersonPlaylists.rows = []; publicPersonPlaylists.selected = null; publicPersonPlaylists.tracks = [];
  publicPersonPlaylists.loading = true; publicPersonPlaylists.error = '';
  if (state.page === 'person-detail') publicPersonProfile();
  const result = await db.from('playlist').select('playlist_id,playlist_name,description,cover_path,visibility,is_active,user_id')
    .eq('user_id', userId).eq('visibility', 'Public').eq('is_active', true).order('playlist_id', { ascending: false });
  if (request !== publicPlaylistRequestId || String(state.selectedPerson?.user_id) !== String(userId)) return;
  publicPersonPlaylists.loading = false;
  if (result.error) { publicPersonPlaylists.error = 'Public playlists could not be loaded.'; console.warn('Public playlists:', result.error); }
  else publicPersonPlaylists.rows = result.data || [];
  if (state.page === 'person-detail') publicPersonProfile();
  // Resolve cover art without delaying playlist names or interactions.
  for (const row of publicPersonPlaylists.rows) {
    const path = row.cover_path;
    if (!path || state.coverUrls?.[path]) continue;
    void resolveCoverUrl(path).then(url => {
      if (!url || request !== publicPlaylistRequestId) return;
      state.coverUrls[path] = url;
      if (state.page === 'person-detail' && String(state.selectedPerson?.user_id) === String(userId)) publicPersonProfile();
    }).catch(() => { });
  }
}
async function openPublicPersonPlaylist(playlistId) {
  const chosen = publicPersonPlaylists.rows.find(p => Number(p.playlist_id) === Number(playlistId));
  if (!chosen || chosen.visibility !== 'Public' || chosen.is_active !== true) return;
  const request = ++publicPlaylistRequestId;
  publicPersonPlaylists.selected = chosen; publicPersonPlaylists.tracks = []; publicPersonPlaylists.loading = true;
  publicPersonPlaylists.error = ''; publicPersonProfile();
  let result = await db.from('playlist_song').select('playlist_id,song_id,track_order,date_added').eq('playlist_id', chosen.playlist_id).order('track_order');
  if (result.error && /date_added/i.test(String(result.error.message || ''))) result = await db.from('playlist_song').select('playlist_id,song_id,track_order').eq('playlist_id', chosen.playlist_id).order('track_order');
  if (request !== publicPlaylistRequestId || state.page !== 'person-detail') return;
  publicPersonPlaylists.loading = false;
  if (result.error) { publicPersonPlaylists.error = 'Unable to load this playlist.'; console.warn('Public playlist tracks:', result.error); }
  else publicPersonPlaylists.tracks = result.data || [];
  publicPersonProfile();
}
function publicPersonProfile() {
  const p = state.selectedPerson;
  if (!p) { shell('<div class="empty-state"><h3>Profile not available</h3><p>This person may be private or inactive.</p><button class="button secondary" data-nav="music">Back to search</button></div>', 'People', ''); return; }
  const own = String(p.user_id) === String(state.user.id);
  const validOwner = publicPersonPlaylists.ownerId === String(p.user_id);
  const entries = validOwner ? publicPersonPlaylists.rows : [];
  const selected = validOwner ? publicPersonPlaylists.selected : null;
  const cards = entries.map((pl, i) => {
    const url = pl.cover_path && state.coverUrls?.[pl.cover_path];
    const art = url ? `<img src="${esc(url)}" loading="lazy" alt="">` : `<span class="sw-person-playlist-placeholder" style="background:${grad(i + 2)}">${icon('music')}</span>`;
    return `<button type="button" class="sw-person-playlist-card" data-public-person-playlist="${Number(pl.playlist_id)}"><span class="sw-person-playlist-art">${art}</span><strong>${esc(pl.playlist_name)}</strong><small>Public playlist</small></button>`;
  }).join('');
  let section = '';
  if (selected) {
    const tracks = publicPersonPlaylists.tracks.map(r => songById(r.song_id)).filter(Boolean);
    const ids = tracks.map(r => r.song_id);
    const ownerName = esc(p.display_name || p.username || 'SoundWave user');
    section = `<section class="sw-person-playlists"><div class="section-heading"><h2>${esc(selected.playlist_name)}</h2><button class="button secondary sm" type="button" data-public-playlist-back>Back to playlists</button></div><p class="muted">Public playlist by ${ownerName} · Read-only</p>${selected.description ? `<p>${esc(selected.description)}</p>` : ''}${publicPersonPlaylists.loading ? '<p class="muted">Loading songs…</p>' : publicPersonPlaylists.error ? `<p class="muted">${esc(publicPersonPlaylists.error)}</p>` : tracks.length ? `<div class="sw-person-playlist-actions"><button type="button" class="button" data-play-ids="${ids.join(',')}">${icon('play')} Play all</button></div>${trackTable(tracks, { queue: ids })}` : '<p class="muted">No available songs in this playlist.</p>'}</section>`;
  } else {
    section = `<section class="sw-person-playlists"><div class="section-heading"><h2>Public playlists</h2></div>${validOwner && publicPersonPlaylists.loading ? '<p class="muted">Loading public playlists…</p>' : validOwner && publicPersonPlaylists.error ? `<p class="muted">${esc(publicPersonPlaylists.error)}</p>` : cards ? `<div class="sw-person-playlist-grid">${cards}</div>` : validOwner ? '<p class="muted">No public playlists yet.</p>' : '<p class="muted">Loading public playlists…</p>'}</section>`;
  }
  shell(`<section class="sw-public-person"><div class="sw-public-person-cover"><span class="eyebrow">PUBLIC PROFILE</span></div><div class="sw-public-person-identity"><span class="sw-person-avatar">${personAvatar(p)}</span><div><h1>${esc(p.display_name || p.username || 'SoundWave user')}</h1><p>@${esc(p.username || 'listener')} · ${esc(p.account_type || 'Listener')}</p></div>${personActions(p)}</div><p class="muted">Only public profile details and active public playlists are shown. Listening history, email, and private playlists are not shared.</p>${own ? '<button type="button" class="button secondary" data-nav="profile">Your profile</button>' : ''}</section>${section}`, 'People', 'Public SoundWave profile');
}
document.addEventListener('click', event => {
  const card = event.target.closest?.('[data-public-person-playlist]');
  if (card) { event.preventDefault(); void openPublicPersonPlaylist(Number(card.dataset.publicPersonPlaylist)); return; }
  if (event.target.closest?.('[data-public-playlist-back]')) { event.preventDefault(); publicPersonPlaylists.selected = null; publicPersonPlaylists.tracks = []; publicPersonProfile(); }
});

document.addEventListener('click', event => {
  const open = event.target.closest?.('[data-open-person]'); if (open) { event.preventDefault(); const p = state.peopleResults.find(x => String(x.user_id) === String(open.dataset.openPerson)); if (p) { const linked = (state.artists || []).find(a => String(a.user_id) === String(p.user_id)); if (linked) { navigate('artist-detail', { selectedArtist: linked.artist_id }); } else { navigate('person-detail', { selectedPerson: p }); void loadPublicPersonPlaylists(p.user_id); } } return; }
  const button = event.target.closest?.('[data-person-follow]'); if (!button) return;
  event.preventDefault(); event.stopPropagation();
  const target = button.dataset.personFollow; if (!target || !state.user || target === state.user.id) return;
  action(async () => {
    const existing = state.personFollowing.has(target);
    const result = existing ? await db.from('user_follow').delete().eq('follower_user_id', state.user.id).eq('followed_user_id', target) : await db.from('user_follow').insert({ follower_user_id: state.user.id, followed_user_id: target });
    check(result);
    if (existing) state.personFollowing.delete(target); else state.personFollowing.add(target);
    if (state.page === 'person-detail') publicPersonProfile(); else renderSearchResults();
    toast(existing ? 'Unfollowed' : 'Following');
  });
});
let peopleSearchTimer = null;
function schedulePeopleSearch() { clearTimeout(peopleSearchTimer); peopleSearchTimer = setTimeout(() => { if (state.user && String(state.searchQuery || '').trim().length >= 2) void loadPeopleSearch(); else { state.peopleResults = []; state.peopleQueryLoaded = ''; } }, 350); }
function topResultHtml(d) {
  const q = d.q; if (!q) return '';
  const score = (n) => { n = String(n || '').toLowerCase(); return n === q ? 3 : n.startsWith(q) ? 2 : n.includes(q) ? 1 : 0; };
  const c = [...d.artists.map((a) => ({ t: 'artist', s: score(a.artist_name) * 10 + 3, a })), ...d.songs.map((s) => ({ t: 'song', s: score(s.song_title) * 10 + 2, song: s })), ...d.albums.map((a) => ({ t: 'album', s: score(a.title) * 10 + 1, a }))].sort((x, y) => y.s - x.s)[0];
  if (!c) return '';
  if (c.t === 'artist') { const songs = songsByArtist(c.a.artist_id); return `<article class="top-card clickable" tabindex="0" role="link" data-open-artist="${c.a.artist_id}" ${songs.length ? `data-queue="${ids(songs).join(',')}"` : ''}><span class="top-art round" data-artist-photo-host="${c.a.artist_id}" style="background:${grad(c.a.artist_id)}">${artistArtwork(c.a)}</span><h3>${esc(c.a.artist_name)}</h3><span class="type-pill">Artist</span>${songs.length ? `<button type="button" class="hover-play" data-play="${songs[0].song_id}" aria-label="Play ${esc(c.a.artist_name)}">${icon('play')}</button>` : ''}</article>`; }
  if (c.t === 'album') return `<article class="top-card clickable" tabindex="0" role="link" data-open-album="${c.a.album_id}" data-queue="${ids(c.a.songs).join(',')}"><span class="top-art">${albumArt({ song_id: c.a.album_id, album: c.a }, 'large')}</span><h3>${esc(c.a.title)}</h3><p><span class="type-pill">Album</span> ${esc(c.a.artist?.artist_name || '')}</p><button type="button" class="hover-play" data-play="${c.a.songs[0].song_id}" aria-label="Play ${esc(c.a.title)}">${icon('play')}</button></article>`;
  const s = c.song;
  return `<article class="top-card clickable" tabindex="0" role="link" ${s.album ? `data-open-album="${s.album.album_id}"` : ''} data-queue="${ids(d.songs).join(',')}"><span class="top-art">${albumArt(s, 'large')}</span><h3>${esc(s.song_title)}</h3><p><span class="type-pill">Song</span> ${esc(s.album?.artist?.artist_name || '')}</p><button type="button" class="hover-play" data-play="${s.song_id}" aria-label="Play ${esc(s.song_title)}">${icon('play')}</button></article>`;
}
function browseAllHtml() {
  const g = state.genres;
  const tiles = g.length ? g.map((x, i) => `<button type="button" class="browse-tile" data-genre="${x.genre_id}" style="background:${BROWSE_COLORS[i % BROWSE_COLORS.length]}"><span>${esc(x.genre_name)}</span><i>${icon('music')}</i></button>`).join('')
    : [['Podcasts', 'podcasts', 'mic'], ['Your library', 'playlists', 'library'], ['Artists', 'artists', 'users'], ['Recently played', 'history', 'clock']].map(([label, page, ico], i) => `<button type="button" class="browse-tile" data-nav="${page}" style="background:${BROWSE_COLORS[i * 2 % BROWSE_COLORS.length]}"><span>${label}</span><i>${icon(ico)}</i></button>`).join('');
  void ensureKaraokeCatalog();
  return `<div id="karaoke-promo-slot">${karaokePromoHtml()}</div>${moodTilesHtml()}<div class="section-heading"><h2>Browse all</h2></div><div class="browse-grid">${tiles}</div>`;
}
function searchResultsHtml() {
  const d = searchData(), tab = state.searchTab, genre = state.searchGenre && state.genres.find((x) => Number(x.genre_id) === Number(state.searchGenre));
  if (!d.q && !state.searchGenre) return browseAllHtml();
  const any = d.songs.length || d.artists.length || d.albums.length || d.playlists.length || d.shows.length || (d.q && (state.peopleResults.length || state.peopleLoading || tab === 'people'));
  const genreChip = genre ? `<div class="genre-chip"><span>${esc(genre.genre_name)}</span><button type="button" data-clear-genre aria-label="Clear genre filter">${icon('close')}</button></div>` : '';
  if (!any && tab !== 'people') return `${genreChip}<div class="empty-state"><h3>No results found${d.q ? ` for “${esc(state.searchQuery)}”` : ''}</h3><p>Check your spelling, or try fewer or different keywords.</p></div>`;
  const tabs = [['all', 'All', true], ['songs', 'Songs', d.songs.length], ['artists', 'Artists', d.artists.length], ['albums', 'Albums', d.albums.length], ['playlists', 'Playlists', d.playlists.length], ['podcasts', 'Podcasts', d.shows.length], ['people', 'People', Boolean(d.q)]].filter((t) => t[2]).map(([k, l]) => `<button type="button" class="${tab === k ? 'active' : ''}" data-search-tab="${k}">${l}</button>`).join('');
  const sec = (title, html) => html ? `<section class="search-section"><div class="section-heading"><h2>${title}</h2></div>${html}</section>` : '';
  const songsHtml = (full) => d.songs.length ? trackTable(full ? d.songs : d.songs.slice(0, 4), { queue: ids(d.songs), header: false, showAlbum: full }) : '';
  const artistsHtml = d.artists.length ? `<div class="shelf">${d.artists.slice(0, tab === 'artists' ? 60 : 7).map(artistCard).join('')}</div>` : '';
  const albumsHtml = d.albums.length ? `<div class="shelf">${d.albums.slice(0, tab === 'albums' ? 60 : 7).map(albumTile).join('')}</div>` : '';
  const plHtml = d.playlists.length ? `<div class="shelf">${d.playlists.map((p, i) => `<article class="release-tile card-link" tabindex="0" role="link" data-openplaylist="${p.playlist_id}"><span class="release-art"><span class="placeholder-art large" style="background:${grad(i)}">${icon('music')}</span></span><strong>${esc(p.playlist_name)}</strong><small>Playlist · You</small></article>`).join('')}</div>` : '';
  const peopleHtml = d.q ? peopleSearchSection() : '';
  const showHtml = d.shows.length ? `<div class="shelf">${d.shows.map(showCard).join('')}</div>` : '';
  let body;
  if (tab === 'songs') body = sec('Songs', songsHtml(true));
  else if (tab === 'artists') body = sec('Artists', artistsHtml);
  else if (tab === 'albums') body = sec('Albums', albumsHtml);
  else if (tab === 'playlists') body = sec('Playlists', plHtml);
  else if (tab === 'podcasts') body = sec('Podcasts', showHtml);
  else if (tab === 'people') body = sec('People', peopleHtml);
  else {
    const top = topResultHtml(d);
    body = `${top || d.songs.length ? `<div class="search-top">${top ? `<section><div class="section-heading"><h2>Top result</h2></div>${top}</section>` : ''}${d.songs.length ? `<section><div class="section-heading"><h2>Songs</h2></div>${songsHtml(false)}</section>` : ''}</div>` : ''}${sec('Artists', artistsHtml)}${sec('Albums', albumsHtml)}${sec('Playlists', plHtml)}${sec('Podcasts', showHtml)}${state.peopleResults.length ? sec('People', peopleHtml) : ''}`;
  }
  return `${genreChip}<div class="home-chips search-tabs">${tabs}</div>${body}`;
}
function renderSearchResults() {
  const box = document.getElementById('search-results'); if (!box) return;
  box.innerHTML = searchResultsHtml();
  bindContent(box); bindMusic(box); bindSearchBits(box); syncHearts(); markPlaying();
}
function bindSearchBits(root) {
  root.querySelectorAll('[data-search-tab]').forEach((b) => b.onclick = () => { state.searchTab = b.dataset.searchTab; if (state.searchTab === 'people' && state.peopleQueryLoaded !== String(state.searchQuery || '').trim()) void loadPeopleSearch(); renderSearchResults(); });
  root.querySelectorAll('[data-genre]').forEach((b) => b.onclick = () => { state.searchGenre = Number(b.dataset.genre); state.searchTab = 'all'; renderSearchResults(); });
  root.querySelectorAll('[data-clear-genre]').forEach((b) => b.onclick = () => { state.searchGenre = null; renderSearchResults(); });
}
function artists() {
  shell(`<div class="home-chips"><button class="active" data-nav="artists">All artists</button><button data-nav="liked-artists">Following</button></div><div class="artist-grid">${state.artists.map((a, i) => artistCard(a, i, { follow: true })).join('') || '<div class="empty">No active artists found.</div>'}</div>`, 'Artists', 'Discover and follow artists.');
}
function likedArtists() { followers(); }
function bindFavoriteButtons() { /* Follow buttons are handled globally (see the document click handler). */ }
const personName = (uid) => state.socialProfiles?.[String(uid)]?.display_name || `Listener ${String(uid || '').slice(0, 6)}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };
function followerRows() {
  return uniqueFollowIds('followers').map(id => {
    const r = (state.followers || []).find(x => String(x.follower_user_id) === id) || {};
    const p = state.ownFollowerNames?.[id] || state.socialProfiles?.[id] || {};
    return { id, name: p.display_name || p.username || personName(id), since: r.date_followed, photo: p.profile_photo_path || p.profile_photo_url || null };
  });
}
async function hydrateOwnFollowerNames() {
  if (state.ownFollowerNamesLoaded || state.ownFollowerNamesPending || !state.user) return;
  state.ownFollowerNamesPending = true;
  try {
    const { data, error } = await db.rpc('soundwave_my_follower_labels');
    if (error) { console.warn('Follower directory unavailable; run the included SQL migration', error.message); return; }
    state.ownFollowerNames = {};
    for (const p of (data || [])) {
      state.ownFollowerNames[String(p.user_id)] = p;
      state.socialProfiles = { ...(state.socialProfiles || {}), [String(p.user_id)]: { ...(state.socialProfiles?.[String(p.user_id)] || {}), ...p } };
    }
    state.ownFollowerNamesLoaded = true;
    if (['followers', 'liked-artists'].includes(state.page)) render();
  } finally { state.ownFollowerNamesPending = false; }
}
function uniqueFollowIds(direction) {
  const key = direction === 'followers' ? 'follower_user_id' : 'followed_user_id';
  return [...new Set((state[direction] || []).map(r => String(r[key] || '')).filter(id => id && id !== String(state.user?.id)))];
}
function myFollowerCount() { return uniqueFollowIds('followers').length; }
function myFollowingCount() { return uniqueFollowIds('following').length; }
const followingArtists = () => state.artists.filter((a) => isFollowing(a.artist_id) && !isOwnArtist(a));
const followNav = () => (hasArtistAccess() ? 'followers' : 'liked-artists');
const followLabel = () => (hasArtistAccess() ? 'Followers' : 'Following');
// Names of accounts followed by the current user, retrieved by UUID rather than search text.
let followingDirectoryPending = false;
async function hydrateFollowingDirectory() {
  if (!state.user || followingDirectoryPending) return;
  const ids = uniqueFollowIds('following');
  if (!ids.length) return;
  followingDirectoryPending = true;
  try {
    const { data, error } = await db.rpc('soundwave_my_following_labels');
    if (error) { console.warn('Following directory unavailable; apply the included SQL migration', error.message); return; }
    let changed = false;
    for (const p of data || []) {
      const key = String(p.user_id);
      const existing = state.socialProfiles?.[key] || {};
      state.socialProfiles = { ...(state.socialProfiles || {}), [key]: { ...existing, ...p } };
      changed = true;
    }
    if (changed && ['followers', 'liked-artists'].includes(state.page)) backgroundRender();
  } finally { followingDirectoryPending = false; }
}
const followerImageRequests = new Map();
function followerAvatar(r, i = 0) {
  const key = String(r.id || '');
  const record = state.socialProfiles?.[key] || {};
  const url = publicProfileImageUrl(record) || publicProfileImageUrl({ profile_photo_path: r.photo });
  if (!url) void resolveFollowerImage(r);
  return `<span class="member-avatar sw-social-avatar" data-social-avatar="${esc(key)}" style="background:${grad(i)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">` : `<span class="sw-social-initial">${esc((r.name || '?')[0].toUpperCase())}</span>`}</span>`;
}
async function resolveFollowerImage(r) {
  const key = String(r.id || ''); if (!key || followerImageRequests.has(key) || !state.user) return;
  const name = String(r.name || '').trim(); if (name.length < 2) return;
  const task = (async () => {
    try {
      const { data, error } = await db.rpc('soundwave_search_public_people', { p_query: name.slice(0, 80), p_limit: 30 });
      if (error) return;
      const person = (data || []).find(p => String(p.user_id) === key);
      if (!person) return;
      state.socialProfiles[key] = { ...(state.socialProfiles[key] || {}), ...person };
      const url = publicProfileImageUrl(person); if (!url) return;
      document.querySelectorAll('[data-social-avatar]').forEach(host => {
        if (host.dataset.socialAvatar !== key) return;
        host.replaceChildren(); const img = document.createElement('img'); img.src = url; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; host.append(img);
      });
    } catch (e) { console.info('Follower photo lookup unavailable', e); }
  })(); followerImageRequests.set(key, task); await task;
}

// Resolve a follower to a public People profile; never substitute another account by name.
async function openFollowerPublicProfile(userId, displayName = '') {
  const uid = String(userId || '').trim();
  if (!uid) { toast('Follower account identifier is unavailable.', true); return; }
  if (uid === String(state.user?.id)) { navigate('profile'); return; }
  const linked = (state.artists || []).find(a => String(a.user_id) === uid);
  if (linked) { navigate('artist-detail', { selectedArtist: Number(linked.artist_id) }); return; }
  let person = state.socialProfiles?.[uid] || state.ownFollowerNames?.[uid] || (state.peopleResults || []).find(p => String(p.user_id) === uid);
  if (!person?.user_id || !person.display_name) {
    // A direct authenticated directory resolves accounts you follow by ID.
    const { data, error } = await db.rpc('soundwave_my_following_labels');
    if (error) { console.warn('Following directory unavailable', error); toast('Profile directory is unavailable. Apply the included SQL.', true); return; }
    for (const p of data || []) state.socialProfiles[String(p.user_id)] = { ...(state.socialProfiles[String(p.user_id)] || {}), ...p };
    person = state.socialProfiles?.[uid] || person;
  }
  if (!person?.user_id) { toast('This account could not be found in your social connections.', true); return; }
  // Profile view shows only public data; never silently navigate by an ambiguous name.
  if (String(person.profile_visibility || 'Public').toLowerCase() !== 'public') {
    toast('This account has a private profile.', true); return;
  }
  navigate('person-detail', { selectedPerson: person });
  void loadPublicPersonPlaylists(uid);
}

function followers() {
  const isArtist = hasArtistAccess();
  const tab = state.page === 'followers' ? 'followers' : 'following';
  if (!state.ownFollowerNamesLoaded) void hydrateOwnFollowerNames();
  if (uniqueFollowIds('following').some(uid => !state.socialProfiles?.[uid]?.display_name)) void hydrateFollowingDirectory();
  const fans = followerRows();
  const followingIds = uniqueFollowIds('following');
  const byOwner = new Map((state.artists || []).filter(a => a.user_id).map(a => [String(a.user_id), a]));
  // Derive both lists and counts from user_follow. Artist data is presentation only.
  const followersList = fans.length ? fans.map((r, i) => `<div class="social-row"><button type="button" class="social-link sw-follower-link" data-open-follower="${esc(String(r.id || ''))}" data-follower-name="${esc(r.name || '')}" aria-label="View ${esc(r.name)} profile">${followerAvatar(r, i)}<span><strong>${esc(r.name)}</strong><small>${r.since ? `Followed you ${esc(fmtDate(r.since))}` : 'Follows you'}</small></span></button></div>`).join('') : `<div class="empty">No followers yet.</div>`;
  const followingList = followingIds.length ? followingIds.map((uid, i) => {
    const a = byOwner.get(uid);
    if (a) return `<div class="social-row"><button type="button" class="social-link" data-open-artist="${a.artist_id}"><span class="member-avatar sw-social-avatar" data-artist-photo-host="${Number(a.artist_id)}" style="background:${grad(i)}">${artistArtwork(a, 'sw-social-avatar-photo')}</span><span><strong>${esc(a.artist_name)}</strong><small>Artist${followerText(a.artist_id) ? ' · ' + followerText(a.artist_id) : ''}</small></span></button>${followBtn(a, 'sm')}</div>`;
    const p = state.socialProfiles?.[uid] || {};
    const name = p.display_name || p.username || `Listener ${uid.slice(0, 6)}`;
    return `<div class="social-row"><button type="button" class="social-link sw-follower-link" data-open-follower="${esc(uid)}" data-follower-name="${esc(name)}" aria-label="View ${esc(name)} profile">${followerAvatar({ id: uid, name, photo: p.profile_photo_path || p.profile_photo_url }, i)}<span><strong>${esc(name)}</strong><small>Listener</small></span></button><button type="button" class="button sm danger sw-listener-unfollow" data-unfollow-listener="${esc(uid)}" aria-label="Unfollow ${esc(name)}">− Unfollow</button></div>`;
  }).join('') : `<div class="empty">You are not following anyone yet. <button type="button" class="text-link" data-nav="artists">Discover artists</button></div>`;
  const chips = `<div class="home-chips"><button class="${tab === 'followers' ? 'active' : ''}" data-nav="followers">Followers</button><button class="${tab === 'following' ? 'active' : ''}" data-nav="liked-artists">Following</button><button data-nav="artists">Discover artists</button></div>`;
  const stats = `<div class="social-stats"><div><strong>${myFollowerCount()}</strong><span>Followers</span></div><div><strong>${myFollowingCount()}</strong><span>Following</span></div></div>`;
  const needsSql = false;
  shell(`${chips}${stats}${needsSql ? `<div class="notice">To see who follows your artist profile, run <code>sql/RUN_ME_likes_and_followers.sql</code> once in the Supabase SQL Editor, then refresh this page.</div>` : ''}<section class="social-list">${tab === 'followers' ? followersList : followingList}</section>`, tab === 'followers' ? 'Followers' : 'Following', 'Your SoundWave social connections.');
}

function profile() {
  const display = state.profile?.display_name || state.user?.email?.split('@')[0] || 'SoundWave user';
  const st = state.profileStats || {};
  const followerCount = myFollowerCount();
  const followingCount = myFollowingCount();
  const playlistCount = Number(st.playlist_count ?? state.playlists.length ?? 0);
  const role = hasAdminAccess() ? (hasArtistAccess() ? 'Artist + Admin' : 'Admin') : hasArtistAccess() ? 'Artist' : 'Listener';
  const premiumName = state.entitlement?.plan_name || 'Premium';
  const avatar = state.profilePhotoUrl ? `<img src="${esc(state.profilePhotoUrl)}" alt="${esc(display)}">` : esc(display[0]?.toUpperCase() || 'S');
  shell(`<section class="profile-card-v26"><div class="profile-identity-row"><button type="button" class="profile-avatar-v26 profile-photo-btn ${isPremiumUser() ? 'premium-user' : ''}" id="profile-photo-btn" title="Change profile photo">${avatar}<span class="profile-photo-edit">${icon('upload')}</span></button><div class="profile-identity-copy"><span class="eyebrow">YOUR PROFILE</span><h2>${esc(display)}</h2><div class="profile-badge-row"><span class="role-badge">${esc(role)}</span>${isPremiumUser() ? `<span class="mini-premium-chip">${icon('check')} ${esc(premiumName)}</span>` : ''}</div></div><button class="button secondary sm profile-edit-v26" id="edit-profile-btn">Edit</button></div><div class="profile-stat-row"><button data-nav="followers"><strong>${followerCount}</strong><span>Followers</span></button><button data-nav="liked-artists"><strong>${followingCount}</strong><span>Following</span></button><button data-nav="playlists"><strong>${playlistCount}</strong><span>Playlists</span></button>${isPremiumUser() ? `<button data-nav="downloads"><strong>${state.offlineDownloads.length}</strong><span>Downloads</span></button>` : ''}</div><div class="profile-action-grid-v26">${hasArtistAccess() ? `<button data-nav="studio">${icon('upload')}<span><strong>Artist Studio</strong><small>Releases and analytics</small></span></button>` : ''}<button data-nav="playlists">${icon('library')}<span><strong>Your Library</strong><small>Playlists and saved music</small></span></button><button data-nav="history">${icon('clock')}<span><strong>Recently played</strong><small>Your listening activity</small></span></button><button data-nav="plans">${icon('check')}<span><strong>${isPremiumUser() ? 'Manage Premium' : 'Premium'}</strong><small>${isPremiumUser() ? esc(premiumName) : 'View available plans'}</small></span></button></div></section><div class="profile-danger-zone"><button class="button danger" id="deactivate-account">Deactivate account</button><button class="button secondary profile-signout" id="profile-page-signout">Sign out</button></div><input type="file" accept="image/jpeg,image/png,image/webp" id="profile-photo-file" hidden><dialog class="sw-modal" id="edit-profile-dialog"><div class="modal-head"><div><span class="eyebrow">PROFILE</span><h2>Edit your profile</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><form id="edit-profile-form"><label class="single-field">Display name<input id="profile-display-name" value="${esc(display)}" required maxlength="90"></label><p class="muted small">Profile photos are stored securely in your SoundWave profile.</p><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button">Save</button></div></form></dialog>`, 'Profile', 'Your SoundWave identity, library and account.');
  $('#edit-profile-btn').onclick = () => $('#edit-profile-dialog').showModal();
  $('#profile-photo-btn').onclick = () => $('#profile-photo-file').click();
  $('#profile-photo-file').onchange = e => action(async () => { const file = e.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP image.'); if (file.size > 5 * 1048576) throw Error('Profile photo must be under 5 MB.'); const ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); const path = `${state.user.id}/avatar.${ext}`; check(await db.storage.from('profile-images').upload(path, file, { upsert: true, contentType: file.type })); check(await db.from('users').update({ profile_photo_path: path }).eq('user_id', state.user.id)); await loadData(); render(); toast('Profile photo updated'); });
  $('#edit-profile-form').onsubmit = e => { e.preventDefault(); action(async () => { const displayName = val('profile-display-name'); const problem = plainNameProblem(displayName, 'Display name', 90); if (problem) throw Error(problem); if (hasArtistAccess()) { const availability = await checkArtistIdentityAvailability(displayName, state.artist?.artist_name || ''); if (!availability.displayAvailable && displayName.toLowerCase() !== String(state.profile?.display_name || '').trim().toLowerCase()) throw Error('That display name is already taken. Choose another one.'); } check(await db.from('users').update({ display_name: displayName }).eq('user_id', state.user.id)); await loadData(); render(); toast('Profile updated'); }); };
  $('#deactivate-account')?.addEventListener('click', () => { if (!confirm('Deactivate your SoundWave account? Your public content will be hidden until you restore the account.')) return; action(async () => { check(await db.rpc('deactivate_my_account')); await loadData(); render(); toast('Account deactivated'); }); });
  $('#profile-page-signout')?.addEventListener('click', () => action(async () => { await stopAudio(); cleanupSessionRuntime(); document.getElementById('soundwave-player')?.remove(); check(await db.auth.signOut()); }));
}

// Fetches one playlist's songs, collaborators and member names together (three requests at once).
async function fetchPlaylistData(id) {
  const chosen = state.playlists.find(p => Number(p.playlist_id) === id);
  const collabQuery = chosen?.user_id === state.user.id ? db.rpc('playlist_collaborators_for_owner', { p_playlist_id: id }) : db.from('playlist_collaborator').select('playlist_id,user_id,date_added').eq('playlist_id', id).order('date_added');
  // A restricted RPC resolves member names without opening the users table to all clients.
  const labelsQuery = chosen ? db.rpc('soundwave_playlist_member_labels', { p_playlist_id: id }) : null;
  let sq = await db.from('playlist_song').select('playlist_id,song_id,track_order,date_added').eq('playlist_id', id).order('track_order');
  if (sq.error && /date_added/i.test(String(sq.error?.message || ''))) sq = await db.from('playlist_song').select('playlist_id,song_id,track_order').eq('playlist_id', id).order('track_order');
  const c = await collabQuery;
  let labels = null, labelError = null;
  if (labelsQuery) {
    const r = await labelsQuery;
    labels = {};
    if (r.error) labelError = r.error; else (r.data || []).forEach(row => { labels[String(row.user_id)] = row; });
  }
  return { songsError: sq.error || null, songs: sq.error ? [] : (sq.data || []), collabError: c.error || null, collabs: c.error ? [] : (c.data || []), labels, labelError };
}
function cacheEntry(d) { const labels = d.labels || {}; return { sig: JSON.stringify([d.songs, d.collabs, labels]), songs: d.songs, collabs: d.collabs, labels }; }
// Warm the cache before the user clicks (on hover and shortly after sign-in), so opening is instant.
function prefetchPlaylist(id) {
  id = Number(id);
  if (!id || !state.user || playlistCache[id] || playlistPrefetching.has(id)) return;
  playlistPrefetching.add(id);
  fetchPlaylistData(id).then(d => { if (!d.songsError && state.user && !playlistCache[id]) playlistCache[id] = cacheEntry(d); }).catch(() => { }).finally(() => playlistPrefetching.delete(id));
}
function prefetchAllPlaylists() {
  if (state.prefetchedPlaylists || !state.user || !state.playlists?.length) return;
  state.prefetchedPlaylists = true;
  setTimeout(() => (state.playlists || []).slice(0, 12).forEach((p, i) => setTimeout(() => prefetchPlaylist(p.playlist_id), i * 150)), 1200);
}
document.addEventListener('pointerover', (e) => { const t = e.target.closest?.('[data-openplaylist]'); if (t) prefetchPlaylist(t.dataset.openplaylist); }, { passive: true });
async function playlistDetail() {
  if (!state.selectedPlaylist) return;
  const id = Number(state.selectedPlaylist);
  const d = await fetchPlaylistData(id);
  if (d.songsError) toast(humanErr(d.songsError), true);
  if (d.collabError) console.warn('Collaborators unavailable', d.collabError);
  if (d.labelError) console.warn('Playlist member labels unavailable; run 01_MEMBER_FOLLOWER_DIRECTORY.sql', d.labelError.message);
  state.playlistSongs = d.songs; state.playlistCollaborators = d.collabs;
  if (d.labels) state.playlistMemberLabels = d.labels;
  const entry = cacheEntry(d);
  if (!d.songsError) playlistCache[id] = entry;
  if (state.page !== 'playlists' || Number(state.selectedPlaylist) !== id) return; // user already moved on
  if (playlistShownSig === entry.sig) { playlistShownSig = null; return; } // cached view was already up to date
  playlistShownSig = null;
  render();
}
// ---- Busy overlay: an obvious "working on it" message for actions that take a few seconds ---------------
function showBusyOverlay(title, detail) {
  hideBusyOverlay();
  const el = document.createElement('div'); el.id = 'sw-busy-overlay'; el.className = 'sw-busy-overlay'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="sw-busy-card"><span class="sw-busy-spinner" aria-hidden="true"></span><div><strong></strong><small></small></div></div>';
  el.querySelector('strong').textContent = title || 'Working…';
  const small = el.querySelector('small'); if (detail) small.textContent = detail; else small.remove();
  document.body.append(el);
  document.querySelectorAll('[data-create-playlist]').forEach(b => { b.setAttribute('aria-busy', 'true'); b.classList.add('is-busy'); });
}
function hideBusyOverlay() {
  document.getElementById('sw-busy-overlay')?.remove();
  document.querySelectorAll('[data-create-playlist].is-busy').forEach(b => { b.removeAttribute('aria-busy'); b.classList.remove('is-busy'); });
}
// Fast-create mirrors a listening-first library: no mandatory forms or interruptions.
// Private by default. Public requires at least one song (BR-017).
async function quickCreatePlaylist() {
  showBusyOverlay('Creating your playlist…', 'This only takes a moment.');
  try { await quickCreatePlaylistInner(); } finally { hideBusyOverlay(); }
}
async function quickCreatePlaylistInner() {
  const next = state.playlists.reduce((highest, p) => { const m = /^My Playlist #(\d+)$/i.exec(p.playlist_name || ''); return m ? Math.max(highest, Number(m[1])) : highest; }, 0) + 1;
  // Use the controlled RPC instead of a direct INSERT. This keeps playlist
  // creation stable even when playlist SELECT/RLS rules change later.
  const created = check(await db.rpc('create_my_playlist', {
    p_name: `My Playlist #${next}`,
    p_description: null,
    p_visibility: 'Private'
  }));
  const result = Array.isArray(created) ? created[0] : created;
  if (!result?.playlist_id) throw Error('Playlist was created but no playlist id was returned.');
  state.selectedPlaylist = Number(result.playlist_id); state.playlistSongs = []; state.page = 'playlists';
  await loadData(); await playlistDetail(); render(); toast('Playlist created');
}
function playlists() {
  const chosen = state.playlists.find((p) => p.playlist_id === state.selectedPlaylist);
  if (!chosen) return libraryOverview();
  const rows = state.playlistSongs.map((ps) => songById(ps.song_id) || { song_id: ps.song_id, song_title: 'Unavailable song', duration_seconds: null, album: null });
  const queueIds = rows.map((s) => s.song_id);
  const available = state.songs.filter((s) => !state.playlistSongs.some((p) => p.song_id === s.song_id)).slice(0, 10);
  const idx = state.playlists.findIndex((p) => p.playlist_id === chosen.playlist_id);
  const isOwner = String(chosen.user_id) === String(state.user?.id);
  const isCollaborator = !isOwner && state.playlistCollaborators.some(c => String(c.user_id) === String(state.user?.id));
  const ownerProfile = state.playlistMemberLabels?.[String(chosen.user_id)] || state.socialProfiles?.[String(chosen.user_id)] || (String(chosen.user_id) === String(state.user?.id) ? (state.profile || {}) : {});
  const display = isOwner ? (state.profile?.display_name || state.profile?.username || 'You') : (ownerProfile.display_name || ownerProfile.username || 'Playlist owner');
  const accessLabel = isOwner ? 'You own this playlist' : isCollaborator ? 'You are a collaborator' : 'Listening to someone else’s playlist';
  const covers = rows.filter((s) => s.album?.cover_path && state.coverUrls[s.album.cover_path]);
  const collageTile = (song, n) => { const path = song?.cover_path || song?.album?.cover_path, url = path && state.coverUrls?.[path]; return url ? `<span class="cover-collage-tile"><img src="${esc(url)}" alt="" loading="lazy"></span>` : `<span class="cover-collage-tile placeholder-art" style="background:${grad((song?.song_id || 0) + n)}">${icon('music')}</span>`; };
  const cover = chosen.cover_path && state.coverUrls[chosen.cover_path] ? `<img class="cover-img playlist-main-cover" src="${esc(state.coverUrls[chosen.cover_path])}" alt="${esc(chosen.playlist_name)}">` : covers.length >= 4 ? `<div class="cover-collage">${covers.slice(0, 4).map((s, n) => collageTile(s, n)).join('')}</div>` : covers.length ? `<img class="cover-img playlist-main-cover" src="${esc(state.coverUrls[covers[0].cover_path || covers[0].album?.cover_path])}" alt="" loading="lazy">` : `<span class="placeholder-art large" style="background:${grad(idx)}">${icon('music')}</span>`;
  const collab = state.playlistCollaborators.map((c, i) => { const profile = state.playlistMemberLabels?.[String(c.user_id)] || state.socialProfiles?.[String(c.user_id)] || (String(c.user_id) === String(state.user?.id) ? state.profile : {}) || {}; const name = profile.display_name || profile.username || c.display_name || (String(c.user_id) === String(state.user?.id) ? 'You' : 'Collaborator'); return `<div class="collab-row"><span class="member-avatar">${esc(name[0].toUpperCase())}</span><div><strong>${esc(name)}</strong>${profile.username && profile.username !== name ? `<small>@${esc(profile.username)}</small>` : ''}<small>Collaborator${c.date_added ? ` · ${esc(c.date_added)}` : ''}</small></div>${isOwner ? `<button type="button" class="icon-quiet" data-collab-remove="${esc(c.user_id)}" aria-label="Remove collaborator">${icon('close')}</button>` : ''}</div>`; }).join('');
  state.tint = tintFor(chosen.playlist_id);
  shell(`<header class="coll-hero"><div class="coll-cover">${cover}</div><div class="coll-meta"><span class="coll-kind">${esc(chosen.visibility)} playlist</span><h1 class="coll-title">${esc(chosen.playlist_name)}</h1>${chosen.description ? `<p class="coll-desc">${esc(chosen.description)}</p>` : ''}<p class="coll-sub"><span class="sw-owner-avatar">${esc(display[0]?.toUpperCase() || 'S')}</span><strong>${esc(display)}</strong> <span class="sw-owner-marker">${isOwner ? "Owner (you)" : "Owner"}</span> · ${rows.length} ${rows.length === 1 ? 'song' : 'songs'}${rows.length ? ', ' + totalTime(rows) : ''}${state.playlistCollaborators.length ? ` · ${state.playlistCollaborators.length} collaborators` : ''}</p><p class="sw-playlist-access">${esc(accessLabel)}</p><div id="playlist-presence" class="playlist-presence">${playlistPresenceHtml()}</div></div></header>
<div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${queueIds.join(',')}" ${!queueIds.length ? 'disabled' : ''} aria-label="Play playlist">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${queueIds.join(',')}" aria-label="Shuffle play this playlist" ${!queueIds.length ? 'disabled' : ''}>${icon('shuffle')} Shuffle</button><div class="more-wrap"><button type="button" class="sw-more" id="sw-more-menu" aria-label="More options">${icon('dots')}</button><div id="sw-more-options" class="sw-more-options" hidden>${isOwner ? `<button type="button" data-open-modal="playlist-edit-dialog">${icon('settings')} Edit playlist</button><button type="button" data-open-modal="playlist-collab-dialog">${icon('users')} Collaborators</button><button type="button" id="deactivate">Delete playlist</button>` : `<button type="button" data-open-modal="playlist-collab-dialog">${icon('users')} View collaborators</button>`}</div></div></div>
${rows.length ? trackTable(rows, { queue: queueIds, remove: isOwner || isCollaborator, extraLabel: 'Date added', extraClass: 'date-added', extraCell: (_, i) => { const added = playlistSongAddedAt(state.playlistSongs[i] || {}); return added ? `<span title="${esc(new Date(added).toLocaleString())}">${esc(agoText(added))}</span>` : 'Recently'; } }) : `<div class="sw-playlist-empty"><h3>Let’s find something for your playlist</h3><p>Add songs from the suggestions below, or use the ••• menu on any song.</p></div>`}
${isOwner || isCollaborator ? `<section class="sw-add-section"><div class="section-heading"><h2>Recommended</h2><button type="button" class="text-link" data-nav="music">Browse all music</button></div><div class="sw-song-results">${playlistSongSuggestions(available)}</div></section>` : ""}
<dialog class="sw-modal edit-surface-dialog reference-edit-dialog" id="playlist-edit-dialog"><div class="edit-surface-head"><div><span class="eyebrow">PLAYLIST SETTINGS</span><h2>Edit playlist</h2><p>Update how this playlist appears to listeners.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close">${icon('close')}</button></div><form class="edit-surface-form" id="editplaylist"><div class="edit-surface-grid reference-edit-grid"><div class="edit-art-column"><label class="cover-drop edit-cover-drop reference-cover-card" for="editplcover"><span id="playlist-cover-preview">${cover}</span><span class="cover-change-badge">${icon('album')}</span><input id="editplcover" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" class="button secondary artwork-trigger" onclick="document.getElementById('editplcover')?.click()">${icon('upload')} Change artwork</button><small>JPG, PNG or WebP · up to 5 MB</small></div><div class="edit-fields"><label class="single-field">Playlist name<input id="editplname" maxlength="100" value="${esc(chosen.playlist_name)}" required><small class="char-counter" id="playlist-name-count">${String(chosen.playlist_name || '').length} / 100</small></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="editpldesc" maxlength="300" placeholder="Describe this playlist">${esc(chosen.description || '')}</textarea><small class="char-counter" id="playlist-desc-count">${String(chosen.description || '').length} / 300</small></label><div class="single-field"><span>Visibility</span><div class="visibility-cards"><label class="visibility-card"><input type="radio" name="playlist_visibility_choice" value="Public" ${chosen.visibility === 'Public' ? 'checked' : ''}><span>${icon('users')}</span><strong>Public</strong><small>Anyone can discover and listen</small><i></i></label><label class="visibility-card"><input type="radio" name="playlist_visibility_choice" value="Private" ${chosen.visibility !== 'Public' ? 'checked' : ''}><span>${icon('lock')}</span><strong>Private</strong><small>Only you can access this playlist</small><i></i></label></div><select id="editplvis" hidden><option value="Private" ${chosen.visibility === 'Private' ? 'selected' : ''}>Private</option><option value="Public" ${chosen.visibility === 'Public' ? 'selected' : ''}>Public</option></select><small class="field-help">Public playlists must contain at least one song.</small></div></div></div><div class="dialog-actions edit-surface-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy>Save changes</button></div></form></dialog>
<dialog class="sw-modal" id="playlist-collab-dialog"><div class="modal-head"><div><span class="eyebrow">PLAYLIST</span><h2>Collaborators</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close">${icon('close')}</button></div><div class="collab-list">${collab || '<p class="muted">No collaborators yet.</p>'}</div>${isOwner ? `<div class="collab-invite"><h3>Invite with a link</h3><p class="muted">Create a one-time link and send it to the person you want to collaborate with. They only need to sign in and open the link.</p><button type="button" class="button" id="create-collab-link">${icon('users')} Copy invite link</button><p class="footnote">No UUID is exposed to the user. Invite links expire after 7 days and can be used once.</p></div>` : ""}</dialog>`, '', '');
  $('#editplcover')?.addEventListener('change', e => { const file = e.target.files?.[0], preview = $('#playlist-cover-preview'); if (!file || !preview) return; const url = URL.createObjectURL(file); preview.innerHTML = `<img class="cover-img" src="${esc(url)}" alt="Selected playlist cover">`; preview.querySelector('img')?.addEventListener('load', () => URL.revokeObjectURL(url), { once: true }); });
  document.querySelectorAll('input[name="playlist_visibility_choice"]').forEach(r => r.addEventListener('change', () => { const sel = $('#editplvis'); if (sel) sel.value = r.value; }));
  const plName = $('#editplname'), plDesc = $('#editpldesc');
  plName?.addEventListener('input', () => { const el = $('#playlist-name-count'); if (el) el.textContent = `${plName.value.length} / 100`; });
  plDesc?.addEventListener('input', () => { const el = $('#playlist-desc-count'); if (el) el.textContent = `${plDesc.value.length} / 300`; });
  $('#editplaylist')?.addEventListener('submit', (e) => { e.preventDefault(); action(async () => { const playlistName = val('editplname'), nameProblem = plainNameProblem(playlistName, 'Playlist name', 100); if (nameProblem) throw Error(nameProblem); const visibility = val('editplvis'); if (visibility === 'Public') { const songCheck = await db.from('playlist_song').select('song_id', { count: 'exact', head: true }).eq('playlist_id', Number(state.selectedPlaylist)); if (songCheck.error) throw Error('Could not verify playlist songs: ' + humanErr(songCheck.error)); if ((songCheck.count || 0) < 1) throw Error('BR-017: Add at least one song before making this playlist public.'); } let cover_path = chosen.cover_path || null; const cf = $('#editplcover')?.files?.[0]; if (cf) { if (!['image/jpeg', 'image/png', 'image/webp'].includes(cf.type)) throw Error('Choose a JPEG, PNG or WebP cover.'); if (cf.size > 5 * 1048576) throw Error('Playlist artwork must be under 5 MB.'); const ext = (cf.name.split('.').pop() || 'jpg').toLowerCase(); cover_path = `${state.user.id}/playlists/${state.selectedPlaylist}/cover.${ext}`; check(await db.storage.from('covers').upload(cover_path, cf, { upsert: true, contentType: cf.type })); } const updatePayload = { p_playlist_id: Number(state.selectedPlaylist), p_name: playlistName, p_description: val('editpldesc') || null, p_visibility: visibility, p_cover_path: cover_path }; const rpcUpdate = await db.rpc('update_my_playlist_details', updatePayload); if (rpcUpdate.error) { const missing = rpcUpdate.error.code === 'PGRST202' || Number(rpcUpdate.error.status) === 404 || /function.*(not found|schema cache)|404/i.test(rpcUpdate.error.message || ''); if (!missing) throw rpcUpdate.error; check(await db.from('playlist').update({ playlist_name: updatePayload.p_name, description: updatePayload.p_description, visibility: updatePayload.p_visibility, cover_path: updatePayload.p_cover_path }).eq('playlist_id', state.selectedPlaylist).eq('user_id', state.user.id)); } await loadData(); await playlistDetail(); toast('Playlist updated'); }); });
  $('#create-collab-link')?.addEventListener('click', () => action(async () => { const data = check(await db.rpc('create_playlist_invite', { p_playlist_id: state.selectedPlaylist })); const token = Array.isArray(data) ? data[0]?.token : data?.token || data; if (!token) throw Error('Could not create invite link.'); const url = `${location.origin}${location.pathname}?playlist_invite=${encodeURIComponent(token)}#/discover`; await navigator.clipboard.writeText(url); toast('Collaborator invite link copied'); }));
  document.querySelectorAll('[data-collab-remove]').forEach((b) => b.onclick = () => action(async () => { check(await db.from('playlist_collaborator').delete().eq('playlist_id', state.selectedPlaylist).eq('user_id', b.dataset.collabRemove)); await playlistDetail(); toast('Collaborator removed'); }));
  $('#sw-more-menu')?.addEventListener('click', (e) => { e.stopPropagation(); const m = $('#sw-more-options'); m.hidden = !m.hidden; });
  $('#deactivate')?.addEventListener('click', () => { if (!confirm('Delete this playlist?')) return; action(async () => { check(await db.from('playlist').update({ is_active: false }).eq('playlist_id', state.selectedPlaylist).eq('user_id', state.user.id)); state.selectedPlaylist = null; state.playlistSongs = []; await loadData(); render(); toast('Playlist deleted'); }); });
  bindAddSong(); bindMusic();
}
function libraryOverview() {
  const liked = state.likesAvailable ? `<article class="release-tile card-link" tabindex="0" role="link" data-nav="liked-songs"><span class="release-art"><span class="placeholder-art large liked-cover">${icon('heart')}</span></span><strong>Liked Songs</strong><small data-liked-count>${state.liked.length} songs</small></article>` : '';
  const pls = state.playlists.map((p, i) => `<article class="release-tile card-link" tabindex="0" role="link" data-openplaylist="${p.playlist_id}"><span class="release-art">${p.cover_path && state.coverUrls[p.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="">` : `<span class="placeholder-art large" style="background:${grad(i)}">${icon('music')}</span>`}</span><strong>${esc(p.playlist_name)}</strong><small>Playlist · ${esc(p.visibility)}</small></article>`).join('');
  const fav = state.artists.filter((a) => state.favorites.some((x) => x.artist_id === a.artist_id));
  state.tint = '#2d2d3d';
  shell(`<div class="section-heading"><h2>Playlists</h2></div><div class="shelf wrap"><article class="release-tile card-link create-tile" tabindex="0" role="button" data-create-playlist><span class="release-art"><span class="placeholder-art large">${icon('plus')}</span></span><strong>Create playlist</strong><small>Start a new collection</small></article>${liked}${pls}</div>${fav.length ? `<section class="shelf-section"><div class="section-heading"><h2>Artists you follow</h2></div><div class="shelf wrap">${fav.map(artistCard).join('')}</div></section>` : ''}`, 'Your Library', '');
}
function playlistSongSuggestions(songs) { return songs.length ? songs.map((s, i) => `<div class="sw-suggest-row"><div class="sw-suggest-art" style="background:${grad(i)}">♫</div><span class="sw-suggest-meta"><strong>${escapeHtml(s.song_title)}</strong><small>${escapeHtml(s.album?.artist?.artist_name || 'SoundWave')} · ${escapeHtml(s.album?.album_title || 'Song')}</small></span><span class="sw-suggest-duration">${nice(s.duration_seconds)}</span><button type="button" class="sw-add-btn" data-addsong="${s.song_id}">＋ Add</button></div>`).join('') : '<p class="sw-no-match">Your playlist already contains the available songs.</p>'; }
function bindAddSong() { document.querySelectorAll('[data-addsong]').forEach(b => b.onclick = () => action(async () => { const song_id = Number(b.dataset.addsong); check(await db.from('playlist_song').insert({ playlist_id: state.selectedPlaylist, song_id, track_order: null })); await playlistDetail(); toast('Song added'); })); document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => action(async () => { const playlist = state.playlists.find(x => x.playlist_id === state.selectedPlaylist); if (playlist?.visibility === 'Public' && state.playlistSongs.length <= 1) throw Error('BR-017: Make the playlist Private before removing its last song.'); check(await db.from('playlist_song').delete().eq('playlist_id', state.selectedPlaylist).eq('song_id', Number(b.dataset.remove))); await playlistDetail(); toast('Song removed'); })); }

function addToPlaylistDialog() {
  return `<dialog class="sw-modal playlist-picker" id="add-to-playlist-dialog"><div class="modal-head"><div><span class="eyebrow">ADD TO PLAYLIST</span><h2>Choose a playlist</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="playlist-picker-list">${state.playlists.length ? state.playlists.map((p, i) => `<button data-pick-playlist="${p.playlist_id}"><span class="library-art" style="background:${grad(i)}">${icon('music')}</span><span><strong>${escapeHtml(p.playlist_name)}</strong><small>${escapeHtml(p.visibility)} playlist</small></span>${icon('plus')}</button>`).join('') : '<p class="muted">Create a playlist first.</p>'}</div></dialog>`;
}
function openAddToPlaylist(songId) {
  state.songMenu = Number(songId); const d = $('#add-to-playlist-dialog'); if (!d) return; d.showModal();
  document.querySelectorAll('[data-pick-playlist]').forEach(b => b.onclick = () => action(async () => { check(await db.from('playlist_song').insert({ playlist_id: Number(b.dataset.pickPlaylist), song_id: state.songMenu, track_order: null })); d.close(); toast('Added to playlist'); if (state.selectedPlaylist === Number(b.dataset.pickPlaylist)) await playlistDetail(); }));
}
function bindSongMenus() {
  document.querySelectorAll('[data-song-menu]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const songId = Number(b.dataset.songMenu), song = songById(songId);
    document.querySelector('.song-action-popover')?.remove();
    const pop = document.createElement('div'); pop.className = 'song-action-popover';
    const downloaded = state.offlineDownloads.some((x) => Number(x.songId) === songId);
    const downloadLabel = isPremiumUser()
      ? (downloaded ? 'Remove download' : 'Download')
      : 'Download · Premium';
    const cqMenuBtn = (typeof crowdQueue !== 'undefined' && crowdQueue.session && crowdQueue.session.status === 'active')
      ? `<button data-menu-cq>${icon('queue')} Add to CrowdQueue</button>`
      : '';
    pop.innerHTML = `${state.likesAvailable ? `<button data-menu-like>${icon('heart')} ${isLiked(songId) ? 'Remove from Liked Songs' : 'Save to Liked Songs'}</button>` : ''}<button data-menu-queue>${icon('queue')} Add to queue</button>${cqMenuBtn}<button data-menu-add>${icon('plus')} Add to playlist</button>${song?.album ? `<button data-menu-album>${icon('album')} Go to album</button>` : ''}<button data-menu-artist>${icon('users')} Go to artist</button><button data-menu-download>${icon('download')} ${downloadLabel}</button><button data-menu-share>${icon('forward')} Share</button><button data-menu-report>${icon('flag')} Report song</button>`;
    document.body.appendChild(pop);
    const r = b.getBoundingClientRect(), h = pop.offsetHeight || 260;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left - 190))}px`;
    pop.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 100, r.bottom + 6))}px`;
    const on = (sel, fn) => pop.querySelector(sel)?.addEventListener('click', () => { pop.remove(); fn(); });
    on('[data-menu-like]', () => action(() => toggleLike(songId)));
    on('[data-menu-queue]', () => addToQueue(songId));
    on('[data-menu-cq]', () => addSongToCrowdQueue(songId));
    on('[data-menu-report]', () => openReportSong(songId));
    on('[data-menu-add]', () => openAddToPlaylist(songId));
    on('[data-menu-album]', () => navigate('album-detail', { selectedAlbum: Number(song.album.album_id) }));
    on('[data-menu-artist]', () => { const aid = song?.album?.artist?.artist_id; if (aid) navigate('artist-detail', { selectedArtist: Number(aid) }); });
    on('[data-menu-download]', () => action(async () => {
      if (!isPremiumUser()) {
        toast('Offline downloads are a Premium feature.');
        navigate('plans');
        return;
      }
      const downloaded = state.offlineDownloads.some((x) => Number(x.songId) === songId);
      if (downloaded) {
        await removeOfflineSong(songId);
        toast('Download removed');
      } else {
        await saveOfflineSong(song);
      }
      render();
    }));
    on('[data-menu-share]', async () => {
      const url = `${location.origin}${location.pathname}${song?.album ? `#/album-detail/${song.album.album_id}` : ''}`;
      const text = `${song?.song_title || 'SoundWave song'} — ${song?.album?.artist?.artist_name || 'SoundWave'}`;
      try { if (navigator.share) await navigator.share({ title: song?.song_title || 'SoundWave', text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } } catch { }
    });
  });
}
async function showDetail() { if (!state.selectedShow) return; const chosen = [...state.podcasts, ...state.myShows].find(p => Number(p.show_id) === Number(state.selectedShow)); let q = db.from('podcast_episode').select('episode_id,show_id,episode_title,description,duration_seconds,audio_path,release_at,is_active').eq('show_id', state.selectedShow).order('release_at', { ascending: false }); if (chosen?.user_id !== state.user.id) q = q.eq('is_active', true); const r = await q; if (r.error) { state.episodes = []; toast(humanErr(r.error), true) } else state.episodes = r.data || []; const sig = JSON.stringify(state.episodes), sid = Number(state.selectedShow); showCache[sid] = { sig, eps: state.episodes }; if (state.page !== 'podcasts' || Number(state.selectedShow) !== sid) return; if (showShownSig === sig) { showShownSig = null; return; } showShownSig = null; render(); }
function podcasts() {
  const chosen = [...state.podcasts, ...state.myShows].find(p => Number(p.show_id) === Number(state.selectedShow));
  state.tint = '#2f4b56';
  if (chosen) {
    const visibleEpisodes = state.episodes.filter(ep => ep.is_active || chosen.user_id === state.user.id);
    const art = chosen.cover_path && state.coverUrls[chosen.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[chosen.cover_path])}" alt="${esc(chosen.show_title)}">` : `<span class="placeholder-art large">${icon('mic')}</span>`;
    const episodeRows = visibleEpisodes.length ? visibleEpisodes.map((ep, i) => `<article class="podcast-episode-row ${ep.is_active ? '' : 'inactive'}"><button type="button" class="podcast-episode-art" ${ep.is_active ? `data-episode="${ep.episode_id}"` : ''} aria-label="${ep.is_active ? `Play ${esc(ep.episode_title)}` : `${esc(ep.episode_title)} is inactive`}">${chosen.cover_path && state.coverUrls[chosen.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[chosen.cover_path])}" alt="">` : `<span class="placeholder-art large">${icon('mic')}</span>`}${ep.is_active ? `<span class="episode-play-overlay">${icon('play')}</span>` : ''}</button><div class="podcast-episode-copy"><span class="episode-number">Episode ${i + 1}</span><strong>${escapeHtml(ep.episode_title)}</strong><p>${escapeHtml(ep.description || 'No episode description yet.')}</p><div class="episode-meta"><span>${nice(ep.duration_seconds)}</span>${ep.release_at ? `<span>${new Date(ep.release_at).toLocaleDateString()}</span>` : ''}${ep.is_active ? '' : '<span>Inactive</span>'}</div>${ep.is_active ? saveEpisodeBtn(ep.episode_id) : ''}${episodeProgressHtml(ep)}</div>${ep.is_active ? `<button type="button" class="episode-listen-btn" data-episode="${ep.episode_id}">${icon('play')}<span>Play</span></button>` : ''}</article>`).join('') : `<div class="empty podcast-empty"><span>${icon('mic')}</span><h3>No episodes yet</h3><p>Episodes published for this show will appear here.</p></div>`;
    shell(`<section class="podcast-show-view"><button type="button" class="podcast-back" data-podcast-back>${icon('back')}<span>All podcasts</span></button><div class="podcast-show-hero"><div class="podcast-show-cover">${art}</div><div class="podcast-show-info"><span class="eyebrow">PODCAST</span><h2>${escapeHtml(chosen.show_title)}</h2><p class="podcast-show-category">${escapeHtml(chosen.category || 'Podcast')}</p><p class="podcast-show-description">${escapeHtml(chosen.description || 'Explore the latest episodes from this show.')}</p><div class="inline">${visibleEpisodes.some(ep => ep.is_active) ? `<button type="button" class="button podcast-play-latest" data-episode="${visibleEpisodes.find(ep => ep.is_active)?.episode_id}">${icon('play')} Play latest</button>` : ''}${followShowBtn(chosen)}${chosen.user_id === state.user.id ? '<button class="button secondary" data-nav="podcast-studio">Open in Podcast Studio</button>' : ''}</div></div></div><div class="podcast-episodes-head"><div><span class="eyebrow">EPISODES</span><h3>${visibleEpisodes.length} ${visibleEpisodes.length === 1 ? 'episode' : 'episodes'}</h3></div></div><div class="podcast-episode-list">${episodeRows}</div></section>`, '', '');
    document.querySelector('[data-podcast-back]')?.addEventListener('click', () => { state.selectedShow = null; navigate('podcasts'); });
  } else {
    shell(`<div class="hero hero-podcast"><div><span class="eyebrow">STORIES WORTH HEARING</span><h2>Podcasts for every mood.</h2><p>Discover active shows and listen to the latest episodes.</p><button class="button secondary" data-nav="podcast-studio">${icon('upload')} Podcast Studio</button></div><div class="hero-art">${icon('mic')}</div></div><div id="podcast-library-slot">${podcastLibraryHtml()}</div><div class="section-heading"><h2>Explore shows</h2><button class="text-link" data-nav="podcast-studio">Manage your podcasts</button></div><div class="cover-grid podcast-show-grid">${state.podcasts.map((p, i) => showCard(p, i)).join('') || '<div class="empty">No active shows published yet.</div>'}</div>`, 'Podcasts', 'Discover shows. Publishing and management live in Podcast Studio.');
  }
  document.querySelectorAll('[data-episode]').forEach(b => b.onclick = () => action(async () => {
    const episodeId = Number(b.dataset.episode);
    if (!episodeId) return;
    if (b.dataset.pendingEpisode === '1') return;
    b.dataset.pendingEpisode = '1';
    try {
      await requirePlaybackAccess();
      let ep = state.episodes.find(x => Number(x.episode_id) === episodeId && Number(x.show_id) === Number(state.selectedShow));
      // Podcast Studio can change the shared episode list while an opened show remains onscreen.
      // Read this episode by its stable ID instead of reporting that its audio is missing.
      if (!ep?.audio_path) {
        const lookup = await db.from('podcast_episode').select('episode_id,show_id,episode_title,duration_seconds,audio_path,is_active').eq('episode_id', episodeId).eq('show_id', state.selectedShow).maybeSingle();
        if (lookup.error) throw lookup.error;
        ep = lookup.data;
      }
      if (!ep) throw Error('This episode is no longer available.');
      if (ep.is_active === false) throw Error('This episode is not currently available.');
      if (!ep.audio_path) throw Error('This episode has no playable audio file attached.');
      const u = check(await db.storage.from('podcast-audio').createSignedUrl(ep.audio_path, 3600));
      startPlayer({ kind: 'podcast', id: ep.episode_id, title: ep.episode_title, artist: chosen?.show_title || 'SoundWave podcasts', url: u.signedUrl, duration: ep.duration_seconds, resumeAt: Number(state.podcastHistory.find(h => Number(h.episode_id) === episodeId && Number(h.resume_position_seconds) > 5)?.resume_position_seconds) || 0 });
    } finally { delete b.dataset.pendingEpisode; }
  }));
}

function podcastStudioAnalytics() {
  const ownShowIds = new Set((state.myShows || []).map(p => Number(p.show_id)));
  const ownEpisodes = (state.episodes || []).filter(ep => ownShowIds.has(Number(ep.show_id)));
  const epMap = new Map(ownEpisodes.map(ep => [Number(ep.episode_id), ep]));
  const qualified = (state.podcastStudioHistory || []).filter(r => epMap.has(Number(r.episode_id)) && isQualifiedPodcastStream(r));
  const byEpisode = new Map(), byShow = new Map(), days = Array(30).fill(0), listeners = new Set();
  let seconds = 0, completed = 0;
  for (const r of qualified) {
    const eid = Number(r.episode_id), ep = epMap.get(eid); if (!ep) continue;
    const sid = Number(ep.show_id);
    byEpisode.set(eid, (byEpisode.get(eid) || 0) + 1);
    byShow.set(sid, (byShow.get(sid) || 0) + 1);
    seconds += Number(r.duration_played_seconds) || 0;
    if (String(r.completion_status || '').toLowerCase() === 'completed') completed++;
    if (r.user_id) listeners.add(String(r.user_id));
    const diff = Math.floor((Date.now() - new Date(r.stream_date).getTime()) / 86400000); if (diff >= 0 && diff < 30) days[29 - diff]++;
  }
  const topEpisodes = [...byEpisode.entries()].map(([id, value]) => ({ id, name: epMap.get(id)?.episode_title || `Episode ${id}`, value })).sort((a, b) => b.value - a.value);
  const topShows = [...byShow.entries()].map(([id, value]) => ({ id, name: (state.myShows || []).find(s => Number(s.show_id) === id)?.show_title || `Show ${id}`, value })).sort((a, b) => b.value - a.value);
  // ---- Extended metrics ----
  const DAY = 86400000, now = Date.now();
  const ageDays = r => (now - new Date(r.stream_date).getTime()) / DAY;
  const inWin = (r, a, b) => { const d = ageDays(r); return d >= a && d < b; };
  const last7 = qualified.filter(r => inWin(r, 0, 7)).length, prev7 = qualified.filter(r => inWin(r, 7, 14)).length;
  const last30 = qualified.filter(r => inWin(r, 0, 30)).length, prev30 = qualified.filter(r => inWin(r, 30, 60)).length;
  const recent = qualified.filter(r => inWin(r, 0, 30));
  const perUser = new Map(), perUserEps = new Map();
  for (const r of qualified) { if (!r.user_id) continue; const u = String(r.user_id); perUser.set(u, (perUser.get(u) || 0) + 1); if (!perUserEps.has(u)) perUserEps.set(u, new Set()); perUserEps.get(u).add(Number(r.episode_id)); }
  const returning = [...perUser.values()].filter(n => n > 1).length;
  const bingers = [...perUserEps.values()].filter(set => set.size > 1).length;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => ({ name, value: 0 }));
  const dayparts = [{ name: 'Morning (5am–12pm)', value: 0 }, { name: 'Afternoon (12–5pm)', value: 0 }, { name: 'Evening (5–10pm)', value: 0 }, { name: 'Night (10pm–5am)', value: 0 }];
  const depth = [{ name: 'Under 25%', value: 0 }, { name: '25–50%', value: 0 }, { name: '50–75%', value: 0 }, { name: '75%+', value: 0 }, { name: 'Finished', value: 0 }];
  for (const r of recent) {
    const dt = new Date(r.stream_date), h = dt.getHours();
    weekday[dt.getDay()].value++;
    dayparts[h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3].value++;
    const dur = Number(epMap.get(Number(r.episode_id))?.duration_seconds) || 0, played = Number(r.duration_played_seconds) || 0;
    if (String(r.completion_status || '').toLowerCase() === 'completed') depth[4].value++;
    else if (dur > 0) { const f = played / dur; depth[f < .25 ? 0 : f < .5 ? 1 : f < .75 ? 2 : 3].value++; }
  }
  const epStats = new Map();
  for (const r of qualified) {
    const eid = Number(r.episode_id); if (!epStats.has(eid)) epStats.set(eid, { n: 0, done: 0, sec: 0, users: new Set(), last: 0, frac: 0, fracN: 0 });
    const e = epStats.get(eid), ep = epMap.get(eid), played = Number(r.duration_played_seconds) || 0, dur = Number(ep?.duration_seconds) || 0;
    e.n++; e.sec += played; if (r.user_id) e.users.add(String(r.user_id));
    if (String(r.completion_status || '').toLowerCase() === 'completed') e.done++;
    if (dur > 0) { e.frac += Math.min(1, played / dur); e.fracN++; }
    e.last = Math.max(e.last, new Date(r.stream_date).getTime() || 0);
  }
  const episodeRows = ownEpisodes.map(ep => {
    const e = epStats.get(Number(ep.episode_id)); const showTitle = (state.myShows || []).find(sh => Number(sh.show_id) === Number(ep.show_id))?.show_title || '';
    return { id: Number(ep.episode_id), showId: Number(ep.show_id), title: ep.episode_title || `Episode ${ep.episode_id}`, show: showTitle, listens: e?.n || 0, listeners: e?.users.size || 0, done: e?.done || 0, completion: e?.n ? Math.round(e.done / e.n * 100) : 0, avgSec: e?.n ? Math.round(e.sec / e.n) : 0, avgFrac: e?.fracN ? Math.round(e.frac / e.fracN * 100) : null, last: e?.last || 0 };
  }).sort((a, b) => b.listens - a.listens);
  const showRows = (state.myShows || []).map(sh => { const eps = episodeRows.filter(x => x.showId === Number(sh.show_id)); const lst = eps.reduce((a, x) => a + x.listens, 0), done = eps.reduce((a, x) => a + x.done, 0); return { id: Number(sh.show_id), title: sh.show_title, episodes: eps.length, listens: lst, completion: lst ? Math.round(done / lst * 100) : 0 }; }).sort((a, b) => b.listens - a.listens);
  const bestDayIdx = days.reduce((bi, v, i) => (v > days[bi] ? i : bi), 0);
  const bestDay = days[bestDayIdx] > 0 ? { value: days[bestDayIdx], label: new Date(now - (29 - bestDayIdx) * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) } : null;
  const topWeekday = weekday.reduce((a, b) => (b.value > a.value ? b : a), weekday[0]);
  const topDaypart = dayparts.reduce((a, b) => (b.value > a.value ? b : a), dayparts[0]);
  return {
    qualified, total: qualified.length, unique: listeners.size, minutes: Math.round(seconds / 60), completionRate: qualified.length ? Math.round((completed / qualified.length) * 100) : 0, days, topEpisodes, topShows,
    completed, partial: qualified.length - completed, avgListenSec: qualified.length ? Math.round(seconds / qualified.length) : 0,
    avgPerListener: listeners.size ? Math.round(qualified.length / listeners.size * 10) / 10 : 0,
    returning, returningRate: perUser.size ? Math.round(returning / perUser.size * 100) : 0, bingers, bingeRate: perUser.size ? Math.round(bingers / perUser.size * 100) : 0,
    last7, prev7, last30, prev30, weekday, dayparts, depth, episodeRows, showRows, bestDay, topWeekday, topDaypart, activeDays: days.filter(v => v > 0).length, noListenEpisodes: episodeRows.filter(x => x.listens === 0).length
  };
}

function podcastAnalyticsKpis(m) {
  const chip = (c, pv, o) => deltaHtml(c, pv, o);
  return `<section class="studio-stat-strip four podcast-kpis podcast-analytics-kpis">
    <div><small>Listens · last 7 days</small><strong>${m.last7}${chip(m.last7, m.prev7, { range: 7 })}</strong><span>${m.prev7 ? `${m.prev7} the week before` : 'Qualified listens'}</span></div>
    <div><small>Avg listen time</small><strong>${mmss(m.avgListenSec)}</strong><span>${m.minutes} min total</span></div>
    <div><small>Listens per listener</small><strong>${m.avgPerListener}</strong><span>${m.unique} unique listeners</span></div>
    <div><small>Returning listeners</small><strong>${m.returningRate}%</strong><span>${m.returning} came back for more</span></div>
  </section>`;
}
function podcastAnalyticsExtra(m) {
  const fmtDate = t => t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
  const empty = !m.total;
  const insights = [];
  if (m.bestDay) insights.push(`<li><b>Best day:</b> ${m.bestDay.label} with ${m.bestDay.value} listen${m.bestDay.value === 1 ? '' : 's'}.</li>`);
  if (m.topWeekday?.value) insights.push(`<li><b>Busiest weekday:</b> ${m.topWeekday.name}.</li>`);
  if (m.topDaypart?.value) insights.push(`<li><b>Peak time:</b> ${esc(m.topDaypart.name)}.</li>`);
  if (m.last30 || m.prev30) insights.push(`<li><b>30-day change:</b> ${m.last30} listens vs ${m.prev30} in the previous 30 days ${deltaHtml(m.last30, m.prev30, { range: 30 })}</li>`);
  if (m.noListenEpisodes) insights.push(`<li><b>Needs a push:</b> ${m.noListenEpisodes} episode${m.noListenEpisodes === 1 ? ' has' : 's have'} no listens yet.</li>`);
  if (m.bingers) insights.push(`<li><b>Binge listeners:</b> ${m.bingers} (${m.bingeRate}%) played more than one episode.</li>`);
  const insightCard = `<article class="chart-card"><div class="chart-head"><div><small>Highlights</small><strong class="chart-title">What stands out</strong></div><span>${m.activeDays}/30 active days</span></div>${insights.length ? `<ul class="podcast-insights">${insights.join('')}</ul>` : '<p class="muted small">Insights appear once your episodes get listens.</p>'}</article>`;
  const completion = `<article class="chart-card"><div class="chart-head"><div><small>Listener outcome</small><strong>${m.completed} finished</strong></div><span>${m.partial} stopped early</span></div>${empty ? '<p class="muted small">No listen data is visible yet.</p>' : `<div class="role-distribution"><div><span><i class="role-dot role-listener"></i>Played to the end</span><strong>${m.completed}</strong><small>${m.completionRate}%</small></div><div><span><i class="role-dot role-artist"></i>Stopped after 30s+</span><strong>${m.partial}</strong><small>${100 - m.completionRate}%</small></div><div><span><i class="role-dot role-admin"></i>Avg per listen</span><strong>${mmss(m.avgListenSec)}</strong><small>min:sec</small></div></div>`}</article>`;
  const depth = `<article class="chart-card"><div class="chart-head"><div><small>Listen depth</small><strong>How far listeners get</strong></div><span>30 days</span></div>${chartBars(m.depth, { title: 'Listen depth', xLabel: 'Listens', legend: 'Listens (last 30 days)', maxItems: 5 })}</article>`;
  const weekday = `<article class="chart-card"><div class="chart-head"><div><small>Listens by weekday</small><strong class="chart-title">${m.topWeekday?.value ? esc(m.topWeekday.name) : 'No data yet'}</strong></div><span>30 days</span></div>${m.last30 ? chartBars(m.weekday, { title: 'Listens by weekday', xLabel: 'Listens', legend: 'Listens (last 30 days)', maxItems: 7 }) : '<p class="muted small">No listens in the last 30 days.</p>'}</article>`;
  const daypart = `<article class="chart-card"><div class="chart-head"><div><small>Time of day</small><strong class="chart-title">${m.topDaypart?.value ? esc(m.topDaypart.name) : 'No data yet'}</strong></div><span>30 days</span></div>${m.last30 ? chartBars(m.dayparts, { title: 'Listens by time of day', xLabel: 'Listens', legend: 'Listens (last 30 days)', maxItems: 4 }) : '<p class="muted small">No listens in the last 30 days.</p>'}</article>`;
  const rowsHtml = m.episodeRows.slice(0, 15).map((x, i) => `<tr><td>${i + 1}</td><td><strong>${esc(x.title)}</strong><small>${esc(x.show)}</small></td><td>${x.listens}</td><td>${x.listeners}</td><td>${x.listens ? x.completion + '%' : '—'}</td><td>${x.listens ? mmss(x.avgSec) : '—'}</td><td>${x.avgFrac === null || !x.listens ? '—' : x.avgFrac + '%'}</td><td>${x.listens ? fmtDate(x.last) : '—'}</td></tr>`).join('');
  const table = `<article class="chart-card chart-full podcast-episode-table-card"><div class="chart-head"><div><small>Episode performance</small><strong class="chart-title">${m.episodeRows.length} episode${m.episodeRows.length === 1 ? '' : 's'}</strong></div><span>all time</span></div>${m.episodeRows.length ? `<div class="podcast-table-scroll"><table class="podcast-episode-table"><thead><tr><th>#</th><th>Episode</th><th>Listens</th><th>Listeners</th><th>Completed</th><th>Avg listen</th><th>Avg % heard</th><th>Last listen</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>` : '<p class="muted small">Publish an episode to see per-episode stats.</p>'}</article>`;
  const showTable = m.showRows.length > 1 ? `<article class="chart-card chart-full"><div class="chart-head"><div><small>Show comparison</small><strong class="chart-title">${m.showRows.length} shows</strong></div><span>all time</span></div><div class="podcast-table-scroll"><table class="podcast-episode-table"><thead><tr><th>Show</th><th>Episodes</th><th>Listens</th><th>Completed</th></tr></thead><tbody>${m.showRows.map(x => `<tr><td><strong>${esc(x.title)}</strong></td><td>${x.episodes}</td><td>${x.listens}</td><td>${x.listens ? x.completion + '%' : '—'}</td></tr>`).join('')}</tbody></table></div></article>` : '';
  const hint = empty
    ? `<article class="chart-card chart-full podcast-empty-hint"><div class="chart-head"><div><small>Getting started</small><strong class="chart-title">No listens counted yet</strong></div></div><ul class="podcast-insights"><li>A listen counts once someone plays <b>30 seconds</b> of an episode or finishes it.</li><li>Publish an episode and share your show so people can find it.</li><li>Charts, completion rates and listener habits fill in automatically as listens arrive.</li></ul></article>`
    : (m.total < 10 ? `<article class="chart-card chart-full podcast-empty-hint"><div class="chart-head"><div><small>Early days</small><strong class="chart-title">Only ${m.total} listen${m.total === 1 ? '' : 's'} so far</strong></div></div><p class="muted small">Percentages and time-of-day patterns can swing a lot with so few listens. They become more reliable after about 10.</p></article>` : '');
  return `<div class="chart-grid podcast-analytics-more">${hint}${insightCard}${completion}${depth}${weekday}${daypart}${table}${showTable}</div>`;
}

function podcastStudio() {
  const studioRole = hasAdminAccess() ? (hasArtistAccess() ? 'artist-admin' : 'admin') : 'artist';
  const activeShows = state.myShows.filter(p => p.is_active);
  const ownShowIds = new Set(state.myShows.map(p => Number(p.show_id)));
  const ownEpisodes = state.episodes.filter(ep => ownShowIds.has(Number(ep.show_id)));
  const activeEpisodes = ownEpisodes.filter(ep => ep.is_active !== false).length;
  const metrics = podcastStudioAnalytics();
  const totalListens = metrics.total;
  const showCards = state.myShows.map((p, i) => { const listens = metrics.topShows.find(x => Number(x.id) === Number(p.show_id))?.value || 0; const eps = ownEpisodes.filter(ep => Number(ep.show_id) === Number(p.show_id)).length; return `<article class="podcast-studio-card">${eps === 0 ? `<span class="status-pill draft">Draft · 0 episodes</span>` : ''}<div class="podcast-card-art-wrap"><div class="podcast-card-art" style="background:${grad(i)}">${p.cover_path && state.coverUrls[p.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="${esc(p.show_title)}" loading="lazy">` : icon('mic')}</div><span class="podcast-card-state status-pill ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? 'Active' : 'Inactive'}</span></div><div class="podcast-card-copy"><span class="podcast-card-category">${esc(p.category || 'Podcast')}</span><strong class="podcast-card-title">${esc(p.show_title)}</strong><p>${esc(p.description || 'No description yet. Add a short description so listeners know what your show is about.')}</p><div class="podcast-card-metrics"><span><b>${listens}</b> listens</span><span><b>${eps}</b> episodes</span></div></div><div class="card-actions podcast-card-actions"><button type="button" class="button secondary sm" data-podcast-catalog-show="${p.show_id}">${icon('play')}<span>Episodes</span></button><button class="button secondary sm" data-studio-show="${p.show_id}" aria-label="Edit ${esc(p.show_title)}">${icon('settings')} <span>Edit show</span></button><button class="button secondary sm ${p.is_active ? 'danger-soft' : ''}" data-show-active="${p.show_id}" data-active="${p.is_active ? 'false' : 'true'}" aria-label="${p.is_active ? 'Deactivate' : 'Restore'} ${esc(p.show_title)}">${p.is_active ? 'Deactivate' : 'Restore'}</button></div></article>` }).join('');
  shell(`<section class="workspace-hero podcast-studio-hero podcast-studio-hero--${studioRole}" data-studio-role="${studioRole}"><div><span class="eyebrow">${studioRole === 'admin' ? 'MODERATOR WORKSPACE' : studioRole === 'artist-admin' ? 'CREATOR + MODERATOR WORKSPACE' : 'CREATOR WORKSPACE'}</span><h2>Podcast Studio</h2><p>${studioRole === 'admin' ? 'Oversee podcast catalog status and performance.' : 'Publish, manage and understand your podcast catalog with separate focused views.'}</p><div class="inline"><button class="button hero-cta" data-open-modal="create-show-dialog">${icon('plus')} Create show</button><button class="button secondary" data-open-modal="publish-episode-dialog" ${!activeShows.length ? 'disabled' : ''}>${icon('upload')} Publish episode</button></div></div><span class="hero-vinyl">${icon('mic')}</span></section>
 <nav class="creator-view-tabs" aria-label="Podcast Studio views"><button class="${state.podcastStudioView === 'overview' ? 'active' : ''}" data-podcast-studio-view-btn="overview">Overview</button><button class="${state.podcastStudioView === 'analytics' ? 'active' : ''}" data-podcast-studio-view-btn="analytics">Analytics</button><button class="${state.podcastStudioView === 'shows' ? 'active' : ''}" data-podcast-studio-view-btn="shows">Shows</button><button class="${state.podcastStudioView === 'publish' ? 'active' : ''}" data-podcast-studio-view-btn="publish">Publish</button></nav>
 <section class="creator-view-block" data-podcast-studio-view="overview" ${state.podcastStudioView !== 'overview' ? 'hidden' : ''}><section class="studio-stat-strip four podcast-kpis"><button type="button" data-stat-info="p-shows" aria-haspopup="dialog"><small>Shows</small><strong data-count="${state.myShows.length}">${state.myShows.length}</strong><span>Your podcast catalog</span></button><button type="button" data-stat-info="p-episodes" aria-haspopup="dialog"><small>Active episodes</small><strong data-count="${activeEpisodes}">${activeEpisodes}</strong><span>Currently available</span></button><button type="button" data-stat-info="p-listens" aria-haspopup="dialog"><small>Qualified listens</small><strong data-count="${totalListens}">${totalListens}</strong><span>30s+ or completed</span></button><button type="button" data-stat-info="p-listeners" aria-haspopup="dialog"><small>Unique listeners</small><strong data-count="${metrics.unique}">${metrics.unique}</strong><span>${metrics.minutes} minutes listened</span></button></section><div class="creator-summary-grid"><article><span class="eyebrow">PUBLISH</span><h3>Keep your show active</h3><p>Create a show or publish a new episode from one dedicated workspace.</p><button class="button secondary" data-podcast-open="publish">Open publishing</button></article><article><span class="eyebrow">PERFORMANCE</span><h3>${metrics.total} qualified listens</h3><p>See listening trend, top episodes and completion rate without catalog controls in the way.</p><button class="button secondary" data-podcast-open="analytics">View analytics</button></article><article><span class="eyebrow">CATALOG</span><h3>${state.myShows.length} shows</h3><p>Edit show information and availability from the Shows view.</p><button class="button secondary" data-podcast-open="shows">Manage shows</button></article></div></section>
 <section class="creator-view-block" data-podcast-studio-view="analytics" ${state.podcastStudioView !== 'analytics' ? 'hidden' : ''}><section class="analytics-suite podcast-analytics-suite"><div class="section-heading"><div><span class="eyebrow">PERFORMANCE</span><h2>Podcast analytics</h2></div><span class="muted small">Qualified listens · trend shows 30 days, other totals are all time</span></div>${podcastAnalyticsKpis(metrics)}<div class="chart-grid"><article class="chart-card chart-wide"><div class="chart-head"><div><small>Listen trend</small><strong>${metrics.last30}${deltaHtml(metrics.last30, metrics.prev30, { range: 30 })}</strong></div><span>last 30 days</span></div>${sparkline(metrics.days)}</article><article class="chart-card"><div class="chart-head"><div><small>Top episodes</small><strong class="chart-title">${esc(metrics.topEpisodes[0]?.name || 'No listens yet')}</strong></div><span>${metrics.topEpisodes[0]?.value || 0} plays · all time</span></div>${chartBars(metrics.topEpisodes)}</article><article class="chart-card"><div class="chart-head"><div><small>Listens by show</small><strong>${metrics.topShows.length}</strong></div><span>shows · all time</span></div>${chartBars(metrics.topShows)}</article><article class="chart-card podcast-completion-card"><div class="chart-head"><div><small>Completion rate</small><strong>${metrics.completionRate}%</strong></div><span>${metrics.unique} listeners · all time</span></div><div class="metric-ring" style="--metric:${metrics.completionRate}"><span>${metrics.completionRate}%</span><small>completed</small></div></article></div>${podcastAnalyticsExtra(metrics)}</section></section>
 <section class="creator-view-block" data-podcast-studio-view="shows" ${state.podcastStudioView !== 'shows' ? 'hidden' : ''}><div class="section-heading"><div><span class="eyebrow">YOUR SHOWS</span><h2>Manage your podcasts</h2></div><button class="text-link" data-nav="podcasts">Explore podcasts</button></div><div class="podcast-studio-grid podcast-catalog-rail">${showCards || `<div class="empty studio-empty"><span>${icon('mic')}</span><h3>Start your first show</h3><p>Create a show, add cover art, then publish your first episode.</p><button class="button" data-open-modal="create-show-dialog">${icon('plus')} Create show</button></div>`}</div><section class="podcast-catalog-episodes" aria-label="Episodes in selected show"><div class="section-heading"><div><span class="eyebrow">PODCAST EPISODES</span><h2>${esc(state.myShows.find(p => Number(p.show_id) === Number(state.selectedPodcastStudioShow))?.show_title || 'Select a podcast show')}</h2><p class="muted small">Episodes belong to a podcast show. Music releases are managed separately in Artist Studio.</p></div><button class="button sm" type="button" data-open-modal="publish-episode-dialog">${icon('upload')} Publish episode</button></div>${state.selectedPodcastStudioShow ? ownEpisodes.filter(ep => Number(ep.show_id) === Number(state.selectedPodcastStudioShow)).map(ep => `<article class="podcast-episode-catalog-row"><span class="podcast-episode-icon">${icon('mic')}</span><div><strong>${esc(ep.episode_title || 'Untitled episode')}</strong><small>${nice(ep.duration_seconds)} · ${ep.is_active === false ? 'Inactive' : 'Active'} · Podcast episode</small></div></article>`).join('') || '<div class="empty compact-empty">No episodes yet. Publish the first episode to make this show discoverable.</div>' : '<div class="empty compact-empty">Choose a show above to inspect its episodes.</div>'}</section></section>
 <section class="creator-view-block" data-podcast-studio-view="publish" ${state.podcastStudioView !== 'publish' ? 'hidden' : ''}><div class="section-heading"><div><span class="eyebrow">PUBLISH</span><h2>Creation tools</h2></div></div><div class="creator-summary-grid publish-grid"><article><span class="studio-action-art gradient-one">${icon('mic')}</span><h3>Create a show</h3><p>Set the title, category, description and cover art for a new podcast.</p><button class="button" data-open-modal="create-show-dialog">${icon('plus')} Create show</button></article><article><span class="studio-action-art gradient-two">${icon('upload')}</span><h3>Publish an episode</h3><p>Choose a show, upload audio and add episode details through the guided workflow.</p><button class="button" data-open-modal="publish-episode-dialog" ${!activeShows.length ? 'disabled' : ''}>${icon('upload')} Publish episode</button></article></div></section>
<dialog class="sw-modal creator-dialog release-create-dialog upload-surface-dialog" id="create-show-dialog"><div class="release-dialog-head"><div><span class="eyebrow">NEW SHOW</span><h2>Create a podcast show</h2><p>Set the artwork, title and category listeners will discover in SoundWave Podcasts.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close create show dialog">${icon('close')}</button></div><form id="showform" class="release-create-form upload-surface-form"><div class="release-create-grid upload-surface-grid"><div class="release-art-panel"><label class="cover-drop creator-cover-drop release-cover-drop" for="showcover"><span id="show-cover-preview">${icon('mic')}</span><strong>Choose show artwork</strong><small>Square JPG, PNG or WebP · up to 5 MB</small><em>Recommended: 1400 × 1400</em><input id="showcover" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><div class="release-art-tip"><strong>Show artwork tips</strong><span>Use a bold square image that represents the show. Avoid screenshots and text that is too small to read.</span></div></div><div class="release-meta-panel"><label class="single-field release-title-field">Show title<input id="showtitle" maxlength="140" required placeholder="e.g. Midnight Tech Talk" autocomplete="off"><small class="field-help">Use a real show title. Placeholder or random text is blocked.</small><small class="field-help availability" id="show-title-status"></small></label><label class="single-field">Category<input id="showcategory" maxlength="60" placeholder="Technology, Life, Education"></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="showdesc" maxlength="1600" placeholder="What is this show about?"></textarea></label></div></div><div class="release-form-note">After creating the show, you can immediately publish your first episode from Podcast Studio.</div><div class="dialog-actions release-dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy>Create show</button></div></form></dialog>
<dialog class="sw-modal edit-surface-dialog" id="edit-show-dialog"><div class="edit-surface-head"><div><span class="eyebrow">PODCAST STUDIO</span><h2>Edit show</h2><p>Keep your show identity and discovery information up to date.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close edit show dialog">${icon('close')}</button></div><form id="editshow" class="edit-surface-form"><input type="hidden" id="editshowid"><div class="edit-surface-grid"><label class="cover-drop edit-cover-drop" for="editshowcover"><span id="edit-show-cover-preview">${icon('mic')}</span><strong>Show artwork</strong><small>Leave unchanged to keep the current image</small><input id="editshowcover" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><div class="edit-fields"><label class="single-field">Show title<input id="editshowtitle" required maxlength="140"></label><label class="single-field">Category<input id="editshowcategory" maxlength="60"></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="editshowdesc" maxlength="1600"></textarea></label></div></div><div class="dialog-actions edit-surface-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button">Save changes</button></div></form></dialog>
<dialog class="sw-modal studio-dialog wizard-dialog creator-dialog upload-wizard-dialog" id="publish-episode-dialog"><div class="upload-hero-strip podcast"><span>${icon('mic')}</span><div><small>PODCAST UPLOAD</small><strong>Publish a polished episode</strong></div></div><div class="modal-head"><div><span class="eyebrow wizard-eyebrow">STEP 1 OF 3</span><h2>Publish an episode</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close publish episode dialog">${icon('close')}</button></div><form id="episodeform" novalidate>${wizardNav(['Show', 'Audio', 'Details'])}<section class="upload-step" data-step="1"><div class="step-icon">${icon('mic')}</div><h3>Choose a show</h3><p class="step-desc">Episodes are published into one of your active podcast shows.</p>${activeShows.length ? `<label class="single-field">Your show<select id="epshow" required>${opts(activeShows, 'show_id', 'show_title')}</select><small class="field-help">Select the show where this episode should appear.</small></label>` : '<p class="notice">Create and activate a show first.</p>'}</section><section class="upload-step" data-step="2" hidden><div class="step-icon">${icon('upload')}</div><h3>Add your audio file</h3><p class="step-desc">Upload the final exported episode file that listeners will stream.</p>${audioDropHtml('ep')}</section><section class="upload-step" data-step="3" hidden><div class="step-icon">${icon('settings')}</div><h3>Episode details</h3><p class="step-desc">Confirm the listener-facing title and optional description before publishing.</p><label class="single-field">Episode title<input id="eptitle" maxlength="140" required placeholder="e.g. Episode 12: Building Better Habits"></label><label class="single-field">Description<textarea id="epdesc" maxlength="1600" placeholder="What is this episode about?"></textarea></label><div id="ep-final"></div></section><div class="dialog-actions"><button type="button" class="button secondary wiz-back" hidden>Back</button><button type="button" class="button wiz-next" ${activeShows.length ? '' : 'disabled'}>Continue</button><button type="submit" class="button wiz-finish" data-busy hidden>Publish episode</button></div></form></dialog>`, '', '');
  const setPodcastStudioView = (view) => { if (view === 'shows' && !state.selectedPodcastStudioShow && state.myShows.length) state.selectedPodcastStudioShow = Number(state.myShows[0].show_id); state.podcastStudioView = view; document.querySelectorAll('[data-podcast-studio-view-btn]').forEach(b => b.classList.toggle('active', b.dataset.podcastStudioViewBtn === view)); document.querySelectorAll('[data-podcast-studio-view]').forEach(s => s.hidden = s.dataset.podcastStudioView !== view); };
  document.querySelectorAll('[data-podcast-studio-view-btn]').forEach(b => b.onclick = () => setPodcastStudioView(b.dataset.podcastStudioViewBtn));
  document.querySelectorAll('[data-podcast-open]').forEach(b => b.onclick = () => setPodcastStudioView(b.dataset.podcastOpen));
  const previewFile = (inputId, previewId) => { const inp = $(inputId), preview = $(previewId); if (!inp || !preview) return; inp.onchange = e => { const f = e.target.files?.[0]; if (!f) return; const u = URL.createObjectURL(f); preview.innerHTML = `<img class="cover-img" src="${esc(u)}" alt="Selected cover">`; preview.querySelector('img')?.addEventListener('load', () => URL.revokeObjectURL(u), { once: true }); }; };
  previewFile('#showcover', '#show-cover-preview'); previewFile('#editshowcover', '#edit-show-cover-preview');
  document.querySelectorAll('[data-view-show]').forEach(b => b.onclick = () => openShow(b.dataset.viewShow));
  document.querySelectorAll('[data-podcast-catalog-show]').forEach(b => b.onclick = () => { state.selectedPodcastStudioShow = Number(b.dataset.podcastCatalogShow); render(); });
  document.querySelectorAll('[data-studio-show]').forEach(b => b.onclick = () => { const p = state.myShows.find(x => Number(x.show_id) === Number(b.dataset.studioShow)); if (!p) return; $('#editshowid').value = p.show_id; $('#editshowtitle').value = p.show_title || ''; $('#editshowcategory').value = p.category || ''; $('#editshowdesc').value = p.description || ''; $('#edit-show-cover-preview').innerHTML = p.cover_path && state.coverUrls[p.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[p.cover_path])}" alt="">` : icon('mic'); $('#edit-show-dialog').showModal(); });
  document.querySelectorAll('[data-show-active]').forEach(b => b.onclick = () => action(async () => { const active = b.dataset.active === 'true'; check(await db.rpc('set_my_podcast_show_active', { p_show_id: Number(b.dataset.showActive), p_active: active })); await loadData(); render(); toast(active ? 'Podcast show restored' : 'Podcast show deactivated with its episodes'); }));
  $('#showform').onsubmit = e => { e.preventDefault(); action(async () => { const titleProblem = contentTitleProblem($('#showtitle')?.value, 'Show title', 140); if (titleProblem) throw Error(titleProblem); if (!(await checkShowTitleAvailability($('#showtitle')?.value))) throw Error('You already have a podcast show with this title. Choose a different title.'); let cover_path = null; const file = $('#showcover')?.files?.[0]; if (file) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP cover.'); if (file.size > 5 * 1048576) throw Error('Podcast artwork must be under 5 MB.'); const ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); cover_path = `${state.user.id}/podcasts/${crypto.randomUUID()}.${ext}`; check(await db.storage.from('covers').upload(cover_path, file, { upsert: false, contentType: file.type })); } try { check(await db.from('podcast_show').insert({ user_id: state.user.id, show_title: normalizedContentTitle(val('showtitle')), category: val('showcategory') || null, description: val('showdesc') || null, cover_path, is_active: true })); } catch (err) { if (cover_path) await db.storage.from('covers').remove([cover_path]); throw err; } await loadData(); state.podcastStudioView = 'shows'; render(); toast('Podcast show created'); }); };
  $('#editshow').onsubmit = e => { e.preventDefault(); action(() => swRun('Saving your show…', async () => { swStage('Checking your changes…', 'Validating the title'); const show_id = Number(val('editshowid')); const existing = state.myShows.find(x => Number(x.show_id) === show_id); if (!existing) throw Error('Podcast show not found.'); const showTitle = val('editshowtitle'), titleProblem = contentTitleProblem(showTitle, 'Show title', 140); if (titleProblem) throw Error(titleProblem); if (!(await checkShowTitleAvailability(showTitle, show_id))) throw Error('You already have a podcast show with this title. Choose a different title.'); let cover_path = existing.cover_path || null, newPath = null; const file = $('#editshowcover')?.files?.[0]; try { if (file) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP cover.'); if (file.size > 5 * 1048576) throw Error('Podcast artwork must be under 5 MB.'); const ext = (file.name.split('.').pop() || 'jpg').toLowerCase(); newPath = `${state.user.id}/podcasts/${crypto.randomUUID()}.${ext}`; swStage('Uploading artwork…', `${file.name} (${swFmtBytes(file.size)})`); check(await db.storage.from('covers').upload(newPath, file, { upsert: false, contentType: file.type })); cover_path = newPath; } swStage('Saving show details…', 'Almost there'); check(await db.from('podcast_show').update({ show_title: normalizedContentTitle(showTitle), category: val('editshowcategory') || null, description: val('editshowdesc') || null, cover_path }).eq('show_id', show_id).eq('user_id', state.user.id)); if (newPath && existing.cover_path && existing.cover_path !== newPath) await db.storage.from('covers').remove([existing.cover_path]); } catch (err) { if (newPath) await db.storage.from('covers').remove([newPath]); throw err; } swStage('Updating your shows…', 'Your changes are saved'); await loadData(); $('#edit-show-dialog')?.close(); state.podcastStudioView = 'shows'; render(); toast('Podcast show updated'); })); };
  bindAudioDrop('ep');
  const epForm = $('#episodeform');
  const epWiz = bindWizard(epForm, { validate: (st) => { if (st === 1 && !val('epshow')) return 'Choose one of your shows first.'; if (st === 2) { const f = $('#ep-file').files?.[0]; if (!f) return 'Choose your audio file first.'; return audioProblem(f); } return ''; } });
  epForm.addEventListener('wizardstep', e => { if (e.detail !== 3) return; const f = $('#ep-file').files?.[0]; const sel = $('#epshow'); $('#ep-final').innerHTML = summaryHtml([['Show', sel?.selectedOptions?.[0]?.textContent], ['File', f?.name], ['Size', f ? `${(f.size / 1048576).toFixed(2)} MB` : '']]); });
  $('#eptitle')?.addEventListener('input', () => setFieldError($('#eptitle'), ''));
  epForm.onsubmit = e => { e.preventDefault(); if (epWiz.step === 3 && !String($('#eptitle')?.value || '').trim()) { setFieldError($('#eptitle'), 'Give your episode a title before publishing.'); return; } action(() => swRun('Publishing your episode…', async () => { if (epWiz.step !== 3) throw Error('Complete the upload steps first.'); swStage('Checking your episode…', 'Validating title and audio file'); const show_id = Number(val('epshow')); if (!state.myShows.some(p => Number(p.show_id) === show_id && p.is_active)) throw Error('Select an active show that you own.'); const file = $('#ep-file').files?.[0]; if (!file) throw Error('Choose an audio file.'); const bad = audioProblem(file); if (bad) throw Error(bad); const epTitleProblem = contentTitleProblem($('#eptitle')?.value, 'Episode title', 140); if (epTitleProblem) throw Error(epTitleProblem); const duration_seconds = await audioDuration(file); if (!(duration_seconds > 0)) throw Error('Audio metadata is unavailable.'); const safe = file.name.replace(/[^a-z0-9._-]/gi, '_').slice(-80); const path = `${state.user.id}/episodes/${crypto.randomUUID()}_${safe}`; const fin = epForm.querySelector('.wiz-finish'); setPublishing(fin, true, 'Publish episode'); try { swStage('Uploading your episode…', `${file.name} (${swFmtBytes(file.size)})`); check(await db.storage.from('podcast-audio').upload(path, file, { upsert: false, contentType: file.type || 'audio/mpeg' })); swStage('Saving episode details…', 'Almost there'); try { check(await db.from('podcast_episode').insert({ show_id, episode_title: normalizedContentTitle($('#eptitle')?.value), description: val('epdesc') || null, duration_seconds, audio_path: path, release_at: new Date().toISOString(), is_active: true })); } catch (err) { await db.storage.from('podcast-audio').remove([path]); throw err; } } finally { setPublishing(fin, false, 'Publish episode'); } swStage('Updating your show…', 'Your episode is published'); await loadData(); state.podcastStudioView = 'shows'; render(); toast('Episode published'); })); };
}

// ---------- Listening history ----------
const agoText = (d) => { const t = new Date(d).getTime(); if (!t) return ''; const sec = Math.max(0, (Date.now() - t) / 1000); if (sec < 60) return 'Just now'; if (sec < 3600) return `${Math.floor(sec / 60)} min ago`; if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`; if (sec < 604800) return `${Math.floor(sec / 86400)} d ago`; return new Date(t).toLocaleDateString(); };

const compactNumber = (n) => {
  const num = Number(n) || 0;
  try { return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(num); }
  catch { return String(num); }
};
const playlistSongAddedAt = (row = {}) => row.date_added || row.created_at || row.inserted_at || null;
function songVisibleStreamCount(songId) {
  const sid = Number(songId);
  const total = Number(state.albumStreamCounts?.[sid]);
  if (Number.isFinite(total)) return total;
  const source = hasAdminAccess() ? adminRows30() : hasArtistAccess() ? (state.artistThirtyDay || []) : [];
  return source.reduce((count, row) => count + (Number(row?.song_id) === sid ? 1 : 0), 0);
}
async function ensureAlbumStreamCounts(album) {
  if (!album?.songs?.length) return;
  const ids = album.songs.map((s) => Number(s.song_id)).filter(Boolean);
  if (!ids.length || state.albumStreamLoading[album.album_id]) return;
  const missing = ids.filter((id) => state.albumStreamCounts[id] == null);
  if (!missing.length) return;
  state.albumStreamLoading[album.album_id] = true;
  try {
    const rows = [];
    if (!hasAdminAccess() && !hasArtistAccess()) {
      const aid = Number(album.artist?.artist_id);
      if (aid) {
        await loadArtistPopularity(aid);
        const pop = state.artistPopularity[String(aid)] || {}, counts = { ...(state.albumStreamCounts || {}) };
        for (const id of missing) counts[id] = Number(pop[id]) || 0;
        state.albumStreamCounts = counts;
        if (state.page === 'album-detail' && Number(state.selectedAlbum) === Number(album.album_id)) render();
      }
      return;
    }
    if (hasAdminAccess() || hasArtistAccess()) {
      const serverRows = hasAdminAccess() ? await fetchAdminServerStreams(36500) : await fetchArtistServerStreams(36500);
      // Album stream totals also use only the server analytics RPC. Falling back to
      // a device-visible RLS query can make phone and desktop totals disagree.
      if (serverRows) rows.push(...serverRows.filter(r => missing.includes(Number(r.song_id))));
      const counts = { ...(state.albumStreamCounts || {}) };
      for (const id of missing) counts[id] = 0;
      for (const row of rows) {
        if (!isQualifiedStream(row)) continue;
        const id = Number(row.song_id);
        if (counts[id] == null) counts[id] = 0;
        counts[id] += 1;
      }
      state.albumStreamCounts = counts;
      if (state.page === 'album-detail' && Number(state.selectedAlbum) === Number(album.album_id)) render();
    }
  } catch (e) { console.warn('Could not load album stream counts', e); }
  finally { state.albumStreamLoading[album.album_id] = false; }
}
let _histFetchAt = 0;
async function refreshHistory(force = false) {
  if (!state.user || !configured) return;
  if (!force && Date.now() - _histFetchAt < 1500) return;
  _histFetchAt = Date.now();
  const uid = state.user.id;
  const cachedMusic = readCachedHistory(uid), cachedPodcasts = readCachedPodcastHistory(uid);
  state.episodeTitles = { ...readCachedEpisodeTitles(uid), ...(state.episodeTitles || {}) };
  const [m, p] = await Promise.all([
    db.from('listening_history').select('stream_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id', uid).order('stream_date', { ascending: false }).limit(50),
    db.from('podcast_listening_history').select('podcast_stream_id,episode_id,stream_date,duration_played_seconds,resume_position_seconds,completion_status').eq('user_id', uid).order('stream_date', { ascending: false }).limit(30)
  ]);
  state.historyError = m.error && !cachedMusic.length && !(state.history || []).length ? humanErr(m.error) : '';
  if (m.error) console.warn('Could not refresh listening history', m.error);
  const before = JSON.stringify([state.history, state.podcastHistory, state.episodeTitles, state.historyError]);
  state.history = m.error ? cachedMusic : mergeStreamHistory(m.data || [], cachedMusic);
  state.podcastHistory = p.error ? cachedPodcasts : mergePodcastHistory(p.data || [], cachedPodcasts);
  const missing = [...new Set(state.podcastHistory.map((r) => r.episode_id))].filter((id) => !state.episodeTitles[id]);
  if (missing.length) {
    const e = await db.from('podcast_episode').select('episode_id,episode_title').in('episode_id', missing);
    if (!e.error) (e.data || []).forEach((x) => { state.episodeTitles[x.episode_id] = x.episode_title; });
  }
  persistHistoryCache();
  if (state.page === 'history' && before !== JSON.stringify([state.history, state.podcastHistory, state.episodeTitles, state.historyError])) render();
}
function historyTable(rows) {
  const q = [...new Set(rows.map((x) => x.s.song_id))].join(',');
  return `<div class="tracks history-tracks" role="table"><div class="tracks-head" role="row"><span class="t-num">#</span><span>Title</span><span class="t-album">Played</span><span class="t-like"></span><span class="t-time" title="Duration">${icon('clock')}</span><span class="t-more"></span></div>${rows.map(({ r, s }, i) => trackRow(s, i, q, { showAlbum: true, histId: r.stream_id, albumHtml: `<span title="${esc(new Date(r.stream_date).toLocaleString())}">${esc(agoText(r.stream_date))}${r.duration_played_seconds ? ` · ${nice(r.duration_played_seconds)} listened` : ''}</span>` })).join('')}</div>`;
}
function history() {
  const rows = state.history.map((r) => ({ r, s: songById(r.song_id) })).filter((x) => x.s);
  const notice = state.historyWriteError ? `<div class="notice">Your plays are not being saved: ${esc(state.historyWriteError)}. Run <code>sql/RUN_ME_listening_history.sql</code> once in the Supabase SQL Editor, then play a song again.</div>` : state.historyError ? `<div class="notice">Could not load your history: ${esc(state.historyError)}</div>` : '';
  const pod = state.podcastHistory.length ? `<div class="history-toolbar"><span>${state.podcastHistory.length} podcast ${state.podcastHistory.length === 1 ? 'entry' : 'entries'}</span><button type="button" class="button danger sm" id="clear-podcast-history">Remove all</button></div><div class="songlist podcast-history-list">${state.podcastHistory.map((r, i) => `<div class="songrow"><div class="songicon" style="background:${grad(i + 2)}">${icon('mic')}</div><div class="grow"><strong>${esc(state.episodeTitles[r.episode_id] || `Episode #${r.episode_id}`)}</strong><small>${esc(r.completion_status || 'Partial')} · ${nice(r.duration_played_seconds)} listened · ${esc(agoText(r.stream_date))}</small></div><button class="button secondary sm" data-poddelete="${r.podcast_stream_id}">Remove</button></div>`).join('')}</div>` : '<div class="empty">No podcast history yet.</div>';
  shell(`${notice}<div class="section-heading"><h2>Recently played</h2></div>${rows.length ? historyTable(rows) : '<div class="empty">No music history yet. Play a song to start tracking your activity.</div>'}<div class="section-heading"><h2>Podcast listening</h2></div>${pod}`, 'Listening history', 'Your recent listening, newest first.');
  document.querySelectorAll('[data-histdelete]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); action(async () => { check(await db.from('listening_history').delete().eq('stream_id', Number(b.dataset.histdelete)).eq('user_id', state.user.id)); state.history = state.history.filter((x) => String(x.stream_id) !== b.dataset.histdelete); persistHistoryCache(); render(); toast('Removed from history'); }); });
  document.querySelectorAll('[data-poddelete]').forEach((b) => b.onclick = () => action(async () => { const id = Number(b.dataset.poddelete); const rpc = await db.rpc('delete_my_podcast_history', { p_podcast_stream_id: id, p_delete_all: false }); if (rpc.error) { check(await db.from('podcast_listening_history').delete().eq('podcast_stream_id', id).eq('user_id', state.user.id)); } state.podcastHistory = state.podcastHistory.filter((x) => Number(x.podcast_stream_id) !== id); persistHistoryCache(); render(); toast('Podcast history entry removed'); }));
  $('#clear-podcast-history')?.addEventListener('click', () => { if (!confirm('Remove all podcast listening history?')) return; action(async () => { const rpc = await db.rpc('delete_my_podcast_history', { p_podcast_stream_id: null, p_delete_all: true }); if (rpc.error) { check(await db.from('podcast_listening_history').delete().eq('user_id', state.user.id)); } state.podcastHistory = []; writeLocalJson(localKey('podcast-history'), []); persistHistoryCache(); render(); toast('Podcast history cleared'); }); });
}
function plans() {
  const ent = state.entitlement;
  const current = ent && String(ent.status || 'Active').toLowerCase() === 'active' ? ent : null;
  const relationship = (current?.relationship || 'Owner');
  const currentPlan = state.plans.find(p => String(p.plan_id) === String(current?.plan_id)) || null;
  const maxMembers = Number(current?.max_members || currentPlan?.max_members || 1);
  const ownedMembers = current?.subscription_id ? state.subscriptionMembers.filter(m => String(m.subscription_id) === String(current.subscription_id) && String(m.user_id) !== String(current.owner_user_id || state.user?.id)) : [];
  const isPlanOwner = String(relationship).toLowerCase() === 'owner';
  const usedSeats = Math.min(maxMembers, 1 + ownedMembers.length);
  const availableSeats = Math.max(0, maxMembers - usedSeats);
  const ownerId = current?.owner_user_id || state.user?.id;
  const memberCards = [`<div class="subscription-member-chip owner"><span class="member-avatar">${esc(String(ownerId || 'O').slice(0, 1).toUpperCase())}</span><span><strong>${isPlanOwner ? 'You' : 'Plan owner'}</strong><small>Owner</small></span></div>`];
  ownedMembers.forEach((m, i) => { const memberLabel = String(m.user_id) === String(state.user?.id) ? 'You' : ('Member ' + (i + 1)); const removeButton = isPlanOwner && String(m.user_id) !== String(state.user?.id) ? `<button type="button" class="icon-quiet" data-remove-sub-member="${esc(m.user_id)}" title="Remove member">${icon('close')}</button>` : ''; memberCards.push(`<div class="subscription-member-chip"><span class="member-avatar">${esc(String(m.user_id || 'U').slice(0, 1).toUpperCase())}</span><span><strong>${esc(memberLabel)}</strong><small>Shared Premium seat</small></span>${removeButton}</div>`); });
  const sharedMemberRows = `<div class="subscription-members-list">${memberCards.join('')}</div>`;
  const sharedMemberInfo = state.sharedMemberships.length ? `<div class="subscription-shared-note">${icon('users')} You are currently included in ${state.sharedMemberships.length} shared plan${state.sharedMemberships.length === 1 ? '' : 's'}.</div>` : '';
  const paymentRows = (state.paymentRows || []).slice(0, 5).map(r => `<div class="subscription-payment-row"><span><strong>${esc(r.payment_status || 'Recorded')}</strong><small>${esc(r.payment_method || 'Payment')}</small></span><span>${r.payment_amount != null ? `₱${Number(r.payment_amount).toFixed(2)}` : '—'}</span><span>${esc(String(r.payment_date || '—').slice(0, 10))}</span></div>`).join('');
  const cards = state.plans.map(p => {
    const isCurrent = current && String(current.plan_id) === String(p.plan_id);
    const price = Number(p.monthly_price || 0);
    const action = isCurrent ? `<button class="button secondary" disabled>${icon('check')} Current plan</button>` : price <= 0 ? `<button class="button secondary" disabled>Free access</button>` : `<button class="button" data-maya-plan="${p.plan_id}">${icon('forward')} Continue to payment</button>`;
    return `<article class="plan-card ${isCurrent ? 'current-plan' : ''}"><span>${esc(p.plan_name)}</span><strong>₱${price.toFixed(0)}<small>/month</small></strong><p>${p.max_members} ${Number(p.max_members) === 1 ? 'member' : 'members'}</p><small class="plan-meta">${Number(p.max_members) > 1 ? 'Best for shared listening' : 'Great for personal listening'}</small>${action}</article>`;
  }).join('');
  const manageSection = current ? `<section class="subscription-minimal"><article class="subscription-current-card"><div class="subscription-current-main"><div><span class="eyebrow">YOUR PLAN</span><h3>${esc(current.plan_name || 'Premium')}</h3><p>${esc(relationship)} · active until ${esc(current.end_date || '—')}</p></div><span class="status-pill active">${icon('check')} Active</span></div><div class="subscription-compact-stats"><span><small>Downloads</small><strong>${state.offlineDownloads.length}</strong></span><span><small>Seats</small><strong>${usedSeats}/${maxMembers}</strong></span><span><small>Renews / ends</small><strong>${esc(String(current.end_date || '—').slice(0, 10))}</strong></span></div>${sharedMemberInfo}${maxMembers > 1 && isPlanOwner ? `<div class="subscription-inline-action"><span>${availableSeats ? `${availableSeats} shared seat${availableSeats === 1 ? '' : 's'} available` : 'All shared seats are in use'}</span><button type="button" class="button secondary sm" id="invite-plan-member" ${availableSeats < 1 ? 'disabled' : ''}>${icon('users')} ${availableSeats > 0 ? 'Invite member' : 'Plan full'}</button></div>` : ''}</article><details class="subscription-details"><summary>Members <span>${usedSeats}/${maxMembers}</span></summary><div class="subscription-details-body">${sharedMemberRows}</div></details>${paymentRows ? `<details class="subscription-details"><summary>Payment history <span>${(state.paymentRows || []).length}</span></summary><div class="subscription-details-body subscription-payment-list">${paymentRows}</div></details>` : ''}</section>` : `<section class="subscription-layout"><article class="subscription-panel"><div class="subscription-panel-head"><div><span class="eyebrow">PREMIUM</span><h3>Upgrade in a few steps</h3></div></div><div class="subscription-flow"><div><strong>1. Choose a plan</strong><p>Select the plan and number of seats that fit your account.</p></div><div><strong>2. Complete checkout</strong><p>Continue to the secure payment page to confirm your subscription.</p></div><div><strong>3. Automatic verification</strong><p>SoundWave verifies the completed transaction and updates your account.</p></div><div><strong>4. Premium activates</strong><p>Your plan, downloads, and eligible sharing benefits become available automatically.</p></div></div></article></section>`;
  if (current && state.mayaPaymentNotice?.type === 'pending') {
    clearPendingMayaReturn();
    state.mayaPaymentNotice = { type: 'success', message: 'Your subscription is active. Premium benefits are ready to use.' };
  }
  const paymentNotice = state.mayaPaymentNotice ? `<div class="payment-return-notice ${esc(state.mayaPaymentNotice.type || 'info')}"><span>${state.mayaPaymentNotice.type === 'success' ? icon('check') : icon('clock')}</span><div><strong>${state.mayaPaymentNotice.type === 'success' ? 'Premium activated' : state.mayaPaymentNotice.type === 'pending' ? 'Payment verification' : 'Checkout update'}</strong><p>${esc(state.mayaPaymentNotice.message || '')}</p></div>${state.mayaPaymentNotice.type === 'pending' ? `<button type="button" class="button secondary sm" id="retry-maya-payment">Retry verification</button>` : ''}</div>` : '';
  shell(`${paymentNotice}${current ? `<section class="workspace-hero premium-hero"><div><span class="eyebrow">SUBSCRIPTION</span><h2>${esc(current.plan_name || 'Premium')} is active.</h2><p>${esc(relationship)} · ${esc(current.start_date || '')} → ${esc(current.end_date || '')}</p><div class="inline hero-inline-pills">${premiumAccountBadge(current.plan_name || 'Premium')}</div></div><span class="hero-vinyl">✓</span></section>` : `<section class="workspace-hero premium-hero"><div><span class="eyebrow">PREMIUM</span><h2>Upgrade to SoundWave Premium.</h2><p>Choose a plan and complete checkout to activate your Premium benefits.</p></div><span class="hero-vinyl">M</span></section>`}${manageSection}<div class="section-heading subscription-heading"><div><h2>Available plans</h2><small class="muted">Choose the plan that fits your listening.</small></div></div><div class="plan-grid">${cards}</div>
 <dialog class="sw-modal maya-checkout-dialog" id="maya-checkout-dialog"><div class="modal-head"><div><span class="eyebrow">SECURE CHECKOUT</span><h2 id="maya-checkout-title">Confirm plan</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="maya-checkout-body"><div class="maya-order-summary"><span class="maya-mark">M</span><div><small>SoundWave Premium</small><strong id="maya-plan-name">Premium</strong><p id="maya-plan-members">1 member</p></div><strong id="maya-plan-price">₱0</strong></div><div class="maya-test-notice">${icon('shield')} <span><strong>Secure payment</strong><small>Your plan activates after the transaction is verified.</small></span></div><ol class="maya-checkout-steps"><li><span>1</span>SoundWave creates a secure checkout session.</li><li><span>2</span>You finish payment on the secure checkout page.</li><li><span>3</span>SoundWave verifies the payment and activates Premium.</li></ol><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button type="button" class="button maya-pay-button" id="maya-start-checkout">Continue to payment</button></div></div></dialog>
 <dialog class="sw-modal" id="subscription-invite-dialog"><div class="modal-head"><div><span class="eyebrow">SHARE PREMIUM</span><h2>Invite a member</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="form"><p class="muted">Generate a one-time link. The other person signs in to SoundWave and opens the link to use one available seat.</p><button type="button" class="button" id="generate-sub-invite">${icon('users')} Generate invite link</button><label class="single-field" id="sub-invite-result" hidden>Invite link<input id="sub-invite-url" readonly></label><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Done</button><button type="button" class="button secondary" id="copy-sub-invite" hidden>Copy link</button></div></div></dialog>
 <dialog class="sw-modal premium-welcome-dialog" id="premium-welcome-dialog"><div class="modal-head"><div><span class="eyebrow">WELCOME TO PREMIUM</span><h2>Your Premium plan is active.</h2></div><button class="modal-close" data-close-modal>${icon('close')}</button></div><div class="premium-benefit-grid"><div>${icon('download')}<strong>Offline downloads</strong><small>Save supported songs to this device.</small></div><div>${icon('check')}<strong>Premium status</strong><small>Your account now shows its active Premium plan.</small></div><div>${icon('users')}<strong>Plan sharing</strong><small>Eligible multi-seat plans can invite other SoundWave users.</small></div></div><div class="dialog-actions"><button type="button" class="button" data-close-modal>Start listening</button></div></dialog>`, 'Subscription', current ? `${current.plan_name} subscription` : 'Manage your Premium subscription.');
  let chosenPlan = null;
  document.querySelectorAll('[data-maya-plan]').forEach(b => b.onclick = () => { chosenPlan = state.plans.find(x => String(x.plan_id) === String(b.dataset.mayaPlan)); if (!chosenPlan) return; $('#maya-plan-name').textContent = chosenPlan.plan_name; $('#maya-plan-members').textContent = `${chosenPlan.max_members} ${Number(chosenPlan.max_members) === 1 ? 'member' : 'members'}`; $('#maya-plan-price').textContent = `₱${Number(chosenPlan.monthly_price || 0).toFixed(2)}`; $('#maya-checkout-title').textContent = `Choose ${chosenPlan.plan_name}`; $('#maya-checkout-dialog').showModal(); });
  $('#maya-start-checkout')?.addEventListener('click', () => action(async () => {
    if (!chosenPlan) { toast('Choose a Premium plan first.', true); return; }
    const btn = $('#maya-start-checkout'); btn.disabled = true; btn.textContent = 'Creating checkout…';
    try {
      const returnOrigin = window.location.origin;
      const { data, error } = await db.functions.invoke('maya-create-checkout', { body: { plan_id: Number(chosenPlan.plan_id), return_origin: returnOrigin } });
      if (error) { toast(`Could not start checkout: ${await edgeFunctionMessage(error)}`, true); return; }
      if (data?.error) { toast(`Could not start checkout: ${data.error}`, true); return; }
      if (!data?.checkout_url) { toast('The payment service did not return a checkout URL. Please try again.', true); return; }
      const checkoutUrl = new URL(data.checkout_url); if (checkoutUrl.protocol !== 'https:' || !/(^|\.)paymaya\.com$|(^|\.)maya\.ph$/i.test(checkoutUrl.hostname)) throw Error('Payment checkout returned an unexpected destination.');
      sessionStorage.setItem('soundwave-maya-reference', String(data.reference || ''));
      window.location.assign(checkoutUrl.href);
    } finally { btn.disabled = false; btn.textContent = 'Continue to payment'; }
  }));
  $('#retry-maya-payment')?.addEventListener('click', () => { state.mayaPaymentNotice = { type: 'pending', message: 'Retrying payment verification…' }; processPendingMayaReturn(); });
  $('#invite-plan-member')?.addEventListener('click', () => document.getElementById('subscription-invite-dialog')?.showModal());
  $('#generate-sub-invite')?.addEventListener('click', () => action(async () => {
    if (!current?.subscription_id) throw Error('No active subscription was found.');
    const { data, error } = await db.rpc('create_subscription_invite', { p_subscription_id: Number(current.subscription_id) });
    if (error) throw error; const token = Array.isArray(data) ? data[0]?.token ?? data[0] : data?.token ?? data; if (!token) throw Error('No invite token was returned.');
    const url = `${location.origin}${location.pathname}?subscription_invite=${encodeURIComponent(String(token))}#/plans`;
    document.getElementById('sub-invite-url').value = url; document.getElementById('sub-invite-result').hidden = false; document.getElementById('copy-sub-invite').hidden = false;
  }));
  $('#copy-sub-invite')?.addEventListener('click', async () => { const input = document.getElementById('sub-invite-url'); if (!input?.value) return; try { await navigator.clipboard.writeText(input.value); toast('Premium invite link copied'); } catch { input.select(); document.execCommand?.('copy'); toast('Invite link ready to share'); } });
  document.querySelectorAll('[data-remove-sub-member]').forEach(b => b.onclick = () => { if (!confirm('Remove this member from the Premium plan?')) return; action(async () => { const { error } = await db.rpc('remove_subscription_member', { p_subscription_id: Number(current.subscription_id), p_user_id: b.dataset.removeSubMember }); if (error) throw error; await loadData(); render(); toast('Member removed'); }); });
}

// Maya return processing is handled by captureMayaReturn/processPendingMayaReturn above.

// ---------- Step-by-step upload helpers (songs + podcasts) ----------
function howItWorks(steps) {
  return `<ol class="how-steps">${steps.map(([t, d], i) => `<li><span class="how-num">${i + 1}</span><span><strong>${esc(t)}</strong><small>${esc(d)}</small></span></li>`).join('')}</ol>`;
}
function wizardNav(labels) {
  return `<ol class="wizard-steps" aria-label="Upload progress">${labels.map((l, i) => `<li class="${i === 0 ? 'current' : ''}"><span>${i + 1}</span>${esc(l)}</li>`).join('')}</ol>`;
}
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/i;
function audioProblem(f) {
  if (!f || f.size <= 0) return 'Choose a non-empty audio file.';
  const mime = String(f.type || '').toLowerCase(), extOk = AUDIO_EXT.test(String(f.name || ''));
  const mimeOk = /^audio\/(mpeg|mp3|wav|x-wav|mp4|m4a|aac|ogg|opus|flac|webm)$/i.test(mime);
  if (!extOk || (!mimeOk && mime)) return 'That does not look like a supported audio file. Use MP3, WAV, M4A, AAC, OGG, OPUS, FLAC or WebM audio.';
  if (f.size > 35 * 1048576) return `That file is ${(f.size / 1048576).toFixed(1)} MB. Please choose one under 35 MB.`;
  return '';
}
function plainNameProblem(value, label = 'Name', max = 100) {
  const raw = String(value || ''), t = raw.trim();
  if (!t) return `${label} is required.`;
  if (t.length < 2) return `${label} must be at least 2 characters.`;
  if (t.length > max) return `${label} must be ${max} characters or fewer.`;
  if (raw !== t) return `${label} cannot start or end with spaces.`;
  if (/\s{2,}/.test(t)) return `${label} cannot contain repeated spaces.`;
  if (/[<>]/.test(t)) return `${label} contains unsupported characters.`;
  return '';
}
function contentTitleProblem(value, label = 'Title', max = 120) {
  const v = String(value || ''); const t = v.trim();
  if (t.length < 2) return `${label} must be at least 2 characters.`;
  if (t.length > max) return `${label} must be ${max} characters or fewer.`;
  if (v !== t) return `${label} cannot start or end with spaces.`;
  if (/\s{2,}/.test(t)) return `${label} cannot contain repeated spaces.`;
  if (/\.(mp3|wav|m4a|aac|ogg|flac|webp|png|jpe?g)$/i.test(t)) return `${label} should be a title, not a filename.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '&.,!?()\-–—:+]*$/u.test(t)) return `${label} contains unsupported symbols. Use letters, numbers, spaces, and normal punctuation.`;
  const letters = (t.match(/\p{L}/gu) || []).length;
  const digits = (t.match(/\p{N}/gu) || []).length;
  const compact = t.replace(/[^\p{L}\p{N}]/gu, '');
  if (letters < 2) return `${label} must contain at least 2 letters.`;
  if (digits > 0 && digits / Math.max(1, letters + digits) > .45) return `${label} contains too many numbers. Use a meaningful release or track name.`;
  if (/(.)\1{3,}/iu.test(t)) return `${label} contains too many repeated characters.`;
  if (/(?:asdf|qwer|zxcv|hjkl|poiuy|lkjh|mnbv|12345|98765)/i.test(t)) return `${label} looks like placeholder or random text.`;
  const words = t.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (words.some(w => w.length >= 7 && !/[aeiouy]/i.test(w) && !/\d/.test(w))) return `${label} looks like random letters. Use a meaningful word or phrase.`;
  if (compact.length >= 8 && /^[a-z]+$/i.test(compact) && new Set(compact.toLowerCase()).size <= 2) return `${label} looks like repeated placeholder text.`;
  return '';
}
function normalizedContentTitle(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
function safeUploadFilename(file) {
  const raw = String(file?.name || 'audio').normalize('NFKD');
  const dot = raw.lastIndexOf('.'), ext = (dot >= 0 ? raw.slice(dot + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const base = (dot >= 0 ? raw.slice(0, dot) : raw).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'track';
  return `${base}.${ext}`;
}

// Read duration from the selected local audio file before uploading it.
// Returns a Promise<number> in seconds. Used by both song and podcast uploads.
function audioDuration(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No audio file selected.')); return; }
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const cleanup = () => {
      try { URL.revokeObjectURL(objectUrl); } catch (_) { }
      audio.removeAttribute('src');
      try { audio.load(); } catch (_) { }
    };
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Timed out while reading audio metadata.')), 12000);
    const ok = () => {
      clearTimeout(timer);
      const duration = Number(audio.duration);
      if (Number.isFinite(duration) && duration > 0) finish(resolve, Math.ceil(duration));
      else finish(reject, new Error('Could not read the audio duration.'));
    };
    const fail = () => { clearTimeout(timer); finish(reject, new Error('Could not read audio metadata.')); };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', ok, { once: true });
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) ok();
    }, { once: true });
    audio.addEventListener('error', fail, { once: true });
    audio.src = objectUrl;
    try { audio.load(); } catch (e) { fail(); }
  });
}
function audioDropHtml(p) {
  return `<label class="audio-drop" id="${p}-drop" for="${p}-file">${icon('upload')}<strong id="${p}-drop-title">Choose an audio file</strong><small>Or drag and drop it here</small><input id="${p}-file" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" hidden></label><div id="${p}-summary" class="audio-summary"></div>`;
}
function bindAudioDrop(p) {
  const input = document.getElementById(`${p}-file`), zone = document.getElementById(`${p}-drop`);
  if (!input || !zone) return;
  const show = () => {
    const f = input.files?.[0]; if (!f) return;
    document.getElementById(`${p}-drop-title`).textContent = f.name;
    const bad = audioProblem(f);
    const sum = document.getElementById(`${p}-summary`);
    if (sum) {
      if (bad) { sum.textContent = bad; }
      else { sum.innerHTML = `<div class="selected-audio-card"><span class="selected-audio-art">${icon('music')}</span><div><strong>${esc(f.name)}</strong><small>${(f.size / 1048576).toFixed(2)} MB · Ready to upload</small></div><span class="audio-ready">${icon('check')} Ready</span></div>`; }
      sum.classList.toggle('bad', Boolean(bad));
    }
  };
  input.addEventListener('change', show);
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); } });
}
const summaryHtml = (rows) => `<dl class="upload-summary">${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
function bindWizard(form, { validate = () => '' } = {}) {
  const dialog = form.closest('dialog');
  const steps = [...form.querySelectorAll('.upload-step')], total = steps.length;
  const back = form.querySelector('.wiz-back'), next = form.querySelector('.wiz-next'), finish = form.querySelector('.wiz-finish');
  const label = dialog?.querySelector('.wizard-eyebrow');
  let step = 1;
  const go = (n) => {
    step = Math.max(1, Math.min(total, n));
    steps.forEach((el, i) => { el.hidden = i + 1 !== step; });
    form.querySelectorAll('.wizard-steps li').forEach((li, i) => { const current = i + 1 === step; li.classList.toggle('current', current); li.classList.toggle('done', i + 1 < step); if (current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    if (label) label.textContent = `STEP ${step} OF ${total}`;
    back.hidden = step === 1; next.hidden = step === total; finish.hidden = step !== total;
    form.dispatchEvent(new CustomEvent('wizardstep', { detail: step }));
  };
  next.onclick = () => { const err = validate(step); if (err) return toast(err, true); go(step + 1); };
  back.onclick = () => go(step - 1);
  dialog?.addEventListener('close', () => go(1));
  go(1);
  return { go, get step() { return step; } };
}
function setFieldError(input, message) {
  if (!input) return;
  let note = input.parentElement?.querySelector(':scope > .field-error');
  if (!message) { note?.remove(); input.classList.remove('field-invalid'); input.removeAttribute('aria-invalid'); return; }
  if (!note) { note = document.createElement('small'); note.className = 'field-error'; note.setAttribute('role', 'alert'); input.insertAdjacentElement('afterend', note); }
  note.textContent = message; input.classList.add('field-invalid'); input.setAttribute('aria-invalid', 'true'); input.focus();
}
function setPublishing(btn, on, idle) { if (!btn) return; btn.disabled = on; btn.textContent = on ? 'Uploading… keep this window open' : idle; btn.closest('form')?.classList.toggle('is-publishing', on); if (on) btn.scrollIntoView?.({ block: 'nearest' }); }

function studio() {
  if (!hasArtistAccess()) return discoverPage();
  const validAlbums = state.albums.filter(a => a.is_active || albumScheduledAt(a.album_id));
  const ownedSongs = state.ownedSongs || [];
  const streams = Number(state.artistThirtyDay.length || 0);
  const followers = myFollowerCount();
  const estimated = Number(state.royaltySummary?.estimated_royalty || 0);
  const days = Array(30).fill(0); for (const r of state.artistThirtyDay || []) { const d = Math.floor((Date.now() - new Date(r.stream_date).getTime()) / 86400000); if (d >= 0 && d < 30) days[29 - d]++; }
  if (state.artistStudioView === 'catalog' && !state.selectedStudioAlbum && state.albums.length) state.selectedStudioAlbum = Number(state.albums[0].album_id);
  const selectedAlbumId = Number(state.selectedStudioAlbum || 0);
  const selectedRelease = state.albums.find(a => Number(a.album_id) === selectedAlbumId) || null;
  const catalogSongs = selectedRelease ? ownedSongs.filter(song => Number(song.album?.album_id || song.album_id) === selectedAlbumId) : [];
  const albums = state.albums.map((a, i) => `<article class="studio-release-card ${Number(a.album_id) === selectedAlbumId ? 'selected-release' : ''}"><button class="studio-release-main" data-album-select="${a.album_id}" aria-label="Show songs from ${esc(a.album_title)}" aria-pressed="${Number(a.album_id) === selectedAlbumId}"><span class="studio-album-art" style="background:${grad(i)}">${a.cover_path && state.coverUrls[a.cover_path] ? `<img src="${escapeHtml(state.coverUrls[a.cover_path])}" alt="${esc(a.album_title)} cover">` : icon('album')}</span><span class="studio-release-copy"><span class="card-title-line"><strong>${escapeHtml(a.album_title)}</strong>${albumScheduledAt(a.album_id) ? `<span class="status-pill scheduled">Scheduled</span>` : `<span class="status-pill ${a.is_active ? 'active' : 'inactive'}">${a.is_active ? 'Active' : 'Inactive'}</span>`}</span><small><span class="release-type-pill">${esc(a.release_type || 'Album')}</span> ${albumScheduledAt(a.album_id) ? `· Goes live ${esc(fmtSchedule(albumScheduledAt(a.album_id)))}` : a.release_date ? `· ${esc(String(a.release_date).slice(0, 10))}` : ''}</small></span></button>${albumScheduledAt(a.album_id) ? `<button type="button" class="button sm studio-deactivate" data-release-now="${a.album_id}">Release now</button>` : `<button type="button" class="button secondary sm studio-deactivate" data-album-active="${a.album_id}" data-active="${a.is_active ? 'false' : 'true'}" ${a.admin_locked ? 'disabled title="Locked by administrator"' : ''}>${a.admin_locked ? 'Admin locked' : a.is_active ? 'Deactivate' : 'Restore'}</button>`}</article>`).join('');
  shell(`<section class="workspace-hero artist-studio-hero"><div><span class="eyebrow">SOUNDWAVE FOR ARTISTS</span><h2>Artist Studio</h2><p>Release, manage and understand your music without crowding everything into one page.</p><div class="hero-actions"><button class="button hero-cta" data-open-modal="new-song-modal">${icon('upload')} Upload a song</button></div></div><span class="hero-vinyl">${icon('album')}</span></section>
 <section class="artist-cover-settings"><div><span class="eyebrow">ARTIST IDENTITY</span><h3>Profile cover photo</h3><p>Personalize your artist page with a wide banner image. Recommended 1600 × 500, JPEG, PNG or WebP (max 5 MB).</p></div><div class="artist-cover-controls"><div id="artist-cover-preview" class="artist-cover-preview" aria-label="Current artist cover">${state.artist?.cover_path && state.coverUrls[state.artist.cover_path] ? `<img src="${esc(state.coverUrls[state.artist.cover_path])}" alt="Current artist banner">` : `<span>No cover image yet</span>`}</div><button type="button" class="button secondary" id="artist-cover-choose">${icon('upload')} Choose cover photo</button><input type="file" id="artist-cover-upload" accept="image/jpeg,image/png,image/webp" class="artist-cover-file-input" aria-label="Artist cover photo"><small id="artist-cover-status" role="status" aria-live="polite">Choose an image to upload.</small></div></section>
 <nav class="creator-view-tabs" aria-label="Artist Studio views"><button class="${state.artistStudioView === 'overview' ? 'active' : ''}" data-artist-view-btn="overview">Overview</button><button class="${state.artistStudioView === 'analytics' ? 'active' : ''}" data-artist-view-btn="analytics">Analytics</button><button class="${state.artistStudioView === 'catalog' ? 'active' : ''}" data-artist-view-btn="catalog">Catalog</button><button class="${state.artistStudioView === 'publish' ? 'active' : ''}" data-artist-view-btn="publish">Publish</button><button class="${state.artistStudioView === 'earnings' ? 'active' : ''}" data-artist-view-btn="earnings">Earnings</button></nav>
 <section class="creator-view-block" data-artist-view="overview" ${state.artistStudioView !== 'overview' ? 'hidden' : ''}><section class="studio-stat-strip four"><button type="button" data-stat-info="a-streams" aria-haspopup="dialog"><small>Streams</small><strong data-count="${streams}">${streams}</strong><span>Last 30 days</span></button><button type="button" data-stat-info="a-followers" aria-haspopup="dialog"><small>Followers</small><strong data-count="${followers}">${followers}</strong><span>Your audience</span></button><button type="button" data-stat-info="a-releases" aria-haspopup="dialog"><small>Releases</small><strong data-count="${state.albums.length}">${state.albums.length}</strong><span>Albums and singles</span></button><button type="button" data-stat-info="a-royalty" aria-haspopup="dialog"><small>Estimated royalty</small><strong>₱${estimated.toFixed(2)}</strong><span>Current estimate</span></button></section><div class="creator-summary-grid"><article><span class="eyebrow">NEXT STEP</span><h3>Publish new music</h3><p>Create a release or upload a track without leaving Artist Studio.</p><button class="button secondary" data-artist-open="publish">Open publishing</button></article><article><span class="eyebrow">PERFORMANCE</span><h3>${state.artistThirtyDay.length} streams in 30 days</h3><p>Open Analytics for trends, top songs, releases and listeners.</p><button class="button secondary" data-artist-open="analytics">View analytics</button></article><article><span class="eyebrow">CATALOG</span><h3>${state.albums.length} releases</h3><p>Manage release and track availability in one focused view.</p><button class="button secondary" data-artist-open="catalog">Manage catalog</button></article></div></section>
 <section class="creator-view-block" data-artist-view="analytics" ${state.artistStudioView !== 'analytics' ? 'hidden' : ''}>${artistChartsHtml()}</section>
 <section class="creator-view-block" data-artist-view="publish" ${state.artistStudioView !== 'publish' ? 'hidden' : ''}><div class="section-heading"><div><span class="eyebrow">CREATE</span><h2>Release tools</h2></div></div><div class="studio-actions redesign-actions"><button data-open-modal="new-album-modal"><span class="studio-action-art gradient-one">${icon('album')}</span><strong>New album / single</strong><small>Create release details and cover art</small><span class="studio-arrow">${icon('plus')}</span></button><button data-open-modal="new-song-modal"><span class="studio-action-art gradient-two">${icon('upload')}</span><strong>Upload a song</strong><small>Audio, artwork, genre and review</small><span class="studio-arrow">${icon('plus')}</span></button><button data-open-modal="edit-song-modal"><span class="studio-action-art gradient-three">${icon('settings')}</span><strong>Edit a release</strong><small>Update an existing song title</small><span class="studio-arrow">${icon('forward')}</span></button></div></section>
 <section class="creator-view-block" data-artist-view="catalog" ${state.artistStudioView !== 'catalog' ? 'hidden' : ''}><div class="section-heading"><div><span class="eyebrow">CATALOG</span><h2>Your releases <span class="muted small">(${state.albums.length})</span></h2><p class="muted small">Select a release to manage only the tracks inside it.</p></div><button class="text-link" data-open-modal="new-album-modal">+ Add album</button></div><div class="studio-release-grid">${albums || `<div class="empty studio-empty"><span>${icon('album')}</span><h3>Release your first album</h3><p>Create an album or single, add artwork, then upload your first track.</p><button class="button" data-open-modal="new-album-modal">${icon('plus')} Create a release</button></div>`}</div><div class="section-heading catalog-track-heading"><div><span class="eyebrow">TRACKS</span><h2>${selectedRelease ? esc(selectedRelease.album_title) : 'Select a release'}</h2><p class="muted small">${selectedRelease ? `${catalogSongs.length} ${catalogSongs.length === 1 ? 'track' : 'tracks'} in this release` : 'Choose an album or single above to manage its songs.'}</p></div><button class="text-link" data-open-modal="new-song-modal">+ Upload song</button></div>${releaseChecklist(selectedRelease, catalogSongs)}<div class="song-manager-grid">${selectedRelease ? (catalogSongs.length ? catalogSongs.map(song => `<article class="song-manager-card">${albumArt(song, 'large')}<div class="song-manager-copy"><div class="card-title-line"><strong>${esc(song.song_title)}</strong>${!song.is_active && albumScheduledAt(song.album?.album_id || song.album_id) ? `<span class="status-pill scheduled">Scheduled</span>` : `<span class="status-pill ${song.is_active ? 'active' : 'inactive'}">${song.is_active ? 'Active' : 'Inactive'}</span>`}${restrictedPillHtml(song.song_id)}</div><small>${esc(song.album?.album_title || 'Release')}</small><div class="song-manager-meta"><span>${esc(state.genres.find(g => Number(g.genre_id) === Number(song.genre_id))?.genre_name || 'Uncategorized')}</span><span>${nice(song.duration_seconds)}</span></div></div><div class="song-manager-actions"><button type="button" class="button secondary sm" data-open-modal="edit-song-modal" data-edit-song-id="${song.song_id}">Edit</button><button class="button secondary sm" data-own-song-active="${song.song_id}" data-active="${song.is_active ? 'false' : 'true'}">${song.is_active ? 'Deactivate' : 'Restore'}</button></div></article>`).join('') : `<div class="empty catalog-song-empty"><span>${icon('music')}</span><h3>No songs in ${esc(selectedRelease.album_title)}</h3><p>Upload a track and choose this release.</p><button class="button" data-open-modal="new-song-modal">Upload song</button></div>`) : '<div class="empty">Select a release above.</div>'}</div></section>
 <section class="creator-view-block" data-artist-view="earnings" ${state.artistStudioView !== 'earnings' ? 'hidden' : ''}><div class="section-heading"><div><span class="eyebrow">EARNINGS</span><h2>Royalty overview</h2></div><button class="text-link" data-open-modal="royalty-info-dialog">How royalties work</button></div><section class="royalty-upgrade"><div class="royalty-figure"><small>Estimated royalty</small><strong>₱${estimated.toFixed(2)}</strong><span>${streams} qualified streams in 30 days · rate ₱${Number(state.royaltySummary?.royalty_rate || 0).toFixed(4)}</span></div><div class="royalty-spark"><div><small>30-day streams</small><strong>${state.artistThirtyDay.length}</strong></div>${sparkline(days)}</div></section>${earningsBreakdownHtml()}</section>
 <dialog class="sw-modal info-dialog" id="royalty-info-dialog"><div class="modal-head"><div><span class="eyebrow">ROYALTIES</span><h2>How royalties work</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close royalties information">${icon('close')}</button></div><div class="info-stack"><p>SoundWave estimates royalties using your visible stream count multiplied by the royalty rate returned by your existing royalty summary data.</p><div class="notice">This is an estimate for your project dashboard, not a payout guarantee.</div><button type="button" class="button" data-close-modal>Got it</button></div></dialog>
 <dialog class="sw-modal studio-dialog release-create-dialog" id="new-album-modal"><div class="release-dialog-head"><div><span class="eyebrow">NEW RELEASE</span><h2>Create a release</h2><p>Set the artwork and metadata listeners will see across SoundWave.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close new release dialog">${icon('close')}</button></div><form id="albumform" class="release-create-form"><div class="release-create-grid"><div class="release-art-panel"><label class="cover-drop creator-cover-drop release-cover-drop" id="cover-drop" for="albumcover"><span id="cover-preview">${icon('album')}</span><strong>Add cover artwork</strong><small>Square JPG, PNG or WebP · up to 5 MB</small><em>Recommended: 1400 × 1400</em><input type="file" id="albumcover" accept="image/png,image/jpeg,image/webp" hidden></label><div class="release-art-tip"><strong>Artwork tips</strong><span>Use a clear square image without tiny text. Avoid screenshots or unrelated images.</span></div></div><div class="release-meta-panel"><div class="release-type-switch"><label><input type="radio" name="release_type_choice" value="Album" checked><span>${icon('album')} Album</span></label><label><input type="radio" name="release_type_choice" value="Single"><span>${icon('music')} Single</span></label><select id="releasetype" hidden><option value="Album" selected>Album</option><option value="Single">Single</option></select></div><label class="single-field release-title-field">Release title<input id="albumtitle" required maxlength="120" placeholder="e.g. Midnight Signals" autocomplete="off"><small class="field-help">Use a real title. Random letters, repeated characters, and number-heavy names are blocked.</small><small class="field-help availability" id="album-title-status"></small></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="albumdesc" maxlength="1200" placeholder="What is this release about?"></textarea></label><label class="single-field">Release date<input id="releasedate" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label><div class="release-timing"><label><input type="radio" name="release_timing" value="now" checked><span>Release now</span></label><label><input type="radio" name="release_timing" value="later"><span>Schedule for later</span></label></div><label class="single-field release-schedule-field" id="release-schedule-field" hidden>Go live at<input id="releaseat" type="datetime-local"><small class="field-help">The release and its tracks stay hidden from listeners until this time.</small></label></div></div><div class="release-form-note">You can add tracks after the release is created. Metadata can be edited later from Catalog.</div><div class="dialog-actions release-dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy>Create release</button></div></form></dialog>
 <dialog class="sw-modal studio-dialog wizard-dialog upload-wizard-dialog" id="new-song-modal"><div class="upload-hero-strip"><span>${icon('upload')}</span><div><small>ARTIST UPLOAD</small><strong>Publish a polished track</strong></div></div><div class="modal-head"><div><span class="eyebrow wizard-eyebrow">STEP 1 OF 4</span><h2>Upload a track</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close upload track dialog">${icon('close')}</button></div><form id="songform">${wizardNav(['Album', 'Audio', 'Details', 'Review'])}<section class="upload-step" data-step="1"><div class="step-icon">${icon('album')}</div><h3>Choose the release</h3><p class="step-desc">Every track belongs to a release. Pick the album or single that should contain this song.</p><div class="album-picks">${validAlbums.map((a, i) => `<label class="album-pick"><input type="radio" name="albumchoice" value="${a.album_id}" ${i === 0 ? 'checked' : ''}><span style="background:${grad(i)}">${icon('album')}</span><strong>${escapeHtml(a.album_title)}</strong><small>${esc(a.release_type || 'Album')}</small>${icon('check')}</label>`).join('') || '<p class="notice">You do not have an album yet. Create one first, then come back to upload.</p>'}</div><button type="button" class="button secondary" data-switch-modal="new-album-modal">${icon('plus')} Create a release</button></section><section class="upload-step" data-step="2" hidden><div class="step-icon">${icon('upload')}</div><h3>Add your audio file</h3><p class="step-desc">Upload the final mastered track that listeners will stream on SoundWave.</p>${audioDropHtml('song')}</section><section class="upload-step" data-step="3" hidden><div class="step-icon">${icon('settings')}</div><h3>Track details</h3><p class="step-desc">Complete the title, description, artwork and genre before publishing.</p><div class="track-detail-grid"><div class="track-detail-fields"><label class="single-field">Song title<input id="songtitle" maxlength="120" minlength="2" required placeholder="e.g. Midnight Drive" autocomplete="off"><small class="field-help">2–120 characters · no file extensions · normal punctuation only</small><small class="field-help availability" id="song-title-status"></small></label><label class="single-field">Description <span class="field-optional">Optional</span><textarea id="songdesc" maxlength="300" placeholder="Tell listeners about this song"></textarea></label>${lyricsFieldHtml('songlyrics')}${karaokeFieldHtml('song-karaoke', false)}<div class="single-field genre-field"><span class="field-label">Genre</span><input id="songgenre" type="hidden" required><button type="button" class="genre-select-trigger" id="genre-select-trigger" aria-haspopup="listbox" aria-expanded="false"><span id="genre-select-label">Choose a genre</span>${icon('forward')}</button><div class="genre-select-menu" id="genre-select-menu" role="listbox" hidden><div class="genre-select-search">${icon('search')}<input id="genre-search" type="search" placeholder="Search genres" autocomplete="off"></div><div class="genre-option-list">${state.genres.map(g => `<button type="button" class="genre-option" role="option" data-genre-value="${g.genre_id}" data-genre-label="${esc(g.genre_name)}"><span>${esc(g.genre_name)}</span>${icon('check')}</button>`).join('')}</div></div><small class="field-help">Required for search, recommendations and autoplay.</small></div>${moodFieldHtml('song-moods')}</div><div class="track-art-column"><span class="field-label">Artwork</span><label class="cover-drop song-cover-drop compact-art-drop" for="songcover"><span id="song-cover-preview">${icon('album')}</span><span class="cover-change-badge">${icon('album')}</span><input id="songcover" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button type="button" class="button secondary artwork-trigger" onclick="document.getElementById('songcover')?.click()">${icon('upload')} Change artwork</button><small>JPG, PNG or WebP · up to 5 MB</small></div></div></section><section class="upload-step review-step" data-step="4" hidden><div class="step-icon">${icon('check')}</div><h3>Review before publishing</h3><p class="step-desc">Confirm the release, file and metadata before SoundWave uploads anything.</p><div id="song-final"></div><div class="notice">Publishing uses your existing Supabase storage and song insert workflow. Keep this dialog open until the upload completes.</div></section><div class="dialog-actions"><button type="button" class="button secondary wiz-back" hidden>Back</button><button type="button" class="button wiz-next" ${validAlbums.length ? '' : 'disabled'}>Continue</button><button type="submit" class="button wiz-finish" data-busy hidden>Publish song</button></div></form></dialog>
 <dialog class="sw-modal edit-surface-dialog edit-song-dialog" id="edit-song-modal"><div class="edit-surface-head"><div><span class="eyebrow">CATALOG EDITOR</span><h2>Edit song details</h2><p>Pick one of your songs, then update its title, lyrics, karaoke track or mood.</p></div><button type="button" class="modal-close" data-close-modal aria-label="Close edit song dialog">${icon('close')}</button></div><form class="edit-surface-form" id="editsong"><input type="hidden" id="owned-song" required><div class="edit-song-picker" id="edit-song-picker"><label class="edit-song-search">${icon('search')}<input id="owned-song-search" type="search" autocomplete="off" placeholder="Search songs or releases" aria-label="Search your songs"></label><div class="edit-song-results" id="owned-song-results" role="listbox" aria-label="Your songs">${ownedSongs.map(song => `<button type="button" class="edit-song-option" role="option" aria-selected="false" data-edit-song-option="${song.song_id}" data-edit-song-search="${esc(`${song.song_title || ''} ${song.album?.album_title || ''}`.toLowerCase())}">${albumArt(song, 'tiny')}<span><strong>${esc(song.song_title || 'Untitled song')}</strong><small>${esc(song.album?.album_title || 'Release')} · ${nice(song.duration_seconds)}</small></span><i>${icon('chevron')}</i></button>`).join('') || `<div class="empty compact-empty"><p>No songs are available to edit yet.</p></div>`}</div><div class="edit-song-selected" id="edit-song-selected" hidden><div class="edit-song-selected-art" id="edit-song-selected-art" aria-hidden="true"></div><div class="edit-song-selected-text"><small>Editing</small><strong id="edit-song-selected-title"></strong><span id="edit-song-selected-release"></span></div><button type="button" class="edit-song-change" id="edit-song-change">Change song</button></div></div><div class="edit-fields single-column"><label class="single-field">Song title<input id="owned-song-title" required maxlength="120" placeholder="Choose a song above first" disabled><small class="field-help">The same title and anti-placeholder rules used during upload apply here.</small></label>${lyricsFieldHtml('owned-song-lyrics', true)}${karaokeFieldHtml('owned-song-karaoke', true)}${moodFieldHtml('owned-song-moods')}</div><div class="dialog-actions edit-surface-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button class="button" data-busy id="edit-song-save" disabled>Save changes</button></div></form></dialog>`, '', '');
  const artistCoverInput = $('#artist-cover-upload');
  const coverChoose = $('#artist-cover-choose'), coverStatus = $('#artist-cover-status');
  if (coverChoose && artistCoverInput) coverChoose.onclick = () => artistCoverInput.click();
  if (artistCoverInput) artistCoverInput.onchange = async () => {
    const file = artistCoverInput.files?.[0]; if (!file) return;
    if (state.loading) { toast('Wait for the current action before uploading a cover.', true); return; }
    const report = (message, error = false) => { if (coverStatus) { coverStatus.textContent = message; coverStatus.classList.toggle('upload-error', error); } };
    report(`Uploading ${file.name}…`); if (coverChoose) coverChoose.disabled = true;
    try {
      if (!state.artist?.artist_id) throw Error('Your artist profile could not be loaded. Confirm the artist cover SQL migration has been run.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP image.');
      if (file.size > 5 * 1048576) throw Error('Artist cover photo must be smaller than 5 MB.');
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type];
      const path = `${state.user.id}/artists/${crypto.randomUUID()}.${ext}`;
      const upload = await db.storage.from('covers').upload(path, file, { upsert: false, contentType: file.type });
      if (upload.error) throw Error(`Storage upload failed: ${upload.error.message}. Check the covers bucket INSERT policy for your user ID.`);
      try {
        const result = await db.from('artist').update({ cover_path: path }).eq('artist_id', state.artist.artist_id).eq('user_id', state.user.id).select('artist_id,cover_path').maybeSingle();
        if (result.error) throw Error(`Artist profile update failed: ${result.error.message}. Run RUN_ME_v48_artist_cover.sql and check artist UPDATE permissions.`);
        if (!result.data) throw Error('Artist profile update changed no rows. Check artist ownership and RLS policies.');
      } catch (error) { await db.storage.from('covers').remove([path]); throw error; }
      state.artist.cover_path = path;
      const entry = state.artists.find(x => Number(x.artist_id) === Number(state.artist.artist_id)); if (entry) entry.cover_path = path;
      const url = await resolveCoverUrl(path);
      if (!url) throw Error('Cover saved, but its Storage URL could not be resolved. Check covers bucket read permissions.');
      const displayUrl = url + (url.includes('?') ? '&' : '?') + 'sw_uploaded=' + Date.now();
      const visible = await new Promise(resolve => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = displayUrl; });
      if (!visible) throw Error('Cover was saved but the image cannot be displayed. Check covers bucket SELECT policies and signed/public access.');
      state.coverUrls[path] = displayUrl;
      report('Cover uploaded and verified. Open your artist profile to see it.');
      toast('Artist cover uploaded and verified');
      render();
    } catch (error) { console.error('Artist cover upload failed:', error); report(error.message || 'Upload failed', true); toast(humanErr(error), true); }
    finally { if (coverChoose && coverChoose.isConnected) coverChoose.disabled = false; artistCoverInput.value = ''; }
  };
  const setArtistView = (view) => { state.artistStudioView = view; if (view === 'catalog') { if (!state.selectedStudioAlbum && state.albums.length) state.selectedStudioAlbum = Number(state.albums[0].album_id); render(); if (!state.artistEngagement) void loadArtistEngagement().then(() => { if (state.artistStudioView === 'catalog') render(); }); requestAnimationFrame(() => document.querySelector('[data-artist-view="catalog"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); return; } document.querySelectorAll('[data-artist-view-btn]').forEach(b => b.classList.toggle('active', b.dataset.artistViewBtn === view)); document.querySelectorAll('[data-artist-view]').forEach(s => s.hidden = s.dataset.artistView !== view); document.querySelector(`[data-artist-view="${view}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); if (view === 'analytics') { void refreshCrossDeviceMetrics(); void loadArtistEngagement().then(() => { if (state.artistStudioView === 'analytics') render(); }); } if (view === 'earnings') void loadArtistEarnings(); };
  document.querySelectorAll('[data-artist-view-btn]').forEach(b => b.onclick = () => setArtistView(b.dataset.artistViewBtn));
  document.querySelectorAll('[data-artist-open]').forEach(b => b.onclick = () => setArtistView(b.dataset.artistOpen));
  // Step-by-step upload: each step only shows what is needed for it.
  bindAudioDrop('song');
  const songForm = $('#songform');
  let songTitleCheckTimer = null; $('#songtitle')?.addEventListener('input', () => { clearTimeout(songTitleCheckTimer); songTitleCheckTimer = setTimeout(async () => { const input = $('#songtitle'), status = $('#song-title-status'); const problem = contentTitleProblem(input?.value, 'Song title', 120); if (problem) { setFieldState(input, status, false, problem); return; } try { const available = await checkSongTitleAvailability(input.value); setFieldState(input, status, available, available ? 'Song title is available.' : 'You already have a song with this title.'); } catch (err) { console.warn('Song title availability check failed', err); } }, 350); });
  document.querySelectorAll('input[name="release_type_choice"]').forEach(r => r.addEventListener('change', () => { const s = $('#releasetype'); if (s) s.value = r.value; }));
  const albumTitleInput = $('#albumtitle'), albumTitleStatus = $('#album-title-status');
  let albumTitleCheckTimer = null;
  albumTitleInput?.addEventListener('input', () => { clearTimeout(albumTitleCheckTimer); albumTitleCheckTimer = setTimeout(async () => { const problem = contentTitleProblem(albumTitleInput.value, 'Release title', 120); if (problem) { setFieldState(albumTitleInput, albumTitleStatus, false, problem); return; } try { const available = await checkAlbumTitleAvailability(albumTitleInput.value); setFieldState(albumTitleInput, albumTitleStatus, available, available ? 'Release title is available.' : 'You already have a release with this title.'); } catch (err) { console.warn('Release title availability check failed', err); setFieldState(albumTitleInput, albumTitleStatus, true, 'Title format looks good.'); } }, 350); });
  let showTitleCheckTimer = null; $('#showtitle')?.addEventListener('input', () => { clearTimeout(showTitleCheckTimer); showTitleCheckTimer = setTimeout(async () => { const input = $('#showtitle'), status = $('#show-title-status'); const problem = contentTitleProblem(input?.value, 'Show title', 140); if (problem) { setFieldState(input, status, false, problem); return; } try { const available = await checkShowTitleAvailability(input.value); setFieldState(input, status, available, available ? 'Show title is available.' : 'You already have a podcast show with this title.'); } catch (err) { console.warn('Show title availability check failed', err); setFieldState(input, status, true, 'Title format looks good.'); } }, 350); });
  const genreTrigger = $('#genre-select-trigger'), genreMenu = $('#genre-select-menu'), genreSearch = $('#genre-search');
  const closeGenreMenu = () => { if (!genreMenu || !genreTrigger) return; genreMenu.hidden = true; genreTrigger.setAttribute('aria-expanded', 'false'); };
  const visibleGenreOptions = () => [...document.querySelectorAll('.genre-option')].filter(btn => !btn.hidden);
  const chooseGenre = (btn) => { const input = $('#songgenre'), label = $('#genre-select-label'); if (input) input.value = btn.dataset.genreValue || ''; if (label) label.textContent = btn.dataset.genreLabel || 'Choose a genre'; document.querySelectorAll('.genre-option').forEach(x => { const active = x === btn; x.classList.toggle('active', active); x.setAttribute('aria-selected', String(active)); }); genreTrigger?.classList.add('has-value'); closeGenreMenu(); genreTrigger?.focus(); };
  genreTrigger?.addEventListener('click', (e) => { e.stopPropagation(); const opening = genreMenu?.hidden !== false; if (genreMenu) genreMenu.hidden = !opening; genreTrigger.setAttribute('aria-expanded', String(opening)); if (opening) setTimeout(() => genreSearch?.focus(), 30); });
  genreTrigger?.addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && genreMenu?.hidden !== false) { e.preventDefault(); genreMenu.hidden = false; genreTrigger.setAttribute('aria-expanded', 'true'); setTimeout(() => genreSearch?.focus(), 0); } });
  genreSearch?.addEventListener('input', () => { const q = genreSearch.value.trim().toLowerCase(); document.querySelectorAll('.genre-option').forEach(btn => btn.hidden = q && !String(btn.dataset.genreLabel || '').toLowerCase().includes(q)); });
  genreSearch?.addEventListener('keydown', (e) => { const options = visibleGenreOptions(); if (!options.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); options[0].focus(); } else if (e.key === 'Escape') { e.preventDefault(); closeGenreMenu(); genreTrigger?.focus(); } });
  document.querySelectorAll('.genre-option').forEach(btn => { btn.addEventListener('click', () => chooseGenre(btn)); btn.addEventListener('keydown', (e) => { const options = visibleGenreOptions(), i = options.indexOf(btn); if (e.key === 'ArrowDown') { e.preventDefault(); options[(i + 1) % options.length]?.focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); options[(i - 1 + options.length) % options.length]?.focus(); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseGenre(btn); } else if (e.key === 'Escape') { e.preventDefault(); closeGenreMenu(); genreTrigger?.focus(); } }); });
  if (genreOutsideClickHandler) document.removeEventListener('click', genreOutsideClickHandler); genreOutsideClickHandler = (e) => { if (!e.target.closest('.genre-field')) closeGenreMenu(); }; document.addEventListener('click', genreOutsideClickHandler);
  const wiz = bindWizard(songForm, { validate: (st) => { if (st === 1 && !document.querySelector('input[name="albumchoice"]:checked')) return 'Choose an album or create one first.'; if (st === 2) { const f = $('#song-file').files?.[0]; if (!f) return 'Choose your audio file first.'; return audioProblem(f); } if (st === 3) { const problem = contentTitleProblem($('#songtitle')?.value, 'Song title', 120); if (problem) return problem; if (!val('songgenre')) return 'Select a genre.'; } return ''; } });
  songForm.addEventListener('wizardstep', e => { if (e.detail !== 4) return; const f = $('#song-file').files?.[0]; const pick = document.querySelector('input[name="albumchoice"]:checked'); const alb = state.albums.find(a => String(a.album_id) === pick?.value); const g = state.genres.find(x => String(x.genre_id) === String(val('songgenre'))); $('#song-final').innerHTML = summaryHtml([['Title', normalizedContentTitle($('#songtitle')?.value)], ['Album', alb?.album_title], ['Genre', g?.genre_name], ['File', f?.name], ['Size', f ? `${(f.size / 1048576).toFixed(2)} MB` : '']]); });
  document.querySelectorAll('[data-album-select]').forEach(b => b.onclick = () => { state.selectedStudioAlbum = Number(b.dataset.albumSelect); state.artistStudioView = 'catalog'; render(); requestAnimationFrame(() => document.querySelector('.catalog-track-heading')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); });
  $('#albumcover').onchange = e => { const file = e.target.files[0]; const preview = $('#cover-preview'); if (file) { const url = URL.createObjectURL(file); preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Selected album artwork">`; preview.querySelector('img').onload = () => URL.revokeObjectURL(url); const drop = $('#cover-drop'); drop?.classList.add('has-cover'); const t = drop?.querySelector('strong'); if (t) t.textContent = 'Change cover artwork'; const m = drop?.querySelector('small'); if (m) m.textContent = file.name; } };
  $('#songcover').onchange = e => { const file = e.target.files?.[0], preview = $('#song-cover-preview'); if (file && preview) { const url = URL.createObjectURL(file); preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Selected song artwork">`; preview.querySelector('img').onload = () => URL.revokeObjectURL(url); } };
  const editSongDialog = $('#edit-song-modal'), editSongSearch = $('#owned-song-search'), editSongInput = $('#owned-song'), editSongTitle = $('#owned-song-title'), editSongSave = $('#edit-song-save');
  const chooseEditSong = (songId) => {
    const song = ownedSongs.find(x => Number(x.song_id) === Number(songId)); if (!song) return; editSongInput.value = String(song.song_id); editSongTitle.value = song.song_title || ''; editSongTitle.disabled = false; setMoodChips('owned-song-moods', song.moods); editSongSave.disabled = false; { const box = $('#owned-song-lyrics'); if (box) { box.value = ''; box.disabled = true; box.dataset.loaded = ''; const sid = song.song_id; ensureLyricsLoaded(sid).then(text => { if (Number(editSongInput.value) === Number(sid)) { box.value = text || ''; box.disabled = false; box.dataset.loaded = '1'; } }); } } { const kf = $('#owned-song-karaoke-file'); if (kf) { kf.value = ''; syncKaraokePick(kf); kf.disabled = true; const rm = $('#owned-song-karaoke-remove'); if (rm) rm.checked = false; const wrap = $('#owned-song-karaoke-remove-wrap'); if (wrap) wrap.hidden = true; const st = $('#owned-song-karaoke-status'); const sid = song.song_id; ensureKaraokeTrack(sid).catch(err => { console.warn('Instrumental lookup failed', err); return null; }).then(path => { if (Number(editSongInput.value) !== Number(sid)) return; kf.disabled = false; kf.dataset.loaded = '1'; if (st) st.textContent = path ? 'This song has an instrumental. Choose a new file to replace it, or tick the box to remove it.' : 'A version of the song without vocals. Listeners hear it in Karaoke mode while the lyrics scroll. Keep the same length and timing as the original so the lyrics stay in sync.'; if (wrap) wrap.hidden = !path; }); } }
    $('#edit-song-selected-title').textContent = song.song_title || 'Untitled song'; $('#edit-song-selected-release').textContent = song.album?.album_title || 'Release'; $('#edit-song-selected-art').innerHTML = albumArt(song, 'tiny'); $('#edit-song-selected').hidden = false; $('#edit-song-picker')?.classList.add('is-picked'); document.querySelectorAll('[data-edit-song-option]').forEach(option => { const selected = Number(option.dataset.editSongOption) === Number(song.song_id); option.classList.toggle('selected', selected); option.setAttribute('aria-selected', String(selected)); });
  };
  const filterEditSongs = () => { const q = String(editSongSearch?.value || '').trim().toLowerCase(); document.querySelectorAll('[data-edit-song-option]').forEach(option => { option.hidden = !!q && !String(option.dataset.editSongSearch || '').includes(q); }); };
  editSongSearch?.addEventListener('input', filterEditSongs);
  $('#edit-song-change')?.addEventListener('click', () => { $('#edit-song-picker')?.classList.remove('is-picked'); editSongSearch?.focus(); });
  document.querySelectorAll('[data-edit-song-option]').forEach(option => option.onclick = () => chooseEditSong(option.dataset.editSongOption));
  document.querySelectorAll('[data-open-modal="edit-song-modal"]').forEach(button => { button.onclick = () => { dialogOpeners.set(editSongDialog, button); editSongSearch.value = ''; filterEditSongs(); if (button.dataset.editSongId) chooseEditSong(button.dataset.editSongId); else if (selectedRelease) { const first = catalogSongs[0]; if (first) chooseEditSong(first.song_id); } editSongDialog.showModal(); requestAnimationFrame(() => ($('#edit-song-picker')?.classList.contains('is-picked') ? editSongTitle : editSongSearch)?.focus()); }; });
  editSongDialog?.addEventListener('close', () => { editSongInput.value = ''; editSongSearch.value = ''; editSongTitle.value = ''; editSongTitle.disabled = true; editSongSave.disabled = true; { const box = $('#owned-song-lyrics'); if (box) { box.value = ''; box.disabled = true; box.dataset.loaded = ''; } } { const kf = $('#owned-song-karaoke-file'); if (kf) { kf.value = ''; syncKaraokePick(kf); kf.disabled = true; kf.dataset.loaded = ''; } const kw = $('#owned-song-karaoke-remove-wrap'); if (kw) kw.hidden = true; } $('#edit-song-selected').hidden = true; $('#edit-song-picker')?.classList.remove('is-picked'); document.querySelectorAll('[data-edit-song-option]').forEach(option => { option.hidden = false; option.classList.remove('selected'); option.setAttribute('aria-selected', 'false'); }); });
  $('#editsong').onsubmit = e => {
    e.preventDefault(); action(() => swRun('Saving your song…', async () => {
      if (!val('owned-song')) throw Error('Choose a song to edit.'); swStage('Checking your changes…', 'Validating the title'); const songId = Number(val('owned-song')); const title = val('owned-song-title'); const problem = contentTitleProblem(title, 'Song title', 120); if (problem) throw Error(problem); if (!(await checkSongTitleAvailability(title, songId))) throw Error('Another song in your catalog already uses this title.'); swStage('Saving song details…', 'Title and mood'); check(await db.from('song').update({ song_title: normalizedContentTitle(title), ...moodPatch('owned-song-moods') }).eq('song_id', songId)); const lyricsBox = $('#owned-song-lyrics'); let lyricsFailed = false; if (lyricsBox && lyricsBox.dataset.loaded === '1') { swStage('Saving lyrics…', 'Almost there'); try { await saveSongLyrics(songId, lyricsBox.value); } catch (err) { console.warn('Lyrics not saved', err); lyricsFailed = true; } } let karaokeFailed = ''; const kFile = $('#owned-song-karaoke-file'); if (kFile && kFile.dataset.loaded === '1') { try { if ($('#owned-song-karaoke-remove')?.checked && !kFile.files?.[0]) { swStage('Removing instrumental…', 'Almost there'); await removeKaraokeTrack(songId); } else if (kFile.files?.[0]) { swStage('Uploading instrumental…', `${kFile.files[0].name} (${swFmtBytes(kFile.files[0].size)})`); await saveKaraokeTrack(songId, kFile.files[0], Number(ownedSongs.find(x => Number(x.song_id) === songId)?.duration_seconds)); } } catch (err) { console.warn('Instrumental not saved', err); karaokeFailed = humanErr(err); } }
      swStage('Updating your library…', 'Your changes are saved'); await loadData(); state.artistStudioView = 'catalog'; render(); const problem2 = lyricsFailed ? 'Title updated, but the lyrics could not be saved.' : karaokeFailed ? `Song updated, but the instrumental was not saved. ${karaokeFailed}` : ''; toast(problem2 || 'Song details updated', Boolean(problem2));
    }));
  };
  document.querySelectorAll('[data-album-active]').forEach(b => b.onclick = () => action(async () => {
    const active = b.dataset.active === 'true'; check(await db.rpc('set_my_album_active', { p_album_id: Number(b.dataset.albumActive), p_active: active }));
    const verified = await db.from('album').select('is_active,admin_locked').eq('album_id', Number(b.dataset.albumActive)).single();
    if (verified.error) throw verified.error;
    await loadData(); render();
    if (Boolean(verified.data?.is_active) !== active) { toast(verified.data?.admin_locked ? 'This album is locked by moderation. Ask an administrator to restore it.' : 'Album status did not change. Refresh and review the release status.', true); return; }
    toast(active ? 'Album is active (verified)' : 'Album is inactive (verified)');
  }));
  document.querySelectorAll('[data-own-song-active]').forEach(b => b.onclick = () => action(async () => {
    const id = Number(b.dataset.ownSongActive), next = b.dataset.active === 'true';
    const before = await db.from('song').select('album_id,admin_locked').eq('song_id', id).single();
    if (before.error) throw before.error;
    const parent = await db.from('album').select('is_active,admin_locked').eq('album_id', before.data.album_id).single();
    if (parent.error) throw parent.error;
    if (next && (before.data.admin_locked || parent.data.admin_locked || parent.data.is_active === false)) throw Error('An administrator or inactive parent release is blocking this song. Contact an administrator.');
    check(await db.from('song').update({ is_active: next }).eq('song_id', id));
    const after = await db.from('song').select('is_active').eq('song_id', id).single();
    if (after.error) throw after.error;
    await loadData(); render();
    if (Boolean(after.data.is_active) !== next) throw Error('Song status was not changed. Check administrative moderation locks.');
    toast(next ? 'Song restored (verified)' : 'Song deactivated (verified)');
  }));
  document.querySelectorAll('input[name="release_timing"]').forEach(r => r.onchange = () => { const later = document.querySelector('input[name="release_timing"]:checked')?.value === 'later'; const f = $('#release-schedule-field'); if (f) f.hidden = !later; const i = $('#releaseat'); if (i) { i.required = later; if (later && !i.value) { const d = new Date(Date.now() + 86400000); d.setMinutes(0, 0, 0); const z = n => String(n).padStart(2, '0'); i.value = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:00`; } } });
  document.querySelectorAll('[data-release-now]').forEach(b => b.onclick = () => action(async () => { check(await db.rpc('release_now_v78', { p_album_id: Number(b.dataset.releaseNow) })); await loadData(); render(); toast('Release is live'); }));
  $('#albumform').onsubmit = e => {
    e.preventDefault(); action(async () => {
      const titleProblem = contentTitleProblem($('#albumtitle')?.value, 'Release title', 120); if (titleProblem) throw Error(titleProblem); if (!(await checkAlbumTitleAvailability($('#albumtitle')?.value))) throw Error('You already have a release with this title. Choose a different title.'); let cover_path = null; const file = $('#albumcover').files?.[0]; if (file) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a JPEG, PNG or WebP cover.'); if (file.size > 5 * 1048576) throw Error('Album artwork must be under 5 MB.'); const ext = file.name.split('.').pop().toLowerCase(); cover_path = `${state.user.id}/albums/${crypto.randomUUID()}.${ext}`; check(await db.storage.from('covers').upload(cover_path, file, { upsert: false, contentType: file.type })); }
      const later = document.querySelector('input[name="release_timing"]:checked')?.value === 'later'; let goLive = null; if (later) { goLive = new Date($('#releaseat')?.value || ''); if (Number.isNaN(goLive.getTime()) || goLive.getTime() < Date.now() + 5 * 60000) throw Error('Pick a go-live time at least 5 minutes from now.'); }
      try { const row = { artist_id: state.artist.artist_id, album_title: normalizedContentTitle($('#albumtitle')?.value), description: val('albumdesc') || null, release_type: val('releasetype') || 'Album', release_date: goLive ? `${goLive.getFullYear()}-${String(goLive.getMonth() + 1).padStart(2, '0')}-${String(goLive.getDate()).padStart(2, '0')}` : val('releasedate'), cover_path, is_active: !goLive }; if (goLive) row.scheduled_at = goLive.toISOString(); check(await db.from('album').insert(row)); } catch (error) { if (cover_path) await db.storage.from('covers').remove([cover_path]); throw error; }
      await loadData(); state.artistStudioView = 'catalog'; render(); toast(goLive ? `Release scheduled for ${fmtSchedule(goLive)}. Upload its songs now.` : 'Release created. You can now upload songs.');
    });
  };
  $('#songform').onsubmit = e => {
    e.preventDefault(); action(() => swRun('Publishing your song…', async () => {
      if (wiz.step !== 4) throw Error('Complete the upload steps first.'); swStage('Checking your track…', 'Validating title and audio file'); const file = $('#song-file').files?.[0]; if (!file) throw Error('Choose an audio file.'); const bad = audioProblem(file); if (bad) throw Error(bad); const album_id = Number(document.querySelector('input[name="albumchoice"]:checked')?.value); if (!validAlbums.some(a => a.album_id === album_id)) throw Error('Select an active album you own.'); const titleProblem = contentTitleProblem($('#songtitle')?.value, 'Song title', 120); if (titleProblem) throw Error(titleProblem); if (!val('songgenre')) throw Error('Select a genre.'); if (!(await checkSongTitleAvailability($('#songtitle')?.value))) throw Error('You already have a song with this title. Choose a different title.'); const duration_seconds = await audioDuration(file); if (!Number.isFinite(duration_seconds) || duration_seconds < 1) throw Error('Could not read the audio duration.'); const path = `${state.user.id}/songs/${crypto.randomUUID()}_${safeUploadFilename(file)}`;
      const fin = songForm.querySelector('.wiz-finish'); setPublishing(fin, true, 'Publish song'); let cover_path = null, audioUploaded = false, coverUploaded = false, newSongId = null; swStage('Preparing upload…', file.name);
      try {
        const trackQuery = await db.from('song').select('track_number').eq('album_id', album_id).order('track_number', { ascending: false }).limit(1);
        if (trackQuery.error) throw trackQuery.error;
        const track_number = (Number(trackQuery.data?.[0]?.track_number) || 0) + 1;
        swStage('Uploading your song…', `${file.name} (${swFmtBytes(file.size)})`); check(await db.storage.from('song-audio').upload(path, file, { upsert: false, contentType: file.type || 'audio/mpeg' })); audioUploaded = true;
        const cover = $('#songcover')?.files?.[0]; if (cover) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(cover.type)) throw Error('Choose a JPEG, PNG or WebP song cover.'); if (cover.size > 5 * 1048576) throw Error('Song artwork must be under 5 MB.'); const ext = (cover.name.split('.').pop() || 'jpg').toLowerCase(); cover_path = `${state.user.id}/songs/${crypto.randomUUID()}.${ext}`; swStage('Uploading artwork…', `${cover.name} (${swFmtBytes(cover.size)})`); check(await db.storage.from('covers').upload(cover_path, cover, { upsert: false, contentType: cover.type })); coverUploaded = true; }
        swStage('Saving song details…', 'Almost there'); const inserted = check(await db.from('song').insert({ album_id, genre_id: Number(val('songgenre')), song_title: normalizedContentTitle($('#songtitle')?.value), description: val('songdesc') || null, cover_path, duration_seconds, track_number, audio_path: path, ...moodPatch('song-moods'), ...(albumScheduledAt(album_id) ? { is_active: false, held_for_release: true } : { is_active: true }) }).select('song_id').single());
        newSongId = inserted?.song_id ?? null;
      } catch (error) { if (audioUploaded) await db.storage.from('song-audio').remove([path]); if (coverUploaded && cover_path) await db.storage.from('covers').remove([cover_path]); throw error; } finally { setPublishing(fin, false, 'Publish song'); }
      const lyricsText = $('#songlyrics')?.value || ''; if (newSongId && lyricsText.trim()) { swStage('Saving lyrics…', 'Almost there'); try { await saveSongLyrics(newSongId, lyricsText); } catch (err) { console.warn('Lyrics not saved', err); toast('Song published, but the lyrics could not be saved. Add them from Edit song.', true); } }
      let karaokeFailed = ''; const karaokeFile = $('#song-karaoke-file')?.files?.[0]; if (newSongId && karaokeFile) { swStage('Uploading instrumental…', `${karaokeFile.name} (${swFmtBytes(karaokeFile.size)})`); try { await saveKaraokeTrack(newSongId, karaokeFile, duration_seconds); } catch (err) { console.warn('Instrumental not saved', err); karaokeFailed = humanErr(err); } }
      swStage('Updating your library…', 'Your track is published'); await loadData(); state.artistStudioView = 'catalog'; render(); toast(karaokeFailed ? `Your track has been released, but the instrumental was not added. ${karaokeFailed}` : 'Your track has been released!', Boolean(karaokeFailed));
    }));
  };
}
function admin() {
  if (!hasAdminAccess()) return discoverPage();
  const d = state.adminData || {}; const users = d.users || [], artists = d.artists || [], songs = d.songs || state.songs || [], pods = d.podcasts || [];
  const activeUsers = users.filter(x => x.is_active !== false).length;
  const cellStatus = (active) => `<span class="status-pill ${active === false ? 'inactive' : 'active'}">${active === false ? 'Inactive' : 'Active'}</span>`;
  const empty = (iconText, title, msg) => `<div class="empty admin-empty"><span>${iconText}</span><h3>${title}</h3><p>${msg}</p></div>`;
  const accountRows = users.map(u => { const isAdmin = Boolean(u.is_admin) || String(u.account_type || '').toLowerCase() === 'admin' || state.adminUserIds.includes(String(u.user_id)); return `<tr data-admin-row data-search="${esc(`${u.display_name || 'User'} ${u.account_type || 'Listener'} ${u.user_id || ''}`.toLowerCase())}" data-sort-name="${esc((u.display_name || 'User').toLowerCase())}" data-sort-status="${u.is_active === false ? 'inactive' : 'active'}" data-priority="${u.is_active === false ? 'true' : 'false'}"><td data-label="Account"><div class="entity-cell"><span class="member-avatar">${esc((u.display_name || 'U')[0].toUpperCase())}</span><span><strong>${esc(u.display_name || 'User')}</strong>${isAdmin ? '<small class="admin-role-note">Administrator</small>' : ''}</span></div></td><td data-label="Type">${esc(u.account_type || 'Listener')}</td><td data-label="Joined">${esc(String(u.created_at || u.date_created || '—').slice(0, 10))}</td><td data-label="Status">${cellStatus(u.is_active)}</td><td data-label="Actions"><div class="admin-row-actions">${isAdmin ? `<span class="status-pill admin-access">Admin access</span>` : `<button class="button admin-promote sm" data-promote-admin="${esc(u.user_id)}" data-promote-name="${esc(u.display_name || 'User')}">${icon('shield')} Promote to admin</button>`}<button class="button secondary sm" data-entity="users" ${(isAdmin || String(u.user_id) === String(state.user?.id)) ? 'disabled title="Administrator accounts and your own account cannot be deactivated here"' : ''} data-name="${esc(u.display_name || 'User')}" data-id="${esc(u.user_id)}" data-active="${u.is_active === false ? 'true' : 'false'}">${u.is_active === false ? 'Reactivate' : 'Deactivate'}</button></div></td></tr>`; }).join('');
  const artistRows = artists.map(a => `<tr data-admin-row data-search="${esc(`${a.artist_name || 'Artist'} ${a.country || ''}`.toLowerCase())}" data-priority="${a.is_active === false ? 'true' : 'false'}" data-sort-name="${esc((a.artist_name || 'Artist').toLowerCase())}" data-sort-status="${a.is_active === false ? 'inactive' : 'active'}"><td data-label="Artist"><div class="entity-cell"><span class="member-avatar">${esc((a.artist_name || 'A')[0].toUpperCase())}</span><span><strong>${esc(a.artist_name || 'Artist')}</strong><small>Artist #${esc(String(a.artist_id))} · Linked account</small></span></div></td><td data-label="Country">${esc(a.country || '—')}</td><td data-label="Songs">${state.songs.filter(s => Number(s.album?.artist?.artist_id) === Number(a.artist_id)).length}</td><td data-label="Status">${cellStatus(a.is_active)}</td><td data-label="Actions"><button class="button secondary sm" data-entity="artist" data-name="${esc(a.artist_name || 'Artist')}" data-id="${a.artist_id}" data-active="${a.is_active === false ? 'true' : 'false'}">${a.is_active === false ? 'Reactivate' : 'Deactivate'}</button></td></tr>`).join('');
  const songRows = songs.map(row => { const live = state.songs.find(s => Number(s.song_id) === Number(row.song_id)) || row; const artist = live.album?.artist?.artist_name || row.artist_name || '—', album = live.album?.album_title || row.album_title || '—'; return `<tr data-admin-row data-search="${esc(`${row.song_title || 'Song'} ${artist} ${album}`.toLowerCase())}" data-priority="${row.is_active === false ? 'true' : 'false'}" data-sort-name="${esc((row.song_title || 'Song').toLowerCase())}" data-sort-status="${row.is_active === false ? 'inactive' : 'active'}"><td data-label="Song"><div class="entity-cell song-entity">${albumArt(live, 'tiny')}<strong>${esc(row.song_title || 'Song')}</strong></div></td><td data-label="Artist">${esc(artist)}</td><td data-label="Album">${esc(album)}</td><td data-label="Duration">${nice(row.duration_seconds || live.duration_seconds)}</td><td data-label="Status">${cellStatus(row.is_active)}</td><td data-label="Actions"><button class="button secondary sm" data-entity="song" data-name="${esc(row.song_title || 'Song')}" data-id="${row.song_id}" data-active="${row.is_active === false ? 'true' : 'false'}">${row.is_active === false ? 'Reactivate' : 'Deactivate'}</button></td></tr>`; }).join('');
  const adminAlbumGroups = new Map();
  const allAlbums = [...(state.adminAllAlbums || []), ...(state.albums || []), ...catalogAlbums()];
  for (const al of allAlbums) {
    const id = Number(al.album_id); if (!id || adminAlbumGroups.has(id)) continue;
    adminAlbumGroups.set(id, { id, title: al.album_title || al.title || `Album #${id}`, artist: al.artist?.artist_name || artists.find(a => Number(a.artist_id) === Number(al.artist_id))?.artist_name || 'Artist', cover: al.cover_path || '', active: al.is_active !== false, songs: [] });
  }
  for (const row of songs) {
    const live = state.songs.find(x => Number(x.song_id) === Number(row.song_id)) || row;
    const id = Number(live.album_id || live.album?.album_id || row.album_id); if (!id) continue;
    if (!adminAlbumGroups.has(id)) adminAlbumGroups.set(id, { id, title: live.album?.album_title || row.album_title || `Album #${id}`, artist: live.album?.artist?.artist_name || row.artist_name || 'Artist', cover: live.album?.cover_path || '', active: live.album?.is_active !== false, songs: [] });
    adminAlbumGroups.get(id).songs.push({ row, live });
  }
  // The public song catalog is filtered: canonical album rows take precedence for moderation.
  for (const source of state.adminAllAlbums || []) {
    const group = adminAlbumGroups.get(Number(source.album_id));
    if (group) { group.active = source.is_active === true; group.adminLocked = source.admin_locked === true; group.cover = source.cover_path || group.cover; }
  }
  const adminAlbumList = [...adminAlbumGroups.values()];
  const selectedAdminAlbum = adminAlbumGroups.get(Number(state.adminSelectedAlbum));
  const adminAlbumPanel = selectedAdminAlbum ? `<div class="admin-album-detail"><button type="button" class="button secondary sm" data-admin-album-back>← All albums</button><div class="admin-album-heading"><h3>${esc(selectedAdminAlbum.title)}</h3><span>${selectedAdminAlbum.songs.length} tracks</span><button class="button secondary sm" data-entity="album" data-name="${esc(selectedAdminAlbum.title)}" data-id="${selectedAdminAlbum.id}" data-active="${selectedAdminAlbum.active ? 'false' : 'true'}">${selectedAdminAlbum.active ? 'Deactivate entire album' : 'Reactivate album'}</button></div><div class="admin-song-manager">${selectedAdminAlbum.songs.map(({ row, live }) => `<article class="admin-song-card" data-admin-row data-search="${esc(`${row.song_title || 'Song'} ${selectedAdminAlbum.artist} ${selectedAdminAlbum.title}`.toLowerCase())}" data-sort-status="${row.is_active === false ? 'inactive' : 'active'}" data-priority="${row.is_active === false ? 'true' : 'false'}">${albumArt(live, 'large')}<div class="admin-song-card-copy"><strong>${esc(row.song_title || 'Song')}</strong><small>${esc(selectedAdminAlbum.artist)} · ${nice(row.duration_seconds || live.duration_seconds)}</small></div>${cellStatus(row.is_active)}<button class="button secondary sm" data-entity="song" data-name="${esc(row.song_title || 'Song')}" data-id="${row.song_id}" data-active="${row.is_active === false ? 'true' : 'false'}">${row.is_active === false ? 'Reactivate' : 'Deactivate'}</button></article>`).join('') || empty('♫', 'Empty album', 'This album has no songs yet.')}</div></div>` : `${state.adminAlbumLoadError ? `<div class="notice" role="alert">Unable to load the complete album catalog: ${esc(state.adminAlbumLoadError)}. Check administrator SELECT permissions on public.album.</div>` : ""}<div class="admin-albums-grid">${adminAlbumList.map(a => `<article class="admin-album-card" data-admin-row data-search="${esc(`${a.title} ${a.artist}`.toLowerCase())}" data-sort-status="${a.active ? 'active' : 'inactive'}" data-priority="${a.active ? 'false' : 'true'}"><div class="admin-album-cover">${a.cover && state.coverUrls?.[a.cover] ? `<img src="${esc(state.coverUrls[a.cover])}" alt="" loading="lazy">` : icon('album')}</div><div class="admin-album-copy"><strong title="${esc(a.title)}">${esc(a.title)}</strong><small>${esc(a.artist)}</small><span class="admin-album-count">${a.songs.length ? a.songs.length + ' song' + (a.songs.length === 1 ? '' : 's') : 'Draft · 0 songs'}</span>${cellStatus(a.active)}</div><div class="admin-album-actions"><button type="button" class="button secondary sm" data-admin-album-select="${a.id}">View songs</button><button type="button" class="button secondary sm" data-entity="album" data-id="${a.id}" data-name="${esc(a.title)}" data-active="${a.active ? 'false' : 'true'}">${a.active ? 'Deactivate' : 'Reactivate'}</button></div></article>`).join('') || empty('♫', 'No albums', 'Albums will appear here when creators add releases.')}</div>`;
  const podRows = pods.map(p => `<tr data-admin-row data-search="${esc(`${p.show_title || 'Podcast'} ${p.category || ''}`.toLowerCase())}" data-priority="${p.is_active === false ? 'true' : 'false'}" data-sort-name="${esc((p.show_title || 'Podcast').toLowerCase())}" data-sort-status="${p.is_active === false ? 'inactive' : 'active'}"><td data-label="Podcast"><div class="entity-cell">${p.cover_path && state.coverUrls[p.cover_path] ? `<img class="admin-cover" src="${esc(state.coverUrls[p.cover_path])}" alt="">` : `<span class="member-avatar">${icon('mic')}</span>`}<strong>${esc(p.show_title || 'Podcast')}</strong></div></td><td data-label="Category">${esc(p.category || '—')}</td><td data-label="Episodes">${state.episodes.filter(e => Number(e.show_id) === Number(p.show_id)).length}</td><td data-label="Status">${cellStatus(p.is_active)}</td><td data-label="Actions"><button class="button secondary sm" data-entity="podcast_show" data-name="${esc(p.show_title || 'Podcast')}" data-id="${p.show_id}" data-active="${p.is_active === false ? 'true' : 'false'}">${p.is_active === false ? 'Reactivate' : 'Deactivate'}</button></td></tr>`).join('');
  const table = (heads, rows, emptyHtml) => rows ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${heads.map(([k, l]) => `<th><button type="button" data-admin-sort="${k}">${l}${k === 'name' ? ' ↕' : ''}</button></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` : emptyHtml;

  shell(`<section class="admin-block" data-admin-view="moderation" ${state.adminView !== 'moderation' ? 'hidden' : ''}><section class="moderation-commandbar" aria-label="Moderation tools"><label class="moderation-search">${icon('search')}<input id="admin-search" type="search" autocomplete="off" placeholder="Search accounts, artists, titles…" value="${esc(state.adminQuery || '')}" aria-label="Search moderation data"></label><select id="admin-status-filter" aria-label="Filter moderation status"><option value="all" ${state.adminStatus === 'all' ? 'selected' : ''}>All statuses</option><option value="active" ${state.adminStatus === 'active' ? 'selected' : ''}>Active only</option><option value="inactive" ${state.adminStatus === 'inactive' ? 'selected' : ''}>Inactive only</option></select><button type="button" class="button secondary ${state.adminPriority ? 'active' : ''}" id="admin-priority-filter" aria-pressed="${state.adminPriority}">${icon('shield')} Needs attention</button></section><nav class="admin-tabbar" aria-label="Moderation sections"><button class="${state.adminTab === 'accounts' ? 'active' : ''}" data-admin-tab="accounts">Accounts</button><button class="${state.adminTab === 'artists' ? 'active' : ''}" data-admin-tab="artists">Artists</button><button class="${state.adminTab === 'songs' ? 'active' : ''}" data-admin-tab="songs">Albums → Songs</button><button class="${state.adminTab === 'podcasts' ? 'active' : ''}" data-admin-tab="podcasts">Podcasts</button><button class="${state.adminTab === 'song-reports' ? 'active' : ''}" data-admin-tab="song-reports">${icon('flag')} Song reports</button></nav><section class="admin-panel" data-admin-panel="accounts" ${state.adminTab !== 'accounts' ? 'hidden' : ''}><p class="muted small">Accounts controls sign-in and account status. An artist also appears in Artists because publishing access is moderated separately.</p>${table([['name', 'Account'], ['type', 'Type'], ['joined', 'Joined'], ['status', 'Status'], ['actions', 'Actions']], accountRows, empty('◎', 'No account data', 'Account moderation data will appear when the existing admin RPC returns rows.'))}</section><section class="admin-panel" data-admin-panel="artists" ${state.adminTab !== 'artists' ? 'hidden' : ''}><p class="muted small">Artist entries are linked music-publishing profiles, not additional login accounts. Disabling a profile is separate from disabling its user account.</p>${table([['name', 'Artist'], ['country', 'Country'], ['songs', 'Songs'], ['status', 'Status'], ['actions', 'Actions']], artistRows, empty('♫', 'No artists to review', 'Artist accounts will appear here.'))}</section><section class="admin-panel" data-admin-panel="songs" ${state.adminTab !== 'songs' ? 'hidden' : ''}>${adminAlbumPanel}</section><section class="admin-panel" data-admin-panel="podcasts" ${state.adminTab !== 'podcasts' ? 'hidden' : ''}>${table([['name', 'Podcast'], ['category', 'Category'], ['episodes', 'Episodes'], ['status', 'Status'], ['actions', 'Actions']], podRows, empty('◉', 'No podcasts to review', 'Published shows will appear here.'))}</section></section>
 <dialog class="sw-modal confirm-dialog" id="admin-confirm-dialog"><div class="modal-head"><div><span class="eyebrow">CONFIRM ACTION</span><h2 id="admin-confirm-title">Are you sure?</h2></div><button type="button" class="modal-close" data-close-modal aria-label="Close confirmation">${icon('close')}</button></div><p id="admin-confirm-message" class="confirm-message"></p><div class="dialog-actions"><button type="button" class="button secondary" data-close-modal>Cancel</button><button type="button" class="button" id="admin-confirm-action">Confirm</button></div></dialog>`, 'Moderation', 'Review and manage accounts, artists, songs and podcasts.');
  // Keep moderation search immediately below the main admin tabs rather than buried
  // inside a scrolled panel. Moving the existing node preserves its input handlers.
  const adminViewTabs = document.querySelector('.admin-view-tabs');
  const moderationToolbar = document.querySelector('.moderation-commandbar');
  if (adminViewTabs && moderationToolbar) {
    adminViewTabs.insertAdjacentElement('afterend', moderationToolbar);
    moderationToolbar.classList.add('moderation-top-toolbar');
  }
  const setAdminView = (view) => { view = 'moderation'; state.adminView = view; if (moderationToolbar) moderationToolbar.hidden = view !== 'moderation'; document.querySelectorAll('[data-admin-view-btn]').forEach(x => x.classList.toggle('active', x.dataset.adminViewBtn === view)); document.querySelectorAll('[data-admin-view]').forEach(x => x.hidden = x.dataset.adminView !== view); };
  const switchTab = (tab, { scroll = true } = {}) => { if (tab === 'song-reports') { navigate('song-reports'); return; } state.adminTab = tab; state.adminQuery = ''; const searchBox = document.getElementById('admin-search'); if (searchBox) searchBox.value = ''; document.querySelectorAll('[data-admin-tab]').forEach(x => x.classList.toggle('active', x.dataset.adminTab === tab)); document.querySelectorAll('[data-admin-panel]').forEach(p => p.hidden = p.dataset.adminPanel !== tab); document.querySelectorAll('.admin-overview [data-admin-target]').forEach(x => { const on = x.dataset.adminTarget === tab; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); if (scroll && state.adminView === 'moderation') document.querySelector('.admin-view-tabs')?.scrollIntoView({ behavior: 'auto', block: 'start' }); };
  setAdminView('moderation');
  switchTab(state.adminTab, { scroll: false });
  document.querySelectorAll('[data-admin-view-btn]').forEach(b => b.onclick = () => setAdminView(b.dataset.adminViewBtn));
  document.querySelectorAll('[data-admin-open]').forEach(b => b.onclick = () => { const target = b.dataset.adminOpen; setAdminView('moderation'); switchTab(target, { scroll: true }); requestAnimationFrame(applyModerationFilters); });
  document.querySelectorAll('.admin-overview [data-admin-target]').forEach(b => b.onclick = () => { setAdminView('moderation'); switchTab(b.dataset.adminTarget); requestAnimationFrame(applyModerationFilters); });
  document.querySelectorAll('[data-admin-tab]').forEach(b => b.onclick = () => switchTab(b.dataset.adminTab));
  document.querySelectorAll('[data-admin-album-select]').forEach(b => b.onclick = () => { state.adminSelectedAlbum = Number(b.dataset.adminAlbumSelect); render(); });
  document.querySelectorAll('[data-admin-album-back]').forEach(b => b.onclick = () => { state.adminSelectedAlbum = null; render(); });
  const applyModerationFilters = () => { if (state.adminView !== 'moderation') { const counter = $('#moderation-visible-count'); if (counter) counter.textContent = ''; return; } const panel = document.querySelector(`[data-admin-panel="${state.adminTab}"]`); if (!panel) return; const q = String(state.adminQuery || '').trim().toLowerCase(); let visible = 0, total = 0; panel.querySelectorAll('[data-admin-row]').forEach(row => { total++; const search = String(row.dataset.search || row.textContent || '').toLowerCase(), status = row.dataset.sortStatus || 'active', priority = row.dataset.priority === 'true'; const show = (!q || search.includes(q)) && (state.adminStatus === 'all' || state.adminStatus === status) && (!state.adminPriority || priority); row.hidden = !show; if (show) visible++; }); const counter = $('#moderation-visible-count'); if (counter) counter.textContent = ''; };
  const adminSearch = $('#admin-search'), adminStatus = $('#admin-status-filter'), adminPriority = $('#admin-priority-filter');
  if (adminSearch) adminSearch.oninput = () => { state.adminQuery = adminSearch.value; applyModerationFilters(); };
  if (adminStatus) adminStatus.onchange = () => { state.adminStatus = adminStatus.value; applyModerationFilters(); };
  if (adminPriority) adminPriority.onclick = () => { state.adminPriority = !state.adminPriority; adminPriority.classList.toggle('active', state.adminPriority); adminPriority.setAttribute('aria-pressed', String(state.adminPriority)); applyModerationFilters(); };
  document.querySelectorAll('[data-admin-tab]').forEach(b => b.addEventListener('click', () => requestAnimationFrame(applyModerationFilters)));
  applyModerationFilters();
  const confirmDialog = $('#admin-confirm-dialog'), confirmAction = $('#admin-confirm-action'); let pendingAction = null;
  const ask = (title, message, label, tone, fn) => { pendingAction = fn; $('#admin-confirm-title').textContent = title; $('#admin-confirm-message').textContent = message; confirmAction.textContent = label; confirmAction.className = `button ${tone || ''}`; confirmDialog.showModal(); };
  confirmAction.onclick = () => { const fn = pendingAction; pendingAction = null; confirmDialog.close(); if (fn) fn(); };
  document.querySelectorAll('[data-entity]').forEach(b => b.onclick = () => {
    const run = (reason = '') => action(async () => {
      const makeActive = b.dataset.active === 'true';
      let r;
      if (b.dataset.entity === 'users') {
        r = await db.rpc('admin_set_account_active_v31', { p_user_id: b.dataset.id, p_active: makeActive });
        if (r?.error && /not found|schema cache|404|PGRST202/i.test(String(r.error.message || ''))) {
          r = await db.from('users').update({ is_active: makeActive }).eq('user_id', b.dataset.id);
        }
      } else if (['album', 'song'].includes(b.dataset.entity)) {
        r = await db.rpc('soundwave_admin_moderate_release', { p_entity: b.dataset.entity, p_id: Number(b.dataset.id), p_active: makeActive });
        if (r?.error && /not found|schema cache|404|PGRST202/i.test(String(r.error.message || ''))) {
          r = await db.rpc('admin_set_entity_active', { p_entity: b.dataset.entity, p_id: b.dataset.id, p_active: makeActive });
          if (r?.error && /not found|schema cache|404|PGRST202/i.test(String(r.error.message || ''))) {
            const tbl = b.dataset.entity === 'album' ? 'album' : 'song';
            const col = b.dataset.entity === 'album' ? 'album_id' : 'song_id';
            r = await db.from(tbl).update({ is_active: makeActive }).eq(col, Number(b.dataset.id));
          }
        }
      } else {
        r = await db.rpc('admin_set_entity_active', { p_entity: b.dataset.entity, p_id: b.dataset.id, p_active: makeActive });
        if (r?.error && /not found|schema cache|404|PGRST202/i.test(String(r.error.message || ''))) {
          const tbl = b.dataset.entity;
          const col = tbl === 'artist' ? 'artist_id' : 'show_id';
          r = await db.from(tbl).update({ is_active: makeActive }).eq(col, Number(b.dataset.id));
        }
      }
      if (r?.error) throw r.error;
      if (!makeActive) await logDeactivation(b.dataset.entity, b.dataset.id, b.dataset.name, reason);
      await loadData();
      if (b.dataset.entity === 'album' || b.dataset.entity === 'song') {
        const table = b.dataset.entity === 'album' ? 'album' : 'song';
        const key = table === 'album' ? 'album_id' : 'song_id';
        const verified = await db.from(table).select('is_active,admin_locked').eq(key, Number(b.dataset.id)).single();
        if (!verified.error && Boolean(verified.data?.is_active) !== makeActive) throw Error('The requested moderation status did not persist. Review the moderation trigger and refresh.');
        if (!verified.error && table === 'album') { state.adminAllAlbums = (state.adminAllAlbums || []).map(x => Number(x.album_id) === Number(b.dataset.id) ? { ...x, ...verified.data } : x); }
      }
      render();
      toast(makeActive ? 'Content status verified: active' : 'Content status verified: inactive');
    }); if (b.dataset.active === 'false') askDeactivationReason(b.dataset.name, b.dataset.entity, run); else run();
  });
  document.querySelectorAll('[data-promote-admin]').forEach(b => b.onclick = () => { const name = b.dataset.promoteName || 'this user', uid = b.dataset.promoteAdmin; ask('Promote to administrator?', `${name} will receive protected administrator access. Only promote users you trust.`, 'Promote to admin', 'approve-btn', () => action(async () => { const r = await db.rpc('admin_set_user_admin', { p_user_id: uid, p_make_admin: true }); if (r.error) { if (/function .*admin_set_user_admin|does not exist|not found/i.test(String(r.error.message || ''))) throw Error('Admin promotion helper is not installed yet. Run sql/RUN_ME_admin_promotion.sql in Supabase SQL Editor, then try again.'); throw r.error; } await loadData(); render(); toast(`${name} is now an administrator`); })); });
  document.querySelectorAll('[data-admin-sort="name"]').forEach(b => b.onclick = () => { const tbody = b.closest('table')?.tBodies?.[0]; if (!tbody) return; const rows = [...tbody.rows], asc = b.dataset.dir !== 'asc'; rows.sort((x, y) => String(x.dataset.sortName || '').localeCompare(String(y.dataset.sortName || '')) * (asc ? 1 : -1)); rows.forEach(r => tbody.append(r)); b.dataset.dir = asc ? 'asc' : 'desc'; });
}
function deactivatedAccountView() {
  const name = state.profile?.display_name || state.user?.email?.split('@')[0] || 'SoundWave user';
  $('#app').innerHTML = `<main class="deactivated-wrap"><section class="deactivated-card"><span class="eyebrow">ACCOUNT DEACTIVATED</span><h1>${esc(name)}</h1><p id="deactivated-copy">Checking whether this account can be restored…</p><div class="inline" id="deactivated-actions"><button class="button secondary" id="deactivated-signout">Sign out</button></div></section></main>`;
  $('#deactivated-signout').onclick = () => action(async () => { cleanupSessionRuntime(); check(await db.auth.signOut()); });
  action(async () => {
    const { data, error } = await db.rpc('my_deactivation_status_v31');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data || {}; state.deactivationStatus = row;
    let reasonText = ''; try { const n = await db.rpc('my_latest_deactivation_notice_v49'); const nr = Array.isArray(n.data) ? n.data[0] : n.data; if (!n.error && nr?.reason) reasonText = ` Reason given: ${nr.reason}`; } catch { }
    const copy = $('#deactivated-copy'), actions = $('#deactivated-actions');
    if (row.admin_locked) { copy.textContent = 'This account was deactivated by an administrator.' + reasonText + ' Only an administrator can reactivate it.'; return; }
    copy.textContent = 'You deactivated this account yourself. You can restore it and make your SoundWave content available again.';
    const btn = document.createElement('button'); btn.className = 'button'; btn.id = 'restore-account'; btn.textContent = 'Restore account'; actions.prepend(btn);
    btn.onclick = () => action(async () => { check(await db.rpc('restore_my_account_v31')); await loadData(); render(); toast('Account restored'); });
  });
}



// Loading placeholder: appears only if the wait is noticeable (>180ms), matches the page being opened,
// fades in, and shows a thin progress bar on top. Fast loads show nothing at all, so there is no flash.
let skeletonTimer = null;
function skeletonKindForPage(page) {
  if (['playlists', 'liked-songs', 'album-detail', 'podcasts'].includes(page)) return 'detail';
  if (page === 'artist-detail' || page === 'person-detail') return 'artist';
  if (['charts', 'top-songs', 'mix', 'mood', 'history', 'liked-artists'].includes(page)) return 'list';
  if (['studio', 'podcast-studio', 'admin', 'profile'].includes(page)) return 'dash';
  return 'grid';
}
function skeletonMarkup(kind) {
  const bar = (w, h) => `<div class="skeleton-line" style="width:${w};height:${h || '16px'}"></div>`;
  const widths = ['62%', '48%', '70%', '55%', '66%', '44%', '58%', '52%', '64%', '50%'];
  const rows = (n) => widths.slice(0, n).map(w => `<div class="sk-row"><div class="skeleton-card sk-thumb"></div><div class="sk-text">${bar(w, '14px')}${bar('30%', '11px')}</div></div>`).join('');
  const cards = (n) => Array.from({ length: n }, () => `<div class="sk-tile"><div class="skeleton-card"></div>${bar('70%', '13px')}${bar('45%', '11px')}</div>`).join('');
  if (!kind) return '<div class="sk-bar"></div>';
  if (kind === 'detail') return `<div class="sk-bar"></div><div class="sk-detail"><div class="skeleton-card sk-cover"></div><div class="sk-meta">${bar('84px', '12px')}${bar('min(420px,70%)', 'clamp(34px,5vw,56px)')}${bar('200px', '14px')}</div></div><div class="sk-actions"><div class="skeleton-card sk-play"></div><div class="skeleton-line" style="width:90px;height:34px;border-radius:999px"></div></div><div class="sk-rows">${rows(8)}</div>`;
  if (kind === 'artist') return `<div class="sk-bar"></div><div class="skeleton-card sk-hero"><div class="sk-hero-text">${bar('90px', '12px')}${bar('min(380px,60%)', 'clamp(34px,5vw,56px)')}</div></div><div class="sk-section">${bar('140px', '22px')}</div><div class="sk-rows">${rows(5)}</div><div class="sk-section">${bar('120px', '22px')}</div><div class="sk-grid">${cards(5)}</div>`;
  if (kind === 'list') return `<div class="sk-bar"></div>${bar('min(320px,55%)', '38px')}<div style="height:10px"></div>${bar('min(480px,80%)', '14px')}<div class="sk-section"></div><div class="sk-rows">${rows(10)}</div>`;
  if (kind === 'dash') return `<div class="sk-bar"></div>${bar('min(300px,55%)', '38px')}<div class="sk-stats">${Array.from({ length: 4 }, () => '<div class="skeleton-card"></div>').join('')}</div><div class="sk-charts"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;
  return `<div class="sk-bar"></div>${bar('min(320px,55%)', '38px')}<div class="sk-section">${bar('150px', '22px')}</div><div class="sk-grid">${cards(5)}</div><div class="sk-section">${bar('130px', '22px')}</div><div class="sk-grid">${cards(5)}</div>`;
}
function showAsyncSkeleton(kind) {
  clearTimeout(skeletonTimer);
  skeletonTimer = setTimeout(() => {
    const main = document.getElementById('main-content');
    if (!main || main.querySelector('.async-skeleton')) return;
    const el = document.createElement('div'); el.className = 'async-skeleton'; el.setAttribute('aria-hidden', 'true');
    el.classList.toggle('bar-only', !kind); el.innerHTML = skeletonMarkup(kind); main.append(el);
  }, 180);
}
function hideAsyncSkeleton() { clearTimeout(skeletonTimer); skeletonTimer = null; document.querySelector('.async-skeleton')?.remove(); }
function enhanceAuth() {
  const show = document.querySelector('.auth-show');
  if (!show || show.querySelector('.auth-waveform')) return;
  const wave = document.createElement('div');
  wave.className = 'auth-waveform';
  wave.setAttribute('aria-hidden', 'true');
  wave.innerHTML = Array.from({ length: 34 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  show.append(wave);
  const particles = document.createElement('div');
  particles.className = 'note-particles';
  particles.setAttribute('aria-hidden', 'true');
  particles.innerHTML = Array.from({ length: 14 }, (_, i) => `<span style="--n:${i}">${i % 3 === 0 ? '♫' : i % 3 === 1 ? '♪' : '♬'}</span>`).join('');
  show.append(particles);
  let pulse = 0;
  document.querySelectorAll('.auth-panel input,.auth-panel select').forEach(el => {
    el.addEventListener('input', () => {
      pulse++;
      wave.querySelectorAll('i').forEach((bar, i) => bar.style.setProperty('--boost', String(1 + ((i + pulse) % 7) / 4)));
      wave.classList.remove('typing');
      void wave.offsetWidth;
      wave.classList.add('typing');
    });
  });
}
function burstHearts(id) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; document.querySelectorAll(`[data-like="${id}"]`).forEach(btn => { const b = document.createElement('span'); b.className = 'heart-burst'; b.innerHTML = '<i>♥</i><i>♥</i><i>♥</i><i>♥</i><i>♥</i>'; btn.append(b); setTimeout(() => b.remove(), 800); }); }
// ================= COMPETITION UPGRADE: insights, realtime, search, onboarding =================
const RECENT_SEARCH_KEY = 'soundwave-recent-searches-v1';
function rememberSearch(q) { q = String(q || '').trim(); if (!q) return; state.recentSearches = [q, ...state.recentSearches.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 6); try { localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(state.recentSearches)); } catch { } }
function recentSearchesHtml() { if (state.searchQuery || !state.recentSearches.length) return ''; return `<div class="recent-searches"><span>Recent</span>${state.recentSearches.map(q => `<button type="button" data-recent-search="${esc(q)}">${esc(q)}</button>`).join('')}</div>`; }
function searchKeyboardNav(e) { if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return; const rows = [...document.querySelectorAll('#search-results .track[data-song],#search-results [data-open-artist],#search-results [data-open-album],#search-results [data-openplaylist],#search-results [data-open-show]')]; if (!rows.length) return; const cur = document.activeElement?.dataset?.searchKbdIndex; let i = Number.isFinite(Number(cur)) ? Number(cur) : -1; if (e.key === 'Enter') { rememberSearch(e.currentTarget.value); if (i >= 0) rows[i]?.click(); return; } e.preventDefault(); i = e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1); rows.forEach((r, n) => { r.dataset.searchKbdIndex = n; r.classList.toggle('kbd-active', n === i); }); rows[i]?.focus(); }
function cacheSongMetadata() { try { const rows = state.songs.slice(0, 50).map(s => ({ song_id: s.song_id, song_title: s.song_title, duration_seconds: s.duration_seconds, genre_id: s.genre_id, cover_path: s.cover_path, album: s.album && { album_id: s.album.album_id, album_title: s.album.album_title, artist: s.album.artist && { artist_id: s.album.artist.artist_id, artist_name: s.album.artist.artist_name } } })); localStorage.setItem('soundwave-song-cache-v1', JSON.stringify({ savedAt: Date.now(), songs: rows })); } catch { } }
function computeListeningStats(rows) { const bySong = new Map(), byArtist = new Map(), byGenre = new Map(), days = new Set(); let seconds = 0; for (const r of rows) { const s = songById(r.song_id); if (!s) continue; seconds += Number(r.duration_played_seconds) || 0; bySong.set(s.song_id, (bySong.get(s.song_id) || 0) + 1); const aid = s.album?.artist?.artist_id; if (aid) byArtist.set(aid, (byArtist.get(aid) || 0) + 1); if (s.genre_id) byGenre.set(s.genre_id, (byGenre.get(s.genre_id) || 0) + 1); if (r.stream_date) days.add(String(r.stream_date).slice(0, 10)); } let streak = 0; for (let d = new Date(), i = 0; i < 365; i++, d.setDate(d.getDate() - 1)) { const k = d.toISOString().slice(0, 10); if (days.has(k)) streak++; else if (i > 0) break; } const top = (map, lookup, n = 5) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, count]) => ({ id, count, item: lookup(id) })).filter(x => x.item); return { minutes: Math.round(seconds / 60), streak, topSongs: top(bySong, id => songById(id)), topArtists: top(byArtist, id => state.artists.find(a => Number(a.artist_id) === Number(id))), favoriteGenre: top(byGenre, id => state.genres.find(g => Number(g.genre_id) === Number(id)), 1)[0]?.item || null }; }
function svgBars(items) { const max = Math.max(1, ...items.map(x => x.count)); return `<svg class="mini-bars" viewBox="0 0 320 110" role="img" aria-label="Top listening counts">${items.map((x, i) => { const h = Math.max(8, (x.count / max) * 78), w = 44, g = 18; return `<g transform="translate(${18 + i * (w + g)} 0)"><rect x="0" y="${88 - h}" width="${w}" height="${h}" rx="7"></rect><text x="${w / 2}" y="104" text-anchor="middle">${i + 1}</text></g>` }).join('')}</svg>`; }
function listeningStatsHtml() { const st = state.listeningStats; if (!st) return ''; return `<section class="insights-panel"><div class="section-heading"><div><span class="eyebrow">YOUR LISTENING</span><h2>SoundWave Stats</h2></div><span class="muted small">Based on your listening history</span></div><div class="insight-grid"><div class="insight-number"><strong data-count="${st.minutes}">${st.minutes}</strong><span>minutes listened</span></div><div class="insight-number"><strong data-count="${st.streak}">${st.streak}</strong><span>day streak</span></div><div class="insight-number"><strong>${esc(st.favoriteGenre?.genre_name || 'Explore more')}</strong><span>favorite genre</span></div><div class="insight-chart">${svgBars(st.topSongs)}</div></div><div class="insight-lists"><div><h3>Top artists</h3>${st.topArtists.map((x, i) => `<button type="button" data-open-artist="${x.id}"><b>${i + 1}</b><span>${esc(x.item.artist_name)}</span><small>${x.count} plays</small></button>`).join('') || '<p class="muted">Listen to artists to build your stats.</p>'}</div><div><h3>Top songs</h3>${st.topSongs.map((x, i) => `<button type="button" data-play="${x.id}"><b>${i + 1}</b><span>${esc(x.item.song_title)}</span><small>${x.count} plays</small></button>`).join('') || '<p class="muted">Your top tracks will appear here.</p>'}</div></div></section>`; }
function weeklyTopHtml() { if (!state.topWeekSongs.length) return ''; return `<section class="weekly-mix"><div class="weekly-cover"><span>7</span><small>DAYS</small></div><div><span class="eyebrow">AUTO PLAYLIST</span><h2>Your Top Songs of the Week</h2><p>${state.topWeekSongs.length} tracks ranked from your real listening history. It updates automatically.</p><div class="inline"><button type="button" class="button" data-play-ids="${state.topWeekSongs.map(s => s.song_id).join(',')}">${icon('play')} Play mix</button><span class="muted small">Cannot be deleted</span></div></div></section>`; }
function roleDistributionHtml(users = []) { const counts = { Listener: 0, Artist: 0, Admin: 0 }; for (const u of users) { const t = String(u.account_type || 'Listener'); counts[t] = (counts[t] || 0) + 1; } if (hasAdminAccess()) counts.Admin = Math.max(counts.Admin, 1); const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0)); return `<div class="role-distribution">${Object.entries(counts).map(([k, v]) => `<div><span><i class="role-dot role-${k.toLowerCase()}"></i>${k}</span><strong>${v}</strong><small>${Math.round(v / total * 100)}%</small></div>`).join('')}</div>`; }
function artistChartData(rowsArg) { const rows = rowsArg || state.artistRangeRows || state.artistThirtyDay || [], bySong = new Map(), byAlbum = new Map(); for (const r of rows) { bySong.set(Number(r.song_id), (bySong.get(Number(r.song_id)) || 0) + 1); const song = songById(r.song_id), al = song?.album?.album_title || 'Unknown release'; byAlbum.set(al, (byAlbum.get(al) || 0) + 1); } const topSongs = [...bySong.entries()].map(([id, value]) => ({ name: songById(id)?.song_title || `Song ${id}`, value, id })).sort((a, b) => b.value - a.value); const releases = [...byAlbum.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); return { topSongs, releases, most: topSongs[0] || null, unique: new Set(rows.map(r => String(r.user_id))).size }; }
function analyticsSongTitle(id) { return songById(id)?.song_title || state.analyticsSongNames?.[Number(id)] || 'Inactive or unavailable track'; }
function adminChartData() { const rows = state.adminAnalyticsHistory || [], R = adminRangeDays(), days = Array(R).fill(0), bySong = new Map(), byArtist = new Map(); for (const r of rows) { const diff = Math.floor((Date.now() - new Date(r.stream_date).getTime()) / 86400000); if (diff >= 0 && diff < R) days[R - 1 - diff]++; bySong.set(Number(r.song_id), (bySong.get(Number(r.song_id)) || 0) + 1); const song = songById(r.song_id), aid = song?.album?.artist?.artist_id; if (aid) byArtist.set(Number(aid), (byArtist.get(Number(aid)) || 0) + 1); } const topSongs = [...bySong.entries()].map(([id, value]) => ({ id, name: analyticsSongTitle(id), value })).sort((a, b) => b.value - a.value); const topArtists = [...byArtist.entries()].map(([id, value]) => ({ name: state.artists.find(a => Number(a.artist_id) === id)?.artist_name || `Artist ${id}`, value })).sort((a, b) => b.value - a.value); return { days, topSongs, topArtists, most: topSongs[0] || null, total: rows.length, unique: new Set(rows.map(r => String(r.user_id))).size, range: R, prevTotal: (state.adminAnalyticsPrev || []).length, prevUnique: new Set((state.adminAnalyticsPrev || []).map(r => String(r.user_id))).size }; }
// ---- Admin analytics date range (7 / 30 / 90 days) and previous-period comparison ----
function adminRangeDays() {
  const v = Number(state.adminRange || 0); if ([7, 30, 90].includes(v)) return v;
  let r = 30; try { const x = Number(localStorage.getItem('sw_admin_range')); if ([7, 30, 90].includes(x)) r = x; } catch { }
  state.adminRange = r; return r;
}
// Song-level pages always use a fixed 30-day window, whatever range the analytics cards are showing.
function adminRows30() { const now = Date.now(); return (state.adminAnalyticsAll || state.adminAnalyticsHistory || []).filter((r) => { const a = Math.floor((now - new Date(r.stream_date).getTime()) / 86400000); return a >= 0 && a < 30; }); }
function applyAdminRows(rows) {
  const R = adminRangeDays(), now = Date.now(), age = (r) => Math.floor((now - new Date(r.stream_date).getTime()) / 86400000);
  state.adminAnalyticsAll = rows;
  state.adminAnalyticsHistory = rows.filter((r) => { const a = age(r); return a >= 0 && a < R; });
  state.adminAnalyticsPrev = rows.filter((r) => { const a = age(r); return a >= R && a < 2 * R; });
}
// Loads twice the selected range, so the previous period is available for comparison.
async function loadAdminRows() {
  const rows = await fetchAdminServerStreams(adminRangeDays() * 2);
  if (rows !== null) applyAdminRows(rows);
  return rows;
}
function deltaHtml(cur, prev, o = {}) {
  cur = Number(cur) || 0; prev = Number(prev) || 0;
  if (!(prev > 0)) return '';
  const diff = cur - prev, R = o.range || adminRangeDays();
  if (o.points) { const pts = Math.round(diff); if (!pts) return `<span class="delta-chip flat" title="Same as the previous ${R} days">– 0 pts</span>`; return `<span class="delta-chip ${pts > 0 ? 'up' : 'down'}" title="Compared with the previous ${R} days (${Math.round(prev)}%)">${pts > 0 ? '▲' : '▼'} ${Math.abs(pts)} pts</span>`; }
  const pct = Math.round(Math.abs(diff) / prev * 100);
  if (!pct) return `<span class="delta-chip flat" title="Same as the previous ${R} days">– 0%</span>`;
  return `<span class="delta-chip ${diff > 0 ? 'up' : 'down'}" title="Compared with the previous ${R} days (${prev.toLocaleString()})">${diff > 0 ? '▲' : '▼'} ${pct}%</span>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-admin-range]'); if (!b) return;
  const v = Number(b.dataset.adminRange); if (![7, 30, 90].includes(v) || v === adminRangeDays()) return;
  state.adminRange = v; try { localStorage.setItem('sw_admin_range', String(v)); } catch { }
  document.querySelectorAll('[data-admin-range]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.adminRange) === v)));
  action(async () => { const rows = await loadAdminRows(); if (rows === null) toast('Could not load that range. Try again.', true); render(); });
});
// ---- Artist analytics: date range (7 / 30 / 90 days), previous-period comparison, follower growth, per-song detail ----
function artistRangeDays() {
  const v = Number(state.artistRange || 0); if ([7, 30, 90].includes(v)) return v;
  let r = 30; try { const x = Number(localStorage.getItem('sw_artist_range')); if ([7, 30, 90].includes(x)) r = x; } catch { }
  state.artistRange = r; return r;
}
function applyArtistRows(rows) {
  const R = artistRangeDays(), now = Date.now(), age = (r) => Math.floor((now - new Date(r.stream_date).getTime()) / 86400000);
  state.artistAllRows = rows;
  state.artistThirtyDay = rows.filter((r) => { const a = age(r); return a >= 0 && a < 30; }); // royalty and top-listener numbers stay on a fixed 30 days
  state.artistRangeRows = rows.filter((r) => { const a = age(r); return a >= 0 && a < R; });
  state.artistPrevRows = rows.filter((r) => { const a = age(r); return a >= R && a < 2 * R; });
}
async function loadArtistRows() {
  const rows = await fetchArtistServerStreams(Math.max(ANALYTICS_WINDOW_DAYS, artistRangeDays() * 2));
  if (rows !== null) applyArtistRows(rows);
  return rows;
}
function artistFollowerDates() {
  let dates = followerRows().map((r) => r.since).filter(Boolean);
  if (!dates.length) dates = (state.artistFollowers || []).map((r) => r.date_followed || r.followed_at || r.created_at).filter(Boolean);
  return dates.map((d) => new Date(d).getTime()).filter((t) => Number.isFinite(t));
}
function artistFollowerGrowth() {
  const R = artistRangeDays(), now = Date.now(), perDay = Array(R).fill(0); let fresh = 0, prev = 0;
  const times = artistFollowerDates();
  for (const t of times) { const diff = Math.floor((now - t) / 86400000); if (diff >= 0 && diff < R) { perDay[R - 1 - diff]++; fresh++; } else if (diff >= R && diff < 2 * R) prev++; }
  return { perDay, fresh, prev, hasDates: times.length > 0, total: Math.max(times.length, (state.artistFollowers || []).length, followerRows().length), range: R };
}
async function loadArtistEngagement() {
  if (!state.artist) return;
  const ids = (state.ownedSongs || []).map((s) => Number(s.song_id));
  const out = { map: {}, ok: false, lyrics: new Set(), at: Date.now() };
  try {
    const r = await db.rpc('artist_song_engagement_v77');
    if (!r.error && Array.isArray(r.data)) { out.ok = true; for (const x of r.data) out.map[Number(x.song_id)] = { saves: Number(x.saves || 0), adds: Number(x.playlist_adds || 0) }; }
    else if (r.error) console.warn('v77 engagement RPC unavailable:', r.error);
  } catch (e) { console.warn(e); }
  try {
    if (ids.length) { const l = await db.from('song_lyrics').select('song_id').in('song_id', ids); if (!l.error) for (const x of l.data || []) out.lyrics.add(Number(x.song_id)); }
  } catch (e) { console.warn(e); }
  state.artistEngagement = out;
}
function albumScheduledAt(id) { const v = (state.albumSchedule || {})[Number(id)]; const t = v ? new Date(v) : null; return t && !Number.isNaN(t.getTime()) && t.getTime() > Date.now() ? t : null; }
function fmtSchedule(d) { return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function releaseChecklist(release, songs) {
  if (!release) return '';
  const eng = state.artistEngagement, lyricSet = eng?.lyrics;
  const hasArt = !!(release.cover_path || songs.some((s) => s.cover_path));
  const noGenre = songs.filter((s) => !s.genre_id);
  const items = [
    { ok: hasArt, label: 'Artwork added', hint: 'Add a cover so your release stands out.' },
    { ok: songs.length > 0, label: 'At least one track', hint: 'Upload a song into this release.' },
    { ok: songs.length > 0 && !noGenre.length, label: 'Every track has a genre', hint: songs.length ? `${noGenre.length} without a genre.` : 'Needs tracks first.' },
    { ok: release.is_active !== false || !!albumScheduledAt(release.album_id), label: albumScheduledAt(release.album_id) ? `Scheduled for ${fmtSchedule(albumScheduledAt(release.album_id))}` : 'Release is active', hint: 'Inactive releases are hidden from listeners.' },
    { ok: !!lyricSet && songs.length > 0 && songs.every((s) => lyricSet.has(Number(s.song_id))), label: 'Lyrics added', hint: lyricSet ? 'Optional, but listeners can sing along.' : 'Checking…', optional: true }
  ];
  const required = items.filter((i) => !i.optional), done = required.filter((i) => i.ok).length, ready = done === required.length;
  return `<section class="release-checklist ${ready ? 'is-ready' : ''}" aria-label="Release checklist"><div class="rc-head"><div><span class="eyebrow">RELEASE CHECKLIST</span><strong>${ready ? 'Ready for listeners' : `${done} of ${required.length} done`}</strong></div><div class="rc-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${required.length}" aria-valuenow="${done}"><i style="width:${Math.round(done / required.length * 100)}%"></i></div></div><ul>${items.map((i) => `<li class="${i.ok ? 'ok' : ''}"><span class="rc-mark" aria-hidden="true">${i.ok ? '✓' : ''}</span><span><b>${i.label}${i.optional ? ' <em>optional</em>' : ''}</b>${i.ok ? '' : `<small>${esc(i.hint)}</small>`}</span></li>`).join('')}</ul></section>`;
}
function earningsBreakdownHtml() {
  const rate = Number(state.royaltySummary?.royalty_rate || 0), rows = state.artistEarningsRows;
  const head = `<div class="section-heading eb-heading"><div><span class="eyebrow">BREAKDOWN</span><h2>Where it comes from</h2></div></div>`;
  if (!rows) return `<section class="earnings-breakdown" id="earnings-breakdown">${head}<p class="muted small">Loading your earnings history…</p></section>`;
  const bySong = new Map(), byMonth = new Map();
  for (const r of rows) {
    const sid = Number(r.song_id); bySong.set(sid, (bySong.get(sid) || 0) + 1);
    const d = new Date(r.stream_date); if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }
  const money = (n) => '₱' + (n * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const songs = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const maxM = Math.max(1, ...months.map((m) => m[1]));
  const total = rows.length;
  const monthName = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); };
  const songTable = songs.length ? `<table class="drill-table perf-table eb-table"><thead><tr><th>Song</th><th>Streams</th><th>Estimated</th></tr></thead><tbody>${songs.map(([id, n]) => `<tr><td class="perf-name">${esc(songById(id)?.song_title || `Song ${id}`)}</td><td>${n.toLocaleString()}</td><td>${money(n)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">No qualified streams yet.</p>';
  const monthList = months.length ? `<div class="eb-months">${months.map(([k, n]) => `<div class="eb-month"><span>${esc(monthName(k))}</span><div class="eb-bar"><i style="width:${Math.max(3, Math.round(n / maxM * 100))}%"></i></div><b>${money(n)}</b><small>${n.toLocaleString()} streams</small></div>`).join('')}</div>` : '<p class="muted small">No monthly history yet.</p>';
  return `<section class="earnings-breakdown" id="earnings-breakdown">${head}<div class="eb-grid"><article class="chart-card"><div class="chart-head"><div><small>By song</small><strong>${money(total)}</strong></div><span>all-time estimate · ${total.toLocaleString()} streams</span></div>${songTable}</article><article class="chart-card"><div class="chart-head"><div><small>By month</small><strong>${months.length}</strong></div><span>recent months</span></div>${monthList}</article></div><article class="payments-card"><div><span class="eyebrow">PAYMENTS</span><strong>Payouts are coming soon</strong><p class="muted small">Figures above are estimates at ₱${rate.toFixed(4)} per qualified stream. When payouts open, your payment history and payout details will appear here.</p></div><span class="status-pill inactive">Not available yet</span></article></section>`;
}
async function loadArtistEarnings() {
  if (!state.artist || state.artistEarningsLoading) return;
  state.artistEarningsLoading = true;
  try {
    const rows = await fetchArtistServerStreams(400);
    if (rows !== null) { state.artistEarningsRows = rows; const el = document.getElementById('earnings-breakdown'); if (el) { const t = document.createElement('div'); t.innerHTML = earningsBreakdownHtml(); el.replaceWith(t.firstElementChild); } }
  } finally { state.artistEarningsLoading = false; }
}
function songPerformance(songId, rows, prevRows) {
  const id = Number(songId), mine = rows.filter((r) => Number(r.song_id) === id), before = prevRows.filter((r) => Number(r.song_id) === id);
  const finished = mine.filter((r) => String(r.completion_status || '').toLowerCase() === 'completed').length;
  const timed = mine.map((r) => Number(r.duration_played_seconds)).filter((v) => v > 0);
  const hasCompletion = mine.some((r) => r.completion_status != null);
  return { streams: mine.length, prevStreams: before.length, listeners: new Set(mine.map((r) => String(r.user_id))).size, finishedPct: hasCompletion && mine.length ? Math.round(finished / mine.length * 100) : null, avgListen: timed.length ? Math.round(timed.reduce((a, b) => a + b, 0) / timed.length) : 0, rows: mine };
}
function openSongPerformance(songId) {
  const R = artistRangeDays(), rows = state.artistRangeRows || [], prev = state.artistPrevRows || [], now = Date.now();
  const m = songPerformance(songId, rows, prev), song = songById(songId);
  const days = Array(R).fill(0); for (const r of m.rows) { const diff = Math.floor((now - new Date(r.stream_date).getTime()) / 86400000); if (diff >= 0 && diff < R) days[R - 1 - diff]++; }
  const max = Math.max(1, ...days), best = days.indexOf(Math.max(...days));
  const dayLabel = (i) => new Date(now - (R - 1 - i) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const bars = days.map((v, i) => `<i class="${m.streams && i === best ? 'best' : ''}" style="height:${Math.max(3, Math.round(v / max * 100))}%" title="${esc(dayLabel(i))}: ${v} streams"></i>`).join('');
  const chip = (label, value) => `<div><small>${label}</small><strong>${value}</strong></div>`;
  document.getElementById('drill-dialog')?.remove();
  const dlg = document.createElement('dialog'); dlg.id = 'drill-dialog'; dlg.className = 'sw-modal drill-dialog';
  dlg.innerHTML = `<div class="modal-head"><div><span class="eyebrow">SONG PERFORMANCE</span><h2>${esc(song?.song_title || `Song ${songId}`)}</h2><p class="muted small">${esc(song?.album?.album_title || '')}${song?.album?.album_title ? ' · ' : ''}last ${R} days</p></div><button type="button" class="modal-close" data-close-drill aria-label="Close">${icon('close')}</button></div><div class="drill-chips drill-chips-4 drill-chips-6">${chip('Streams', `${m.streams.toLocaleString()}${deltaHtml(m.streams, m.prevStreams, { range: R })}`)}${chip('Listeners', m.listeners.toLocaleString())}${chip('Played to the end', m.finishedPct === null ? '—' : m.finishedPct + '%')}${chip('Avg listen', m.avgListen ? mmss(m.avgListen) : '—')}${chip('Saves', engVal(songId, 'saves'))}${chip('In playlists', engVal(songId, 'adds'))}</div>${m.streams ? `<div class="drill-chart" role="img" aria-label="Streams per day for this song"><div class="drill-bars">${bars}</div><div class="drill-axis"><span>${esc(dayLabel(0))}</span><span>${esc(dayLabel(Math.floor((R - 1) / 2)))}</span><span>${esc(dayLabel(R - 1))}</span></div></div>` : '<p class="muted small" style="margin:16px 0">No streams for this song in the selected range.</p>'}<div class="inline drill-actions"><button type="button" class="button secondary" data-close-drill>Close</button></div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close-drill]')) dlg.close(); });
  dlg.addEventListener('close', () => dlg.remove()); dlg.showModal();
}
document.addEventListener('click', (e) => {
  const row = e.target.closest?.('[data-song-perf]'); if (row) { openSongPerformance(row.dataset.songPerf); return; }
  const b = e.target.closest?.('[data-artist-range]'); if (!b) return;
  const v = Number(b.dataset.artistRange); if (![7, 30, 90].includes(v) || v === artistRangeDays()) return;
  state.artistRange = v; try { localStorage.setItem('sw_artist_range', String(v)); } catch { }
  document.querySelectorAll('[data-artist-range]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.artistRange) === v)));
  action(async () => { const rows = await loadArtistRows(); if (rows === null) toast('Could not load that range. Try again.', true); render(); });
});
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-song-perf]')) { e.preventDefault(); openSongPerformance(e.target.dataset.songPerf); } });
function engVal(id, k) { const e = state.artistEngagement; if (!e || !e.ok) return '—'; return (e.map[Number(id)]?.[k] ?? 0).toLocaleString(); }
function artistChartsHtml() {
  const R = artistRangeDays(), rows = state.artistRangeRows || state.artistThirtyDay || [], prev = state.artistPrevRows || [];
  const d = artistChartData(rows), days = Array(R).fill(0);
  for (const r of rows) { const x = Math.floor((Date.now() - new Date(r.stream_date).getTime()) / 86400000); if (x >= 0 && x < R) days[R - 1 - x]++; }
  const prevUnique = new Set(prev.map((r) => String(r.user_id))).size, g = artistFollowerGrowth();
  const songRows = d.topSongs.slice(0, 10).map((x) => { const m = songPerformance(x.id, rows, prev); return `<tr class="perf-row" data-song-perf="${x.id}" tabindex="0" role="button" aria-label="Open performance for ${esc(x.name)}"><td class="perf-name">${esc(x.name)}</td><td>${m.streams.toLocaleString()}</td><td class="delta-cell">${deltaHtml(m.streams, m.prevStreams, { range: R }) || '<span class="delta flat">–</span>'}</td><td>${m.finishedPct === null ? '—' : m.finishedPct + '%'}</td><td>${engVal(x.id, 'saves')}</td><td>${engVal(x.id, 'adds')}</td><td class="perf-go" aria-hidden="true">›</td></tr>`; }).join('');
  const followers = g.hasDates
    ? `<article class="chart-card chart-wide"><div class="chart-head"><div><small>Follower growth</small><strong>+${g.fresh}${deltaHtml(g.fresh, g.prev, { range: R })}</strong></div><span>${g.total.toLocaleString()} total followers</span></div>${sparkline(g.perDay, { title: 'New followers per day', legend: 'New followers', yLabel: 'Followers' })}</article>`
    : `<article class="chart-card chart-wide"><div class="chart-head"><div><small>Follower growth</small><strong>${g.total.toLocaleString()}</strong></div><span>followers</span></div><p class="muted small">Follow dates are not available yet, so growth cannot be charted.</p></article>`;
  const perf = `<article class="chart-card chart-wide chart-full"><div class="chart-head"><div><small>Song performance</small><strong>${d.topSongs.length}</strong></div><span>songs with streams · select one for details</span></div>${songRows ? `<div class="perf-wrap"><table class="drill-table perf-table"><thead><tr><th>Song</th><th>Streams</th><th>vs previous</th><th>Played to the end</th><th>Saves</th><th>Playlists</th><th></th></tr></thead><tbody>${songRows}</tbody></table></div>` : '<p class="muted small">No streams yet in this range.</p>'}</article>`;
  return `<section class="analytics-suite artist-suite">${state.analyticsSyncError ? `<div class="notice compact-notice">Analytics refresh failed. Showing the last successfully loaded server data.</div>` : ''}<div class="section-heading"><div><span class="eyebrow">PERFORMANCE</span><h2>Music analytics</h2></div><div class="range-wrap"><div class="range-switch" role="group" aria-label="Date range">${[7, 30, 90].map((n) => `<button type="button" data-artist-range="${n}" aria-pressed="${n === R}">${n}d</button>`).join('')}</div><span class="muted small">Compared with the previous ${R} days</span></div></div><div class="chart-grid"><article class="chart-card chart-wide"><div class="chart-head"><div><small>Stream trend</small><strong>${rows.length}${deltaHtml(rows.length, prev.length, { range: R })}</strong></div><span>last ${R} days</span></div>${sparkline(days, { title: "Your streams per day", legend: "Streams per day" })}</article><article class="chart-card chart-stat"><div class="chart-head"><div><small>Unique listeners</small><strong>${d.unique}${deltaHtml(d.unique, prevUnique, { range: R })}</strong></div><span>visible listeners</span></div><div class="metric-ring"><span>${d.unique}</span><small>people</small></div></article>${followers}<article class="chart-card"><div class="chart-head"><div><small>Most streamed song</small><strong class="chart-title">${esc(d.most?.name || 'No streams yet')}</strong></div><span>${d.most?.value || 0} plays</span></div>${chartBars(d.topSongs, { title: "Your top songs by streams (last " + R + " days)", xLabel: "Streams", yLabel: "Song", legend: "Streams per song" })}</article>${perf}<article class="chart-card chart-full"><div class="chart-head"><div><small>Streams by release</small><strong>${d.releases.length}</strong></div><span>releases</span></div>${chartBars(d.releases, { title: "Streams by release (last " + R + " days)", xLabel: "Streams", yLabel: "Release", legend: "Streams per release" })}</article></div></section>`;
}
// ---- Extra admin analytics: signups, genres, completion, moderation workload ----
function adminExtraData(users = []) {
  const rows = state.adminAnalyticsHistory || [], now = Date.now();
  const R = adminRangeDays(), signupDays = Array(R).fill(0); let newArtists = 0, newListeners = 0, hasJoinDates = false, prevSignups = 0;
  for (const u of users) {
    const raw = u.created_at || u.date_created; if (!raw) continue; hasJoinDates = true;
    const diff = Math.floor((now - new Date(raw).getTime()) / 86400000);
    if (diff >= 0 && diff < R) { signupDays[R - 1 - diff]++; if (String(u.account_type || 'Listener') === 'Artist') newArtists++; else newListeners++; } else if (diff >= R && diff < 2 * R) prevSignups++;
  }
  const byGenre = new Map(); let finished = 0, seconds = 0, timed = 0;
  for (const r of rows) {
    const song = songById(r.song_id);
    if (song) { const g = (state.genres || []).find(x => Number(x.genre_id) === Number(song.genre_id))?.genre_name || 'Uncategorized'; byGenre.set(g, (byGenre.get(g) || 0) + 1); }
    if (String(r.completion_status || '').toLowerCase() === 'completed') finished++;
    const d = Number(r.duration_played_seconds); if (d > 0) { seconds += d; timed++; }
  }
  const genres = [...byGenre.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const d = state.adminData || {};
  const work = {
    songs: (d.songs || []).filter(x => x.is_active === false).length,
    podcasts: (d.podcasts || []).filter(x => x.is_active === false).length,
    artists: (d.artists || []).filter(x => x.is_active === false).length,
    accounts: users.filter(u => u.is_active === false).length
  };
  const prev = state.adminAnalyticsPrev || [], prevFinished = prev.filter(r => String(r.completion_status || '').toLowerCase() === 'completed').length;
  return { range: R, prevSignups, prevTotal: prev.length, prevFinished, signupDays, newArtists, newListeners, hasJoinDates, newTotal: newArtists + newListeners, genres, total: rows.length, finished, avgListen: timed ? Math.round(seconds / timed) : 0, work };
}
function mmss(sec) { sec = Math.max(0, Math.round(Number(sec) || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function adminExtraCardsHtml(users = []) {
  const x = adminExtraData(users);
  const pct = (n, t) => t ? Math.round(n / t * 100) : 0;
  const signup = x.hasJoinDates
    ? `<article class="chart-card chart-wide"><div class="chart-head"><div><small>New signups</small><strong>${x.newTotal}${deltaHtml(x.newTotal, x.prevSignups)}</strong></div><span>${x.newListeners} ${x.newListeners === 1 ? 'listener' : 'listeners'} · ${x.newArtists} ${x.newArtists === 1 ? 'artist' : 'artists'} · last ${x.range} days</span></div>${sparkline(x.signupDays, { title: 'New accounts per day', legend: 'New accounts', yLabel: 'Accounts' })}</article>`
    : `<article class="chart-card chart-wide"><div class="chart-head"><div><small>New signups</small><strong>—</strong></div><span>last ${x.range} days</span></div><p class="muted small">Join dates are not available from the admin data yet.</p></article>`;
  const genre = `<article class="chart-card"><div class="chart-head"><div><small>Streams by genre</small><strong>${x.genres.length}</strong></div><span>genres</span></div>${chartBars(x.genres, { title: 'Streams by genre (last ' + x.range + ' days)', xLabel: 'Streams', yLabel: 'Genre', legend: 'Streams per genre' })}</article>`;
  const partial = Math.max(0, x.total - x.finished);
  const completion = `<article class="chart-card"><div class="chart-head"><div><small>Completion rate</small><strong>${pct(x.finished, x.total)}%${deltaHtml(pct(x.finished, x.total), pct(x.prevFinished, x.prevTotal), { points: true })}</strong></div><span>avg listen ${mmss(x.avgListen)}</span></div>${x.total ? `<div class="role-distribution"><div><span><i class="role-dot role-listener"></i>Played to the end</span><strong>${x.finished}</strong><small>${pct(x.finished, x.total)}%</small></div><div><span><i class="role-dot role-artist"></i>Stopped after 30s+</span><strong>${partial}</strong><small>${pct(partial, x.total)}%</small></div></div>` : '<p class="muted small">No stream data is visible yet.</p>'}</article>`;
  const w = x.work, wTotal = w.songs + w.podcasts + w.artists + w.accounts;
  const row = (label, n, drill) => `<div><span>${label}</span><strong>${n}</strong>${drill && n ? `<button type="button" class="count-link" data-drill="${drill}">View</button>` : '<small>—</small>'}</div>`;
  const moderation = `<article class="chart-card"><div class="chart-head"><div><small>Moderation workload</small><strong>${wTotal}</strong></div><span>${wTotal ? 'items to review' : 'all clear'}</span></div><div class="role-distribution">${row('Inactive songs', w.songs, 'attention')}${row('Inactive podcasts', w.podcasts, 'attention')}${row('Inactive creator profiles', w.artists, 'creators')}${row('Inactive accounts', w.accounts, 'users')}</div></article>`;
  return signup + genre + completion + moderation;
}
function adminSongBars(list) { const top = (list || []).slice(0, 8), seen = new Map(); top.forEach(x => seen.set(x.name, (seen.get(x.name) || 0) + 1)); return top.map(x => { if (seen.get(x.name) < 2) return x; const who = songById(x.id)?.album?.artist?.artist_name; return who ? { ...x, name: `${x.name} · ${who}` } : x; }); }
function adminChartsHtml(users = []) { const d = adminChartData(); return `<section class="analytics-suite admin-suite" id="admin-analytics">${state.analyticsSyncError ? `<div class="notice compact-notice">Analytics refresh failed. Showing the last successfully loaded server data.</div>` : ''}<div class="section-heading"><div><span class="eyebrow">PLATFORM ANALYTICS</span><h2>What is happening on SoundWave</h2></div><div class="range-wrap"><div class="range-switch" role="group" aria-label="Date range">${[7, 30, 90].map((n) => `<button type="button" data-admin-range="${n}" aria-pressed="${n === d.range}">${n}d</button>`).join('')}</div><span class="muted small">Qualified streams · 30s+ or completed · compared with the previous ${d.range} days</span></div></div><div class="chart-grid"><article class="chart-card chart-wide"><div class="chart-head"><div><small>Streams</small><button type="button" class="count-link" data-drill="streams">${d.total}</button>${deltaHtml(d.total, d.prevTotal)}</div><span>last ${d.range} days</span></div>${sparkline(d.days, { title: "Qualified streams per day", legend: "Streams per day" })}</article><article class="chart-card"><div class="chart-head"><div><small>Most streamed songs</small><button type="button" class="count-link chart-title" data-drill="songs">${esc(d.most?.name || 'No streams yet')}</button></div><span>${d.most?.value || 0} plays</span></div>${chartBars(adminSongBars(d.topSongs), { title: "Top songs by streams (last " + d.range + " days)", xLabel: "Streams", yLabel: "Song", legend: "Streams per song" })}</article><article class="chart-card"><div class="chart-head"><div><small>Top artists</small><button type="button" class="count-link" data-drill="artists">${d.topArtists.length}</button></div><span>by streams</span></div>${chartBars(d.topArtists, { title: "Top artists by streams (last " + d.range + " days)", xLabel: "Streams", yLabel: "Artist", legend: "Streams per artist" })}</article><article class="chart-card"><div class="chart-head"><div><small>Account mix</small><button type="button" class="count-link" data-drill="users">${users.length}</button></div><span>accounts</span></div>${roleDistributionHtml(users)}</article>${adminExtraCardsHtml(users)}</div>${adminSongsShortcutHtml()}</section>`; }
function artistAnalyticsHtml() { if (!state.artist) return ''; const days = Array(30).fill(0); for (const r of state.artistThirtyDay) { const diff = Math.floor((Date.now() - new Date(r.stream_date).getTime()) / 86400000); if (diff >= 0 && diff < 30) days[29 - diff]++; } const roy = state.royaltySummary || {}; const rate = Number(roy.royalty_rate || 0); return `<section class="artist-analytics"><div class="section-heading"><div><span class="eyebrow">LAST 30 DAYS</span><h2>Audience pulse</h2></div></div><div class="artist-analytics-grid"><div class="analytics-chart"><strong>${state.artistThirtyDay.length}</strong><span>visible streams</span>${sparkline(days)}</div><div class="top-listeners"><h3>Top listeners</h3>${state.artistTopListeners.map((x, i) => `<div><span class="member-avatar">${i + 1}</span><strong>${esc(x.name)}</strong><small>${x.count} streams</small></div>`).join('') || '<p class="muted small">No listener rows are visible under the current RLS policy yet.</p>'}</div><div class="royalty-calc"><h3>Royalty estimator</h3><strong>₱${(state.artistThirtyDay.length * rate).toFixed(2)}</strong><small>${state.artistThirtyDay.length} streams × ₱${rate.toFixed(4)}</small></div></div></section>`; }
function episodeProgressHtml(ep) { const h = state.podcastHistory.find(x => String(x.episode_id) === String(ep.episode_id)); const pos = Number(h?.resume_position_seconds) || 0, dur = Number(ep.duration_seconds) || 0, pct = dur ? Math.min(100, (pos / dur) * 100) : 0; return pct > 1 ? `<div class="episode-progress" title="Resume at ${nice(pos)}"><span style="width:${pct}%"></span></div>` : ''; }
function friendNowHtml() { if (!state.friendNow.length) return ''; return `<section class="rail-card friend-now"><h4>Friends listening now</h4>${state.friendNow.slice(0, 5).map(x => `<button type="button" data-play="${x.song_id}"><span class="presence-dot"></span><span><strong>${esc(x.name)}</strong><small>${esc(x.song_title)} · ${esc(x.artist_name)}</small></span></button>`).join('')}</section>`; }
function friendActivityHtml() { if (!state.friendActivity.length) return ''; return `<section class="rail-card friend-feed"><h4>Friend activity</h4>${state.friendActivity.slice(0, 6).map(x => `<div><span class="member-avatar">${esc(x.initial)}</span><p><strong>${esc(x.name)}</strong> ${esc(x.text)}<small>${esc(agoText(x.at))}</small></p></div>`).join('')}</section>`; }
function playlistPresenceHtml() { if (!state.playlistPresence.length) return '<span class="muted small">Live collaboration ready</span>'; return `<span class="presence-label">Viewing now</span>${state.playlistPresence.slice(0, 5).map((p, i) => `<span class="presence-avatar" title="${esc(p.name)}">${esc((p.name || '?')[0].toUpperCase())}</span>`).join('')}`; }
let realtimeChannel = null, playlistPresenceChannel = null, adminStreamChannel = null, creatorStreamChannel = null, podcastCreatorChannel = null, releaseAlertChannel = null, releaseAlertTimer = null, releaseAlertTick = 0, releaseAlertLastLoad = 0;
let sleepTimeout = null, sleepTicker = null, sleepFade = null;
function normalizeAnalyticsRpcRows(data) {
  let rows = data;
  if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch { return null; } }
  if (rows && typeof rows === 'object' && !Array.isArray(rows) && Array.isArray(rows.rows)) rows = rows.rows;
  if (!Array.isArray(rows)) return null;
  return uniqueStreamRows(rows).filter(isQualifiedStream);
}
async function fetchArtistServerStreams(days = ANALYTICS_WINDOW_DAYS) {
  if (!state.artist) return null;
  const artistId = Number(state.artist.artist_id);
  let rpc = await db.rpc('artist_stream_rows_v26', { p_artist_id: artistId, p_days: days });
  if (!rpc.error) { state.analyticsSyncError = ''; return normalizeAnalyticsRpcRows(rpc.data) ?? []; }
  console.warn('v26 artist analytics RPC unavailable:', rpc.error);
  // Backward-compatible fallback while the v26 SQL is being installed.
  rpc = await db.rpc('artist_stream_rows', { p_days: days });
  if (rpc.error) { state.analyticsSyncError = humanErr(rpc.error); console.warn('Artist analytics sync failed:', rpc.error); return null; }
  state.analyticsSyncError = '';
  return normalizeAnalyticsRpcRows(rpc.data) ?? [];
}
async function fetchAdminServerStreams(days = ANALYTICS_WINDOW_DAYS) {
  if (!hasAdminAccess()) return null;
  let rpc = await db.rpc('admin_stream_rows_v26', { p_days: days });
  let rows = null;
  if (!rpc.error) rows = normalizeAnalyticsRpcRows(rpc.data) ?? [];
  else {
    console.warn('v26 admin analytics RPC unavailable:', rpc.error);
    rpc = await db.rpc('admin_stream_rows', { p_days: days });
    if (rpc.error) { state.analyticsSyncError = humanErr(rpc.error); console.warn('Admin analytics sync failed:', rpc.error); return null; }
    rows = normalizeAnalyticsRpcRows(rpc.data) ?? [];
  }
  state.analyticsSyncError = '';
  const missing = [...new Set(rows.map(r => Number(r.song_id)).filter(id => id && !songById(id) && !state.analyticsSongNames?.[id]))];
  if (missing.length) {
    const meta = await db.from('song').select('song_id,song_title').in('song_id', missing).limit(500);
    if (!meta.error) { state.analyticsSongNames = { ...(state.analyticsSongNames || {}), ...Object.fromEntries((meta.data || []).map(s => [Number(s.song_id), s.song_title])) }; }
  }
  return rows;
}
async function refreshCrossDeviceMetrics({ renderIfNeeded = true } = {}) {
  if (!state.user) return;
  try {
    let changed = false;
    if (state.artist) {
      const rows = await loadArtistRows();
      if (rows) {
        const listeners = new Map(); state.artistThirtyDay.forEach(r => listeners.set(String(r.user_id), (listeners.get(String(r.user_id)) || 0) + 1));
        state.artistTopListeners = [...listeners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, count]) => ({ uid, count, name: analyticsListenerName(uid) })); void hydrateArtistTopListenerLabels();
        changed = true;
      }
    }
    if (hasAdminAccess()) {
      const rows = await loadAdminRows();
      if (rows) { changed = true; }
    }
    if (changed && renderIfNeeded && ['artist-dashboard', 'studio', 'admin', 'admin-dashboard', 'album-detail'].includes(state.page)) backgroundRender();
  } catch (e) { console.warn('Cross-device analytics refresh failed', e); }
}
function hasOpenFileWorkflow() { return !!document.querySelector('dialog[open], input[type="file"]:focus'); }
function bindCrossDeviceRefresh() {
  if (state.crossDeviceRefreshBound) return;
  state.crossDeviceRefreshBound = true;
  let lastHiddenAt = 0;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') lastHiddenAt = Date.now(); else if (!hasOpenFileWorkflow() && Date.now() - lastHiddenAt > 1200) void refreshCrossDeviceMetrics(); });
  window.addEventListener('focus', () => { setTimeout(() => { if (!hasOpenFileWorkflow()) void refreshCrossDeviceMetrics(); }, 500); });
}
async function handleSuspendedAccount(message = 'This account has been suspended by an administrator.') {
  if (state.profile) state.profile = { ...state.profile, is_active: false };
  try { await stopAudio(); } catch (e) { console.warn('Could not stop playback during suspension', e); }
  state.player = null;
  render();
  toast(message, true);
}
async function verifyAccountAccess({ silent = false } = {}) {
  if (!state.user?.id || accountStatusChecking) return state.profile?.is_active !== false;
  accountStatusChecking = true;
  try {
    const { data, error } = await db.from('users').select('is_active').eq('user_id', state.user.id).maybeSingle();
    if (error) { if (!silent) console.warn('Account access check failed', error); return state.profile?.is_active !== false; }
    const active = data?.is_active !== false;
    if (state.profile) state.profile = { ...state.profile, is_active: active };
    if (!active) { await handleSuspendedAccount(); return false; }
    return true;
  } finally { accountStatusChecking = false; }
}
async function requirePlaybackAccess() {
  const allowed = await verifyAccountAccess();
  if (!allowed) throw Error('This account is suspended. Playback is disabled until an administrator restores it.');
  return true;
}
// <notifications-v79>
// ---------- Notifications (bell, panel, full page, preferences, realtime) ----------
// All data access goes through RLS-protected tables / RPCs created by the notifications migration.
// The browser never creates notifications; it only reads, marks read, deletes and edits its own preferences.
const NOTIF_PAGE_SIZE = 30;
const NOTIF_FILTERS = [['all', 'All'], ['unread', 'Unread'], ['social', 'Social'], ['releases', 'Releases'], ['account', 'Account'], ['premium', 'Premium'], ['system', 'System']];
const NOTIF_CATEGORY_LABELS = { social: 'Social', releases: 'Releases', moderation: 'Moderation', account: 'Account', premium: 'Premium', crowdqueue: 'CrowdQueue', system: 'System' };
const notif = { items: [], types: {}, unread: 0, loaded: false, loading: false, hasMore: false, error: '', filter: 'all', prefs: {}, prefsLoaded: false, selected: new Set(), open: false, stats: null };
let notifChannel = null, notifChannelUser = null, notifUnreadTimer = null, notifEscBound = false;

function notifInfo(type) { return notif.types[type] || { category: 'system', label: String(type || 'Notification') }; }
function notifAgo(iso) {
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return 'just now'; if (s < 3600) return `${Math.round(s / 60)}m ago`; if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 604800) return `${Math.round(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function notifVisible(list = notif.items) {
  const f = notif.filter;
  if (f === 'all') return list;
  if (f === 'unread') return list.filter((n) => !n.read_at);
  return list.filter((n) => notifInfo(n.type).category === f);
}
function notifBellHtml() {
  const n = notif.unread, label = n ? `Notifications, ${n} unread` : 'Notifications';
  return `<div class="notif-wrap"><button type="button" class="top-bell" id="notif-toggle" aria-label="${label}" aria-haspopup="true" aria-expanded="${notif.open}">${icon('bell')}<span class="bell-badge" id="notif-badge" ${n ? '' : 'hidden'}>${n > 99 ? '99+' : n}</span></button><div class="notif-panel" id="notif-panel" role="dialog" aria-label="Notifications" ${notif.open ? '' : 'hidden'}></div></div>`;
}
function notifItemHtml(n, { selectable = false } = {}) {
  const id = Number(n.notification_id), info = notifInfo(n.type), unread = !n.read_at;
  return `<div class="notif-item ${unread ? 'unread' : ''} prio-${esc(n.priority || 'normal')}" role="listitem" data-notif="${id}">${selectable ? `<input type="checkbox" class="notif-check" data-notif-check="${id}" aria-label="Select notification" ${notif.selected.has(id) ? 'checked' : ''}>` : ''}<button type="button" class="notif-main" data-notif-open="${id}"><span class="notif-dot" aria-hidden="true"></span><span class="notif-text"><strong>${esc(n.title)}</strong>${n.body ? `<small>${esc(n.body)}</small>` : ''}<em>${esc(info.label)} · ${esc(notifAgo(n.created_at))}</em></span></button><button type="button" class="notif-del" data-notif-del="${id}" aria-label="Delete notification">${icon('close')}</button></div>`;
}
function notifEmptyHtml() {
  if (notif.error) return `<div class="notif-empty"><p>${esc(notif.error)}</p><button type="button" class="button secondary" data-notif-retry>Try again</button></div>`;
  if (notif.loading && !notif.loaded) return '<div class="notif-empty"><p>Loading notifications…</p></div>';
  return `<div class="notif-empty"><p>${notif.filter === 'all' ? 'You are all caught up. New activity will show up here.' : 'Nothing here for this filter.'}</p></div>`;
}
function notifUpdateBadge() {
  const b = document.getElementById('notif-badge'), btn = document.getElementById('notif-toggle'), n = notif.unread;
  if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n); }
  if (btn) btn.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
}
function renderNotifPanel() {
  const panel = document.getElementById('notif-panel'); if (!panel || panel.hidden) return;
  const list = notif.items.slice(0, 8);
  panel.innerHTML = `<div class="notif-panel-head"><strong>Notifications</strong><span><button type="button" class="notif-link" data-notif-markall ${notif.unread ? '' : 'disabled'}>Mark all read</button></span></div><div class="notif-list" role="list">${list.length ? list.map((n) => notifItemHtml(n)).join('') : notifEmptyHtml()}</div><div class="notif-panel-foot"><button type="button" class="notif-link" data-notif-seeall>See all notifications</button></div>`;
  bindNotifList(panel);
}
function renderNotifPage() {
  const host = document.getElementById('notif-page-list'); if (!host) return;
  const list = notifVisible();
  host.innerHTML = list.length ? list.map((n) => notifItemHtml(n, { selectable: true })).join('') : notifEmptyHtml();
  const more = document.getElementById('notif-more'); if (more) more.hidden = !(notif.hasMore && !notif.loading);
  const cnt = document.getElementById('notif-selected-count'); if (cnt) cnt.textContent = notif.selected.size ? `${notif.selected.size} selected` : '';
  const del = document.getElementById('notif-delete-selected'); if (del) del.disabled = !notif.selected.size;
  const mark = document.getElementById('notif-page-markall'); if (mark) mark.disabled = !notif.unread;
  document.querySelectorAll('[data-notif-filter]').forEach((b) => { const on = b.dataset.notifFilter === notif.filter; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  bindNotifList(host);
}
function paintNotifs() { notifUpdateBadge(); renderNotifPanel(); if (state.page === 'notifications') renderNotifPage(); }

async function loadNotificationTypes() {
  if (Object.keys(notif.types).length) return;
  const rows = check(await db.from('notification_types').select('*').order('sort_order'));
  notif.types = Object.fromEntries(rows.map((r) => [r.type, r]));
}
async function refreshNotifUnread() {
  if (!db || !state.user) return;
  const res = await db.from('notifications').select('notification_id', { count: 'exact', head: true }).is('read_at', null);
  if (res.error) { console.warn('Unread count failed', res.error); return; }
  notif.unread = res.count || 0; notifUpdateBadge();
  const mark = document.getElementById('notif-page-markall'); if (mark) mark.disabled = !notif.unread;
}
function scheduleNotifUnreadRefresh() { clearTimeout(notifUnreadTimer); notifUnreadTimer = setTimeout(() => { void refreshNotifUnread(); }, 250); }
async function loadNotifications(reset = false) {
  if (!db || !state.user || notif.loading) return;
  notif.loading = true; notif.error = ''; if (!notif.loaded) paintNotifs();
  try {
    await loadNotificationTypes();
    let q = db.from('notifications').select('notification_id,type,title,body,data,priority,count,read_at,created_at').order('created_at', { ascending: false }).limit(NOTIF_PAGE_SIZE + 1);
    if (!reset && notif.items.length) q = q.lt('created_at', notif.items[notif.items.length - 1].created_at);
    const rows = check(await q);
    notif.hasMore = rows.length > NOTIF_PAGE_SIZE;
    const page = rows.slice(0, NOTIF_PAGE_SIZE);
    notif.items = reset ? page : [...notif.items, ...page.filter((n) => !notif.items.some((x) => x.notification_id === n.notification_id))];
    notif.loaded = true;
    await refreshNotifUnread();
  } catch (e) { console.warn('Notifications failed to load', e); notif.error = humanErr(e); }
  finally { notif.loading = false; paintNotifs(); }
}
async function markNotifsRead(ids, category = null) {
  const before = notif.items.map((n) => ({ ...n }));
  const touch = (n) => (ids ? ids.includes(Number(n.notification_id)) : (!category || notifInfo(n.type).category === category)) && !n.read_at;
  const now = new Date().toISOString();
  notif.items.forEach((n) => { if (touch(n)) n.read_at = now; });
  paintNotifs();
  try {
    check(await db.rpc('sw_mark_notifications_read', { p_ids: ids || null, p_category: category || null }));
    await refreshNotifUnread();
  } catch (e) { notif.items = before; toast(humanErr(e), true); await refreshNotifUnread(); }
  paintNotifs();
}
async function deleteNotifs(ids) {
  if (!ids.length) return;
  try {
    const gone = check(await db.from('notifications').delete().in('notification_id', ids).select('notification_id')) || [];
    const set = new Set(gone.map((r) => Number(r.notification_id)));
    notif.items = notif.items.filter((n) => !set.has(Number(n.notification_id)));
    set.forEach((id) => notif.selected.delete(id));
    if (set.size < ids.length) toast('Some notifications could not be deleted.', true);
    await refreshNotifUnread();
  } catch (e) { toast(humanErr(e), true); }
  paintNotifs();
}
function notifTarget(n) {
  const d = n.data || {};
  switch (n.type) {
    case 'new_follower': case 'unfollow': return ['followers', {}];
    case 'artist_new_release':
      if (d.album_id && state.albums?.some((a) => Number(a.album_id) === Number(d.album_id))) return ['album-detail', { selectedAlbum: Number(d.album_id) }];
      if (d.artist_id) return ['artist-detail', { selectedArtist: Number(d.artist_id) }];
      return ['discover', {}];
    case 'following_deactivated': case 'following_suspended': case 'following_deleted': return ['liked-artists', {}];
    case 'account_suspended': case 'account_restored': return ['profile', {}];
    case 'premium_activated': case 'premium_renewed': case 'premium_expiring': case 'premium_expired': case 'payment_issue': return ['plans', {}];
    default: return null;
  }
}
function openNotif(id) {
  const n = notif.items.find((x) => Number(x.notification_id) === Number(id)); if (!n) return;
  if (!n.read_at) void markNotifsRead([Number(id)]);
  const target = notifTarget(n); if (!target) return;
  closeNotifPanel(); navigate(target[0], target[1]);
}
function bindNotifList(root) {
  root.querySelectorAll('[data-notif-open]').forEach((b) => { b.onclick = () => openNotif(b.dataset.notifOpen); });
  root.querySelectorAll('[data-notif-del]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); void deleteNotifs([Number(b.dataset.notifDel)]); }; });
  root.querySelectorAll('[data-notif-check]').forEach((c) => { c.onchange = () => { const id = Number(c.dataset.notifCheck); if (c.checked) notif.selected.add(id); else notif.selected.delete(id); renderNotifPage(); }; });
  root.querySelectorAll('[data-notif-markall]').forEach((b) => { b.onclick = () => void markNotifsRead(null); });
  root.querySelectorAll('[data-notif-seeall]').forEach((b) => { b.onclick = () => { closeNotifPanel(); navigate('notifications'); }; });
  root.querySelectorAll('[data-notif-retry]').forEach((b) => { b.onclick = () => void loadNotifications(true); });
}
function closeNotifPanel() {
  notif.open = false;
  const p = document.getElementById('notif-panel'); if (p) p.hidden = true;
  document.getElementById('notif-toggle')?.setAttribute('aria-expanded', 'false');
}
function bindNotifications() {
  if (!notifEscBound) { notifEscBound = true; document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && notif.open) { closeNotifPanel(); document.getElementById('notif-toggle')?.focus(); } }); }
  const btn = document.getElementById('notif-toggle'); if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); notif.open = !notif.open;
    const p = document.getElementById('notif-panel'); if (p) p.hidden = !notif.open;
    btn.setAttribute('aria-expanded', String(notif.open));
    if (notif.open) { renderNotifPanel(); if (!notif.loaded) void loadNotifications(true); else void refreshNotifUnread(); const pm = document.getElementById('profile-menu'); if (pm) pm.hidden = true; }
  });
  document.getElementById('notif-panel')?.addEventListener('click', (e) => e.stopPropagation());
  notifUpdateBadge(); renderNotifPanel();
}

// ----- realtime
function onNotifChange(payload) {
  const row = payload.new, old = payload.old;
  if (payload.eventType === 'INSERT' && row && row.in_app !== false) {
    if (!notif.items.some((n) => Number(n.notification_id) === Number(row.notification_id))) notif.items.unshift(row);
    if (!row.read_at) notif.unread += 1;
    if (row.priority === 'high') toast(row.body ? `${row.title} — ${row.body}` : row.title);
  } else if (payload.eventType === 'UPDATE' && row) {
    const i = notif.items.findIndex((n) => Number(n.notification_id) === Number(row.notification_id));
    if (i >= 0) notif.items[i] = { ...notif.items[i], ...row }; else notif.items.push(row);
    notif.items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    scheduleNotifUnreadRefresh();
  } else if (payload.eventType === 'DELETE' && old) {
    notif.items = notif.items.filter((n) => Number(n.notification_id) !== Number(old.notification_id));
    notif.selected.delete(Number(old.notification_id)); scheduleNotifUnreadRefresh();
  }
  paintNotifs();
}
function setupNotifications() {
  if (!db || !state.user?.id) return;
  if (notifChannel && notifChannelUser === state.user.id) return;
  teardownNotifications();
  notifChannelUser = state.user.id;
  void loadNotifications(true);
  notifChannel = db.channel(`soundwave-notifications-${state.user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${state.user.id}` }, onNotifChange)
    .subscribe((status) => { if (status === 'SUBSCRIBED' && notif.loaded) void loadNotifications(true); }); // resync anything missed while offline
}
function teardownNotifications() { if (notifChannel && db) db.removeChannel(notifChannel); notifChannel = null; notifChannelUser = null; clearTimeout(notifUnreadTimer); }
function resetNotifications() {
  teardownNotifications();
  Object.assign(notif, { items: [], unread: 0, loaded: false, loading: false, hasMore: false, error: '', filter: 'all', prefs: {}, prefsLoaded: false, selected: new Set(), open: false, stats: null });
}

// ----- preferences (in-app toggles; email/push are stored by the backend but have no sender yet, so they are not shown)
async function loadNotifPrefs() {
  await loadNotificationTypes();
  const rows = check(await db.from('notification_preferences').select('type,in_app,email,push'));
  notif.prefs = Object.fromEntries(rows.map((r) => [r.type, r])); notif.prefsLoaded = true;
}
function notifPrefsHtml() {
  const types = Object.values(notif.types).sort((a, b) => a.sort_order - b.sort_order);
  if (!types.length) return '<p class="muted">Preferences are not available right now.</p>';
  const groups = {}; types.forEach((t) => { (groups[t.category] ||= []).push(t); });
  return Object.entries(groups).map(([cat, list]) => `<fieldset class="notif-pref-group"><legend>${esc(NOTIF_CATEGORY_LABELS[cat] || cat)}</legend>${list.map((t) => {
    const on = notif.prefs[t.type] ? notif.prefs[t.type].in_app : t.default_in_app, locked = !t.user_can_disable;
    return `<label class="notif-pref"><span><strong>${esc(t.label)}</strong><small>${esc(t.description || '')}${locked ? ' Always on for your security.' : ''}</small></span><input type="checkbox" role="switch" data-notif-pref="${esc(t.type)}" ${on || locked ? 'checked' : ''} ${locked ? 'disabled' : ''}></label>`;
  }).join('')}</fieldset>`).join('');
}
function bindNotifPrefs() {
  document.querySelectorAll('[data-notif-pref]').forEach((c) => {
    c.onchange = async () => {
      const type = c.dataset.notifPref, prev = notif.prefs[type], want = c.checked; c.disabled = true;
      try {
        const row = { user_id: state.user.id, type, in_app: want, email: prev?.email ?? false, push: prev?.push ?? false };
        const saved = check(await db.from('notification_preferences').upsert(row, { onConflict: 'user_id,type' }).select('type,in_app,email,push'));
        notif.prefs[type] = saved?.[0] || row; toast(want ? 'Notification turned on' : 'Notification turned off');
      } catch (e) { c.checked = !want; toast(humanErr(e), true); } finally { c.disabled = false; }
    };
  });
}

// ----- admin: announcements + aggregated delivery status
function notifAdminHtml() {
  const rows = notif.stats;
  const table = !rows ? '<p class="muted">Loading delivery status…</p>' : rows.length ? `<div class="notif-stats-wrap"><table class="notif-stats"><thead><tr><th>Type</th><th>Channel</th><th>Status</th><th>Total</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(notifInfo(r.type).label)}</td><td>${esc(r.channel)}</td><td>${esc(r.status)}</td><td>${Number(r.total)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No notifications in the last 7 days.</p>';
  return `<section class="notif-card" id="notif-admin"><h3>Send an announcement</h3><form id="notif-announce" class="notif-announce"><label class="single-field">Title<input id="ann-title" maxlength="120" required placeholder="What should people know?"></label><label class="single-field">Message<textarea id="ann-body" maxlength="1000" placeholder="Optional details"></textarea></label><div class="notif-announce-row"><label class="single-field">Audience<select id="ann-audience"><option value="all">Everyone</option><option value="premium">Premium members</option><option value="artists">Artists</option></select></label><label class="single-field">Priority<select id="ann-priority"><option value="normal">Normal</option><option value="high">High (shows a toast)</option><option value="low">Low</option></select></label></div><button type="submit" class="button">Send announcement</button></form><h3>Delivery status (last 7 days)</h3>${table}</section>`;
}
async function loadNotifStats() {
  try { notif.stats = check(await db.rpc('sw_admin_notification_stats', { p_days: 7 })) || []; } catch (e) { notif.stats = []; console.warn('Notification stats failed', e); }
  const box = document.getElementById('notif-admin'); if (box) { box.outerHTML = notifAdminHtml(); bindNotifAdmin(); }
}
function bindNotifAdmin() {
  const form = document.getElementById('notif-announce'); if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const title = val('ann-title'), body = val('ann-body') || null, audience = val('ann-audience'), priority = val('ann-priority');
    if (!title) return toast('Enter a title.', true);
    if (!confirm(`Send "${title}" to ${audience === 'all' ? 'everyone' : audience === 'premium' ? 'Premium members' : 'all artists'}? This cannot be undone.`)) return;
    action(async () => {
      const res = check(await db.rpc('sw_admin_send_announcement', { p_title: title, p_body: body, p_audience: audience, p_priority: priority }));
      toast(`Announcement sent to ${res?.recipients ?? 0} ${Number(res?.recipients) === 1 ? 'person' : 'people'}`); form.reset(); await loadNotifStats();
    });
  };
}

// ----- full page
function notificationsPage() {
  const filters = NOTIF_FILTERS.map(([k, l]) => `<button type="button" class="notif-chip" data-notif-filter="${k}" aria-pressed="${notif.filter === k}">${l}</button>`).join('');
  shell(`<section class="notif-page"><div class="notif-toolbar"><div class="notif-chips" role="group" aria-label="Filter notifications">${filters}</div><div class="notif-bulk"><span id="notif-selected-count" class="muted" aria-live="polite"></span><button type="button" class="button secondary" id="notif-page-markall">Mark all read</button><button type="button" class="button secondary" id="notif-delete-selected" disabled>Delete selected</button><button type="button" class="button secondary" id="notif-delete-read">Delete read</button></div></div><div class="notif-list notif-list-page" id="notif-page-list" role="list"></div><div class="notif-more-row"><button type="button" class="button secondary" id="notif-more" hidden>Load more</button></div><details class="notif-card notif-prefs" id="notif-prefs"><summary>Notification preferences</summary><div id="notif-prefs-body"><p class="muted">Loading…</p></div></details>${hasAdminAccess() ? notifAdminHtml() : ''}</section>`, 'Notifications');
  document.querySelectorAll('[data-notif-filter]').forEach((b) => { b.onclick = () => { notif.filter = b.dataset.notifFilter; notif.selected.clear(); renderNotifPage(); }; });
  document.getElementById('notif-page-markall').onclick = () => { const cat = ['all', 'unread'].includes(notif.filter) ? null : notif.filter; void markNotifsRead(null, cat); };
  document.getElementById('notif-delete-selected').onclick = () => { const ids = [...notif.selected]; if (ids.length && confirm(`Delete ${ids.length} notification${ids.length === 1 ? '' : 's'}?`)) void deleteNotifs(ids); };
  document.getElementById('notif-delete-read').onclick = () => { const ids = notif.items.filter((n) => n.read_at).map((n) => Number(n.notification_id)); if (!ids.length) return toast('No read notifications to delete.'); if (confirm(`Delete ${ids.length} read notification${ids.length === 1 ? '' : 's'}?`)) void deleteNotifs(ids); };
  document.getElementById('notif-more').onclick = () => void loadNotifications(false);
  renderNotifPage();
  if (!notif.loaded) void loadNotifications(true);
  const prefs = document.getElementById('notif-prefs');
  const fillPrefs = async () => { const body = document.getElementById('notif-prefs-body'); try { if (!notif.prefsLoaded) await loadNotifPrefs(); if (body) { body.innerHTML = notifPrefsHtml(); bindNotifPrefs(); } } catch (e) { if (body) body.innerHTML = `<p class="muted">${esc(humanErr(e))}</p>`; } };
  prefs?.addEventListener('toggle', () => { if (prefs.open) void fillPrefs(); });
  if (hasAdminAccess()) { bindNotifAdmin(); void loadNotifStats(); }
}
// </notifications-v79>
// <moderation-ui-v79>
// ---------- Song reporting + admin moderation UI ----------
// Everything that matters is enforced server-side (RPCs, RLS, Storage policy). This file only presents it:
// the browser never decides who is an admin, what a report means, or what the AI said.
const REPORT_REASONS = [
  ['copyright', 'Copyright', 'Uses music, lyrics or artwork the artist may not have rights to'],
  ['hate_harassment', 'Hate or harassment', 'Attacks or demeans people or groups'],
  ['threats', 'Threats or violence', 'Threatens, or encourages harm to, someone'],
  ['explicit', 'Explicit content', 'Sexual or graphic content that is not labelled'],
  ['impersonation', 'Impersonation', 'Pretends to be another artist or person'],
  ['spam', 'Spam or misleading', 'Fake, repetitive or deceptive content'],
  ['other', 'Something else', 'Tell us what is wrong'],
];
const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map(([k, l]) => [k, l]));
let reportDialogOpen = false, myRestrictedSongs = new Set();

function reportErrorMessage(e) {
  const m = String(e?.message || e || '').toLowerCase();
  if (m.includes('sign in')) return 'Please sign in again to report a song.';
  if (m.includes('own song')) return 'You can’t report your own song.';
  if (m.includes('too many')) return 'You’ve sent a lot of reports today. Please try again tomorrow.';
  if (m.includes('not available')) return 'This song is no longer available.';
  if (m.includes('not active')) return 'Your account can’t send reports right now.';
  if (m.includes('describe')) return 'Please tell us what is wrong.';
  if (m.includes('fetch') || m.includes('network')) return 'Couldn’t reach SoundWave. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

function openReportSong(songId, hint = {}) {
  if (reportDialogOpen) return;
  if (!state.user) { toast('Sign in to report a song.', true); return; }
  const id = Number(songId); if (!Number.isFinite(id) || id <= 0) return;
  const song = songById(id);
  const title = song?.song_title || hint.title || 'this song', artist = song?.album?.artist?.artist_name || hint.artist || '';
  const opener = document.activeElement;
  reportDialogOpen = true;
  const dlg = document.createElement('dialog');
  dlg.className = 'sw-modal report-dialog'; dlg.setAttribute('aria-labelledby', 'report-title');
  dlg.innerHTML = `<form id="report-form" novalidate>
    <header class="report-head"><div><h3 id="report-title">Report song</h3><p class="muted">${esc(title)}${artist ? ` · ${esc(artist)}` : ''}</p></div><button type="button" class="report-x" data-report-cancel aria-label="Close">${icon('close')}</button></header>
    <div class="report-body">
      <fieldset class="report-reasons" id="report-reasons"><legend>What’s wrong with it?</legend>${REPORT_REASONS.map(([k, l, d], i) => `<label class="report-reason"><input type="radio" name="reason" value="${k}" ${i === 0 ? 'required' : ''}><span><strong>${esc(l)}</strong><small>${esc(d)}</small></span></label>`).join('')}</fieldset>
      <label class="single-field report-details"><div class="report-details-head"><span>Details <span class="muted" id="report-optional">(optional)</span></span><small class="muted"><span id="report-count">0</span>/1000</small></div><textarea id="report-description" maxlength="1000" rows="3" placeholder="Anything that helps us review it, like the lyric or timestamp"></textarea></label>
      <p class="report-error" id="report-error" role="alert" hidden></p>
      <p class="muted report-fineprint">Reports are reviewed by the SoundWave team. The artist isn’t told who reported them.</p>
    </div>
    <div class="report-actions"><button type="button" class="button secondary" data-report-cancel>Cancel</button><button type="submit" class="button" id="report-submit">Send report</button></div>
  </form>`;
  document.body.appendChild(dlg);
  document.body.classList.add('modal-open');
  const form = dlg.querySelector('#report-form'), err = dlg.querySelector('#report-error'), submit = dlg.querySelector('#report-submit'), desc = dlg.querySelector('#report-description');
  const showErr = (m) => { err.textContent = m; err.hidden = !m; };
  const close = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { document.body.classList.remove('modal-open'); reportDialogOpen = false; try { if (opener && opener.isConnected) opener.focus(); } catch { /* element may be gone */ } dlg.remove(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });   // backdrop click
  dlg.querySelectorAll('[data-report-cancel]').forEach((b) => { b.onclick = close; });
  desc.addEventListener('input', () => { dlg.querySelector('#report-count').textContent = String(desc.value.length); });
  dlg.querySelectorAll('input[name="reason"]').forEach((r) => r.addEventListener('change', () => { dlg.querySelector('#report-optional').textContent = r.value === 'other' ? '(required)' : '(optional)'; showErr(''); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); showErr('');
    const reason = form.querySelector('input[name="reason"]:checked')?.value, text = desc.value.trim();
    if (!reason) { showErr('Choose a reason.'); form.querySelector('input[name="reason"]')?.focus(); return; }
    if (reason === 'other' && text.length < 5) { showErr('Please tell us what is wrong (at least a few words).'); desc.focus(); return; }
    if (text.length > 1000) { showErr('Details must be 1000 characters or fewer.'); return; }
    submit.disabled = true; submit.textContent = 'Sending…'; form.querySelector('#report-reasons').disabled = true; desc.disabled = true;
    try {
      const res = check(await db.rpc('sw_report_song', { p_song_id: id, p_reason: reason, p_description: text || null }));
      const dup = res?.status === 'duplicate';
      form.innerHTML = `<div class="report-done" role="status"><div class="report-done-icon" aria-hidden="true">${icon('check')}</div><h3>${dup ? 'Already reported' : 'Thanks for letting us know'}</h3><p class="muted">${dup ? 'You’ve already reported this song. Our team will take it from here.' : 'We’ve received your report and the team will review it.'}</p><button type="button" class="button" id="report-done">Done</button></div>`;
      const done = form.querySelector('#report-done'); done.onclick = close; done.focus();
      // Ask the server to assess the case. Failure is silent: the case just waits for a human.
      if (!dup && res?.case_id) { try { void db.functions.invoke('moderate-song-case', { body: { case_id: res.case_id } }).catch(() => { }); } catch { /* ignore */ } }
    } catch (ex) {
      submit.disabled = false; submit.textContent = 'Send report'; form.querySelector('#report-reasons').disabled = false; desc.disabled = false;
      showErr(reportErrorMessage(ex));
    }
  });
  dlg.showModal();
  dlg.querySelector('input[name="reason"]')?.focus();
}
// one delegated handler serves the track menu, player bar, mobile now-playing sheet and queue rows
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-report-song]'); if (!b) return;
  e.preventDefault(); e.stopPropagation(); document.querySelector('.song-action-popover')?.remove();
  openReportSong(Number(b.dataset.reportSong), { title: b.dataset.reportTitle, artist: b.dataset.reportArtist });
}, true);

async function loadMyRestrictions() {
  if (!db || !state.user) return;
  try { const rows = check(await db.rpc('sw_my_song_restrictions')) || []; myRestrictedSongs = new Set(rows.map((r) => Number(r.song_id))); }
  catch (e) { console.info('Restriction list unavailable', e); }
}
const restrictedPillHtml = (songId) => myRestrictedSongs.has(Number(songId)) ? '<span class="status-pill inactive" title="This song is restricted and can’t be played right now">Restricted</span>' : '';

// ---------------- admin: Song reports page
const MOD_FILTERS = [['pending', 'Open'], ['top_reported', 'Most reported'], ['ai_flagged', 'AI flagged'], ['high_severity', 'High severity'], ['restricted', 'Restricted'], ['repeat_offenders', 'Repeat offenders'], ['resolved', 'Resolved'], ['all', 'All']];
const MOD_SORTS = [['recent', 'Newest first'], ['oldest', 'Oldest first'], ['reports', 'Most reporters'], ['severity', 'AI severity']];
const AI_SOURCE_LABEL = { title: 'Title', description: 'Description', lyrics: 'Lyrics', report_text: 'Reporter text' };
const modState = { filter: 'pending', sort: 'recent', search: '', page: 0, pageSize: 20, rows: [], total: 0, summary: null, loading: false, error: '', req: 0, timer: null };
const modWhen = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const modPct = (n) => (n == null ? '' : `${Math.round(Number(n) * 100)}%`);
function modAiSummary(r) {
  if (r.ai_status === 'done') return `AI: ${esc(REASON_LABEL[r.ai_category] || r.ai_category || 'none')} · ${esc(r.ai_severity)} · ${modPct(r.ai_confidence)}`;
  return { failed: 'AI: failed', insufficient_evidence: 'AI: not enough evidence', none: 'AI: not run yet' }[r.ai_status] || 'AI: not run yet';
}
function modRowHtml(r) {
  return `<button type="button" class="mod-row" data-mod-case="${Number(r.case_id)}"><span class="mod-main"><strong>${esc(r.song_title)}</strong><small>${esc(r.artist_name || 'Unknown artist')}</small></span><span class="mod-meta"><span class="mod-pill s-${esc(r.status)}">${esc(r.status)}</span>${r.restricted ? '<span class="mod-pill s-restricted">restricted</span>' : ''}<span>${Number(r.distinct_reporters)} reporter${Number(r.distinct_reporters) === 1 ? '' : 's'}</span><span>${esc(REASON_LABEL[r.top_reason] || r.top_reason || '')}</span><span class="muted">${modAiSummary(r)}</span><span class="muted">${esc(modWhen(r.created_at))}</span></span></button>`;
}
function paintModeration() {
  const s = modState.summary, tiles = document.getElementById('mod-tiles');
  if (tiles && s) {
    const tile = (k, label, n) => `<button type="button" class="mod-tile ${modState.filter === k ? 'active' : ''}" data-mod-filter="${k}"><b>${Number(n) || 0}</b><span>${label}</span></button>`;
    tiles.innerHTML = tile('pending', 'Open', s.pending) + tile('high_severity', 'High severity', s.high_severity) + tile('ai_flagged', 'AI flagged', s.ai_flagged) + tile('restricted', 'Restricted now', s.restricted) + tile('repeat_offenders', 'Repeat offenders', s.repeat_offenders) + tile('resolved', 'Resolved', s.resolved);
  }
  document.querySelectorAll('[data-mod-filter]').forEach((b) => { b.onclick = () => { modState.filter = b.dataset.modFilter; modState.page = 0; void loadModeration(); }; });
  document.querySelectorAll('[data-mod-chip]').forEach((b) => { const on = b.dataset.modChip === modState.filter; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); b.onclick = () => { modState.filter = b.dataset.modChip; modState.page = 0; void loadModeration(); }; });
  const list = document.getElementById('mod-list'); if (!list) return;
  list.innerHTML = modState.error ? `<div class="notif-empty"><p>${esc(modState.error)}</p><button type="button" class="button secondary" id="mod-retry">Try again</button></div>`
    : modState.loading && !modState.rows.length ? '<div class="notif-empty"><p>Loading cases…</p></div>'
      : modState.rows.length ? modState.rows.map(modRowHtml).join('') : '<div class="notif-empty"><p>No cases match this view.</p></div>';
  document.getElementById('mod-retry')?.addEventListener('click', () => void loadModeration());
  list.querySelectorAll('[data-mod-case]').forEach((b) => { b.onclick = () => void openCaseDetail(Number(b.dataset.modCase)); });
  const pager = document.getElementById('mod-pager');
  if (pager) {
    const from = modState.total ? modState.page * modState.pageSize + 1 : 0, to = Math.min(modState.total, (modState.page + 1) * modState.pageSize);
    pager.innerHTML = `<span class="muted">${modState.total ? `${from}–${to} of ${modState.total}` : ''}</span><span><button type="button" class="button secondary" id="mod-prev" ${modState.page === 0 ? 'disabled' : ''}>Previous</button> <button type="button" class="button secondary" id="mod-next" ${to >= modState.total ? 'disabled' : ''}>Next</button></span>`;
    document.getElementById('mod-prev').onclick = () => { modState.page = Math.max(0, modState.page - 1); void loadModeration(); };
    document.getElementById('mod-next').onclick = () => { modState.page += 1; void loadModeration(); };
  }
}
async function loadModeration() {
  const my = ++modState.req; modState.loading = true; modState.error = ''; paintModeration();
  try {
    let [sum, rows] = await Promise.all([
      db.rpc('sw_admin_moderation_summary'),
      db.rpc('sw_admin_moderation_cases', { p_filter: modState.filter, p_search: modState.search || null, p_sort: modState.sort, p_limit: modState.pageSize, p_offset: modState.page * modState.pageSize }),
    ]);
    if (sum?.error || rows?.error) {
      // If error is permission-related and user does not have admin access, bail
      if (!hasAdminAccess()) throw (sum?.error || rows?.error);
    }
    if (my !== modState.req) return;   // a newer request superseded this one

    if (sum?.error || rows?.error) {
      console.warn('Moderation RPC failed, using table fallback:', sum?.error || rows?.error);
      const query = db.from('song_moderation_cases').select('*', { count: 'exact' });
      if (modState.filter === 'pending') query.in('status', ['pending', 'review', 'priority']);
      else if (modState.filter === 'resolved') query.in('status', ['confirmed', 'dismissed']);
      else if (modState.filter === 'high_severity') query.in('ai_severity', ['high', 'critical']);
      if (modState.search) {
        query.or(`song_title.ilike.%${modState.search}%,artist_name.ilike.%${modState.search}%`);
      }
      query.order('created_at', { ascending: false }).range(modState.page * modState.pageSize, (modState.page + 1) * modState.pageSize - 1);
      const direct = await query;
      if (direct.error) throw direct.error;
      const allCases = (await db.from('song_moderation_cases').select('status, ai_severity'))?.data || [];
      modState.summary = {
        pending: allCases.filter(c => ['pending', 'review', 'priority'].includes(c.status)).length,
        priority: allCases.filter(c => c.status === 'priority').length,
        ai_flagged: allCases.filter(c => ['medium', 'high', 'critical'].includes(c.ai_severity)).length,
        high_severity: allCases.filter(c => c.status === 'priority' || ['high', 'critical'].includes(c.ai_severity)).length,
        restricted: 0,
        resolved: allCases.filter(c => ['confirmed', 'dismissed'].includes(c.status)).length,
        repeat_offenders: 0
      };
      modState.rows = direct.data || [];
      modState.total = direct.count ?? modState.rows.length;
    } else {
      modState.summary = check(sum);
      const data = check(rows) || [];
      modState.rows = data;
      modState.total = data.length ? Number(data[0].total_count) : 0;
    }
    if (!modState.rows.length && modState.page > 0) { modState.page = 0; modState.loading = false; return void loadModeration(); }
  } catch (e) {
    if (my !== modState.req) return;
    modState.error = humanErr(e);
    modState.rows = [];
    modState.total = 0;
  }
  modState.loading = false; paintModeration();
}

function modCaseDialog(d) {
  const c = d.case, open = ['pending', 'review', 'priority'].includes(c.status);
  const songR = d.song_restriction && d.song_restriction.restricted && (!d.song_restriction.restricted_until || new Date(d.song_restriction.restricted_until) > new Date());
  const albumR = d.album_restriction && d.album_restriction.restricted && (!d.album_restriction.restricted_until || new Date(d.album_restriction.restricted_until) > new Date());
  const ev = Array.isArray(c.ai_evidence) ? c.ai_evidence : [];
  const ai = c.ai_status === 'done' || c.ai_status === 'insufficient_evidence'
    ? `<dl class="mod-ai"><div><dt>Category</dt><dd>${esc(REASON_LABEL[c.ai_category] || c.ai_category || 'none')}</dd></div><div><dt>Severity</dt><dd>${esc(c.ai_severity)}</dd></div><div><dt>Confidence</dt><dd>${modPct(c.ai_confidence)}</dd></div><div><dt>Recommends</dt><dd>${esc(c.ai_recommended_action)}</dd></div><div><dt>Human review</dt><dd>${c.ai_human_review_needed ? 'needed' : 'not flagged'}</dd></div><div><dt>Model</dt><dd>${esc(c.ai_model || '')}</dd></div></dl>
       <p class="muted">Evidence the AI was given: ${(c.ai_evidence_sources || []).map((s) => esc(AI_SOURCE_LABEL[s] || s)).join(', ') || 'none'}. It cannot hear audio.</p>
       ${c.ai_status === 'insufficient_evidence' ? '<p class="mod-warn">The AI raised a concern but cited no verifiable evidence, so no automatic action was taken.</p>' : ''}
       ${ev.length ? `<ul class="mod-evidence">${ev.map((x) => `<li><b>${esc(AI_SOURCE_LABEL[x.source] || x.source)}</b> “${esc(x.quote)}”</li>`).join('')}</ul>` : ''}`
    : `<p class="muted">${c.ai_status === 'failed' ? `AI assessment failed (${esc(String(c.ai_error || 'unknown').slice(0, 120))}). The case is waiting for a human decision.` : 'No AI assessment yet.'}</p>`;
  const btn = (act, label, cls = '') => `<button type="button" class="button ${cls}" data-mod-act="${act}">${label}</button>`;
  const actions = [
    open ? btn('confirm', 'Confirm violation') + btn('dismiss', 'Dismiss', 'secondary') : '',
    open && c.status === 'pending' ? btn('request_review', 'Request review', 'secondary') : '',
    c.song_id && !songR ? btn('restrict_song', 'Restrict song', 'danger') : '', songR ? btn('restore_song', 'Restore song', 'secondary') : '',
    c.song_id && !albumR ? btn('restrict_album', 'Restrict album', 'danger') : '', albumR ? btn('restore_album', 'Restore album', 'secondary') : '',
    btn('suspend_account', 'Suspend account', 'danger'), btn('restore_account', 'Restore account', 'secondary'),
    open ? btn('run_ai', 'Run AI assessment', 'secondary') : '', btn('note', 'Add note', 'secondary'),
  ].join('');
  return `<header class="report-head"><div><h3 id="mod-title">${esc(c.song_title)}</h3><p class="muted">${esc(c.artist_name || 'Unknown artist')} · <span class="mod-pill s-${esc(c.status)}">${esc(c.status)}</span>${d.restricted_now ? ' <span class="mod-pill s-restricted">restricted</span>' : ''}</p></div><button type="button" class="report-x" data-mod-close aria-label="Close">${icon('close')}</button></header>
  <div class="mod-dialog-scroll">
  <section class="mod-sec"><h4>Reports (${d.reports.length})</h4>${d.reports.length ? `<ul class="mod-reports">${d.reports.map((r) => `<li><b>${esc(REASON_LABEL[r.reason] || r.reason)}</b> · ${esc(r.reporter || 'user')} <span class="muted">${esc(modWhen(r.created_at))}</span>${r.description ? `<p>${esc(r.description)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="muted">None.</p>'}</section>
  <section class="mod-sec"><h4>AI assessment</h4>${ai}</section>
  <section class="mod-sec"><h4>Artist history</h4><p class="muted">${Number(d.artist_cases?.total || 0)} other case(s), ${Number(d.artist_cases?.confirmed || 0)} confirmed.</p></section>
  <section class="mod-sec"><h4>Decision history</h4>${d.history.length ? `<ul class="mod-history">${d.history.map((h) => `<li><b>${esc(String(h.action).replace('moderation.', '').replace(/_/g, ' '))}</b> <span class="muted">${esc(modWhen(h.at))}</span>${h.details?.note ? `<p>${esc(h.details.note)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="muted">No decisions yet.</p>'}${c.resolution_note ? `<p><b>Resolution:</b> ${esc(c.resolution_note)}</p>` : ''}</section>
  <section class="mod-sec"><label class="single-field">Note <span class="muted">(required to confirm, dismiss, restrict or suspend)</span><textarea id="mod-note" rows="2" maxlength="1000" placeholder="Why are you taking this action?"></textarea></label><p class="report-error" id="mod-error" role="alert" hidden></p><div class="mod-actions">${actions}</div></section>
  </div>`;
}
const MOD_NOTE_REQUIRED = ['note', 'dismiss', 'confirm', 'restrict_song', 'restrict_album', 'suspend_account'];
const MOD_CONFIRM_TEXT = {
  restrict_song: (c) => `Restrict “${c.song_title}”?\n\nIt will be hidden and unplayable for everyone except admins until you restore it. The artist will be notified.`,
  restrict_album: (c) => `Restrict the whole album containing “${c.song_title}”?\n\nEvery song in it becomes hidden and unplayable until you restore it. The artist will be notified.`,
  suspend_account: (c) => `Suspend ${c.artist_name || 'this artist'}’s whole account?\n\nThey will lose access until you restore it. This is recorded in the audit log.`,
};
async function openCaseDetail(caseId) {
  let dlg = document.getElementById('mod-dialog');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'mod-dialog'; dlg.className = 'sw-modal report-dialog mod-dialog'; dlg.setAttribute('aria-labelledby', 'mod-title'); document.body.appendChild(dlg); dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); dlg.addEventListener('close', () => { document.body.classList.remove('modal-open'); dlg.remove(); void loadModeration(); }); }
  document.body.classList.add('modal-open');
  dlg.innerHTML = '<div class="notif-empty"><p>Loading case…</p></div>'; if (!dlg.open) dlg.showModal();
  const render = async () => {
    let d;
    try {
      d = check(await db.rpc('sw_admin_case_detail', { p_case_id: caseId }));
    } catch (e) {
      console.warn('sw_admin_case_detail failed, attempting direct table fallback:', e);
      try {
        const caseRes = await db.from('song_moderation_cases').select('*').eq('case_id', caseId).maybeSingle();
        if (!caseRes.data) throw e;
        const songRes = caseRes.data.song_id ? await db.from('song').select('song_id, song_title, album_id, is_active').eq('song_id', caseRes.data.song_id).maybeSingle() : { data: null };
        const repRes = await db.from('song_reports').select('*').eq('case_id', caseId);
        d = {
          case: caseRes.data,
          song: songRes.data,
          song_restriction: null,
          album_restriction: null,
          restricted_now: false,
          reports: (repRes.data || []).map(r => ({ report_id: r.report_id, reason: r.reason, description: r.description, created_at: r.created_at, reporter: 'User' })),
          artist_cases: { total: 0, confirmed: 0 },
          history: []
        };
      } catch (fallbackErr) {
        dlg.innerHTML = `<div class="notif-empty"><p>${esc(humanErr(e))}</p><button type="button" class="button secondary" data-mod-close>Close</button></div>`;
        dlg.querySelector('[data-mod-close]').onclick = () => dlg.close();
        return;
      }
    }
    dlg.innerHTML = modCaseDialog(d);
    const err = dlg.querySelector('#mod-error'), showErr = (m) => { err.textContent = m; err.hidden = !m; };
    dlg.querySelector('[data-mod-close]').onclick = () => dlg.close();
    dlg.querySelectorAll('[data-mod-act]').forEach((b) => {
      b.onclick = async () => {
        const act = b.dataset.modAct, note = dlg.querySelector('#mod-note').value.trim(); showErr('');
        if (MOD_NOTE_REQUIRED.includes(act) && note.length < 3) { showErr('Add a short note (at least 3 characters) for this action.'); dlg.querySelector('#mod-note').focus(); return; }
        if (MOD_CONFIRM_TEXT[act] && !confirm(MOD_CONFIRM_TEXT[act](d.case))) return;
        dlg.querySelectorAll('[data-mod-act]').forEach((x) => { x.disabled = true; });
        try {
          if (act === 'run_ai') {
            const r = await db.functions.invoke('moderate-song-case', { body: { case_id: caseId, force: true } });
            if (r.error) throw r.error;
            toast(r.data?.status === 'assessed' ? 'AI assessment updated.' : `AI assessment: ${r.data?.reason || r.data?.status || 'no result'}.`);
          } else {
            let res = await db.rpc('sw_admin_moderate_case', {
              p_case_id: caseId,
              p_action: act,
              p_note: note || null,
              p_params: { confirmed: true }
            });
            if (res.error) {
              console.warn('sw_admin_moderate_case failed, attempting admin fallback:', res.error);
              if (hasAdminAccess()) {
                let ok = false;
                const now = new Date().toISOString();
                if (act === 'confirm' || act === 'dismiss') {
                  const status = act === 'confirm' ? 'confirmed' : 'dismissed';
                  const r = await db.from('song_moderation_cases').update({
                    status,
                    resolved_by: state.user?.id,
                    resolved_at: now,
                    resolution_note: note || null,
                    updated_at: now
                  }).eq('case_id', caseId);
                  if (!r.error) ok = true;
                } else if (act === 'request_review') {
                  const r = await db.from('song_moderation_cases').update({
                    status: 'review',
                    updated_at: now
                  }).eq('case_id', caseId);
                  if (!r.error) ok = true;
                } else if (act === 'restrict_song' && d.case.song_id) {
                  await db.from('song').update({ is_active: false }).eq('song_id', d.case.song_id);
                  const r = await db.from('song_moderation_state').upsert({
                    song_id: d.case.song_id,
                    restricted: true,
                    source: 'admin',
                    reason: note || null,
                    case_id: caseId,
                    restricted_by: state.user?.id
                  });
                  if (!r.error) ok = true;
                } else if (act === 'restore_song' && d.case.song_id) {
                  await db.from('song').update({ is_active: true }).eq('song_id', d.case.song_id);
                  const r = await db.from('song_moderation_state').update({
                    restricted: false,
                    restored_at: now,
                    restored_by: state.user?.id
                  }).eq('song_id', d.case.song_id);
                  if (!r.error) ok = true;
                } else if (act === 'restrict_album' && d.song?.album_id) {
                  await db.from('album').update({ is_active: false }).eq('album_id', d.song.album_id);
                  const r = await db.from('album_moderation_state').upsert({
                    album_id: d.song.album_id,
                    restricted: true,
                    source: 'admin',
                    reason: note || null,
                    case_id: caseId,
                    restricted_by: state.user?.id
                  });
                  if (!r.error) ok = true;
                } else if (act === 'restore_album' && d.song?.album_id) {
                  await db.from('album').update({ is_active: true }).eq('album_id', d.song.album_id);
                  const r = await db.from('album_moderation_state').update({
                    restricted: false,
                    restored_at: now,
                    restored_by: state.user?.id
                  }).eq('album_id', d.song.album_id);
                  if (!r.error) ok = true;
                } else if (act === 'suspend_account' && d.case.artist_user_id) {
                  let r = await db.rpc('admin_set_account_active_v31', { p_user_id: d.case.artist_user_id, p_active: false });
                  if (r.error) r = await db.from('users').update({ is_active: false }).eq('user_id', d.case.artist_user_id);
                  if (!r.error) ok = true;
                } else if (act === 'restore_account' && d.case.artist_user_id) {
                  let r = await db.rpc('admin_set_account_active_v31', { p_user_id: d.case.artist_user_id, p_active: true });
                  if (r.error) r = await db.from('users').update({ is_active: true }).eq('user_id', d.case.artist_user_id);
                  if (!r.error) ok = true;
                } else if (act === 'note') {
                  const r = await db.from('song_moderation_cases').update({
                    resolution_note: note || null,
                    updated_at: now
                  }).eq('case_id', caseId);
                  if (!r.error) ok = true;
                }
                if (!ok) throw res.error;
              } else {
                throw res.error;
              }
            }
            toast('Done.');
          }
          await render();
        } catch (e) { showErr(humanErr(e)); dlg.querySelectorAll('[data-mod-act]').forEach((x) => { x.disabled = false; }); }
      };
    });
  };
  await render();
}

const MOD_SETTING_META = {
  review_threshold: ['Review threshold', 'number', 2, 50], priority_threshold: ['Priority threshold', 'number', 2, 100], report_daily_limit: ['Reports per user per day', 'number', 1, 200],
  auto_restrict_enabled: ['Allow automatic temporary restriction', 'boolean'], auto_restrict_min_confidence: ['Min AI confidence (0.5–1)', 'number', 0.5, 1],
  auto_restrict_min_severity: ['Min AI severity', 'severity'], temp_restrict_hours: ['Temporary restriction (hours)', 'number', 1, 720],
  escalate_artist_after: ['Repeat-offender threshold', 'number', 2, 50], escalate_window_days: ['Repeat-offender window (days)', 'number', 1, 730], ai_min_interval_minutes: ['Min minutes between AI runs', 'number', 0, 1440],
};
async function loadModSettings() {
  const body = document.getElementById('mod-settings-body'); if (!body) return;
  try {
    let rows = [];
    try { rows = check(await db.rpc('sw_admin_moderation_settings')) || []; }
    catch {
      const direct = await db.from('moderation_settings').select('key, value, description');
      if (direct.data) rows = direct.data;
    }
    body.innerHTML = rows.filter((r) => MOD_SETTING_META[r.key]).map((r) => {
      const [label, kind, min, max] = MOD_SETTING_META[r.key], v = r.value;
      const input = kind === 'boolean' ? `<input type="checkbox" role="switch" data-mod-setting="${r.key}" ${v === true ? 'checked' : ''}>`
        : kind === 'severity' ? `<select data-mod-setting="${r.key}">${['medium', 'high', 'critical'].map((s) => `<option ${v === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`
          : `<input type="number" data-mod-setting="${r.key}" value="${esc(v)}" min="${min}" max="${max}" step="${r.key === 'auto_restrict_min_confidence' ? '0.01' : '1'}">`;
      return `<div class="mod-setting"><span><strong>${esc(label)}</strong><small>${esc(r.description || '')}</small></span>${input}<button type="button" class="button secondary" data-mod-save="${r.key}">Save</button></div>`;
    }).join('');
    body.querySelectorAll('[data-mod-save]').forEach((b) => {
      b.onclick = () => {
        const key = b.dataset.modSave, el = body.querySelector(`[data-mod-setting="${key}"]`), kind = MOD_SETTING_META[key][1];
        const value = kind === 'boolean' ? el.checked : kind === 'severity' ? el.value : Number(el.value);
        if (kind === 'number' && (el.value.trim() === '' || !Number.isFinite(value))) return toast('Enter a number.', true);
        if (key === 'auto_restrict_enabled' && value === true && !confirm('Allow the system to TEMPORARILY restrict songs when the AI is highly confident about serious content? Restrictions expire on their own and you can restore them at any time. Accounts are never suspended automatically.')) { el.checked = false; return; }
        action(async () => {
          let res = await db.rpc('sw_admin_update_moderation_setting', { p_key: key, p_value: value });
          if (res.error) {
            const up = await db.from('moderation_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
            if (up.error) throw res.error;
          }
          toast('Setting saved.');
          await loadModSettings();
        });
      };
    });
  } catch (e) { body.innerHTML = `<p class="muted">${esc(humanErr(e))}</p>`; }
}
function songReportsPage() {
  if (!hasAdminAccess()) return discoverPage();
  shell(`<section class="mod-page"><nav class="admin-tabbar" aria-label="Moderation sections" style="margin-bottom:1.5rem"><button type="button" data-nav-admin-tab="accounts">Accounts</button><button type="button" data-nav-admin-tab="artists">Artists</button><button type="button" data-nav-admin-tab="songs">Albums → Songs</button><button type="button" data-nav-admin-tab="podcasts">Podcasts</button><button type="button" class="active">${icon('flag')} Song reports</button></nav>
    <div class="mod-tiles" id="mod-tiles" aria-label="Moderation summary"></div>
    <div class="notif-toolbar"><div class="notif-chips" role="group" aria-label="Filter cases">${MOD_FILTERS.map(([k, l]) => `<button type="button" class="notif-chip" data-mod-chip="${k}" aria-pressed="${modState.filter === k}">${l}</button>`).join('')}</div>
    <div class="mod-controls"><input type="search" id="mod-search" placeholder="Search song or artist" value="${esc(modState.search)}" aria-label="Search cases"><select id="mod-sort" aria-label="Sort cases">${MOD_SORTS.map(([k, l]) => `<option value="${k}" ${modState.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div class="notif-list notif-list-page" id="mod-list" role="list"></div><div class="mod-pager" id="mod-pager"></div>
    <details class="notif-card" id="mod-settings"><summary>Moderation settings</summary><div id="mod-settings-body"><p class="muted">Loading…</p></div></details></section>`, 'Song reports');
  document.querySelectorAll('[data-nav-admin-tab]').forEach((b) => {
    b.onclick = () => { state.adminTab = b.dataset.navAdminTab; navigate('admin'); };
  });
  document.getElementById('mod-search').addEventListener('input', (e) => { clearTimeout(modState.timer); const v = e.target.value; modState.timer = setTimeout(() => { modState.search = v.trim(); modState.page = 0; void loadModeration(); }, 300); });
  document.getElementById('mod-sort').addEventListener('change', (e) => { modState.sort = e.target.value; modState.page = 0; void loadModeration(); });
  document.getElementById('mod-settings').addEventListener('toggle', (e) => { if (e.target.open) void loadModSettings(); });
  void loadModeration();
}
// </moderation-ui-v79>

// <crowdqueue-v79>
// ---------- CrowdQueue Premium (collaborative listening sessions) ----------
const crowdQueue = {
  session: null,
  publicSessions: [],
  loading: false,
  error: '',
  channel: null,
  lastSyncVersion: 0,
  clockBias: null,
  searchResults: [],
  searchTimer: null
};

function cleanupCrowdQueue() {
  cqStopTimers();
  crowdQueue.clockBias = null;
  if (crowdQueue.channel && db) {
    db.removeChannel(crowdQueue.channel);
    crowdQueue.channel = null;
  }
  crowdQueue.session = null;
  crowdQueue.publicSessions = [];
  crowdQueue.loading = false;
  crowdQueue.error = '';
  crowdQueue.lastSyncVersion = 0;
  crowdQueue.searchResults = [];
  clearTimeout(crowdQueue.searchTimer);
}

async function loadMyActiveCrowdQueueSession() {
  if (!db || !state.user) return;
  try {
    const res = await db.rpc('sw_cq_my_active_session');
    if (res.error) {
      console.warn('loadMyActiveCrowdQueueSession error:', res.error);
      return;
    }
    if (res.data && res.data.session_id) {
      crowdQueue.session = res.data;
      crowdQueue.lastSyncVersion = res.data.playback?.version || 0;
      setupCrowdQueueRealtime(res.data.session_id);
      // A listener who joins (or reloads) mid-song starts in step with the host straight away.
      if (!res.data.is_host && res.data.playback?.current_song_id) void cqApplyPlayback(res.data.playback, { initial: true });
      if (state.page === 'crowdqueue') render();
    } else {
      crowdQueue.session = null;
    }
  } catch (e) {
    console.warn('loadMyActiveCrowdQueueSession failed:', e);
  }
}

/* ====== CrowdQueue soft refresh ======
   shell() rebuilds the ENTIRE app (top bar, library, page, sidebar, player bar) with innerHTML. CrowdQueue used to call
   render() on every vote / queue / participant / playback event, and one vote fires several of them in a row, so the
   whole screen was torn down and redrawn again and again: the blinking. Now events only patch the parts of the DOM that
   actually changed (a vote changes one number), nothing is touched when nothing changed, and typed text, focus,
   scroll position and open menus survive. */
function cqHasOwnText(el) { return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''); }
function cqSyncAttrs(a, b) {
  const live = (el, name) => el.tagName === 'DETAILS' && name === 'open'; // user-toggled, not in the markup
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name) && !live(a, at.name)) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value && !live(a, at.name)) a.setAttribute(at.name, at.value);
}
function cqMorph(a, b, depth = 0) {
  if (a.outerHTML === b.outerHTML) return;
  if (a.tagName !== b.tagName) { a.replaceWith(b); return; }
  cqSyncAttrs(a, b);
  const leaf = ['SELECT', 'TEXTAREA', 'INPUT', 'BUTTON', 'svg', 'SVG'].includes(a.tagName);
  if (depth > 8 || leaf || a.children.length !== b.children.length || cqHasOwnText(a) || cqHasOwnText(b)) {
    if (a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML; return;
  }
  if (!a.children.length) { if (a.textContent !== b.textContent) a.textContent = b.textContent; return; }
  // Snapshot both child lists first: cqMorph may replaceWith() a node, which moves it out of its parent
  // and would shift every live index after it (that mismatch produced duplicated Pause/Next buttons).
  const aKids = Array.from(a.children), bKids = Array.from(b.children);
  for (let i = 0; i < aKids.length; i++) cqMorph(aKids[i], bKids[i], depth + 1);
}
function cqSoftRail() {
  const rail = document.getElementById('context-rail'), box = rail?.querySelector(':scope > .cq-rail-container');
  if (!rail || !box || !(crowdQueue.session && crowdQueue.session.status === 'active')) return;
  const html = railHtml(); if (rail._cqSig === html) return;
  const tpl = document.createElement('template'); tpl.innerHTML = html.trim();
  const fresh = tpl.content.firstElementChild; if (!fresh || !fresh.classList.contains('cq-rail-container')) return;
  cqMorph(box, fresh); rail._cqSig = html; bindRail();
}
let cqSoftTimer = 0;
function cqSoftRender(immediate) {
  clearTimeout(cqSoftTimer);
  if (immediate) { cqSoftRenderNow(); return; }
  cqSoftTimer = setTimeout(cqSoftRenderNow, 90); // events arrive in bursts: coalesce them into one patch
}
function cqSoftRenderNow() {
  cqSoftTimer = 0;
  if (!state.user) return;
  const live = Boolean(crowdQueue.session && crowdQueue.session.status === 'active');
  if (state.page === 'crowdqueue') {
    const root = document.getElementById('cq-active-session');
    if (!live || !root) { render(); return; } // lobby <-> room is a real page change: full render
    const tpl = document.createElement('template'); tpl.innerHTML = crowdQueueActiveHtml().trim();
    const fresh = tpl.content.firstElementChild;
    if (fresh) { cqMorph(root, fresh); bindCrowdQueueEvents(); }
  }
  cqSoftRail();
}

function setupCrowdQueueRealtime(sessionId) {
  if (!db || !sessionId) return;
  if (crowdQueue.channel) {
    db.removeChannel(crowdQueue.channel);
    crowdQueue.channel = null;
  }
  const sid = Number(sessionId);
  crowdQueue.channel = db.channel(`soundwave-crowdqueue-${sid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crowdqueue_sessions', filter: `session_id=eq.${sid}` }, (payload) => {
      const row = payload.new || {};
      if (row.status === 'closed') {
        toast('This CrowdQueue session has ended.');
        cleanupCrowdQueue();
        if (state.page === 'crowdqueue') render();
        return;
      }
      if (crowdQueue.session && row.order_mode) {
        crowdQueue.session.order_mode = row.order_mode;
        crowdQueue.session.session_name = row.session_name || crowdQueue.session.session_name;
        cqSoftRender();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crowdqueue_participants', filter: `session_id=eq.${sid}` }, () => {
      void refreshCrowdQueueSession(sid);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crowdqueue_queue', filter: `session_id=eq.${sid}` }, () => {
      void refreshCrowdQueueSession(sid);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'crowdqueue_votes', filter: `session_id=eq.${sid}` }, () => {
      void refreshCrowdQueueSession(sid);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crowdqueue_playback', filter: `session_id=eq.${sid}` }, (payload) => {
      handleCrowdQueuePlaybackUpdate(payload.new);
    })
    .subscribe((status) => {
      // If the realtime socket drops, reconnect and catch up on whatever was missed.
      if (status === 'SUBSCRIBED') {
        if (crowdQueue._wasDown) { crowdQueue._wasDown = false; void cqResync({ quiet: true }); }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        crowdQueue._wasDown = true;
        cqSync.state = 'reconnecting'; cqSoftRender();
        clearTimeout(crowdQueue._retryTimer);
        crowdQueue._retryTimer = setTimeout(() => { if (crowdQueue.session && crowdQueue.session.session_id === sid) setupCrowdQueueRealtime(sid); }, 3000);
      }
    });
  cqStartTimers(sid);
}

async function refreshCrowdQueueSession(sessionId) {
  if (!db || !sessionId) return;
  try {
    const res = await db.rpc('sw_cq_get_session', { p_session_id: Number(sessionId) });
    if (!res.error && res.data) {
      crowdQueue.session = res.data;
      cqSoftRender();
    }
  } catch (e) {
    console.warn('Failed to refresh CrowdQueue session:', e);
  }
}

/* ====== CrowdQueue playback sync (listeners follow the host) ======
   - The host re-broadcasts its position every few seconds (heartbeat), so drift is corrected continuously.
   - Listeners estimate how old each update is (updated_at minus a measured clock bias) and add that elapsed time.
   - A slow poll + visibility/online hooks are a safety net if the realtime socket drops.
   - Only the newest update is ever applied, so rapid host skips cannot make a listener play an old song. */
const cqSync = { state: 'idle', seq: 0, hb: 0, poll: 0, tick: 0, installed: false };

function cqExpectedPosition(pb, receivedAt) {
  const base = Number(pb.position_seconds) || 0;
  if (!pb.is_playing) return base;
  let elapsed = 0;
  const ts = Date.parse(pb.updated_at || pb.position_updated_at || '');
  if (Number.isFinite(ts)) {
    const age = (receivedAt || Date.now()) - ts;
    // The smallest observed age ~ clock difference + network delay; anything above it is real elapsed time.
    if (crowdQueue.clockBias === null || age < crowdQueue.clockBias) crowdQueue.clockBias = age;
    elapsed = Math.min(20, Math.max(0, (Date.now() - ts - crowdQueue.clockBias) / 1000));
  }
  return base + elapsed;
}

async function cqApplyPlayback(pb, opts = {}) {
  const s = crowdQueue.session;
  if (!pb || !s || s.is_host) return;
  const mine = ++cqSync.seq;
  const receivedAt = Date.now();
  const songId = pb.current_song_id ? Number(pb.current_song_id) : null;
  const audio = () => document.getElementById('sw-audio');
  const curSong = () => (state.player?.kind === 'song' ? Number(state.player.id) : null);
  const tryPlay = async (a) => {
    try { await a.play(); cqSync.state = 'synced'; }
    catch (e) { cqSync.state = (e && e.name === 'NotAllowedError') ? 'blocked' : 'out'; }
  };
  try {
    if (!songId) { const a = audio(); if (a && !a.paused) a.pause(); cqSync.state = 'synced'; cqSoftRender(); return; }
    if (curSong() !== songId) {
      cqSync.state = 'syncing'; cqSoftRender();
      await playSong(songId, null, { quiet: true });
      if (mine !== cqSync.seq) return; // a newer update arrived while this song was loading
    }
    const a = audio(); if (!a) return;
    const target = cqExpectedPosition(pb, receivedAt) + (Date.now() - receivedAt) / 1000 * (pb.is_playing ? 1 : 0);
    const drift = a.currentTime - target;
    if (pb.is_playing) {
      if (Math.abs(drift) > (opts.initial || curSong() !== songId ? 0.4 : 1.5) && Number.isFinite(target)) a.currentTime = Math.max(0, target);
      if (a.paused) await tryPlay(a); else cqSync.state = 'synced';
    } else {
      if (!a.paused) a.pause();
      if (Math.abs(drift) > 0.5) a.currentTime = Math.max(0, Number(pb.position_seconds) || 0);
      cqSync.state = 'synced';
    }
  } catch (e) {
    console.warn('CrowdQueue sync failed', e);
    if (mine === cqSync.seq) cqSync.state = 'out';
  }
  cqSoftRender();
}

function handleCrowdQueuePlaybackUpdate(pb, opts = {}) {
  if (!pb || !crowdQueue.session) return;
  const version = Number(pb.version || 0);
  if (version < crowdQueue.lastSyncVersion) return;
  if (version === crowdQueue.lastSyncVersion && !opts.poll) return;
  const isNew = version > crowdQueue.lastSyncVersion;
  crowdQueue.lastSyncVersion = version;
  crowdQueue.session.playback = pb;

  // Host drives playback; don't let their own broadcast interrupt them
  if (crowdQueue.session.is_host) {
    if (isNew) cqSoftRender();
    return;
  }
  void cqApplyPlayback(pb, opts);
}

// Pull the latest state from the server (used by the poll, tab-visible, back-online and the "Sync" button).
async function cqResync(opts = {}) {
  const s = crowdQueue.session;
  if (!db || !s) return;
  try {
    const res = await db.rpc('sw_cq_get_session', { p_session_id: Number(s.session_id) });
    if (res.error || !res.data) return;
    const prevPb = crowdQueue.session?.playback;
    crowdQueue.session = res.data;
    if (!res.data.is_host) {
      if (opts.force) cqSync.state = 'syncing';
      const pb = res.data.playback || prevPb;
      if (pb) {
        if (opts.force) { crowdQueue.lastSyncVersion = Math.min(crowdQueue.lastSyncVersion, Number(pb.version || 0) - 1); }
        handleCrowdQueuePlaybackUpdate(pb, { poll: true });
      }
    }
    cqSoftRender();
  } catch (e) { console.warn('CrowdQueue resync failed', e); }
}

// Host heartbeat: publish the real position so listeners can correct drift.
async function cqHostHeartbeat() {
  const s = crowdQueue.session;
  if (!s || !s.is_host || cqNextBusy) return;
  const pb = s.playback || {};
  const a = document.getElementById('sw-audio');
  if (!a || a.paused || !pb.current_song_id || !pb.is_playing) return;
  if (!(state.player?.kind === 'song' && Number(state.player.id) === Number(pb.current_song_id))) return;
  try {
    const res = await db.rpc('sw_cq_update_playback', {
      p_session_id: Number(s.session_id),
      p_queue_item_id: pb.current_queue_item_id ? Number(pb.current_queue_item_id) : null,
      p_song_id: Number(pb.current_song_id),
      p_is_playing: true,
      p_position_seconds: a.currentTime,
      p_version: pb.version ? Number(pb.version) : null
    });
    if (!res.error && res.data) { s.playback = res.data; crowdQueue.lastSyncVersion = Math.max(Number(crowdQueue.lastSyncVersion) || 0, Number(res.data.version) || 0); }
  } catch (e) { /* the next heartbeat will try again */ }
}

function cqUpdateProgress() {
  const s = crowdQueue.session; if (!s) return;
  const bars = document.querySelectorAll('.cq-np-progress'); if (!bars.length) return;
  const pb = s.playback || {};
  const song = pb.current_song_id ? songById(pb.current_song_id) : null;
  const a = document.getElementById('sw-audio');
  const same = a && state.player?.kind === 'song' && Number(state.player.id) === Number(pb.current_song_id);
  const dur = (same && Number.isFinite(a.duration) && a.duration > 0) ? a.duration : Number(song?.duration_seconds) || 0;
  const pos = same ? a.currentTime : cqExpectedPosition(pb);
  const pct = dur > 0 ? Math.max(0, Math.min(100, (pos / dur) * 100)) : 0;
  bars.forEach((bar) => {
    const fill = bar.querySelector('i'); if (fill) fill.style.width = pct + '%';
    const e = bar.querySelector('[data-cq-elapsed]'); if (e) e.textContent = nice(pos);
    const t = bar.querySelector('[data-cq-total]'); if (t) t.textContent = dur > 0 ? nice(dur) : '--:--';
  });
}

function cqStartTimers(sid) {
  cqStopTimers();
  cqSync.hb = setInterval(() => { void cqHostHeartbeat(); }, 8000);
  cqSync.poll = setInterval(() => { if (!document.hidden) void cqResync({ quiet: true }); }, 7000);
  cqSync.tick = setInterval(cqUpdateProgress, 500);
  if (!cqSync.installed) {
    cqSync.installed = true;
    document.addEventListener('visibilitychange', () => { if (!document.hidden && crowdQueue.session) void cqResync({ quiet: true }); });
    window.addEventListener('online', () => { if (crowdQueue.session) void cqResync({ force: true }); });
    // One delegated handler covers the "Sync" chip on the page and in the side panel.
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-cq-resync]');
      if (b) { ev.preventDefault(); void cqResync({ force: true }); }
    });
  }
}
function cqStopTimers() {
  clearInterval(cqSync.hb); clearInterval(cqSync.poll); clearInterval(cqSync.tick);
  cqSync.hb = cqSync.poll = cqSync.tick = 0; cqSync.state = 'idle'; cqSync.seq++;
  clearTimeout(crowdQueue._retryTimer);
}

// Small status chip shown on the page and in the side panel.
function cqSyncChipHtml(isHost) {
  if (isHost) return '<span class="cq-sync-chip is-host" role="status"><b></b>Hosting · everyone follows you</span>';
  const st = cqSync.state;
  if (st === 'blocked') return '<button type="button" class="cq-sync-chip is-warn" data-cq-resync="1"><b></b>Tap to start audio</button>';
  if (st === 'out') return '<button type="button" class="cq-sync-chip is-warn" data-cq-resync="1"><b></b>Out of sync · Resync</button>';
  if (st === 'syncing') return '<span class="cq-sync-chip is-busy" role="status"><b></b>Syncing…</span>';
  if (st === 'reconnecting') return '<span class="cq-sync-chip is-busy" role="status"><b></b>Reconnecting…</span>';
  return '<button type="button" class="cq-sync-chip is-ok" data-cq-resync="1" title="Click to re-sync with the host"><b></b>In sync with host</button>';
}
function cqProgressHtml() {
  return '<div class="cq-np-progress" aria-hidden="true"><span data-cq-elapsed>0:00</span><div class="cq-np-track"><i></i></div><span data-cq-total>--:--</span></div>';
}
function cqAvatarsHtml(participants) {
  const list = (participants || []).slice(0, 6);
  const more = (participants || []).length - list.length;
  const initial = (p) => esc(String(p.display_name || p.username || 'L').trim().charAt(0).toUpperCase() || 'L');
  return `<div class="cq-avatars" aria-label="Listeners">${list.map(p => `<span class="cq-avatar ${p.role === 'host' ? 'is-host' : ''}" title="${esc(p.display_name || p.username || 'Listener')}${p.role === 'host' ? ' (Host)' : ''}">${initial(p)}</span>`).join('')}${more > 0 ? `<span class="cq-avatar more">+${more}</span>` : ''}</div>`;
}

function crowdQueueUpgradePromptHtml() {
  return `<div class="cq-upgrade-card" role="region" aria-label="CrowdQueue Premium">
    <div class="cq-lock-icon">${icon('queue')}</div>
    <h2>CrowdQueue is a Premium Feature</h2>
    <p class="muted">Listen together with friends in real time, build shared queues, and upvote the next tracks. Upgrade to SoundWave Premium to host and join CrowdQueue sessions.</p>
    <div class="cq-upgrade-actions">
      <button type="button" class="button" data-nav="plans">Upgrade to Premium</button>
      <button type="button" class="button secondary" data-nav="discover">Back to Listen</button>
    </div>
  </div>`;
}

function crowdQueueLobbyHtml() {
  return `<div class="cq-page">
    <div class="cq-lobby-grid">
      <div class="cq-card">
        <h3>${icon('plus')} Create a Session</h3>
        <p class="muted">Host a listening session, invite your friends, and listen together.</p>
        <form id="cq-create-form" novalidate>
          <div class="cq-field">
            <label for="cq-create-name">Session Name *</label>
            <input type="text" id="cq-create-name" maxlength="100" placeholder="e.g. Chill Beats Lounge" required>
          </div>
          <div class="cq-field">
            <label for="cq-create-desc">Description <small>(optional)</small></label>
            <textarea id="cq-create-desc" maxlength="500" rows="2" placeholder="What's the vibe?"></textarea>
          </div>
          <div class="cq-field">
            <label for="cq-create-vis">Visibility</label>
            <select id="cq-create-vis">
              <option value="invite_only">Invite Only (with code)</option>
              <option value="public">Public (anyone can join)</option>
            </select>
          </div>
          <div class="cq-field">
            <label for="cq-create-limit">Max Participants (2–100)</label>
            <input type="number" id="cq-create-limit" min="2" max="100" value="20">
          </div>
          <div class="cq-field">
            <label for="cq-create-mode">Queue Order</label>
            <select id="cq-create-mode">
              <option value="voted">Most Voted First</option>
              <option value="chronological">Chronological (Added Order)</option>
            </select>
          </div>
          <button type="submit" class="button" id="cq-btn-create-session">Create Session</button>
        </form>
      </div>

      <div class="cq-card">
        <h3>${icon('forward')} Join with Code</h3>
        <p class="muted">Got an invite code from a friend? Enter it here to join their room.</p>
        <form id="cq-join-form" novalidate>
          <div class="cq-field">
            <label for="cq-join-code">Invite Code</label>
            <input type="text" id="cq-join-code" placeholder="e.g. CQ8ABC9" style="text-transform:uppercase" required>
          </div>
          <button type="submit" class="button secondary" id="cq-btn-join-session">Join Session</button>
        </form>
        <div class="cq-howto" aria-label="How CrowdQueue works">
          <h4>How it works</h4>
          <ol>
            <li><span>1</span><div><strong>Host or join</strong><small>Create a session, or enter a friend's invite code.</small></div></li>
            <li><span>2</span><div><strong>Add songs together</strong><small>Everyone in the room can add tracks to the shared queue.</small></div></li>
            <li><span>3</span><div><strong>Vote the next track</strong><small>The most upvoted song plays next, so the room decides the vibe.</small></div></li>
          </ol>
          <p class="muted small">Codes are not case-sensitive. Public rooms are listed below, so you can jump in without a code.</p>
        </div>
      </div>
    </div>

    <div class="cq-card">
      <h3>${icon('users')} Public Listening Rooms</h3>
      <div id="cq-public-sessions" class="cq-public-list">
        ${crowdQueuePublicListHtml()}
      </div>
    </div>
  </div>`;
}

function crowdQueuePublicListHtml() {
  if (!crowdQueue.publicSessions || !crowdQueue.publicSessions.length) {
    return `<div class="notif-empty"><p>No public sessions right now. Create one above to get started!</p></div>`;
  }
  return crowdQueue.publicSessions.map(ps => `
    <div class="cq-public-card" data-public-session="${ps.session_id}">
      <div>
        <strong>${esc(ps.session_name)}</strong>
        <small class="muted" style="display:block">Host: ${esc(ps.host_name)} · ${ps.participant_count} / ${ps.participant_limit} listeners</small>
      </div>
      <button type="button" class="button small secondary" data-cq-join-code="${esc(ps.invite_code)}">Join Room</button>
    </div>
  `).join('');
}

function crowdQueueItemsHtml(queue, s) {
  const upcoming = (queue || []).filter(q => q.status === 'upcoming');
  if (!upcoming.length) {
    return `<div class="notif-empty"><p>The queue is empty. Search for songs below to add them to the session!</p></div>`;
  }
  const isHost = Boolean(s.is_host);
  const myUid = state.user?.id;
  return upcoming.map((item, idx) => {
    const qid = Number(item.queue_item_id);
    const canRemove = isHost || (myUid && String(item.added_by) === String(myUid));
    const hasVoted = item.my_vote === 1;
    const cover = item.cover_path && state.coverUrls && state.coverUrls[item.cover_path]
      ? `<img class="cq-item-art" src="${esc(state.coverUrls[item.cover_path])}" alt="">`
      : `<div class="cq-item-art placeholder-art">${icon('music')}</div>`;

    return `<div class="cq-queue-item" data-queue-item="${qid}">
      <span class="cq-item-rank">${idx + 1}</span>
      ${cover}
      <div class="cq-item-main">
        <strong>${esc(item.song_title || 'Song')}</strong>
        <small>${esc(item.artist_name || 'Artist')} · Added by ${esc(item.added_by_name || 'Listener')}</small>
      </div>
      <div class="cq-item-vote">
        <button type="button" class="cq-vote-btn ${hasVoted ? 'has-voted' : ''}" data-cq-vote="${qid}" aria-label="Vote for ${esc(item.song_title)}" aria-pressed="${hasVoted}">
          ${icon('forward')}
          <span class="cq-score">${Number(item.score || 0)}</span>
        </button>
        ${canRemove ? `<button type="button" class="cq-remove-btn" data-cq-remove="${qid}" aria-label="Remove ${esc(item.song_title)} from queue" title="Remove">${icon('close')}</button>` : ''}
        ${isHost && s.order_mode === 'chronological' ? `
          ${idx > 0 ? `<button type="button" class="cq-reorder-btn" data-cq-up="${qid}" aria-label="Move up" title="Move up"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg></button>` : ''}
          ${idx < upcoming.length - 1 ? `<button type="button" class="cq-reorder-btn" data-cq-down="${qid}" aria-label="Move down" title="Move down"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>` : ''}
        ` : ''}
      </div>
    </div>`;
  }).join('');
}

function crowdQueueSearchResultsHtml() {
  if (!crowdQueue.searchResults.length) {
    const input = document.getElementById('cq-search-input');
    if (input && input.value.trim()) {
      return `<p class="muted" style="padding:10px">No songs matched your search.</p>`;
    }
    return `<div class="cq-search-empty"><p class="muted">Search above by title or artist to add tracks to the queue.</p></div>`;
  }
  return crowdQueue.searchResults.map(s => {
    const sid = Number(s.song_id || s.id);
    const title = s.song_title || s.title || 'Untitled';
    const artist = s.album?.artist?.artist_name || s.artist_name || s.artist || 'SoundWave';
    const cover = s.cover_path && state.coverUrls && state.coverUrls[s.cover_path]
      ? `<img class="cq-item-art" src="${esc(state.coverUrls[s.cover_path])}" alt="">`
      : `<div class="cq-item-art placeholder-art">${icon('music')}</div>`;

    return `<div class="cq-search-row">
      ${cover}
      <div class="cq-item-main">
        <strong>${esc(title)}</strong>
        <small>${esc(artist)}</small>
      </div>
      <button type="button" class="button small secondary" data-cq-add-song="${sid}">${icon('plus')} Add</button>
    </div>`;
  }).join('');
}

function crowdQueueActiveHtml() {
  const s = crowdQueue.session;
  const isHost = Boolean(s.is_host);
  const queue = Array.isArray(s.queue) ? s.queue : [];
  const participants = Array.isArray(s.participants) ? s.participants : [];
  const pb = s.playback || {};
  const currentSong = pb.current_song_id ? ((typeof songById === 'function' ? songById(pb.current_song_id) : null) || queue.find(q => Number(q.song_id) === Number(pb.current_song_id))) : null;

  return `<div class="cq-page" id="cq-active-session" data-session-id="${s.session_id}">
    <header class="cq-session-head">
      <div class="cq-session-info">
        <h2>${esc(s.session_name)}</h2>
        ${s.description ? `<p class="muted">${esc(s.description)}</p>` : ''}
        <div class="cq-session-meta">
          <span>Host: <strong>${esc(s.host?.display_name || 'Host')}</strong></span>
          <span>·</span>
          <span class="cq-listeners">${cqAvatarsHtml(participants)}${participants.length} / ${s.participant_limit} listeners</span>
          <span>·</span>
          <span>Order: <strong>${s.order_mode === 'voted' ? 'Top Voted' : 'Chronological'}</strong></span>
          <button type="button" class="cq-code-pill cq-invite-pill" id="cq-copy-invite-link" title="Copy direct invite link" aria-label="Copy direct invite link">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>Copy Invite Link</span>
          </button>
          <button type="button" class="cq-code-pill secondary" id="cq-open-sidebar-btn" title="Show queue in right sidebar">
            ${icon('queue')} <span>Sidebar View</span>
          </button>
        </div>
      </div>
      <div class="cq-session-actions">
        ${isHost ? `
          <select id="cq-mode-switch" aria-label="Queue order mode">
            <option value="voted" ${s.order_mode === 'voted' ? 'selected' : ''}>Voted Order</option>
            <option value="chronological" ${s.order_mode === 'chronological' ? 'selected' : ''}>Chronological</option>
          </select>
          <button type="button" class="button danger" id="cq-btn-end-session">End Session</button>
        ` : `
          <button type="button" class="button secondary" id="cq-btn-leave-session">Leave Session</button>
        `}
      </div>
    </header>

    <section class="cq-now-playing" aria-label="Now playing in session">
      ${currentSong ? `
        ${currentSong.cover_path && state.coverUrls && state.coverUrls[currentSong.cover_path] ? `<img class="cq-np-art" src="${esc(state.coverUrls[currentSong.cover_path])}" alt="">` : `<div class="cq-np-art placeholder-art">${icon('music')}</div>`}
        <div class="cq-np-details">
          <strong>${esc(currentSong.song_title || currentSong.title || 'Current Track')}</strong>
          <small class="muted">${esc(currentSong.artist_name || currentSong.artist || 'Artist')} ${pb.is_playing ? '· Playing' : '· Paused'}</small>
          ${cqProgressHtml()}
        </div>
        ${isHost ? `
          <div class="cq-np-controls">
            <button type="button" class="button small secondary" id="cq-btn-toggle-play">${pb.is_playing ? icon('pause') : icon('play')} ${pb.is_playing ? 'Pause' : 'Play'}</button>
            <button type="button" class="button small secondary" id="cq-btn-skip-next">${icon('next')} Next</button>
          </div>
        ` : `
          <div class="cq-np-controls">
            ${cqSyncChipHtml(false)}
          </div>
        `}
      ` : `
        <div class="cq-np-details">
          <strong>No track currently playing</strong>
          <small class="muted">${isHost ? 'Select a song below or hit Play to start the session queue.' : 'Waiting for host to start playback...'}</small>
        </div>
        ${isHost && queue.filter(q => q.status === 'upcoming').length ? `
          <div class="cq-np-controls">
            <button type="button" class="button small" id="cq-btn-start-queue">${icon('play')} Play Next</button>
          </div>
        ` : ''}
      `}
    </section>

    <section class="cq-queue-wrap" aria-label="Session queue">
      <div class="cq-queue-head">
        <h3>Queue (${queue.filter(q => q.status === 'upcoming').length} upcoming)</h3>
      </div>
      <div class="cq-queue-list" id="cq-queue-list">
        ${crowdQueueItemsHtml(queue, s)}
      </div>
    </section>

    <section class="cq-card cq-add-section" aria-label="Add songs to queue">
      <h3>${icon('plus')} Add Songs to Queue</h3>
      <div class="cq-field">
        <input type="search" id="cq-search-input" placeholder="Search song title or artist..." aria-label="Search songs to add">
      </div>
      <div class="cq-search-results" id="cq-search-results">
        ${crowdQueueSearchResultsHtml()}
      </div>
    </section>

    <details class="cq-card" id="cq-participants-details">
      <summary><strong>Participants (${participants.length})</strong></summary>
      <div class="cq-public-list" style="margin-top:10px">
        ${participants.map(p => `
          <div class="cq-public-card">
            <div>
              <strong>${esc(p.display_name || p.username || 'Listener')}</strong>
              <small class="muted" style="display:block">${p.role === 'host' ? 'Host' : 'Member'}</small>
            </div>
            <span class="role-badge">${esc(p.role)}</span>
          </div>
        `).join('')}
      </div>
    </details>
  </div>`;
}

function crowdQueueSearchSongs(q) {
  if (!q) {
    crowdQueue.searchResults = [];
    const el = document.getElementById('cq-search-results');
    if (el) el.innerHTML = crowdQueueSearchResultsHtml();
    return;
  }
  const all = Array.isArray(state.allSongs) && state.allSongs.length ? state.allSongs : (state.songs || []);
  const matched = all.filter(s => {
    const title = (s.song_title || s.title || '').toLowerCase();
    const artist = (s.album?.artist?.artist_name || s.artist_name || s.artist || '').toLowerCase();
    return title.includes(q) || artist.includes(q);
  }).slice(0, 10);
  crowdQueue.searchResults = matched;
  const el = document.getElementById('cq-search-results');
  if (el) el.innerHTML = crowdQueueSearchResultsHtml();
}

async function createCrowdQueueSession(formData) {
  try {
    const res = await db.rpc('sw_cq_create_session', {
      p_name: formData.name,
      p_description: formData.description || null,
      p_visibility: formData.visibility || 'invite_only',
      p_participant_limit: formData.limit || 20,
      p_order_mode: formData.order_mode || 'voted'
    });
    if (res.error) throw res.error;
    toast(`Session "${formData.name}" created!`);
    await loadMyActiveCrowdQueueSession();
    state.railTab = 'crowdqueue';
    toggleRail(false);
    render();
    refreshRail();
  } catch (e) {
    toast(humanErr(e), true);
  }
}

async function joinCrowdQueueSession(inviteInput) {
  let code = (inviteInput || '').trim();
  const m = /[?&](?:join|code)=([A-Za-z0-9_-]+)/i.exec(code) || /#\/crowd-?queue(?:\?join=|\/)([A-Za-z0-9_-]+)/i.exec(code);
  if (m) code = m[1];
  code = code.toUpperCase();
  if (!code) {
    toast('Please enter an invite code.', true);
    return;
  }
  try {
    const res = await db.rpc('sw_cq_join_session', { p_invite_code: code });
    if (res.error) throw res.error;
    toast(`Joined session!`);
    await loadMyActiveCrowdQueueSession();
    state.railTab = 'crowdqueue';
    toggleRail(false);
    render();
    refreshRail();
  } catch (e) {
    const msg = e?.message || String(e || '');
    if (/invalid_invite/i.test(msg)) {
      toast('Invite code not found. Check the code and try again.', true);
    } else if (/session_closed/i.test(msg)) {
      toast('This session has already ended.', true);
    } else if (/session_full/i.test(msg)) {
      toast('This session has reached maximum capacity.', true);
    } else {
      toast(humanErr(e), true);
    }
  }
}

async function leaveCrowdQueueSession() {
  if (!crowdQueue.session) return;
  const sid = Number(crowdQueue.session.session_id);
  try {
    const res = await db.rpc('sw_cq_leave_session', { p_session_id: sid });
    if (res.error) throw res.error;
    toast('Left session.');
    cleanupCrowdQueue();
    render();
  } catch (e) {
    toast(humanErr(e), true);
  }
}

async function closeCrowdQueueSession() {
  if (!crowdQueue.session) return;
  const ok = window.confirm('Are you sure you want to end this CrowdQueue session for everyone?');
  if (!ok) return;
  const sid = Number(crowdQueue.session.session_id);
  try {
    const res = await db.rpc('sw_cq_close_session', { p_session_id: sid });
    if (res.error) throw res.error;
    toast('Session ended.');
    cleanupCrowdQueue();
    render();
  } catch (e) {
    toast(humanErr(e), true);
  }
}

async function addSongToCrowdQueue(songId) {
  if (!state.user) {
    toast('Sign in required.');
    return;
  }
  if (!isPremiumUser()) {
    toast('CrowdQueue is a Premium feature.');
    navigate('plans');
    return;
  }
  if (!crowdQueue.session || crowdQueue.session.status !== 'active') {
    toast('You must join or create a CrowdQueue session first.');
    navigate('crowdqueue');
    return;
  }
  const sid = Number(crowdQueue.session.session_id);
  try {
    const res = await db.rpc('sw_cq_add_song', { p_session_id: sid, p_song_id: Number(songId) });
    if (res.error) throw res.error;
    toast('Added to CrowdQueue!');
    void refreshCrowdQueueSession(sid);
  } catch (e) {
    const msg = e?.message || String(e || '');
    if (/song_restricted/i.test(msg)) {
      toast('This song cannot be added because it is restricted under moderation policy.', true);
    } else if (/song_not_available/i.test(msg)) {
      toast('This song is not available.', true);
    } else {
      toast(humanErr(e), true);
    }
  }
}

async function removeSongFromCrowdQueue(queueItemId) {
  if (!crowdQueue.session) return;
  const sid = Number(crowdQueue.session.session_id);
  const qid = Number(queueItemId);
  try {
    const res = await db.rpc('sw_cq_remove_song', { p_session_id: sid, p_queue_item_id: qid });
    if (res.error) throw res.error;
    toast('Song removed from queue.');
    void refreshCrowdQueueSession(sid);
  } catch (e) {
    toast(humanErr(e), true);
  }
}

async function voteQueueItem(queueItemId) {
  if (!crowdQueue.session) return;
  const s = crowdQueue.session;
  const qid = Number(queueItemId);
  const item = (s.queue || []).find(q => Number(q.queue_item_id) === qid);
  if (!item) return;

  const currentVote = Number(item.my_vote || 0);
  const newVote = currentVote === 1 ? 0 : 1;
  const diff = newVote - currentVote;

  // Optimistic UI update
  item.my_vote = newVote;
  item.score = (item.score || 0) + diff;
  cqSoftRender(true);

  try {
    const res = await db.rpc('sw_cq_vote', {
      p_session_id: Number(s.session_id),
      p_queue_item_id: qid,
      p_vote: newVote
    });
    if (res.error) throw res.error;
    if (res.data) {
      item.score = res.data.score;
      item.my_vote = res.data.my_vote;
    }
    void refreshCrowdQueueSession(s.session_id);
  } catch (e) {
    // Rollback
    item.my_vote = currentVote;
    item.score = (item.score || 0) - diff;
    toast(humanErr(e), true);
    cqSoftRender(true);
  }
}

async function reorderCrowdQueueItem(queueItemId, delta) {
  if (!crowdQueue.session || !crowdQueue.session.is_host) return;
  const s = crowdQueue.session;
  const upcoming = (s.queue || []).filter(q => q.status === 'upcoming');
  const idx = upcoming.findIndex(q => Number(q.queue_item_id) === Number(queueItemId));
  if (idx < 0) return;
  const targetIdx = idx + delta;
  if (targetIdx < 0 || targetIdx >= upcoming.length) return;

  const temp = upcoming[idx];
  upcoming[idx] = upcoming[targetIdx];
  upcoming[targetIdx] = temp;

  const itemIds = upcoming.map(q => Number(q.queue_item_id));
  try {
    const res = await db.rpc('sw_cq_reorder_queue', {
      p_session_id: Number(s.session_id),
      p_item_ids: itemIds
    });
    if (res.error) throw res.error;
    void refreshCrowdQueueSession(s.session_id);
  } catch (e) {
    toast(humanErr(e), true);
  }
}

let cqNextBusy = false;
async function hostPlayNextInCrowdQueue(opts = {}) {
  if (!crowdQueue.session || !crowdQueue.session.is_host) return;
  if (cqNextBusy) return; // rapid clicks must not start overlapping skips
  cqNextBusy = true;
  document.querySelectorAll('#cq-btn-skip-next, #cq-rail-np-next').forEach(b => { b.disabled = true; });
  try {
    // Always decide from the freshest queue so a quick second click never replays the same song.
    await refreshCrowdQueueSession(crowdQueue.session.session_id);
    const s = crowdQueue.session;
    if (!s || !s.is_host) return;
    const queue = Array.isArray(s.queue) ? s.queue : [];
    const upcoming = queue.filter(q => q.status === 'upcoming');
    if (!upcoming.length) {
      if (opts.auto) await hostAnnounceStopped(); else toast('No upcoming songs in the queue.');
      return;
    }
    await hostPlayQueueItem(upcoming[0]);
  } finally {
    cqNextBusy = false;
    document.querySelectorAll('#cq-btn-skip-next, #cq-rail-np-next').forEach(b => { b.disabled = false; });
  }
}

// The queue ran out: tell listeners playback stopped so nobody is left looping or hearing silence.
async function hostAnnounceStopped() {
  const s = crowdQueue.session; if (!s || !s.is_host) return;
  const pb = s.playback || {};
  try {
    const res = await db.rpc('sw_cq_update_playback', {
      p_session_id: Number(s.session_id),
      p_queue_item_id: pb.current_queue_item_id ? Number(pb.current_queue_item_id) : null,
      p_song_id: pb.current_song_id ? Number(pb.current_song_id) : null,
      p_is_playing: false, p_position_seconds: 0, p_version: null
    });
    if (!res.error && res.data) { s.playback = res.data; crowdQueue.lastSyncVersion = Math.max(Number(crowdQueue.lastSyncVersion) || 0, Number(res.data.version) || 0); }
    toast('The queue is finished. Add more songs to keep listening.');
    cqSoftRender(true);
  } catch (e) { console.warn('Could not announce the end of the queue', e); }
}

async function hostPlayQueueItem(item) {
  if (!crowdQueue.session || !crowdQueue.session.is_host) return;
  const s = crowdQueue.session;
  const qid = Number(item.queue_item_id);
  const songId = Number(item.song_id);

  try {
    const already = state.player?.kind === 'song' && Number(state.player.id) === songId;
    if (already) {
      // playSong() on the song that is already loaded would toggle pause, so restart it instead.
      const a0 = document.getElementById('sw-audio');
      if (a0) { a0.currentTime = 0; await a0.play().catch(() => { }); }
    } else if (typeof playSong === 'function') {
      await playSong(songId);
    }
    const audio = document.getElementById('sw-audio');
    const pos = audio ? audio.currentTime : 0;
    const send = (version) => db.rpc('sw_cq_update_playback', {
      p_session_id: Number(s.session_id),
      p_queue_item_id: qid,
      p_song_id: songId,
      p_is_playing: true,
      p_position_seconds: pos,
      p_version: version
    });
    let res = await send(s.playback?.version ? Number(s.playback.version) : null);
    if (res.error) {
      // A stale playback version is the usual cause: re-sync once without it instead of failing silently.
      console.warn('CrowdQueue playback update failed, retrying', res.error);
      res = await send(null);
    }
    if (res.error) throw res.error;
    if (res.data) {
      s.playback = res.data;
      crowdQueue.lastSyncVersion = Math.max(Number(crowdQueue.lastSyncVersion) || 0, Number(res.data.version) || 0);
    }
    // Show the change immediately: the song that just started leaves the upcoming list.
    (s.queue || []).forEach(q => { if (Number(q.queue_item_id) === qid) q.status = 'playing'; });
    cqSoftRender(true);
    await refreshCrowdQueueSession(s.session_id);
  } catch (e) {
    toast(humanErr(e), true);
  }
}

async function hostTogglePlay() {
  if (!crowdQueue.session || !crowdQueue.session.is_host) return;
  const s = crowdQueue.session;
  const pb = s.playback || {};
  const audio = document.getElementById('sw-audio');
  const isPlaying = audio ? !audio.paused : Boolean(pb.is_playing);
  const newPlaying = !isPlaying;

  if (audio) {
    if (newPlaying) audio.play().catch(() => { });
    else audio.pause();
  }
  try {
    const res = await db.rpc('sw_cq_update_playback', {
      p_session_id: Number(s.session_id),
      p_queue_item_id: pb.current_queue_item_id ? Number(pb.current_queue_item_id) : null,
      p_song_id: pb.current_song_id ? Number(pb.current_song_id) : null,
      p_is_playing: newPlaying,
      p_position_seconds: audio ? audio.currentTime : 0,
      p_version: pb.version ? Number(pb.version) : null
    });
    if (!res.error && res.data) {
      s.playback = res.data;
      crowdQueue.lastSyncVersion = res.data.version;
    }
    cqSoftRender();
  } catch (e) {
    toast(humanErr(e), true);
  }
}

async function loadPublicCrowdQueueSessions() {
  if (!db) return;
  try {
    const res = await db.rpc('sw_cq_public_sessions');
    if (!res.error && res.data) {
      crowdQueue.publicSessions = res.data;
      const el = document.getElementById('cq-public-sessions');
      if (el) el.innerHTML = crowdQueuePublicListHtml();
    }
  } catch (e) {
    console.warn('loadPublicCrowdQueueSessions error:', e);
  }
}

function bindCrowdQueueEvents() {
  // Create form
  const createForm = document.getElementById('cq-create-form');
  if (createForm) {
    createForm.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('cq-create-name')?.value?.trim();
      if (!name) { toast('Please enter a session name.', true); return; }
      const desc = document.getElementById('cq-create-desc')?.value?.trim();
      const vis = document.getElementById('cq-create-vis')?.value || 'invite_only';
      const limit = parseInt(document.getElementById('cq-create-limit')?.value, 10) || 20;
      const mode = document.getElementById('cq-create-mode')?.value || 'voted';
      void createCrowdQueueSession({ name, description: desc, visibility: vis, limit, order_mode: mode });
    };
  }

  // Join form
  const joinForm = document.getElementById('cq-join-form');
  if (joinForm) {
    joinForm.onsubmit = (e) => {
      e.preventDefault();
      const code = document.getElementById('cq-join-code')?.value?.trim();
      if (!code) { toast('Please enter an invite code.', true); return; }
      void joinCrowdQueueSession(code);
    };
  }

  // Public join buttons
  document.getElementById('cq-public-sessions')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cq-join-code]');
    if (btn) {
      void joinCrowdQueueSession(btn.dataset.cqJoinCode);
    }
  });

  // Copy code pill
  const copyLinkBtn = document.getElementById('cq-copy-invite-link') || document.getElementById('cq-copy-code');
  if (copyLinkBtn && crowdQueue.session) {
    copyLinkBtn.onclick = () => void copyCrowdQueueInviteLink();
  }
  const openSidebarBtn = document.getElementById('cq-open-sidebar-btn');
  if (openSidebarBtn) {
    openSidebarBtn.onclick = () => {
      state.railTab = 'crowdqueue';
      toggleRail(false);
      refreshRail();
      toast('CrowdQueue is open on the right sidebar!');
    };
  }

  // Mode switch
  const modeSel = document.getElementById('cq-mode-switch');
  if (modeSel && crowdQueue.session?.is_host) {
    modeSel.onchange = async () => {
      const mode = modeSel.value;
      try {
        const res = await db.rpc('sw_cq_set_order_mode', {
          p_session_id: Number(crowdQueue.session.session_id),
          p_order_mode: mode
        });
        if (res.error) throw res.error;
        crowdQueue.session.order_mode = mode;
        toast(`Queue order set to ${mode === 'voted' ? 'Voted' : 'Chronological'}`);
        void refreshCrowdQueueSession(crowdQueue.session.session_id);
      } catch (e) {
        toast(humanErr(e), true);
      }
    };
  }

  // Leave and End buttons
  { const b = document.getElementById('cq-btn-leave-session'); if (b) b.onclick = () => void leaveCrowdQueueSession(); }
  { const b = document.getElementById('cq-btn-end-session'); if (b) b.onclick = () => void closeCrowdQueueSession(); }

  // Host playback controls
  { const b = document.getElementById('cq-btn-toggle-play'); if (b) b.onclick = () => void hostTogglePlay(); }
  { const b = document.getElementById('cq-btn-skip-next'); if (b) b.onclick = () => void hostPlayNextInCrowdQueue(); }
  { const b = document.getElementById('cq-btn-start-queue'); if (b) b.onclick = () => void hostPlayNextInCrowdQueue(); }

  // Queue item actions (voting, remove, reorder)
  const queueList = document.getElementById('cq-queue-list');
  if (queueList) {
    queueList.onclick = (e) => {
      const voteBtn = e.target.closest('[data-cq-vote]');
      if (voteBtn) {
        const qid = Number(voteBtn.dataset.cqVote);
        void voteQueueItem(qid);
        return;
      }
      const remBtn = e.target.closest('[data-cq-remove]');
      if (remBtn) {
        const qid = Number(remBtn.dataset.cqRemove);
        void removeSongFromCrowdQueue(qid);
        return;
      }
      const upBtn = e.target.closest('[data-cq-up]');
      if (upBtn) {
        const qid = Number(upBtn.dataset.cqUp);
        void reorderCrowdQueueItem(qid, -1);
        return;
      }
      const downBtn = e.target.closest('[data-cq-down]');
      if (downBtn) {
        const qid = Number(downBtn.dataset.cqDown);
        void reorderCrowdQueueItem(qid, 1);
        return;
      }
    };
  }

  // Song search
  const searchInput = document.getElementById('cq-search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      clearTimeout(crowdQueue.searchTimer);
      const q = e.target.value.trim().toLowerCase();
      crowdQueue.searchTimer = setTimeout(() => {
        crowdQueueSearchSongs(q);
      }, 250);
    };
  }

  // Search results add button
  const resultsContainer = document.getElementById('cq-search-results');
  if (resultsContainer) {
    resultsContainer.onclick = (e) => {
      const addBtn = e.target.closest('[data-cq-add-song]');
      if (addBtn) {
        const songId = Number(addBtn.dataset.cqAddSong);
        void addSongToCrowdQueue(songId);
      }
    };
  }
}

function crowdQueuePage() {
  if (!state.user) {
    shell(`<div class="cq-upgrade-card"><div class="cq-lock-icon">${icon('users')}</div><h2>Sign in to access CrowdQueue</h2><p class="muted">Join or host collaborative listening sessions with other SoundWave listeners.</p><button type="button" class="button" data-nav="discover">Explore SoundWave</button></div>`, 'CrowdQueue');
    return;
  }
  if (!isPremiumUser()) {
    shell(crowdQueueUpgradePromptHtml(), 'CrowdQueue');
    return;
  }
  if (crowdQueue.session && crowdQueue.session.status === 'active') {
    shell(crowdQueueActiveHtml(), 'CrowdQueue');
  } else {
    shell(crowdQueueLobbyHtml(), 'CrowdQueue');
    void loadPublicCrowdQueueSessions();
  }
  bindCrowdQueueEvents();
}
// </crowdqueue-v79>


function setupAccountAccessGuard() {
  if (!db || !state.user?.id) return;
  if (accountStatusTimer) clearInterval(accountStatusTimer);
  accountStatusTimer = setInterval(() => { if (state.user?.id) void verifyAccountAccess({ silent: true }); }, 5000);
  if (accountStatusChannel) { db.removeChannel(accountStatusChannel); accountStatusChannel = null; }
  accountStatusChannel = db.channel(`soundwave-account-access-${state.user.id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `user_id=eq.${state.user.id}` }, payload => {
      if (payload.new?.is_active === false) void handleSuspendedAccount();
    }).subscribe();
}
function setupRealtime() {
  if (!db || !state.user) return;
  setupAccountAccessGuard();
  setupNotifications();
  void loadMyRestrictions();
  void loadMyActiveCrowdQueueSession();
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  if (releaseAlertChannel) { db.removeChannel(releaseAlertChannel); releaseAlertChannel = null; }
  startReleaseAlerts();
  if (adminStreamChannel) { db.removeChannel(adminStreamChannel); adminStreamChannel = null; }
  if (creatorStreamChannel) { db.removeChannel(creatorStreamChannel); creatorStreamChannel = null; }
  if (podcastCreatorChannel) { db.removeChannel(podcastCreatorChannel); podcastCreatorChannel = null; }
  realtimeChannel = db.channel(`soundwave-listening-${state.user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listening_history' }, payload => { const r = payload.new || {}, followed = new Set(state.following.map(x => String(x.followed_user_id))); if (!followed.has(String(r.user_id))) return; const s = songById(r.song_id); const prof = state.socialProfiles[String(r.user_id)]; if (!s) return; state.friendNow = [{ user_id: r.user_id, song_id: r.song_id, name: prof?.display_name || 'A friend', song_title: s.song_title, artist_name: s.album?.artist?.artist_name || 'SoundWave', at: r.stream_date || new Date().toISOString() }, ...state.friendNow.filter(x => String(x.user_id) !== String(r.user_id))].slice(0, 8); refreshRail(); }).subscribe();
  if (state.artist && state.ownedSongs.length) {
    const ownedIds = new Set(state.ownedSongs.map(s => Number(s.song_id)));
    const refreshArtist = payload => { const r = payload.new || {}; if (!ownedIds.has(Number(r.song_id))) return; void refreshStreamMetrics(); };
    creatorStreamChannel = db.channel(`soundwave-artist-streams-${state.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listening_history' }, refreshArtist)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listening_history' }, refreshArtist)
      .subscribe();
  }
  if (state.myShows?.length) {
    const ownShowIds = new Set(state.myShows.map(s => Number(s.show_id)));
    const ownEpisodeIds = new Set((state.episodes || []).filter(ep => ownShowIds.has(Number(ep.show_id))).map(ep => Number(ep.episode_id)));
    const refreshPodcast = payload => { const r = payload.new || {}; if (!ownEpisodeIds.has(Number(r.episode_id))) return; void refreshPodcastStudioMetrics(); };
    podcastCreatorChannel = db.channel(`soundwave-podcast-streams-${state.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'podcast_listening_history' }, refreshPodcast)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'podcast_listening_history' }, refreshPodcast)
      .subscribe();
  }
  if (hasAdminAccess()) {
    const refreshAdmin = () => { void refreshCrossDeviceMetrics(); };
    adminStreamChannel = db.channel(`soundwave-admin-streams-${state.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listening_history' }, refreshAdmin)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listening_history' }, refreshAdmin)
      .subscribe();
  }
}
function setupPlaylistPresence() { if (!db || !state.user || state.page !== 'playlists' || !state.selectedPlaylist) { if (playlistPresenceChannel) { db.removeChannel(playlistPresenceChannel); playlistPresenceChannel = null; } return; } const id = state.selectedPlaylist; if (playlistPresenceChannel) db.removeChannel(playlistPresenceChannel); playlistPresenceChannel = db.channel(`playlist-presence-${id}`, { config: { presence: { key: state.user.id } } }); playlistPresenceChannel.on('presence', { event: 'sync' }, () => { const pres = playlistPresenceChannel.presenceState(); state.playlistPresence = Object.values(pres).flat().filter(Boolean).map(x => ({ user_id: x.user_id, name: x.name || 'Listener' })); const el = document.getElementById('playlist-presence'); if (el) el.innerHTML = playlistPresenceHtml(); }).subscribe(async status => { if (status === 'SUBSCRIBED') await playlistPresenceChannel.track({ user_id: state.user.id, name: state.profile?.display_name || 'Listener', at: new Date().toISOString() }); }); }
async function loadCompetitionData() {
  if (!state.user) return; try { state.recentSearches = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]').slice(0, 6); } catch { state.recentSearches = []; } if (!state.songs.length) { try { const cached = JSON.parse(localStorage.getItem('soundwave-song-cache-v1') || '{}'); if (Array.isArray(cached.songs) && cached.songs.length) { state.songs = cached.songs; toast('You are viewing your recent SoundWave catalog offline.'); } } catch { } } const now = Date.now(), since90 = new Date(now - 90 * 86400000).toISOString(), since30 = new Date(now - 30 * 86400000).toISOString(); const hist = await db.from('listening_history').select('stream_id,user_id,song_id,stream_date,duration_played_seconds,completion_status').eq('user_id', state.user.id).gte('stream_date', since90).order('stream_date', { ascending: false }).limit(1500); state.insightHistory = hist.error ? (state.history || []) : mergeStreamHistory(hist.data || [], readCachedHistory()); state.listeningStats = computeListeningStats(state.insightHistory); const weekCut = now - 7 * 86400000, counts = new Map(); state.insightHistory.filter(r => new Date(r.stream_date).getTime() >= weekCut).forEach(r => counts.set(Number(r.song_id), (counts.get(Number(r.song_id)) || 0) + 1)); state.topWeekSongs = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => songById(id)).filter(Boolean).slice(0, 20); cacheSongMetadata(); const friendIds = [...new Set(state.following.map(x => x.followed_user_id).filter(Boolean))]; state.friendActivity = []; state.friendNow = []; if (friendIds.length) { const [fh, likes, pls, social] = await Promise.all([db.from('listening_history').select('user_id,song_id,stream_date').in('user_id', friendIds).order('stream_date', { ascending: false }).limit(40), db.from('saved_song').select('user_id,song_id,date_saved').in('user_id', friendIds).limit(60), db.from('playlist').select('user_id,playlist_name,date_created').in('user_id', friendIds).eq('is_active', true).limit(40), db.from('user_follow').select('follower_user_id,followed_user_id,date_followed').in('follower_user_id', friendIds).limit(100)]); if (!fh.error) state.friendNow = (fh.data || []).filter(r => now - new Date(r.stream_date).getTime() < 10 * 60 * 1000).map(r => { const s = songById(r.song_id), p = state.socialProfiles[String(r.user_id)]; return s ? { user_id: r.user_id, song_id: r.song_id, name: p?.display_name || 'A friend', song_title: s.song_title, artist_name: s.album?.artist?.artist_name || 'SoundWave', at: r.stream_date } : null; }).filter(Boolean).filter((x, i, a) => a.findIndex(y => String(y.user_id) === String(x.user_id)) === i); const events = []; if (!likes.error) (likes.data || []).forEach(r => { const s = songById(r.song_id), p = state.socialProfiles[String(r.user_id)]; if (s) events.push({ name: p?.display_name || 'A friend', initial: (p?.display_name || 'F')[0], text: `liked ${s.song_title}`, at: r.date_saved || new Date().toISOString() }); }); if (!pls.error) (pls.data || []).forEach(r => { const p = state.socialProfiles[String(r.user_id)]; events.push({ name: p?.display_name || 'A friend', initial: (p?.display_name || 'F')[0], text: `created ${r.playlist_name || 'a playlist'}`, at: r.date_created || new Date().toISOString() }); }); if (!social.error) (social.data || []).forEach(r => { const uid = r.follower_user_id || r.follower_id || r.user_id; if (!friendIds.some(x => String(x) === String(uid))) return; const p = state.socialProfiles[String(uid)]; events.push({ name: p?.display_name || 'A friend', initial: (p?.display_name || 'F')[0], text: 'followed someone new', at: r.date_followed || new Date().toISOString() }); }); state.friendActivity = events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20); } if (state.artist && state.ownedSongs.length) { await loadArtistRows(); const counts2 = new Map(); state.artistThirtyDay.forEach(r => counts2.set(String(r.user_id), (counts2.get(String(r.user_id)) || 0) + 1)); state.artistTopListeners = [...counts2.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uid, count]) => ({ uid, count, name: analyticsListenerName(uid) })); void hydrateArtistTopListenerLabels(); }
  if (hasAdminAccess()) { await loadAdminRows(); } else state.adminAnalyticsHistory = [];
  await refreshPodcastRecommendationSignals(); state.competitionLoaded = true;
}
function showOnboarding() {
  const roleKey = hasAdminAccess() ? (hasArtistAccess() ? 'artist-admin' : 'admin') : hasArtistAccess() ? 'artist' : 'listener';
  const key = `soundwave-onboarded-unified-${state.user?.id}`; if (!state.user || localStorage.getItem(key) || document.querySelector('.onboarding')) return;
  if (['listener', 'artist', 'admin', 'artist-admin'].some(r => localStorage.getItem(`soundwave-onboarded-${r}-${state.user.id}`))) { localStorage.setItem(key, '1'); return; }
  const tours = {
    listener: [['Welcome to Discover', 'Discover brings albums, recommendations, new releases, artists and podcasts into one focused page.', '♫'], ['Search and save', 'Find music fast, like songs, follow artists and build playlists.', '♥'], ['Keep the music moving', 'Use the player, queue and podcast resume tools across desktop and mobile.', '▶']],
    artist: [['Welcome to Artist Studio', 'Your sidebar has one clear Studio entry for releases and performance.', '✦'], ['Publish with confidence', 'Create albums and songs using your existing SoundWave catalog workflow.', '♫'], ['Read your audience', 'Track streams, top listeners and royalty estimates without leaving Studio.', '↗']],
    admin: [['Welcome to Moderation', 'Your sidebar has one clear Moderation entry for protected admin work.', '◆'], ['Review safely', 'Manage accounts, artists, songs and podcasts through existing RLS/RPC rules.', '✓'], ['Stay focused', 'Listener tools remain available, but dashboard links no longer compete for attention.', '◎']],
    'artist-admin': [['Two roles, two workspaces', 'Artist Studio and Moderation are the only dashboard destinations in your sidebar.', '✦'], ['Create and review', 'Publish your own catalog in Studio, then switch to Moderation for protected admin actions.', '◆'], ['No duplicate routes', 'Profile and top-bar dashboard shortcuts are removed to keep navigation predictable.', '✓']]
  };
  const slides = tours[roleKey]; let i = 0; const wrap = document.createElement('div'); wrap.className = 'onboarding';
  const close = () => { localStorage.setItem(key, '1'); wrap.remove(); };
  const draw = () => { const [t, d, ico] = slides[i]; wrap.innerHTML = `<div class="onboarding-card"><div class="onboarding-illustration">${ico}<i></i><i></i><i></i></div><span class="eyebrow">${roleKey.replace('-', ' + ').toUpperCase()} TOUR · ${i + 1}/3</span><h2>${t}</h2><p>${d}</p><div class="onboarding-dots">${slides.map((_, n) => `<span class="${n === i ? 'active' : ''}"></span>`).join('')}</div><div class="inline"><button class="button secondary" id="tour-skip">Skip</button><button class="button" id="tour-next">${i === 2 ? 'Done' : 'Next'}</button></div></div>`; wrap.querySelector('#tour-skip').onclick = close; wrap.querySelector('#tour-next').onclick = () => { if (i === 2) close(); else { i++; draw(); } }; };
  document.body.append(wrap); draw();
}
function animateCounters() { document.querySelectorAll('[data-count]').forEach(el => { const end = Number(el.dataset.count) || 0; if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = end; return; } let start = 0, t0 = performance.now(); const tick = t => { const p = Math.min(1, (t - t0) / 700); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick) }; requestAnimationFrame(tick); }); }
function afterCompetitionRender() { document.getElementById('app')?.classList.add('route-enter'); requestAnimationFrame(() => document.getElementById('app')?.classList.remove('route-enter')); animateCounters(); setupPlaylistPresence(); showOnboarding(); }

function notFound() { state.tint = '#2b333f'; shell(`<section class="not-found"><div class="not-found-code">404</div><div><span class="eyebrow">TRACK NOT FOUND</span><h2>This page skipped a beat.</h2><p>The link may be old, private, or unavailable to your account.</p><button type="button" class="button" data-nav="discover">Back to SoundWave</button></div></section>`, 'Lost in the mix', ''); }
function karaokePanelOpen() { return Boolean(state.karaokeMode && document.body.classList.contains('karaoke-mode') && document.querySelector('.karaoke-panel')); }
// Live-stat refreshes call this instead of render(): redrawing the page rebuilds the karaoke panel (lyrics jump back to the
// top and the whole view flashes), so while karaoke/lyrics is open the redraw waits until it is closed.
function backgroundRender() { if (karaokePanelOpen()) { state.renderPending = true; return; } render(); }
function render() {
  state.renderPending = false;
  if (requireConfig()) return;
  if (!state.user) { authView(); return; }
  if (state.profile && state.profile.is_active === false) { deactivatedAccountView(); return; }
  if (!pageAllowed(state.page)) state.page = 'discover';
  if (state.karaokeMode && state.karaokeHostPage !== state.page && !['music', 'discover', 'karaoke', 'artist-detail', 'album-detail', 'playlists'].includes(state.page)) { state.karaokeMode = false; document.body.classList.remove('karaoke-mode'); }
  switch (state.page) {
    case 'discover': discoverPage(); break;
    case 'home': home(); break;
    case 'listener-dashboard': discoverPage(); break;
    case 'artist-dashboard': artistDashboard(); break;
    case 'admin-dashboard': adminDashboard(); break;
    case 'song-streams': songStreamsPage(); break;
    case 'history': history(); refreshHistory(); break;
    case 'music': music(); break;
    case 'artists': artists(); break;
    case 'artist-detail': artistDetail(); break;
    case 'album-detail': albumDetail(); break;
    case 'liked-artists': likedArtists(); break;
    case 'liked-songs': likedSongsPage(); break;
    case 'top-songs': topSongsPage(); break;
    case 'mix': mixPage(); break;
    case 'mood': moodPage(); break;
    case 'karaoke': karaokePage(); break;
    case 'charts': chartsPage(); break;
    case 'followers': followers(); break;
    case 'notifications': notificationsPage(); break;
    case 'song-reports': songReportsPage(); break;
    case 'crowdqueue': crowdQueuePage(); break;
    case 'profile': profile(); break;
    case 'person-detail': publicPersonProfile(); break;
    case 'playlists': playlists(); break;
    case 'downloads': downloadsPage(); break;
    case 'podcasts': podcasts(); break;
    case 'podcast-studio': podcastStudio(); break;
    case 'plans': plans(); break;
    case 'studio': studio(); break;
    case 'admin': admin(); break;
    case 'not-found': notFound(); break;
    default: home();
  }
  afterRender();
  afterCompetitionRender();
}
async function acceptPendingPlaylistInvite() {
  if (state.playlistInviteHandled || !state.user) return;
  const token = new URLSearchParams(location.search).get('playlist_invite');
  if (!token) return;
  state.playlistInviteHandled = true;
  try {
    const data = check(await db.rpc('accept_playlist_invite', { p_token: token }));
    toast('Playlist collaboration accepted');
    await loadData();
    const u = new URL(window.location.href);
    u.searchParams.delete('playlist_invite');
    const cleanUrl = u.pathname + u.search + (u.hash || '#/playlists');
    window.history.replaceState(window.history.state || {}, document.title, cleanUrl);
  } catch (e) { console.error(e); toast(humanErr(e), true); }
}
async function ensureOAuthProfile(user) {
  if (!user?.id) return;
  const existing = await db.from('users').select('user_id,account_type').eq('user_id', user.id).maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST116') throw existing.error;
  if (existing.data) { sessionStorage.removeItem('soundwave-google-registration'); return; }
  let intent = null;
  try { intent = JSON.parse(sessionStorage.getItem('soundwave-google-registration') || 'null'); } catch { }
  const role = intent?.role === 'Artist' ? 'Artist' : 'Listener';
  const meta = user.user_metadata || {};
  const display = String(meta.full_name || meta.name || user.email?.split('@')[0] || 'SoundWave User').trim().slice(0, 90);
  const payload = { user_id: user.id, display_name: display || 'SoundWave User', account_type: role, is_active: true };
  const created = await db.from('users').insert(payload);
  if (created.error) {
    if (/23505|duplicate|already exists/i.test(String(created.error.message || ''))) return;
    throw new Error('Google sign-in succeeded, but the account could not be created: ' + created.error.message);
  }
  if (role === 'Artist') {
    const artistName = String(intent?.artistName || display || '').trim().slice(0, 100);
    const found = await db.from('artist').select('artist_id').eq('user_id', user.id).maybeSingle();
    if (found.error && found.error.code !== 'PGRST116') throw found.error;
    if (!found.data) {
      const added = await db.from('artist').insert({ user_id: user.id, artist_name: artistName, is_active: true });
      if (added.error) throw new Error('Your Google account was created, but Artist Studio setup needs attention: ' + added.error.message);
    }
  }
  sessionStorage.removeItem('soundwave-google-registration');
}
async function waitForAuthSession(timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data?.session?.user) return data.session;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return null;
}
function cleanOAuthUrl() {
  const u = new URL(window.location.href);
  ['code', 'oauth', 'error', 'error_code', 'error_description'].forEach(k => u.searchParams.delete(k));
  if (/^#(?:access_token|error|type|expires_in|provider_token)/i.test(u.hash || '')) u.hash = '#/discover';
  window.history.replaceState(window.history.state || {}, document.title, `${u.pathname}${u.search}${u.hash || '#/discover'}`);
  sessionStorage.removeItem('soundwave-oauth-return');
}
async function completeOAuthReturn() {
  const params = new URLSearchParams(location.search);
  const oauthError = params.get('error_description') || params.get('error');
  if (oauthError) { const err = new Error(oauthError); err.code = params.get('error_code') || 'oauth_error'; cleanOAuthUrl(); throw err; }
  // A code beginning with 4/ is a Google authorization code. It must never be
  // delivered directly to the SPA; Google must redirect to Supabase first.
  const rawCode = params.get('code') || '';
  if (/^4\//.test(rawCode)) {
    const err = new Error('Google returned a raw authorization code directly to SoundWave. In Google Cloud Console, the Authorized redirect URI must be exactly https://azqbzyxknfdwfuqevbrd.supabase.co/auth/v1/callback. Remove any soundwave-gold.vercel.app redirect URI from the Google OAuth client.');
    err.code = 'google_redirect_misconfigured';
    cleanOAuthUrl();
    throw err;
  }
  const expected = sessionStorage.getItem('soundwave-oauth-return') === 'google' || /access_token=|error_description=/i.test(String(location.hash || ''));
  if (!expected) return null;
  const session = await waitForAuthSession(12000);
  if (!session) { const err = new Error('Google returned to SoundWave, but Supabase did not create a session. Check the Supabase redirect URL and Google OAuth callback settings.'); err.code = 'oauth_session_missing'; throw err; }
  cleanOAuthUrl();
  return session;
}
async function boot() {
  if (requireConfig()) return;
  captureMayaReturn();
  try {
    let oauthSession = null;
    const oauthParams = new URLSearchParams(location.search);
    if (oauthParams.has('code') || oauthParams.has('error') || /access_token=|error_description=/i.test(String(location.hash || '')) || sessionStorage.getItem('soundwave-oauth-return') === 'google') {
      oauthSession = await completeOAuthReturn();
    }
    let result = oauthSession ? { data: { session: oauthSession }, error: null } : await db.auth.getSession();
    if (result.error) throw result.error;
    state.user = result.data.session?.user || null; state.hist.i = window.history.state?.i ?? 0; state.hist.max = state.hist.i;
    if (state.user) {
      await ensureOAuthProfile(state.user);
      await loadData(); await loadCompetitionData(); await restoreLastSongPlayer(); setupRealtime(); bindCrossDeviceRefresh(); await acceptPendingPlaylistInvite();
      const matched = applyHash(location.hash), firstRoleEntry = !sessionStorage.getItem('soundwave-role-entry');
      const roleLanding = defaultLanding(), listenerLanding = roleLanding === 'discover';
      if (!matched || (firstRoleEntry && /^#\/(?:discover|home)?$/.test(location.hash || '#/discover')) || (!listenerLanding && state.page === 'discover')) state.page = roleLanding;
      sessionStorage.setItem('soundwave-role-entry', '1');
    }
    await routeLoad();
    if (state.user) { setTimeout(() => acceptPendingSubscriptionInvite(), 120); schedulePendingPaymentVerification(180); }
  } catch (e) {
    console.error(e); state.error = humanErr(e);
    let session = null; try { session = (await db.auth.getSession()).data?.session || null; } catch { }
    if (session?.user) {
      state.user = session.user;
      try { await ensureOAuthProfile(state.user); await loadData(); } catch (dataErr) { console.error('Authenticated, but app data initialization failed', dataErr); state.error = `Signed in, but SoundWave could not load all account data: ${humanErr(dataErr)}`; }
      render(); toast(state.error, true);
    } else { authView(); toast(state.error, true); }
  }
  db.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      action(async () => {
        const newUser = session?.user || null; if (newUser?.id === state.user?.id) return;
        await stopAudio(); cleanupSessionRuntime(); state.user = newUser; state.coverUrls = {}; state.selectedPlaylist = null; state.page = 'discover'; state.routeReady = false;
        if (newUser) { await ensureOAuthProfile(newUser); await loadData(); await loadCompetitionData(); await restoreLastSongPlayer(); setupRealtime(); bindCrossDeviceRefresh(); state.playlistInviteHandled = false; await acceptPendingPlaylistInvite(); state.page = defaultLanding(); }
        render();
        if (newUser) { setTimeout(() => acceptPendingSubscriptionInvite(), 120); schedulePendingPaymentVerification(180); }
      });
    }, 0);
  });
}
function queueRow(item, idx) {
  const rowHtml = `<button type="button" class="queue-row ${idx == null ? 'current' : ''}" ${idx != null ? `data-queue-jump="${idx}"` : ''}><span class="queue-art">${item.song ? albumArt(item.song, 'tiny') : `<span class="placeholder-art tiny">${icon('mic')}</span>`}</span><span class="queue-text"><strong>${esc(item.title)}</strong><small>${esc(item.artist)}</small></span></button>`;
  return item.song ? `<div class="queue-row-wrap">${rowHtml}<button type="button" class="queue-report" data-report-song="${Number(item.song.song_id)}" aria-label="Report ${esc(item.title)}">${icon('flag')}</button></div>` : rowHtml;
}

function getCrowdQueueInviteLink(code) {
  const c = code || crowdQueue.session?.invite_code || '';
  const base = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
  return `${base}#/crowdqueue?join=${encodeURIComponent(c)}`;
}

async function copyCrowdQueueInviteLink(code) {
  const link = getCrowdQueueInviteLink(code);
  try {
    await navigator.clipboard.writeText(link);
    toast('Invite link copied! Send it to friends to join instantly.');
  } catch {
    toast(`Invite link: ${link}`);
  }
}

function crowdQueueRailHtml() {
  const s = crowdQueue.session;
  if (!s || s.status !== 'active') {
    return `<div class="rail-title cq-rail-title">
      <div class="cq-rail-heading">
        <h2>CrowdQueue</h2>
      </div>
      <div class="rail-tools">
        <button type="button" id="close-rail" class="icon-quiet" aria-label="Hide this panel" title="Hide">${icon('close')}</button>
      </div>
    </div>
    <div class="cq-rail-empty-session">
      <div class="cq-lock-icon">${icon('queue')}</div>
      <h3>No Active Room</h3>
      <p class="muted">Join or create a CrowdQueue session to listen and vote together in real time.</p>
      <button type="button" class="button small" data-nav="crowdqueue">Open CrowdQueue</button>
    </div>`;
  }

  const isHost = Boolean(s.is_host);
  const queue = Array.isArray(s.queue) ? s.queue : [];
  const upcoming = queue.filter(q => q.status === 'upcoming');
  const participants = Array.isArray(s.participants) ? s.participants : [];
  const pb = s.playback || {};
  const currentSong = pb.current_song_id ? ((typeof songById === 'function' ? songById(pb.current_song_id) : null) || queue.find(q => Number(q.song_id) === Number(pb.current_song_id))) : null;
  const suggestSongs = (Array.isArray(state.songs) && state.songs.length ? state.songs : (state.allSongs || [])).slice(0, 4);

  return `<div class="cq-rail-container">
    <div class="rail-title cq-rail-title">
      <div class="cq-rail-heading">
        <div class="cq-live-tag"><span class="cq-live-dot"></span> Live Room</div>
        <h2 title="${esc(s.session_name)}">${esc(s.session_name)}</h2>
      </div>
      <div class="rail-tools">
        ${state.player?.kind === 'song' ? `<button type="button" class="cq-pill-switch" data-rail-tab="now" title="Switch to Track details">${icon('music')} Track</button>` : ''}
        <button type="button" id="close-rail" class="icon-quiet" aria-label="Hide this panel" title="Hide">${icon('close')}</button>
      </div>
    </div>

    <!-- Direct Invite Link Card -->
    <div class="cq-rail-invite-card">
      <div class="cq-rail-invite-text">
        <span class="cq-invite-kicker">INVITE BY LINK</span>
        <strong>Share Invite Link</strong>
        <small>Anyone with the link joins instantly</small>
      </div>
      <button type="button" class="cq-copy-link-action" id="cq-rail-copy-link" title="Copy direct shareable link" aria-label="Copy direct invite link">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>Copy Link</span>
      </button>
    </div>

    <!-- Room Status & Host Order Controls -->
    <div class="cq-rail-status-bar">
      <span class="cq-stat-pill"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> ${participants.length} ${participants.length === 1 ? 'listener' : 'listeners'}</span>
      <span class="cq-stat-pill ${isHost ? 'host' : ''}">${isHost ? '👑 Host' : '🎧 Member'}</span>
      ${isHost ? `
        <select class="cq-rail-order-select" id="cq-rail-mode-switch" aria-label="Order mode">
          <option value="voted" ${s.order_mode === 'voted' ? 'selected' : ''}>⬆ Top Voted</option>
          <option value="chronological" ${s.order_mode === 'chronological' ? 'selected' : ''}>⏱ Chronological</option>
        </select>
      ` : `
        <span class="cq-stat-pill">${s.order_mode === 'voted' ? '⬆ Voted' : '⏱ Added'}</span>
      `}
    </div>

    <!-- Now Playing in Session -->
    ${currentSong ? `
      <div class="cq-rail-np">
        <span class="cq-rail-np-kicker"><span class="cq-eq-bars"><s></s><s></s><s></s></span> NOW PLAYING</span>
        <div class="cq-rail-np-body">
          ${currentSong.cover_path && state.coverUrls && state.coverUrls[currentSong.cover_path]
        ? `<img class="cq-rail-np-art" src="${esc(state.coverUrls[currentSong.cover_path])}" alt="">`
        : `<div class="cq-rail-np-art placeholder-art">${icon('music')}</div>`}
          <div class="cq-rail-np-meta">
            <strong title="${esc(currentSong.song_title || currentSong.title)}">${esc(currentSong.song_title || currentSong.title)}</strong>
            <small>${esc(currentSong.artist_name || currentSong.artist || 'Artist')}</small>
          </div>
          ${isHost ? `
            <div class="cq-rail-np-btns">
              <button type="button" class="cq-mini-btn" id="cq-rail-np-play" title="${pb.is_playing ? 'Pause' : 'Play'}">${pb.is_playing ? icon('pause') : icon('play')}</button>
              <button type="button" class="cq-mini-btn" id="cq-rail-np-next" title="Next track">${icon('next')}</button>
            </div>
          ` : ''}
        </div>
        <div class="cq-rail-np-sync">${cqProgressHtml()}${cqSyncChipHtml(isHost)}</div>
      </div>
    ` : ''}

    <!-- Quick Add to Queue (Live Search + Suggestions) -->
    <div class="cq-rail-add-box">
      <div class="cq-rail-search-bar">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="cq-search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="search" id="cq-rail-search" placeholder="Add song or artist to queue…" aria-label="Add song to queue" autocomplete="off">
        <button type="button" class="cq-search-clear" id="cq-rail-search-clear" hidden aria-label="Clear search">✕</button>
      </div>
      <div class="cq-rail-search-dropdown" id="cq-rail-search-dropdown" hidden></div>
      ${suggestSongs.length ? `
        <div class="cq-rail-suggestions" id="cq-rail-suggestions">
          <span class="cq-sug-label">Quick Add:</span>
          <div class="cq-sug-chips">
            ${suggestSongs.map(sg => `
              <button type="button" class="cq-sug-chip" data-cq-add-song="${sg.song_id}" title="Add ${esc(sg.song_title)}">
                ${icon('plus')} <span>${esc(sg.song_title)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Upcoming Queue List -->
    <div class="cq-rail-queue-section">
      <div class="cq-rail-queue-head">
        <h4>Upcoming Queue (${upcoming.length})</h4>
      </div>
      <div class="cq-rail-list" id="cq-rail-queue-list">
        ${upcoming.length ? upcoming.map((item, idx) => {
          const qid = Number(item.queue_item_id);
          const canRemove = isHost || (state.user?.id && String(item.added_by) === String(state.user.id));
          const hasVoted = item.my_vote === 1;
          const cover = item.cover_path && state.coverUrls && state.coverUrls[item.cover_path]
            ? `<img class="cq-rail-item-art" src="${esc(state.coverUrls[item.cover_path])}" alt="">`
            : `<div class="cq-rail-item-art placeholder-art">${icon('music')}</div>`;

          return `<div class="cq-rail-item" data-queue-item="${qid}">
            <span class="cq-rail-item-rank">${idx + 1}</span>
            ${cover}
            <div class="cq-rail-item-text">
              <strong title="${esc(item.song_title)}">${esc(item.song_title)}</strong>
              <small>${esc(item.artist_name || 'Artist')} · <span class="muted">${esc(item.added_by_name || 'Listener')}</span></small>
            </div>
            <div class="cq-rail-item-actions">
              <button type="button" class="cq-vote-pill ${hasVoted ? 'has-voted' : ''}" data-cq-vote="${qid}" aria-label="Vote for ${esc(item.song_title)}" aria-pressed="${hasVoted}">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                <span>${Number(item.score || 0)}</span>
              </button>
              ${canRemove ? `<button type="button" class="cq-item-del" data-cq-remove="${qid}" title="Remove from queue" aria-label="Remove">${icon('close')}</button>` : ''}
              ${isHost && s.order_mode === 'chronological' ? `
                <div class="cq-rail-reorder-pair">
                  ${idx > 0 ? `<button type="button" class="cq-order-micro" data-cq-up="${qid}" title="Move up" aria-label="Move up"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg></button>` : ''}
                  ${idx < upcoming.length - 1 ? `<button type="button" class="cq-order-micro" data-cq-down="${qid}" title="Move down" aria-label="Move down"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>` : ''}
                </div>
              ` : ''}
            </div>
          </div>`;
        }).join('') : `
          <div class="cq-rail-empty-queue">
            <div class="cq-empty-queue-icon">${icon('music')}</div>
            <p>Queue is empty</p>
            <small class="muted">Search or click a suggestion above to add tracks</small>
          </div>
        `}
      </div>
    </div>

    <!-- Footer -->
    <div class="cq-rail-footer">
      <button type="button" class="button small secondary w-full" id="cq-rail-leave-btn">
        ${isHost ? 'End Session' : 'Leave Session'}
      </button>
    </div>
  </div>`;
}

function railHtml() {
  const p = state.player;
  const inCrowdSession = Boolean(crowdQueue.session && crowdQueue.session.status === 'active');

  // If currently in a CrowdQueue session and user has not toggled to solo Now Playing
  if (inCrowdSession && state.railTab !== 'now') {
    return crowdQueueRailHtml();
  }
  if (!inCrowdSession && state.railTab === 'crowdqueue') {
    return crowdQueueRailHtml();
  }

  const tab = state.railTab === 'lyrics' ? 'now' : state.railTab;
  const head = `<div class="rail-title"><h2>${tab === 'queue' ? 'Queue' : tab === 'lyrics' ? 'Lyrics' : 'Now playing'}</h2><div class="rail-tools">${inCrowdSession ? `<button type="button" class="cq-pill-switch" data-rail-tab="crowdqueue" title="Switch to CrowdQueue">${icon('queue')} Room</button>` : ''}<button type="button" id="close-rail" class="icon-quiet" aria-label="Hide this panel" title="Hide">${icon('close')}</button></div></div>`;
  if (!p) return `${head}<div class="now-card empty-now"><span class="now-art placeholder">${icon('music')}</span><h3>Nothing playing</h3><p class="muted">Pick a song and its details will show up here.</p></div>${friendNowHtml()}${friendActivityHtml()}`;
  const song = p.kind === 'song' ? songById(p.id) : null;
  const current = { song, title: p.title, artist: p.artist };
  if (tab === 'queue') {
    const up = p.kind === 'song' ? p.order.slice(p.pos + 1).map((id, k) => ({ id, idx: p.pos + 1 + k, s: songById(id) })).filter((x) => x.s) : [];
    return `${head}<div class="queue-block"><h4>Now playing</h4>${queueRow(current, null)}</div><div class="queue-block"><h4>Next up</h4>${up.length ? up.slice(0, 60).map((x) => queueRow({ song: x.s, title: x.s.song_title, artist: x.s.album?.artist?.artist_name || 'SoundWave' }, x.idx)).join('') : '<p class="muted small">Nothing queued. Play an album or playlist, or choose “Add to queue”.</p>'}</div>`;
  }
  if (tab === 'lyrics' && song) {
    const lyric = state.lyricsCache[String(song.song_id)];
    return `${head}<section class="rail-card lyrics-rail"><h4>${esc(song.song_title)}</h4>${lyric === undefined ? '<p class="muted">Loading lyrics…</p>' : lyric ? `<div class="lyrics-display">${esc(lyric).replace(/\n/g, '<br>')}</div>` : '<p class="muted">Lyrics have not been added for this song yet.</p>'}</section>`;
  }
  const artist = song?.album?.artist;
  const full = artist && state.artists.find((a) => Number(a.artist_id) === Number(artist.artist_id));
  const saved = full && state.favorites.some((f) => Number(f.artist_id) === Number(full.artist_id));
  const nextId = p.kind === 'song' ? p.order[p.pos + 1] : null, next = nextId != null ? songById(nextId) : null;
  if (p.kind === 'podcast') {
    const episode = state.episodes.find(e => Number(e.episode_id) === Number(p.id));
    const show = state.podcasts.find(x => Number(x.show_id) === Number(episode?.show_id || p.show_id));
    const subtitle = show?.show_title || p.artist || 'SoundWave Podcasts';
    return `${head}<div class="podcast-rail-feature"><div class="podcast-rail-art">${icon('mic')}<span class="podcast-rail-pulse"></span></div><span class="podcast-rail-kicker">NOW PLAYING · PODCAST</span><h3>${esc(p.title || 'Podcast episode')}</h3><p>${esc(subtitle)}</p><div class="podcast-rail-meta"><span>${icon('headphones')} Listening now</span>${episode?.duration_seconds ? `<span>${nice(episode.duration_seconds)}</span>` : ''}</div></div><section class="podcast-rail-details"><span class="eyebrow">EPISODE DETAILS</span><h4>${esc(p.title || 'Episode')}</h4><p>${esc(episode?.description || show?.description || 'Listen to this episode and explore more from the show.')}</p>${show ? `<button type="button" class="button secondary" data-open-show="${show.show_id}">View podcast ${icon('forward')}</button>` : ''}</section><section class="podcast-rail-tip">${icon('headphones')}<span>Continue listening from the player below. Your queue and episode controls remain available.</span></section>`;
  }
  return `${head}<div class="now-card"><span class="now-art">${p.kind === 'podcast' ? `<span class="placeholder-art large">${icon('mic')}</span>` : albumArt(song, 'large')}</span><div class="now-title"><div><h3>${esc(p.title)}</h3><p class="muted">${artist ? `<a href="#/artist-detail/${artist.artist_id}" data-open-artist="${artist.artist_id}">${esc(p.artist)}</a>` : esc(p.artist)}</p></div>${song ? `<button type="button" class="queue-report rail-report" data-report-song="${Number(song.song_id)}" data-report-title="${esc(p.title)}" data-report-artist="${esc(p.artist)}" aria-label="Report song" title="Report song">${icon('flag')}</button>` : ''}</div></div>
 ${song ? railLyricsCardHtml(song) : ''}
 ${full ? `<section class="rail-card about"><h4>About the artist</h4><span class="about-art" data-artist-photo-host="${Number(full.artist_id)}" style="background:${grad(full.artist_id)};overflow:hidden;display:grid;place-items:center">${artistArtwork(full, 'rail-artist-avatar')}</span><strong>${esc(full.artist_name)}</strong><p>${esc(full.bio || full.country || 'SoundWave artist')}</p>${followBtn(full, 'sm')}</section>` : ''}
 ${next ? `<section class="rail-card"><div class="rail-card-head"><h4>Next in queue</h4><button type="button" class="text-link" data-rail-tab="queue">Open queue</button></div>${queueRow({ song: next, title: next.song_title, artist: next.album?.artist?.artist_name || 'SoundWave' }, p.pos + 1)}</section>` : ''}${friendNowHtml()}${friendActivityHtml()}`;
}
// ---- CrowdQueue quick access (top bar, Your Library, + menu) -----------------------------------------
function crowdQueueIsLive() { return typeof crowdQueue !== 'undefined' && Boolean(crowdQueue.session && crowdQueue.session.status === 'active'); }
function crowdQueueTopBtnHtml() {
  const live = crowdQueueIsLive();
  return `<button type="button" class="top-listen-btn top-cq-btn ${live ? 'is-live' : ''}" data-nav="crowdqueue" data-cq-entry aria-label="${live ? 'Open your live CrowdQueue room' : 'Open CrowdQueue'}" title="CrowdQueue: listen together">${icon('users')}<span>CrowdQueue</span><i class="cq-entry-dot" aria-hidden="true"></i></button>`;
}
function crowdQueueLibraryCardHtml() {
  const live = crowdQueueIsLive();
  return `<button type="button" class="library-cq ${live ? 'is-live' : ''}" data-nav="crowdqueue" data-cq-entry title="CrowdQueue: listen together"><span class="library-cq-icon">${icon('users')}</span><span class="library-cq-text"><strong>CrowdQueue</strong><small data-cq-status>${live ? 'Room live · tap to rejoin' : 'Listen and vote together'}</small></span><i class="cq-entry-dot" aria-hidden="true"></i></button>`;
}
// Keeps the "live" dot and wording right after a room starts or ends (called whenever the side panel refreshes).
function updateCrowdQueueEntries() {
  const live = crowdQueueIsLive();
  document.querySelectorAll('[data-cq-entry]').forEach(b => { b.classList.toggle('is-live', live); });
  document.querySelectorAll('[data-cq-status]').forEach(t => { t.textContent = live ? 'Room live · tap to rejoin' : 'Listen and vote together'; });
  document.querySelectorAll('.top-cq-btn').forEach(b => b.setAttribute('aria-label', live ? 'Open your live CrowdQueue room' : 'Open CrowdQueue'));
}
function refreshRail() {
  updateCrowdQueueEntries();
  const el = document.getElementById('context-rail'); if (!el) return;
  { const html = railHtml(); el.innerHTML = html; el._cqSig = html; } bindRail();
  const activeArtist = state.player?.kind === 'song' ? songById(state.player.id)?.album?.artist : null;
  if (activeArtist) { const a = state.artists.find(x => Number(x.artist_id) === Number(activeArtist.artist_id)); if (a) { updateArtistArtwork(a); if (!artistAvatarUrl(a)) void ensureArtistPhoto(a); } }
  $('#sw-queue')?.classList.toggle('active', state.railTab === 'queue' && !prefs.railHidden);
}
// ---- Lyrics text size (rail card, karaoke mode, mobile lyrics) -------------------------------------
const LYRICS_SCALES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
function lyricsScaleIndex() { const v = Number(prefs.lyricsScale) || 1; let best = 0; LYRICS_SCALES.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(LYRICS_SCALES[best] - v)) best = i; }); return best; }
function applyLyricsScale() {
  const i = lyricsScaleIndex();
  document.documentElement.style.setProperty('--lyrics-scale', String(LYRICS_SCALES[i]));
  document.querySelectorAll('[data-lyrics-size]').forEach(b => { b.disabled = b.dataset.lyricsSize === 'down' ? i === 0 : i === LYRICS_SCALES.length - 1; });
  document.querySelectorAll('[data-lyrics-size-label]').forEach(l => { l.textContent = Math.round(LYRICS_SCALES[i] * 100) + '%'; });
}
function lyricsSizeControlsHtml() {
  return `<span class="lyrics-size" role="group" aria-label="Lyrics text size"><button type="button" data-lyrics-size="down" aria-label="Smaller lyrics" title="Smaller lyrics">A<small>−</small></button><span class="lyrics-size-label" data-lyrics-size-label aria-live="polite"></span><button type="button" data-lyrics-size="up" aria-label="Larger lyrics" title="Larger lyrics">A<small>+</small></button></span>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-lyrics-size]'); if (!b || b.disabled) return;
  e.preventDefault();
  const i = lyricsScaleIndex(), next = Math.max(0, Math.min(LYRICS_SCALES.length - 1, i + (b.dataset.lyricsSize === 'up' ? 1 : -1)));
  prefs.lyricsScale = LYRICS_SCALES[next]; savePrefs(); applyLyricsScale();
  setTimeout(() => updateLyricsHighlight(true), 50);   // keep the current line centred after the size changes
});
applyLyricsScale();
// ---- Lyrics card in the Now playing panel (Spotify-style) -------------------------------------
function railLyricsCardHtml(song) {
  setTimeout(() => { fillRailLyrics(); applyLyricsScale(); }, 0);
  return `<section class="rail-card rail-lyrics rail-lyrics-preview" id="rail-lyrics" aria-label="Lyrics preview"><div class="rail-card-head"><h4>Lyrics preview</h4>${lyricsSizeControlsHtml()}</div><div class="rail-lyrics-wrap"><div class="rail-lyrics-body" data-rail-lyrics="${Number(song.song_id)}" data-rail-scroll="1" data-rail-preview="1">Loading lyrics…</div><button type="button" class="rail-lyrics-more" data-lyrics-more hidden>Show more</button></div></section>`;
}
async function fillRailLyrics() {
  const host = document.querySelector('.rail-lyrics-body[data-rail-lyrics]'); if (!host) return;
  const id = Number(host.dataset.railLyrics);
  const text = await ensureLyricsLoaded(id);
  const now = document.querySelector('.rail-lyrics-body[data-rail-lyrics]');
  if (!now || Number(now.dataset.railLyrics) !== id) return;
  renderLyricsInto(now, text, 'Lyrics haven’t been added to this song yet.');
  const more = now.parentElement?.querySelector('[data-lyrics-more]'); if (more) more.hidden = !String(text || '').trim();
}
// "Show more": open the full lyrics view (same panel as karaoke, without the instrumental). The size buttons work there too.
function openFullLyrics() {
  if (state.player?.kind !== 'song') return;
  state.karaokeMode = true; state.lyricsOnly = true;
  updateKaraokeButtons(); void syncKaraokePanel();
}
function closeFullLyrics() {
  state.karaokeMode = false; state.lyricsOnly = false;
  updateKaraokeButtons(); void syncKaraokePanel();
}
document.addEventListener('click', e => {
  if (e.target.closest?.('[data-lyrics-more]')) { e.preventDefault(); openFullLyrics(); return; }
  if (e.target.closest?.('[data-lyrics-close]')) { e.preventDefault(); closeFullLyrics(); }
});
// Player-bar Lyrics button: open the Now playing panel and bring the lyrics card into view.
document.addEventListener('click', e => {
  const btn = e.target.closest?.('[data-lyrics-rail]'); if (!btn) return;
  e.preventDefault();
  if (state.karaokeMode && state.lyricsOnly) { closeFullLyrics(); }
  if (prefs.railHidden) { toggleRail(false); $('#sw-view')?.classList.add('active'); }
  state.railTab = 'now'; refreshRail();
  setTimeout(() => { document.getElementById('rail-lyrics')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); updateLyricsHighlight(true); }, 60);
});
function bindRail() {
  const rail = document.getElementById('context-rail'); if (!rail) return;
  { const b = rail.querySelector('#close-rail'); if (b) b.onclick = () => { toggleRail(true); $('#sw-view')?.classList.remove('active'); }; }

  // CrowdQueue Sidebar bindings
  { const b = rail.querySelector('#cq-rail-copy-link'); if (b) b.onclick = () => void copyCrowdQueueInviteLink(); }

  const modeSel = rail.querySelector('#cq-rail-mode-switch');
  if (modeSel && crowdQueue.session?.is_host) {
    modeSel.onchange = async () => {
      const mode = modeSel.value;
      try {
        const res = await db.rpc('sw_cq_set_order_mode', {
          p_session_id: Number(crowdQueue.session.session_id),
          p_order_mode: mode
        });
        if (res.error) throw res.error;
        crowdQueue.session.order_mode = mode;
        toast(`Queue order set to ${mode === 'voted' ? 'Top Voted' : 'Chronological'}`);
        cqSoftRender(true);
      } catch (e) {
        toast(humanErr(e), true);
      }
    };
  }

  const railSearch = rail.querySelector('#cq-rail-search');
  const dropdown = rail.querySelector('#cq-rail-search-dropdown');
  const clearBtn = rail.querySelector('#cq-rail-search-clear');
  if (railSearch && dropdown) {
    railSearch.oninput = () => {
      const q = railSearch.value.trim().toLowerCase();
      if (clearBtn) clearBtn.hidden = !q;
      if (!q) {
        dropdown.hidden = true;
        dropdown.innerHTML = '';
        return;
      }
      const all = Array.isArray(state.allSongs) && state.allSongs.length ? state.allSongs : (state.songs || []);
      const matched = all.filter(s => {
        const t = (s.song_title || s.title || '').toLowerCase();
        const a = (s.album?.artist?.artist_name || s.artist_name || s.artist || '').toLowerCase();
        return t.includes(q) || a.includes(q);
      }).slice(0, 6);

      if (!matched.length) {
        dropdown.hidden = false;
        dropdown.innerHTML = `<div class="cq-rail-no-results">No songs found matching "${esc(q)}"</div>`;
        return;
      }
      dropdown.hidden = false;
      dropdown.innerHTML = matched.map(s => {
        const sid = Number(s.song_id || s.id);
        const cover = s.cover_path && state.coverUrls && state.coverUrls[s.cover_path]
          ? `<img class="cq-search-thumb" src="${esc(state.coverUrls[s.cover_path])}" alt="">`
          : `<div class="cq-search-thumb placeholder-art">${icon('music')}</div>`;
        return `<div class="cq-rail-search-row">
          ${cover}
          <div class="cq-search-meta">
            <strong>${esc(s.song_title || s.title)}</strong>
            <small>${esc(s.album?.artist?.artist_name || s.artist_name || s.artist || 'SoundWave')}</small>
          </div>
          <button type="button" class="button small secondary cq-quick-add-btn" data-cq-add-song="${sid}">${icon('plus')} Add</button>
        </div>`;
      }).join('');
    };

    if (clearBtn) {
      clearBtn.onclick = () => {
        railSearch.value = '';
        clearBtn.hidden = true;
        dropdown.hidden = true;
        dropdown.innerHTML = '';
        railSearch.focus();
      };
    }
  }

  // Delegated action handler inside the rail
  rail.onclick = (e) => {
    const addBtn = e.target.closest('[data-cq-add-song]');
    if (addBtn) {
      e.stopPropagation();
      const songId = Number(addBtn.dataset.cqAddSong);
      void addSongToCrowdQueue(songId);
      if (railSearch) railSearch.value = '';
      if (clearBtn) clearBtn.hidden = true;
      if (dropdown) { dropdown.hidden = true; dropdown.innerHTML = ''; }
      return;
    }
    const voteBtn = e.target.closest('[data-cq-vote]');
    if (voteBtn) {
      e.stopPropagation();
      void voteQueueItem(Number(voteBtn.dataset.cqVote));
      return;
    }
    const remBtn = e.target.closest('[data-cq-remove]');
    if (remBtn) {
      e.stopPropagation();
      void removeSongFromCrowdQueue(Number(remBtn.dataset.cqRemove));
      return;
    }
    const upBtn = e.target.closest('[data-cq-up]');
    if (upBtn) {
      e.stopPropagation();
      void reorderCrowdQueueItem(Number(upBtn.dataset.cqUp), -1);
      return;
    }
    const downBtn = e.target.closest('[data-cq-down]');
    if (downBtn) {
      e.stopPropagation();
      void reorderCrowdQueueItem(Number(downBtn.dataset.cqDown), 1);
      return;
    }
  };

  { const b = rail.querySelector('#cq-rail-np-play'); if (b) b.onclick = () => void hostTogglePlay(); }
  { const b = rail.querySelector('#cq-rail-np-next'); if (b) b.onclick = () => void hostPlayNextInCrowdQueue(); }
  { const b = rail.querySelector('#cq-rail-leave-btn'); if (b) b.onclick = () => { if (crowdQueue.session?.is_host) void closeCrowdQueueSession(); else void leaveCrowdQueueSession(); }; }
  rail.querySelectorAll('[data-rail-tab]').forEach((b) => b.onclick = () => { const next = b.dataset.railTab; state.railTab = next === state.railTab ? 'now' : next; refreshRail(); if (state.railTab === 'lyrics' && state.player?.kind === 'song') { const sid = String(state.player.id); if (state.lyricsCache[sid] === undefined) { db.from('song_lyrics').select('lyrics').eq('song_id', state.player.id).maybeSingle().then(r => { state.lyricsCache[sid] = r.error ? '' : (r.data?.lyrics || ''); if (state.railTab === 'lyrics') refreshRail(); }); } } });
  rail.querySelectorAll('[data-queue-jump]').forEach((b) => b.onclick = () => { const p = state.player; if (!p) return; const idx = Number(b.dataset.queueJump); playAction(() => playSong(p.order[idx], p.queue, { order: p.order, pos: idx })); });
  bindFavoriteButtons(new Set(state.favorites.map((f) => String(f.artist_id))));
  bindContent(rail);
}
function toggleRail(force) { prefs.railHidden = force ?? !prefs.railHidden; savePrefs(); document.body.classList.toggle('rail-hidden', prefs.railHidden); }
function albumDetail() {
  const al = albumById(state.selectedAlbum);
  if (!al) return music();
  const owner = al.artist, total = totalTime(al.songs);
  const canSeeStreams = true;
  void ensureAlbumStreamCounts(al);
  state.tint = tintFor(al.album_id);
  shell(`<header class="coll-hero"><div class="coll-cover">${albumArt({ song_id: al.album_id, album: al }, 'large')}</div><div class="coll-meta"><span class="coll-kind">${esc(al.release_type || 'Album')}</span><h1 class="coll-title">${esc(al.title)}</h1>${al.description ? `<p class="coll-desc">${esc(al.description)}</p>` : ''}<p class="coll-sub">${owner ? `<a href="#/artist-detail/${owner.artist_id}" data-open-artist="${owner.artist_id}"><strong>${esc(owner.artist_name)}</strong></a> · ` : ''}${yearOf(al.release_date) ? yearOf(al.release_date) + ' · ' : ''}${al.songs.length} ${al.songs.length === 1 ? 'song' : 'songs'}, ${total}</p></div></header>
<div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${ids(al.songs).join(',')}" aria-label="Play ${esc(al.title)}">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${ids(al.songs).join(',')}" aria-label="Shuffle play this album">${icon('shuffle')} Shuffle</button><button type="button" class="sw-quiet-action album-pin-control" data-pin-key="album:${al.album_id}" aria-label="${libraryPinnedIds().has('album:' + al.album_id) ? 'Unpin' : 'Pin'} album" title="${libraryPinnedIds().has('album:' + al.album_id) ? 'Unpin' : 'Pin'} album">${icon('pin')}</button></div>
${canSeeStreams ? `<p class="muted small album-stream-note">Times each song was played (streams of 30s or more, or completed)${state.albumStreamLoading[al.album_id] ? ' · updating…' : ''}</p>` : ''}
${trackTable(al.songs, { queue: ids(al.songs), showAlbum: false, extraLabel: canSeeStreams ? 'Plays' : '', extraClass: 'streams', extraCell: canSeeStreams ? ((song) => `<span class="stream-pill">${compactNumber(songVisibleStreamCount(song.song_id))}</span>`) : null })}
${(() => { const more = catalogAlbums().filter((a) => a.album_id !== al.album_id && Number(a.artist?.artist_id) === Number(owner?.artist_id)); return more.length ? `<section class="shelf-section"><div class="section-heading"><h2>More by ${esc(owner.artist_name)}</h2></div><div class="shelf">${more.map(albumTile).join('')}</div></section>` : ''; })()}`, '', '');
}
function rankedPersonalTopSongs(rows) {
  const scores = new Map();
  for (const r of rows || []) {
    const id = Number(r.song_id);
    if (!id || !(String(r.completion_status || '').toLowerCase() === 'completed' || Number(r.duration_played_seconds || 0) >= 30)) continue;
    const s = songById(id); if (!s || s.is_active === false || s.album?.is_active === false) continue;
    const current = scores.get(id) || { song: s, plays: 0, last: 0 };
    current.plays++;
    current.last = Math.max(current.last, Date.parse(r.stream_date) || 0);
    scores.set(id, current);
  }
  return [...scores.values()].sort((a, b) => b.plays - a.plays || b.last - a.last).slice(0, 50);
}
async function refreshPersonalTopSongs() {
  if (!state.user || state.topSongsLoading) return;
  state.topSongsLoading = true;
  try {
    const response = await db.from('listening_history')
      .select('stream_id,song_id,stream_date,duration_played_seconds,completion_status')
      .eq('user_id', state.user.id).order('stream_date', { ascending: false }).limit(5000);
    if (response.error) throw response.error;
    state.personalTopSongs = rankedPersonalTopSongs(response.data || []);
  } catch (error) { console.warn('Could not load personal top songs', error); state.personalTopSongs = rankedPersonalTopSongs(state.insightHistory || state.history || []); }
  finally { state.topSongsLoading = false; }
  if (state.page === 'top-songs') { topSongsPage(); renderLibraryList(); }
}
function topSongsPage() {
  const ranked = state.personalTopSongs || [], songs = ranked.map(x => x.song), display = state.profile?.display_name || 'You';
  state.tint = '#1f5c4d';
  shell(`<header class="coll-hero"><div class="coll-cover top-songs-cover">${icon('music')}</div><div class="coll-meta"><span class="coll-kind">Your listening history</span><h1 class="coll-title">Your Top Songs</h1><p class="coll-sub"><span class="sw-owner-avatar">${esc(display[0]?.toUpperCase() || 'S')}</span><strong>${esc(display)}</strong> · ${songs.length} tracks ranked by your qualified plays</p></div></header>
    <div class="coll-actions">${songs.length ? `<button type="button" class="sw-big-play" data-play-ids="${ids(songs).join(',')}" aria-label="Play your most played songs">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${ids(songs).join(',')}" aria-label="Shuffle play">${icon('shuffle')} Shuffle</button>` : ''}</div>
    ${songs.length ? `<p class="muted small">Ranked by your own completed plays or listens of at least 30 seconds.</p>${trackTable(songs, { queue: ids(songs), showAlbum: true, extraLabel: 'Your plays', extraClass: 'streams', extraCell: (song) => `<span class="stream-pill">${ranked.find(x => Number(x.song.song_id) === Number(song.song_id))?.plays || 0}</span>` })}` : `<div class="empty-state"><h3>${state.topSongsLoading ? 'Loading your top songs…' : 'No qualified plays yet'}</h3><p>Listen to songs for at least 30 seconds or finish them to build your personal ranking.</p><button class="button" type="button" data-nav="discover">Discover songs</button></div>`}`, '', '');
}
function likedSongsPage() {
  const songs = state.liked.map((x) => songById(x.song_id)).filter(Boolean);
  const display = state.profile?.display_name || 'You';
  state.tint = '#3a4658';
  shell(`<header class="coll-hero"><div class="coll-cover liked-cover">${icon('heart')}</div><div class="coll-meta"><span class="coll-kind">Playlist</span><h1 class="coll-title">Liked Songs</h1><p class="coll-sub"><span class="sw-owner-avatar">${esc(display[0]?.toUpperCase() || 'S')}</span><strong>${esc(display)}</strong> · <span data-liked-count>${songs.length} ${songs.length === 1 ? 'song' : 'songs'}</span></p></div></header>${likesNotice()}
<div class="coll-actions">${songs.length ? `<button type="button" class="sw-big-play" data-play-ids="${ids(songs).join(',')}" aria-label="Play Liked Songs">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${ids(songs).join(',')}" aria-label="Shuffle play">${icon('shuffle')} Shuffle</button>` : ''}</div>
${songs.length ? trackTable(songs, { queue: ids(songs) }) : `<div class="empty-state"><h3>Songs you like will appear here</h3><p>Save songs by tapping the heart icon.</p><button type="button" class="button" data-nav="music">Find something to play</button></div>`}`, '', '');
}
// ---------- Global interactions ----------
document.addEventListener('click', (e) => {
  const like = e.target.closest('[data-like]');
  if (like) { e.preventDefault(); e.stopPropagation(); toggleLike(like.dataset.like).catch((err) => { console.error(err); toast(humanErr(err), true); }); return; }
  const fav = e.target.closest('[data-fav]');
  if (fav) { e.preventDefault(); e.stopPropagation(); toggleFollow(fav.dataset.fav).catch((err) => { console.error(err); toast(humanErr(err), true); }); return; }
  if (!e.target.closest('.song-action-popover,[data-song-menu]')) document.querySelector('.song-action-popover')?.remove();
  if (!e.target.closest('.profile-wrap')) { const m = document.getElementById('profile-menu'); if (m) m.hidden = true; }
  if (!e.target.closest('.notif-wrap')) closeNotifPanel();
  if (!e.target.closest('.more-wrap')) { const m = document.getElementById('sw-more-options'); if (m) m.hidden = true; }
  const row = e.target.closest('.track[data-song]');
  if (row && !e.target.closest('button,a,input')) {
    // One click plays the song. Clicking the song that is already playing does nothing (use the play/pause button for that).
    const cur = state.player;
    if (!(cur?.kind === 'song' && Number(cur.id) === Number(row.dataset.song))) playRow(row);
  }
}, true);
// (A double-click no longer needs its own handler: the first click already plays the song.)
document.addEventListener('keydown', (e) => { if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return; const active = e.target.closest?.('#search-results .track[data-song],#search-results [data-open-artist],#search-results [data-open-album],#search-results [data-openplaylist],#search-results [data-open-show]'); if (!active) return; const rows = [...document.querySelectorAll('#search-results .track[data-song],#search-results [data-open-artist],#search-results [data-open-album],#search-results [data-openplaylist],#search-results [data-open-show]')]; const i = rows.indexOf(active); if (i < 0) return; e.preventDefault(); const n = e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1); rows[n]?.focus(); rows.forEach((r, j) => r.classList.toggle('kbd-active', j === n)); });
document.addEventListener('keydown', (e) => {
  const t = e.target, typing = t.matches?.('input,textarea,select,[contenteditable="true"]');
  if (e.key === 'Escape') { document.querySelector('.song-action-popover')?.remove(); return; }
  if (!state.user) return;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="link"][tabindex],.track[data-song]') && !e.target.closest('button,a,input')) {
    e.preventDefault();
    if (t.matches('.track')) playRow(t); else t.click();
    return;
  }
  if (typing || document.querySelector('dialog[open]')) return;
  const audio = document.getElementById('sw-audio');
  if (e.key === ' ' && audio && !t.matches?.('button,a,[role="button"]')) { e.preventDefault(); if (audio.paused) audio.play().catch(() => { }); else audio.pause(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); action(() => skip(1)); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); action(() => skip(-1)); }
  else if (e.key === '/') { e.preventDefault(); document.getElementById('global-search')?.focus(); }
});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installEvent = e; const b = document.getElementById('install-app'); if (b) b.hidden = false; });
window.addEventListener('appinstalled', () => { state.installEvent = null; const b = document.getElementById('install-app'); if (b) b.hidden = true; });
initMediaKeys();
/* ====== v49 PANEL-FEEDBACK ENHANCEMENTS ======
   Personalization, clearer analytics (Chart.js), admin drill-downs,
   deactivation reasons, charts page, filters, counters, seamless loading. */
const SEARCH_LIMIT = 80;
const PODCAST_CATEGORY_SUGGESTIONS = ['Technology', 'News', 'Comedy', 'Education', 'Business', 'Health & Wellness', 'True Crime', 'Music', 'Society & Culture', 'Sports', 'Science', 'Arts', 'Kids & Family', 'Religion & Spirituality'];
const DEACTIVATION_REASONS = [
  ['copyright', 'Copyright or ownership claim'],
  ['policy', 'Violates community guidelines'],
  ['spam', 'Spam, fake or misleading content'],
  ['explicit', 'Inappropriate or unlabelled explicit content'],
  ['abuse', 'Harassment or abusive behavior'],
  ['requested', 'Owner asked for removal'],
  ['other', 'Other (explain below)']
];
Object.assign(state, { playlistSignal: [], playlistSignalAt: 0, chartsTab: 'top100', chartTop: null, chartSource: '', chartBillboard: null, chartsAt: 0, chartsLoading: false });

/* ---------- Personalization: likes + playlists + follows + listening ---------- */
function buildAffinity() {
  const bump = (m, k, n) => { if (k) m.set(k, (m.get(k) || 0) + n); };
  const aff = { followed: new Set((state.favorites || []).map((r) => Number(r.artist_id))), likedArtists: new Map(), playlistArtists: new Map(), playArtists: new Map(), genreScores: new Map() };
  for (const r of state.liked || []) { const s = songById(r.song_id); if (!s) continue; bump(aff.likedArtists, Number(s.album?.artist?.artist_id), 1); bump(aff.genreScores, Number(s.genre_id), 2); }
  for (const r of state.playlistSignal || []) { const s = songById(r.song_id); if (!s) continue; bump(aff.playlistArtists, Number(s.album?.artist?.artist_id), 1); bump(aff.genreScores, Number(s.genre_id), 1.5); }
  for (const r of state.history || []) { const s = songById(r.song_id); if (!s) continue; bump(aff.playArtists, Number(s.album?.artist?.artist_id), 1); bump(aff.genreScores, Number(s.genre_id), 1); }
  return aff;
}
function affinityScore(aff, aid, gid, artistName) {
  let score = 0; const reasons = []; const who = artistName || 'this artist';
  if (aff.followed.has(aid)) { score += 40; reasons.push(`Because you follow ${who}`); }
  if (aff.likedArtists.has(aid)) { score += Math.min(30, aff.likedArtists.get(aid) * 10); reasons.push(`You liked songs by ${who}`); }
  if (aff.playlistArtists.has(aid)) { score += Math.min(24, aff.playlistArtists.get(aid) * 8); reasons.push(`${who} is in your playlists`); }
  if ((aff.playArtists.get(aid) || 0) >= 3) { score += 25; reasons.push(`You often play ${who}`); }
  if (aff.genreScores.has(gid)) {
    score += Math.min(20, aff.genreScores.get(gid) * 3);
    const g = (state.genres || []).find((x) => Number(x.genre_id) === gid);
    reasons.push(g ? `Matches your ${g.genre_name} taste` : 'Matches your listening');
  }
  return { score, reason: reasons[0] || '' };
}
function matchMeta(score) {
  if (score >= 60) return { cls: 'strong', label: 'Strong match' };
  if (score >= 25) return { cls: 'good', label: 'Good match' };
  return { cls: 'explore', label: 'Explore' };
}
function recommendationPicksDetailed(limit = 7) {
  const recent = new Set((state.history || []).slice(0, 10).map((r) => Number(r.song_id)));
  const aff = buildAffinity(), now = Date.now();
  const scored = (state.songs || []).filter((s) => !recent.has(Number(s.song_id))).map((song) => {
    const aid = Number(song.album?.artist?.artist_id), gid = Number(song.genre_id);
    const r = affinityScore(aff, aid, gid, song.album?.artist?.artist_name);
    let score = r.score;
    const rd = song.album?.release_date ? new Date(song.album.release_date).getTime() : 0;
    if (rd && now - rd <= 60 * 86400000) score += 5;
    return { song, score, reason: r.reason || 'Explore something new' };
  }).sort((a, b) => b.score - a.score || Number(b.song.song_id) - Number(a.song.song_id));
  const artistCounts = new Map(), out = [];
  for (const pick of scored) {
    const aid = Number(pick.song.album?.artist?.artist_id) || 0;
    if ((artistCounts.get(aid) || 0) >= 2) continue;
    artistCounts.set(aid, (artistCounts.get(aid) || 0) + 1); out.push(pick);
    if (out.length === limit) break;
  }
  return out;
}
function albumAffinity(album) {
  const aff = buildAffinity(), aid = Number(album.artist?.artist_id);
  let best = { score: 0, reason: '' };
  for (const s of album.songs || []) {
    const r = affinityScore(aff, aid, Number(s.genre_id), album.artist?.artist_name);
    if (r.score > best.score) best = r;
  }
  return best;
}
function freshTile(item) {
  const m = matchMeta(item.score);
  const caption = item.score > 0 ? `<span class="reason-caption">${esc(item.reason)}</span>` : '';
  return albumTile(item.album).replace(/<\/article>$/, `${caption}</article>`).replace('<span class="release-art">', `<span class="release-art"><span class="match-chip ${m.cls}">${m.label}</span>`);
}
async function ensurePlaylistSignal(force = false) {
  if (!state.user || !db || !(state.playlists || []).length) return;
  if (!force && Date.now() - state.playlistSignalAt < 15000) return;
  state.playlistSignalAt = Date.now();
  try {
    const res = await db.from('playlist_song').select('playlist_id,song_id').in('playlist_id', state.playlists.map((p) => p.playlist_id));
    if (res.error) throw res.error;
    const changed = (res.data || []).length !== (state.playlistSignal || []).length;
    state.playlistSignal = res.data || [];
    if (changed && state.page === 'discover') backgroundRender();
  } catch (e) { console.info('Playlist signals unavailable', e); }
}

/* ---------- Analytics rendering (Chart.js) ---------- */
function legacyBars(rows, label, value) {
  const max = Math.max(1, ...rows.map((x) => Number(x[value]) || 0));
  return `<div class="rank-bars">${rows.map((x, i) => `<div class="rank-bar"><div><span>${i + 1}</span><strong>${esc(x[label] || 'Unknown')}</strong><b>${Number(x[value]) || 0}</b></div><i><s style="width:${Math.max(4, ((Number(x[value]) || 0) / max) * 100)}%"></s></i></div>`).join('')}</div>`;
}
function chartBars(items, o = {}) {
  const { label = 'name', value = 'value', maxItems = 8, title = 'Top items', xLabel = 'Streams', yLabel = '', legend = 'Streams (last 30 days)' } = o;
  const rows = (items || []).slice(0, maxItems);
  if (!rows.length) return '<p class="muted small">No stream data is visible yet.</p>';
  const cfg = { kind: 'hbar', title, xLabel, yLabel, legend, labels: rows.map((x) => String(x[label] || 'Unknown')), data: rows.map((x) => Number(x[value]) || 0) };
  return `<div class="chart-wrap" style="height:${Math.max(190, rows.length * 34 + 90)}px"><canvas data-chart="${esc(JSON.stringify(cfg))}" role="img" aria-label="${esc(title)}"></canvas><template class="chart-fallback">${legacyBars(rows, label, value)}</template></div>`;
}
function sparkline(rows, o = {}) {
  const pts = rows.length ? rows : [0];
  const { title = 'Streams per day', legend = 'Streams per day', yLabel = 'Streams' } = o;
  const labels = pts.map((_, i) => { const d = new Date(Date.now() - (pts.length - 1 - i) * 86400000); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); });
  const cfg = { kind: 'line', title, legend, xLabel: `Date (last ${pts.length} days)`, yLabel, labels, data: pts };
  const max = Math.max(1, ...pts);
  const svg = `<svg class="sparkline" viewBox="0 0 360 95" preserveAspectRatio="none" aria-label="30 day streams"><polyline points="${pts.map((v, i) => `${(i / (pts.length - 1 || 1)) * 360},${88 - (v / max) * 72}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke"></polyline></svg>`;
  return `<div class="chart-wrap chart-wrap-line"><canvas data-chart="${esc(JSON.stringify(cfg))}" role="img" aria-label="${esc(title)}"></canvas><template class="chart-fallback">${svg}</template></div>`;
}
function renderCharts() {
  const canvases = document.querySelectorAll('canvas[data-chart]:not([data-ready])');
  if (!canvases.length) return;
  canvases.forEach((cv) => {
    cv.dataset.ready = '1';
    const wrap = cv.closest('.chart-wrap');
    if (!window.Chart) { const t = wrap?.querySelector('template.chart-fallback'); if (wrap && t) wrap.innerHTML = t.innerHTML; return; }
    let cfg; try { cfg = JSON.parse(cv.dataset.chart); } catch { return; }
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim() || '#f2a65a', text = css.getPropertyValue('--text-2').trim() || '#c9cfd8', grid = currentTheme() === 'light' ? 'rgba(24,28,62,.12)' : 'rgba(255,255,255,.08)';
    const trunc = (s) => (String(s).length > 24 ? String(s).slice(0, 23) + '…' : s);
    const hbar = cfg.kind === 'hbar';
    new window.Chart(cv, {
      type: hbar ? 'bar' : 'line',
      data: { labels: cfg.labels, datasets: [{ label: cfg.legend, data: cfg.data, backgroundColor: hbar ? accent : 'rgba(242,166,90,.18)', borderColor: accent, borderWidth: hbar ? 0 : 2, borderRadius: hbar ? 6 : 0, fill: !hbar, tension: .3, pointRadius: hbar ? 0 : (cfg.data.length > 45 ? 0 : 2), pointHoverRadius: 4 }] },
      options: {
        indexAxis: hbar ? 'y' : 'x', interaction: hbar ? undefined : { mode: 'index', intersect: false }, responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, layout: { padding: { right: hbar ? 36 : 8 } },
        plugins: {
          title: { display: true, text: cfg.title, align: 'start', color: text, font: { size: 13, weight: '600' }, padding: { bottom: 10 } },
          legend: { display: true, position: 'bottom', labels: { color: text, boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded', generateLabels: (ch) => window.Chart.defaults.plugins.legend.labels.generateLabels(ch).map((l) => ({ ...l, fillStyle: accent, strokeStyle: accent, lineWidth: 0 })) } },
          tooltip: { callbacks: { label: (c) => ` ${Number(hbar ? c.parsed.x : c.parsed.y).toLocaleString()} ${String((hbar ? cfg.xLabel : cfg.yLabel) || 'streams').toLowerCase()}` } }
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: cfg.xLabel, color: text }, grid: { color: grid }, ticks: { color: text, precision: 0, maxTicksLimit: hbar ? 6 : 8, autoSkip: true } },
          y: { beginAtZero: true, title: { display: !hbar && !!cfg.yLabel, text: cfg.yLabel, color: text }, grid: { color: grid }, ticks: { color: text, precision: 0, padding: 8, callback: hbar ? function (v) { const lim = this.chart.width < 430 ? 18 : 26, t = String(this.getLabelForValue(v)); return t.length > lim ? t.slice(0, lim - 1) + '…' : t; } : undefined, autoSkip: false } }
        }
      },
      plugins: hbar ? [{ id: 'swValueLabels', afterDatasetsDraw(ch) { const c = ch.ctx, m = ch.getDatasetMeta(0); c.save(); c.fillStyle = text; c.font = '700 12px ' + getComputedStyle(document.body).fontFamily; c.textBaseline = 'middle'; m.data.forEach((bar, i) => { c.fillText(Number(ch.data.datasets[0].data[i]).toLocaleString(), bar.x + 6, bar.y); }); c.restore(); } }] : []
    });
  });
}

/* ---------- Admin drill-downs (clickable counts) ---------- */
function openDrill(kind) {
  if (!hasAdminAccess()) return;
  const d = state.adminData || {}, users = d.users || [], artistsList = d.artists || [], songs = d.songs || state.songs || [], pods = d.podcasts || [];
  const chart = adminChartData();
  let title = '', sub = '', body = '', go = 'moderation';
  const noGo = kind === 'streams';
  const row = (a, b, c) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`;
  const table = (heads, rows) => `<div class="drill-scroll"><table class="drill-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
  if (kind === 'users') { title = 'All accounts'; sub = `${users.length} total · ${users.filter((u) => u.is_active !== false).length} active`; body = table(['Account', 'Type', 'Status'], users.slice(0, 200).map((u) => row(u.display_name || 'User', u.account_type || 'Listener', u.is_active === false ? 'Inactive' : 'Active'))); }
  else if (kind === 'artists') { title = 'Artists by streams'; sub = `Qualified streams, last ${chart.range} days`; body = table(['Artist', 'Streams', 'Status'], chart.topArtists.map((a) => row(a.name, a.value.toLocaleString(), 'Active'))); go = 'catalog'; }
  else if (kind === 'streams') {
    const N = chart.days.length;
    const dayLabel = (i) => new Date(Date.now() - (N - 1 - i) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const days = chart.days.map((v) => Number(v) || 0);
    const max = Math.max(1, ...days), sum = days.reduce((a, b) => a + b, 0), best = days.indexOf(Math.max(...days));
    title = 'Streams per day'; sub = `${chart.total.toLocaleString()} qualified streams · ${chart.unique} unique listeners`;
    const bars = days.map((v, i) => `<i class="${i === best ? 'best' : ''}" style="height:${Math.max(3, Math.round(v / max * 100))}%" title="${esc(dayLabel(i))}: ${v} streams"></i>`).join('');
    const chipsHtml = `<div class="drill-chips"><div><small>Daily average</small><strong>${Math.round(sum / Math.max(1, days.length)).toLocaleString()}</strong></div><div><small>Best day</small><strong>${esc(dayLabel(best))} · ${days[best].toLocaleString()}</strong></div><div><small>Latest day</small><strong>${(days[days.length - 1] || 0).toLocaleString()}</strong></div></div>`;
    const chartHtml = `<div class="drill-chart" role="img" aria-label="Streams per day over the selected range"><div class="drill-bars">${bars}</div><div class="drill-axis"><span>${esc(dayLabel(0))}</span><span>${esc(dayLabel(Math.floor((N - 1) / 2)))}</span><span>${esc(dayLabel(N - 1))}</span></div></div>`;
    const rows = days.map((v, i) => {
      const diff = i > 0 ? v - days[i - 1] : 0;
      const delta = diff ? `<span class="delta ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toLocaleString()}</span>` : '<span class="delta flat">–</span>';
      return `<tr><td class="nowrap">${esc(dayLabel(i))}</td><td><div class="stream-cell"><b>${v.toLocaleString()}</b><span class="stream-bar"><s style="width:${Math.round(v / max * 100)}%"></s></span></div></td><td class="delta-cell">${delta}</td></tr>`;
    }).reverse();
    body = chipsHtml + chartHtml + table(['Date', 'Streams', 'vs. previous day'], rows);
  }
  else if (kind === 'songs') { navigate('song-streams'); return; }
  else if (kind === 'attention') { title = 'Needs attention'; sub = 'Inactive songs and podcasts'; const inactive = [...songs.filter((x) => x.is_active === false).map((x) => row(x.song_title || 'Song', 'Song', 'Inactive')), ...pods.filter((x) => x.is_active === false).map((x) => row(x.show_title || 'Podcast', 'Podcast', 'Inactive'))]; body = table(['Item', 'Type', 'Status'], inactive); go = 'catalog'; }
  else if (kind === 'creators') { title = 'Creator profiles'; sub = `${artistsList.length} artist profiles`; body = table(['Artist', 'Country', 'Status'], artistsList.map((a) => row(a.artist_name || 'Artist', a.country || '—', a.is_active === false ? 'Inactive' : 'Active'))); go = 'catalog'; }
  else return;
  document.getElementById('drill-dialog')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'drill-dialog'; dlg.className = 'sw-modal drill-dialog';
  dlg.innerHTML = `<div class="modal-head"><div><span class="eyebrow">DETAILS</span><h2>${esc(title)}</h2><p class="muted small">${esc(sub)}</p></div><button type="button" class="modal-close" data-close-drill aria-label="Close">${icon('close')}</button></div>${body}<div class="inline drill-actions"><button type="button" class="button secondary" data-close-drill>Close</button>${noGo ? '' : `<button type="button" class="button" data-drill-go="${go}">Open in moderation</button>`}</div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close-drill]')) dlg.close();
    const g = e.target.closest('[data-drill-go]'); if (g) { dlg.close(); openAdminDashboardSection(g.dataset.drillGo); }
  });
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}
document.addEventListener('click', (e) => { const t = e.target.closest?.('[data-drill]'); if (t) { e.preventDefault(); openDrill(t.dataset.drill); } });

/* ---------- Creator stat cards: click a card to see what is behind the number ---------- */
async function openStatInfo(kind) {
  const num = (n) => Number(n || 0).toLocaleString();
  const cell = (v, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${esc(v)}</td>`;
  const table = (heads, rows) => `<div class="drill-scroll"><table class="drill-table stat-table"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
  let title = '', sub = '', body = '', go = null;
  if (kind === 'a-streams') {
    const d = artistChartData(state.artistThirtyDay || []), total = (state.artistThirtyDay || []).length;
    title = 'Streams by song'; sub = `${num(total)} qualified streams · ${num(d.unique)} unique listeners · last 30 days`;
    body = table(['Song', 'Release', 'Streams'], d.topSongs.slice(0, 100).map((x) => `<tr>${cell(x.name)}${cell(songById(x.id)?.album?.album_title || '—')}${cell(num(x.value))}</tr>`));
    go = ['View analytics', '[data-artist-view-btn="analytics"]'];
  } else if (kind === 'a-followers') {
    try { await hydrateOwnFollowerNames(); } catch { /* names are optional */ }
    let rows = followerRows();
    if (!rows.length && state.artistFollowers?.length) rows = state.artistFollowers.map((r) => ({ name: r.display_name || personName(r.follower_user_id), since: r.date_followed }));
    title = 'Your followers'; sub = `${num(rows.length)} ${rows.length === 1 ? 'person follows' : 'people follow'} you`;
    body = table(['Follower', 'Followed since'], rows.map((r) => `<tr>${cell(r.name)}${cell(r.since ? fmtDate(r.since) : '—')}</tr>`));
  } else if (kind === 'a-releases') {
    const owned = state.ownedSongs || [], albums = state.albums || [];
    title = 'Your releases'; sub = `${num(albums.length)} ${albums.length === 1 ? 'release' : 'releases'} · ${num(albums.filter((a) => a.is_active).length)} active`;
    body = table(['Release', 'Type', 'Tracks', 'Status'], albums.map((a) => `<tr>${cell(a.album_title)}${cell(a.release_type || 'Album')}${cell(num(owned.filter((x) => Number(x.album?.album_id || x.album_id) === Number(a.album_id)).length))}${cell(a.is_active ? 'Active' : 'Inactive')}</tr>`));
    go = ['Manage catalog', '[data-artist-view-btn="catalog"]'];
  } else if (kind === 'a-royalty') {
    const roy = state.royaltySummary || {}, streams = (state.artistThirtyDay || []).length;
    title = 'Estimated royalty'; sub = 'A running estimate based on your last 30 days of qualified streams';
    body = table(['Detail', 'Value'], [
      `<tr>${cell('Qualified streams (30 days)')}${cell(num(streams))}</tr>`,
      `<tr>${cell('Rate per stream')}${cell('₱' + Number(roy.royalty_rate || 0).toFixed(4))}</tr>`,
      `<tr>${cell('Estimated royalty')}${cell('₱' + Number(roy.estimated_royalty || 0).toFixed(2))}</tr>`,
    ]);
    go = ['How royalties work', '#royalty-info-dialog'];
  } else if (kind.startsWith('p-')) {
    const m = podcastStudioAnalytics(), shows = state.myShows || [];
    const showIds = new Set(shows.map((x) => Number(x.show_id)));
    const eps = (state.episodes || []).filter((e) => showIds.has(Number(e.show_id)));
    if (kind === 'p-shows') {
      title = 'Your shows'; sub = `${num(shows.length)} ${shows.length === 1 ? 'show' : 'shows'} · ${num(shows.filter((x) => x.is_active).length)} active`;
      body = table(['Show', 'Episodes', 'Listens', 'Status'], shows.map((x) => `<tr>${cell(x.show_title)}${cell(num(eps.filter((e) => Number(e.show_id) === Number(x.show_id)).length))}${cell(num(m.topShows.find((t) => Number(t.id) === Number(x.show_id))?.value))}${cell(x.is_active ? 'Active' : 'Inactive')}</tr>`));
      go = ['Manage shows', '[data-podcast-studio-view-btn="shows"]'];
    } else if (kind === 'p-episodes') {
      const live = eps.filter((e) => e.is_active !== false);
      title = 'Active episodes'; sub = `${num(live.length)} of ${num(eps.length)} episodes are currently available`;
      body = table(['Episode', 'Show', 'Listens'], live.map((e) => `<tr>${cell(e.episode_title)}${cell(shows.find((x) => Number(x.show_id) === Number(e.show_id))?.show_title || '—')}${cell(num(m.topEpisodes.find((t) => Number(t.id) === Number(e.episode_id))?.value))}</tr>`));
      go = ['Manage shows', '[data-podcast-studio-view-btn="shows"]'];
    } else if (kind === 'p-listens') {
      title = 'Qualified listens by episode'; sub = `${num(m.total)} listens of 30s or more, or completed · ${m.completionRate}% completion`;
      body = table(['Episode', 'Listens'], m.topEpisodes.slice(0, 100).map((x) => `<tr>${cell(x.name)}${cell(num(x.value))}</tr>`));
      go = ['View analytics', '[data-podcast-studio-view-btn="analytics"]'];
    } else if (kind === 'p-listeners') {
      title = 'Your audience'; sub = 'Based on qualified listens across your shows';
      body = table(['Detail', 'Value'], [
        `<tr>${cell('Unique listeners')}${cell(num(m.unique))}</tr>`,
        `<tr>${cell('Minutes listened')}${cell(num(m.minutes))}</tr>`,
        `<tr>${cell('Qualified listens')}${cell(num(m.total))}</tr>`,
        `<tr>${cell('Completion rate')}${cell(m.completionRate + '%')}</tr>`,
      ]);
      go = ['View analytics', '[data-podcast-studio-view-btn="analytics"]'];
    } else return;
  } else return;
  document.getElementById('drill-dialog')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'drill-dialog'; dlg.className = 'sw-modal drill-dialog';
  dlg.innerHTML = `<div class="modal-head"><div><span class="eyebrow">DETAILS</span><h2>${esc(title)}</h2><p class="muted small">${esc(sub)}</p></div><button type="button" class="modal-close" data-close-drill aria-label="Close">${icon('close')}</button></div>${body}<div class="inline drill-actions"><button type="button" class="button secondary" data-close-drill>Close</button>${go ? `<button type="button" class="button" data-stat-go>${esc(go[0])}</button>` : ''}</div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-close-drill]')) { dlg.close(); return; }
    if (e.target.closest('[data-stat-go]') && go) {
      dlg.close();
      const t = document.querySelector(go[1]);
      if (t?.tagName === 'DIALOG') t.showModal(); else t?.click();
    }
  });
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}
document.addEventListener('click', (e) => { const t = e.target.closest?.('[data-stat-info]'); if (t) { e.preventDefault(); openStatInfo(t.dataset.statInfo); } });

/* ---------- Deactivation with reason + owner notice ---------- */
function askDeactivationReason(name, entity, onConfirm) {
  document.getElementById('deactivate-reason-dialog')?.remove();
  const dlg = document.createElement('dialog');
  dlg.id = 'deactivate-reason-dialog'; dlg.className = 'sw-modal reason-dialog';
  dlg.innerHTML = `<div class="modal-head"><div><span class="eyebrow">DEACTIVATE ${esc(String(entity).toUpperCase())}</span><h2>Deactivate ${esc(name)}?</h2><p class="muted small">It becomes hidden from listeners until an administrator reactivates it. The owner is notified with the reason below.</p></div></div>
  <label class="single-field">Reason<select id="reason-code"><option value="">Choose a reason…</option>${DEACTIVATION_REASONS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
  <label class="single-field">Message to the owner <span class="field-optional" id="reason-req">Optional</span><textarea id="reason-text" maxlength="200" rows="3" placeholder="What needs to change before this can be reactivated?"></textarea><small class="char-counter" id="reason-count">0 / 200</small></label>
  <div class="inline drill-actions"><button type="button" class="button secondary" id="reason-cancel">Cancel</button><button type="button" class="button danger" id="reason-confirm" disabled>Deactivate</button></div>`;
  document.body.appendChild(dlg);
  const code = dlg.querySelector('#reason-code'), text = dlg.querySelector('#reason-text'), ok = dlg.querySelector('#reason-confirm');
  const valid = () => { const other = code.value === 'other'; dlg.querySelector('#reason-req').textContent = other ? 'Required' : 'Optional'; ok.disabled = !code.value || (other && text.value.trim().length < 10); dlg.querySelector('#reason-count').textContent = `${text.value.length} / 200`; };
  code.onchange = valid; text.oninput = valid;
  dlg.querySelector('#reason-cancel').onclick = () => dlg.close();
  ok.onclick = () => { const label = DEACTIVATION_REASONS.find(([v]) => v === code.value)?.[1] || ''; const reason = text.value.trim() ? `${label}: ${text.value.trim()}` : label; dlg.close(); onConfirm(reason); };
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}
async function logDeactivation(entity, id, name, reason) {
  if (!reason || !db) return;
  try {
    const r = await db.rpc('admin_log_deactivation_v49', { p_entity: String(entity), p_id: String(id), p_name: String(name || ''), p_reason: String(reason || '') });
    if (r.error) throw r.error;
  } catch (e) {
    console.warn('Deactivation reason could not be logged (run sql/RUN_ME_v49_enhancements.sql):', e?.message || e);
  }
}
async function showDeactivationNotices() {
  if (!state.user || !db || state.noticesChecked === state.user.id) return;
  state.noticesChecked = state.user.id;
  try {
    const r = await db.from('deactivation_notice').select('notice_id,entity,entity_name,reason').eq('user_id', state.user.id).is('seen_at', null).order('created_at', { ascending: false }).limit(5);
    if (r.error || !r.data?.length) return;
    r.data.forEach((n) => toast(`Your ${n.entity} “${n.entity_name}” was deactivated by an administrator. Reason: ${n.reason}`, true));
    await db.from('deactivation_notice').update({ seen_at: new Date().toISOString() }).in('notice_id', r.data.map((n) => n.notice_id));
  } catch (e) { console.info('Deactivation notices unavailable', e); }
}

/* ---------- Charts page: Top 100 + Billboard Hot 100 ---------- */
const normTitle = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/\(.*?\)|\[.*?\]/g, '').replace(/\b(feat|ft)\b.*$/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
async function loadCharts(force = false) {
  if (!state.user || state.chartsLoading) return;
  if (!force && state.chartTop && Date.now() - state.chartsAt < 60000) return;
  state.chartsLoading = true;
  try {
    let rows = null;
    try {
      const rpc = await db.rpc('public_top_songs_v49', { p_days: 30, p_limit: 100 });
      if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length) { rows = rpc.data.map((r) => ({ song: songById(r.song_id), streams: Number(r.stream_count) || 0 })).filter((x) => x.song && x.song.is_active !== false); state.chartSource = 'platform'; }
    } catch { }
    if (!rows) {
      const plays = new Map();
      for (const r of state.history || []) plays.set(Number(r.song_id), (plays.get(Number(r.song_id)) || 0) + 1);
      for (const r of state.liked || []) plays.set(Number(r.song_id), (plays.get(Number(r.song_id)) || 0) + 2);
      rows = (state.songs || []).filter((s) => s.is_active !== false).map((s) => ({ song: s, streams: plays.get(Number(s.song_id)) || 0 })).sort((a, b) => b.streams - a.streams || Number(b.song.song_id) - Number(a.song.song_id)).slice(0, 100);
      state.chartSource = 'local';
    }
    state.chartTop = rows.slice(0, 100); state.chartsAt = Date.now();
    try { const res = await fetch('data/billboard-hot-100.json', { cache: 'no-cache' }); state.chartBillboard = res.ok ? await res.json() : { entries: [] }; } catch { state.chartBillboard = { entries: [] }; }
  } finally { state.chartsLoading = false; }
  if (state.page === 'charts') render();
}
function chartsPage() {
  state.tint = '#3a4658';
  const tab = state.chartsTab || 'top100';
  const tabs = `<div class="home-chips charts-tabs"><button type="button" class="${tab === 'top100' ? 'active' : ''}" data-charts-tab="top100">Top 100</button><button type="button" class="${tab === 'billboard' ? 'active' : ''}" data-charts-tab="billboard">Billboard Hot 100</button></div>`;
  let body = '';
  if (state.chartsLoading && !state.chartTop) body = '<div class="skeleton-list">' + '<i></i>'.repeat(8) + '</div>';
  else if (tab === 'top100') {
    const rows = state.chartTop || [], songs = rows.map((r) => r.song);
    const note = state.chartSource === 'platform' ? 'Ranked by qualified streams across SoundWave in the last 30 days.' : 'Platform-wide ranking is not enabled yet, so this list is ranked from the plays and likes visible to you. Install sql/RUN_ME_v49_enhancements.sql to turn on the global chart.';
    body = songs.length ? `<p class="muted small chart-note">${esc(note)}</p><div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${ids(songs).join(',')}" aria-label="Play Top 100">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${ids(songs).join(',')}">${icon('shuffle')} Shuffle</button></div>${trackTable(songs, { queue: ids(songs), extraLabel: 'Streams', extraClass: 'streams', extraCell: (s, i) => `<span class="stream-pill">${compactNumber(rows[i]?.streams || 0)}</span>` })}` : '<div class="empty"><h3>No songs to rank yet</h3><p>Charts fill in as songs are published and played.</p></div>';
  } else {
    const bb = state.chartBillboard || { entries: [] }, entries = bb.entries || [];
    if (!entries.length) body = `<div class="empty"><h3>Billboard chart not loaded</h3><p>Billboard data is licensed, so it is not bundled. Add this week’s chart to <code>data/billboard-hot-100.json</code> (see README) and it appears here, matched against the SoundWave catalog.</p></div>`;
    else {
      const catalog = (state.songs || []).filter((s) => s.is_active !== false);
      const rowsHtml = entries.slice(0, 100).map((e) => {
        const t = normTitle(e.title), a = normTitle(e.artist);
        const hit = catalog.find((s) => normTitle(s.song_title) === t && (a.includes(normTitle(s.album?.artist?.artist_name)) || normTitle(s.album?.artist?.artist_name).includes(a)));
        return `<div class="bb-row ${hit ? 'on-sw' : ''}"><b class="bb-rank">${esc(e.rank)}</b><span class="bb-meta"><strong>${esc(e.title)}</strong><small>${esc(e.artist)}${e.peak ? ` · peak #${esc(e.peak)}` : ''}${e.weeks ? ` · ${esc(e.weeks)} wks` : ''}</small></span>${hit ? `<span class="status-pill active">On SoundWave</span><button type="button" class="t-play bb-play" data-play="${hit.song_id}" aria-label="Play ${esc(hit.song_title)}">${icon('play')}</button>` : '<span class="status-pill inactive">Not on SoundWave yet</span>'}</div>`;
      }).join('');
      body = `<p class="muted small chart-note">Billboard Hot 100${bb.chart_date ? ` · week of ${esc(bb.chart_date)}` : ''}. Songs available in the SoundWave catalog can be played directly.</p><div class="bb-list">${rowsHtml}</div>`;
    }
  }
  shell(`<header class="page-head"><span class="eyebrow">CHARTS</span><h1>What’s charting</h1></header>${tabs}${body}`, '', '');
  document.querySelectorAll('[data-charts-tab]').forEach((b) => b.onclick = () => { state.chartsTab = b.dataset.chartsTab; render(); });
  bindMusic();
}

/* ---------- Filters (playlists, podcasts, artists, tracks) ---------- */
function filterBarHtml({ placeholder, chips = [], sorts = [] }) {
  return `<div class="filter-bar" role="search"><label class="filter-search"><span class="sr-only">Filter</span><input type="search" maxlength="60" placeholder="${esc(placeholder)}" autocomplete="off" data-filter-input></label>${chips.length ? `<div class="filter-chips" role="tablist">${chips.map((c, i) => `<button type="button" class="filter-chip ${i === 0 ? 'active' : ''}" data-filter-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}${sorts.length ? `<select class="filter-sort" data-filter-sort aria-label="Sort">${sorts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>` : ''}<span class="muted small filter-count" data-filter-count aria-live="polite"></span></div>`;
}
function wireFilter(bar, items, { getText, getTag, onSort }) {
  const input = bar.querySelector('[data-filter-input]'), count = bar.querySelector('[data-filter-count]'), sort = bar.querySelector('[data-filter-sort]');
  let tag = bar.querySelector('.filter-chip')?.dataset.filterChip || '';
  const first = tag;
  const apply = () => {
    const q = input.value.trim().toLowerCase(); let shown = 0;
    items.forEach((el) => { const ok = (!q || getText(el).includes(q)) && (!tag || tag === first || getTag(el) === tag.toLowerCase()); el.hidden = !ok; if (ok) shown++; });
    count.textContent = (q || tag !== first) ? `${shown} of ${items.length}` : '';
  };
  input.addEventListener('input', apply);
  bar.querySelectorAll('[data-filter-chip]').forEach((b) => b.onclick = () => { tag = b.dataset.filterChip; bar.querySelectorAll('.filter-chip').forEach((x) => x.classList.toggle('active', x === b)); apply(); });
  sort?.addEventListener('change', () => { onSort?.(sort.value); apply(); });
}
// Filter bars on the Artists, Podcasts and Playlists pages were removed on request (filterBarHtml/wireFilter are kept but unused).
function enhanceFilters() { }

/* ---------- Counters, category suggestions, images, shuffle ---------- */
function enhanceCounters() {
  document.querySelectorAll('input[maxlength]:not([type=hidden]):not([type=search]):not([type=file]),textarea[maxlength]').forEach((el) => {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    const host = el.closest('label') || el.parentElement; if (!host || host.querySelector('.char-counter')) return;
    const max = Number(el.getAttribute('maxlength')), small = document.createElement('small');
    small.className = 'char-counter live-counter'; el.insertAdjacentElement('afterend', small);
    const upd = () => { small.textContent = `${el.value.length} / ${max}`; small.classList.toggle('near-limit', el.value.length >= max * 0.9); };
    el.addEventListener('input', upd); upd();
  });
}
function enhanceCategoryInputs() {
  document.querySelectorAll('#showcategory,#editshowcategory').forEach((el) => {
    if (el.dataset.suggest) return; el.dataset.suggest = '1';
    const listId = `${el.id}-list`;
    el.setAttribute('list', listId); el.setAttribute('autocomplete', 'off');
    el.insertAdjacentHTML('afterend', `<datalist id="${listId}">${PODCAST_CATEGORY_SUGGESTIONS.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist><div class="suggest-row" aria-label="Suggested categories"><span class="muted small">Suggested:</span>${PODCAST_CATEGORY_SUGGESTIONS.slice(0, 8).map((c) => `<button type="button" class="suggest-chip" data-suggest-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>`);
    el.parentElement.querySelectorAll('[data-suggest-value]').forEach((b) => b.onclick = () => { el.value = b.dataset.suggestValue; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); });
  });
}
function enhanceImages() {
  document.querySelectorAll('img:not([data-enh])').forEach((img) => {
    img.dataset.enh = '1';
    if (!img.hasAttribute('loading')) img.loading = 'lazy';
    img.decoding = 'async';
    img.classList.add('img-fade');
    const done = () => img.classList.add('loaded');
    if (img.complete) done(); else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); setTimeout(done, 4000); }
  });
}

/* ---------- Admin: every song in the system with its stream count ---------- */
async function loadAdminSongTotals() {
  if (!hasAdminAccess() || !db || state.adminSongTotalsLoading || (state.adminSongTotalsAt && Date.now() - state.adminSongTotalsAt < 60000)) return;
  state.adminSongTotalsLoading = true; state.adminSongTotalsAt = Date.now();
  try {
    const r = await db.rpc('admin_song_stream_totals_v49');
    if (r.error) throw r.error;
    state.adminSongTotals = Object.fromEntries((r.data || []).map((x) => [Number(x.song_id), { all: Number(x.all_time) || 0, d30: Number(x.last_30) || 0 }]));
    if (document.getElementById('admin-all-songs')) render();
  } catch (e) { state.adminSongTotals = null; console.info('All-time totals unavailable. Run sql/RUN_ME_v49_enhancements.sql', e); }
  finally { state.adminSongTotalsLoading = false; }
}
function adminSongStreamRows() {
  const counts = new Map();
  for (const r of adminRows30()) counts.set(Number(r.song_id), (counts.get(Number(r.song_id)) || 0) + 1);
  const totals = state.adminSongTotals || null;
  const all = (state.adminData?.songs?.length ? state.adminData.songs : state.songs) || [];
  return all.map((x) => { const full = songById(x.song_id) || x, id = Number(x.song_id); return { id, title: x.song_title || full.song_title || 'Untitled', artist: full.album?.artist?.artist_name || '—', album: full.album?.album_title || '—', active: x.is_active !== false, d30: totals?.[id]?.d30 ?? (counts.get(id) || 0), all: totals ? (totals[id]?.all || 0) : null }; })
    .sort((a, b) => (b.all ?? b.d30) - (a.all ?? a.d30) || a.title.localeCompare(b.title));
}
function adminAllSongsHtml() {
  void loadAdminSongTotals();
  const rows = adminSongStreamRows(), hasAll = rows.some((r) => r.all !== null);
  const sumAll = rows.reduce((n, r) => n + (r.all || 0), 0), sum30 = rows.reduce((n, r) => n + r.d30, 0);
  const body = rows.map((r, i) => `<tr data-song-row data-title="${esc(r.title.toLowerCase())}" data-search="${esc(`${r.title} ${r.artist} ${r.album}`.toLowerCase())}" data-all="${r.all ?? r.d30}" data-d30="${r.d30}" data-status="${r.active ? 'active' : 'inactive'}"><td class="num">${i + 1}</td><td><strong>${esc(r.title)}</strong></td><td>${esc(r.artist)}</td><td>${esc(r.album)}</td><td><span class="status-pill ${r.active ? 'active' : 'inactive'}">${r.active ? 'Active' : 'Inactive'}</span></td>${hasAll ? `<td class="num"><b>${(r.all || 0).toLocaleString()}</b></td>` : ''}<td class="num">${hasAll ? r.d30.toLocaleString() : `<b>${r.d30.toLocaleString()}</b>`}</td></tr>`).join('');
  const sub = hasAll ? `${rows.length.toLocaleString()} songs · ${sumAll.toLocaleString()} all-time streams · ${sum30.toLocaleString()} in the last 30 days` : `${rows.length.toLocaleString()} songs · ${sum30.toLocaleString()} streams in the last 30 days. All-time totals load once sql/RUN_ME_v49_enhancements.sql is installed.`;
  return `<section class="all-songs-card" id="admin-all-songs"><div class="section-heading"><div><span class="eyebrow">CATALOG</span><h2>All songs and their streams</h2><p class="muted small">${sub}</p></div><button type="button" class="button secondary" data-songs-csv>Download CSV</button></div><div class="filter-bar"><div class="filter-chips" role="group" aria-label="Song status"><button type="button" class="filter-chip active" data-songs-status="all">All (${rows.length})</button><button type="button" class="filter-chip" data-songs-status="active">Active (${rows.filter((r) => r.active).length})</button><button type="button" class="filter-chip" data-songs-status="inactive">Inactive (${rows.filter((r) => !r.active).length})</button></div><label class="filter-search"><span class="sr-only">Search songs</span><input type="search" maxlength="60" placeholder="Search song, artist or album" data-songs-search></label><select class="filter-sort" data-songs-sort aria-label="Sort songs"><option value="all">${hasAll ? 'Most all-time streams' : 'Most streams'}</option>${hasAll ? '<option value="d30">Most streams (30 days)</option>' : ''}<option value="az">Title A–Z</option></select></div><div class="drill-scroll all-songs-scroll"><table class="drill-table"><thead><tr><th>#</th><th>Song</th><th>Artist</th><th>Album</th><th>Status</th>${hasAll ? '<th>All-time streams</th>' : ''}<th>Last 30 days</th></tr></thead><tbody>${body || '<tr><td colspan="7">No songs in the system yet.</td></tr>'}</tbody></table></div></section>`;
}
function enhanceAdminSongs() {
  const box = document.getElementById('admin-all-songs'); if (!box || box.dataset.ready) return; box.dataset.ready = '1';
  const tbody = box.querySelector('tbody'), rows = [...box.querySelectorAll('[data-song-row]')];
  const input = box.querySelector('[data-songs-search]'), sort = box.querySelector('[data-songs-sort]');
  const apply = () => {
    const q = input.value.trim().toLowerCase(), v = sort.value, st = box.dataset.status || 'all';
    [...rows].sort((a, b) => v === 'az' ? a.dataset.title.localeCompare(b.dataset.title) : Number(b.dataset[v]) - Number(a.dataset[v])).forEach((r) => tbody.appendChild(r));
    let n = 0; rows.forEach((r) => { const ok = (!q || r.dataset.search.includes(q)) && (st === 'all' || r.dataset.status === st); r.hidden = !ok; if (ok) { n++; r.firstElementChild.textContent = n; } });
  };
  box.querySelectorAll('[data-songs-status]').forEach((b) => b.onclick = () => { box.dataset.status = b.dataset.songsStatus; box.querySelectorAll('[data-songs-status]').forEach((x) => x.classList.toggle('active', x === b)); apply(); });
  input.addEventListener('input', apply); sort.addEventListener('change', apply);
  box.querySelector('[data-songs-csv]').onclick = () => {
    const data = adminSongStreamRows(), q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = ['Song,Artist,Album,Status,All-time streams,Streams (30 days)', ...data.map((r) => [r.title, r.artist, r.album, r.active ? 'Active' : 'Inactive', r.all ?? '', r.d30].map(q).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'soundwave-song-streams.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
}

function adminSongsShortcutHtml() {
  const rows = adminSongStreamRows(), top = rows.slice(0, 5), total = rows.length;
  return `<section class="all-songs-card songs-shortcut"><div class="section-heading"><div><span class="eyebrow">CATALOG</span><h2>Song streams</h2><p class="muted small">${total.toLocaleString()} songs in the system</p></div><button type="button" class="button" data-nav="song-streams">View all ${total.toLocaleString()} songs</button></div>${top.length ? `<ol class="shortcut-list">${top.map((r) => `<li><span>${esc(r.title)}<small>${esc(r.artist)}</small></span><b>${(r.all ?? r.d30).toLocaleString()}</b></li>`).join('')}</ol>` : '<p class="muted small">No songs yet.</p>'}</section>`;
}
function songStreamsPage() {
  if (!hasAdminAccess()) return navigate(primaryDashboard());
  state.tint = '#3a4658';
  shell(`<section class="workspace-hero admin-hero"><div><span class="eyebrow">SOUNDWAVE ADMIN</span><h2>Song streams</h2><p>Every song in the system with how many times it was streamed.</p><div class="hero-actions"><button class="button secondary" data-nav="admin-dashboard">${icon('back')} Back to dashboard</button></div></div></section>${adminAllSongsHtml()}`, '', '');
}
function runEnhancers() {
  renderCharts(); enhanceFilters(); enhanceAdminSongs(); enhanceCounters(); enhanceCategoryInputs(); enhanceImages();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-shuffle-ids]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const list = b.dataset.shuffleIds.split(',').filter(Boolean).map(Number); if (!list.length) return;
  prefs.shuffle = true; savePrefs(); updateModeButtons();
  // Shuffle the songs themselves: reorder the visible list so the page shows the new play order,
  // then start playing from the top of it (not only reshuffling the hidden queue).
  const order = shuffled(list);
  const tracks = document.querySelector('.tracks:not(.history-tracks)') || document.querySelector('.tracks');
  if (tracks) {
    const rows = new Map([...tracks.querySelectorAll(':scope > .track[data-song]')].map((r) => [Number(r.dataset.song), r]));
    const q = order.join(',');
    let n = 0;
    order.forEach((id) => {
      const r = rows.get(id); if (!r) return;
      tracks.appendChild(r);
      r.dataset.queue = q;
      const num = r.querySelector('.t-num b'); if (num) num.textContent = String(++n);
    });
    tracks.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  playAction(() => playSong(order[0], list, { order, pos: 0 }));
}, true);
new MutationObserver(() => { if (state.user) { enhanceImages(); renderCharts(); } }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

if ('serviceWorker' in navigator) {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) { navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => { }); }
  else navigator.serviceWorker.register('./sw.js?v=56').catch(() => { });
}
boot();

/* Card hover effects: cursor spotlight + subtle 3D tilt (works for cards rendered later too) */
(() => {
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!fine || calm) return;
  const SEL = '.release-tile,.artist-card,.cover-card';
  let raf = 0;
  document.addEventListener('mousemove', e => {
    const card = e.target.closest && e.target.closest(SEL);
    if (!card) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty('--mx', x + 'px');
      card.style.setProperty('--my', y + 'px');
      card.style.setProperty('--ry', ((x / r.width - .5) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((.5 - y / r.height) * 6).toFixed(2) + 'deg');
    });
  }, { passive: true });
  document.addEventListener('mouseout', e => {
    const card = e.target.closest && e.target.closest(SEL);
    if (!card || card.contains(e.relatedTarget)) return;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
})();


// Curated carousel: accessible buttons that reveal the next/previous visible cards.
(function bindCuratedCarousel() {
  function update() {
    const rail = document.getElementById('curated-slider'); if (!rail) return;
    const prev = document.querySelector('[data-curated-slide="prev"]'), next = document.querySelector('[data-curated-slide="next"]');
    if (prev) prev.disabled = rail.scrollLeft <= 3;
    if (next) next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 3;
  }
  document.addEventListener('click', event => {
    const b = event.target.closest?.('[data-curated-slide]'); if (!b) return;
    const rail = document.getElementById('curated-slider'); if (!rail) return;
    event.preventDefault();
    const card = rail.querySelector('.curated-card');
    const distance = Math.max(card?.getBoundingClientRect().width || 180, Math.floor(rail.clientWidth * 0.8));
    rail.scrollBy({ left: (b.dataset.curatedSlide === 'prev' ? -1 : 1) * distance, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(update, 340);
  });
  document.addEventListener('scroll', event => { if (event.target?.id === 'curated-slider') update(); }, true);
  new MutationObserver(() => { if (document.getElementById('curated-slider')) requestAnimationFrame(update); }).observe(document.body, { childList: true, subtree: true });
})();

/* ---------- New-release alerts (v79): bell, "From artists you follow" shelf, Remind me ----------
   Needs sql/RUN_ME_v79_release_alerts.sql. Without it the shelf still lists recent releases of followed
   artists (computed from the catalog); the bell explains that alerts are not set up yet. */
const REMINDER_WINDOW_MS = 24 * 3600 * 1000;
const reminderInFlight = new Set();

// "Drops in 12 min" / "Drops today at 8:00 PM" / "Drops tomorrow at 8:00 PM" / "Drops Friday" / "Drops Oct 24"
function dropsText(d) {
  const now = new Date(), ms = d.getTime() - now.getTime();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (ms < 3600e3) return `Drops in ${Math.max(1, Math.ceil(ms / 60000))} min`;
  if (d.toDateString() === now.toDateString()) return `Drops today at ${time}`;
  if (d.toDateString() === new Date(now.getTime() + 864e5).toDateString()) return `Drops tomorrow at ${time}`;
  if (ms < 7 * 864e5) return `Drops ${d.toLocaleDateString(undefined, { weekday: 'long' })}`;
  return `Drops ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
// Compact label for the small badge on a tile ("Drops Fri", "Today 8:00 PM", "Tomorrow")
function dropsShort(d) {
  const now = new Date(), ms = d.getTime() - now.getTime();
  if (ms < 3600e3) return `Drops in ${Math.max(1, Math.ceil(ms / 60000))} min`;
  if (d.toDateString() === now.toDateString()) return `Today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  if (d.toDateString() === new Date(now.getTime() + 864e5).toDateString()) return 'Tomorrow';
  if (ms < 7 * 864e5) return `Drops ${d.toLocaleDateString(undefined, { weekday: 'short' })}`;
  return `Drops ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
const upcomingList = () => (state.releaseAlerts?.upcoming || []).filter((u) => u.when.getTime() > Date.now());
const reminderAckKey = () => localKey('release-reminder-ack');
const reminderAckId = (u) => `${u.album_id}@${u.scheduled_at}`;
// Releases the listener asked to be reminded about that drop within 24 hours.
const dueSoonReminders = () => upcomingList().filter((u) => u.reminded && u.when.getTime() - Date.now() <= REMINDER_WINDOW_MS);
function releaseUnreadCount() {
  const ack = readLocalJson(reminderAckKey(), {});
  return (state.releaseAlerts?.items || []).filter((n) => !n.seen_at).length + dueSoonReminders().filter((u) => !ack[reminderAckId(u)]).length;
}

async function loadReleaseAlerts() {
  if (!db || !state.user) return;
  const uid = state.user.id, ra = state.releaseAlerts;
  releaseAlertLastLoad = Date.now();
  try {
    const [n, u] = await Promise.all([
      db.from('release_notification').select('notification_id,album_id,artist_id,album_title,artist_name,release_type,reminded,created_at,seen_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
      db.rpc('my_upcoming_releases_v79')
    ]);
    if (state.user?.id !== uid) return;
    if (n.error) console.info('Release alerts unavailable. Run sql/RUN_ME_v79_release_alerts.sql.', n.error.message);
    ra.available = !n.error;
    const rows = n.error ? [] : (n.data || []);
    ra.items = rows;
    ra.upcoming = u.error ? [] : (u.data || []).map((r) => ({ ...r, album_id: Number(r.album_id), artist_id: Number(r.artist_id), when: new Date(r.scheduled_at) })).filter((r) => !Number.isNaN(r.when.getTime()));
    // A new, unread alert since the last load: tell the listener once. (First load never announces; the bell badge covers it.)
    if (ra.known) rows.filter((r) => !r.seen_at && !ra.known.has(r.notification_id)).slice(0, 2).forEach((r) => toast(`${r.artist_name || 'An artist you follow'} released ${r.album_title || 'new music'}`));
    ra.known = new Set(rows.map((r) => r.notification_id));
    ra.loaded = true;
    const paths = [...new Set(ra.upcoming.map((x) => x.cover_path).filter((x) => x && !state.coverUrls[x]))];
    await Promise.all(paths.map(async (path) => { try { const url = await resolveCoverUrl(path); if (url) state.coverUrls[path] = url; } catch { } }));
  } catch (e) { console.info('Release alerts could not load', e); return; }
  refreshReleaseSurfaces();
}

// Keeps the bell current: live via Realtime, plus a light poll that also covers "the drop just went live".
function startReleaseAlerts() {
  if (!db || !state.user) return;
  try {
    releaseAlertChannel = db.channel(`soundwave-release-alerts-${state.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'release_notification', filter: `user_id=eq.${state.user.id}` }, () => { void loadReleaseAlerts(); })
      .subscribe();
  } catch (e) { console.info('Realtime release alerts unavailable', e); }
  clearInterval(releaseAlertTimer);
  releaseAlertTimer = setInterval(async () => {
    if (document.hidden || !state.user) return;
    releaseAlertTick++;
    const imminent = upcomingList().some((u) => u.when.getTime() - Date.now() <= 90e3) || (state.releaseAlerts.upcoming || []).some((u) => u.when.getTime() <= Date.now());
    if (imminent) { try { await db.rpc('publish_due_releases_v78'); } catch { } await loadReleaseAlerts(); }
    else if (releaseAlertTick % 5 === 0) await loadReleaseAlerts();
    else refreshReleaseSurfaces();   // cheap: re-evaluates the 24-hour reminder window and the "Drops in…" labels
  }, 60000);
  if (!startReleaseAlerts.bound) {
    startReleaseAlerts.bound = true;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.user && Date.now() - releaseAlertLastLoad > 30000) void loadReleaseAlerts(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBellPanel(); });
  }
}

// ---- Bell ----
const releaseCoverArt = (cover_path, id, size = 'tiny') => {
  const url = cover_path && state.coverUrls?.[cover_path];
  return url ? `<img class="real-cover ${size}" src="${esc(url)}" alt="" loading="lazy">` : `<span class="placeholder-art ${size}" style="background:${grad(id || 0)}" aria-hidden="true">${icon('music')}</span>`;
};
function bellBadgeLabel(n) { return n ? `Release alerts, ${n} new` : 'Release alerts'; }
/* ---------- Light / dark theme (v88) ----------
   The choice is saved in localStorage and applied by a tiny script in index.html before the page paints.
   Light colours live in theme-light.css and only apply while <html data-theme="light"> is set. */
const THEME_KEY = 'soundwave-theme';
function currentTheme() { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; }
function themeToggleHtml() {
  const light = currentTheme() === 'light';
  return `<button type="button" class="top-bell theme-toggle" id="theme-toggle" aria-label="${light ? 'Switch to dark theme' : 'Switch to light theme'}" title="${light ? 'Switch to dark theme' : 'Switch to light theme'}" aria-pressed="${light}">${icon(light ? 'moon' : 'sun')}</button>`;
}
function applyTheme(theme, persist = true) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  try { if (persist) localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch { }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f4f9' : '#0f1218');
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const label = light ? 'Switch to dark theme' : 'Switch to light theme';
    btn.innerHTML = icon(light ? 'moon' : 'sun'); btn.title = label; btn.setAttribute('aria-label', label); btn.setAttribute('aria-pressed', String(light));
  }
  // Charts read their colours once, so redraw any that are on screen.
  document.querySelectorAll('canvas[data-chart][data-ready]').forEach((cv) => { try { window.Chart?.getChart(cv)?.destroy(); } catch { } delete cv.dataset.ready; });
  try { renderCharts(); } catch { }
}
(function initTheme() {
  let saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch { }
  if (saved !== 'light') saved = 'dark';
  applyTheme(saved, false);
})();
function bellHtml() {
  const n = releaseUnreadCount();
  return `<div class="bell-wrap"><button type="button" class="top-bell" id="bell-toggle" aria-label="${bellBadgeLabel(n)}" aria-haspopup="true" aria-expanded="false">${icon('bell')}<span class="bell-badge" ${n ? '' : 'hidden'}>${n > 9 ? '9+' : n}</span></button><div class="bell-panel" id="bell-panel" role="region" aria-label="Release alerts" hidden>${bellPanelHtml()}</div></div>`;
}
function bellPanelHtml() {
  const ra = state.releaseAlerts, soon = dueSoonReminders(), items = ra.items || [];
  const unread = items.some((n) => !n.seen_at);
  const soonHtml = soon.map((u) => `<button type="button" class="bell-item soon" data-open-artist="${u.artist_id}"><span class="bell-art">${releaseCoverArt(u.cover_path, u.album_id)}</span><span class="bell-copy"><strong>${esc(u.album_title)}</strong><small>${esc(u.artist_name)} · ${esc(dropsText(u.when))}</small></span><span class="bell-tag">Reminder</span></button>`).join('');
  const itemsHtml = items.map((n) => {
    const album = albumById(n.album_id), cover = album?.cover_path;
    return `<button type="button" class="bell-item ${n.seen_at ? '' : 'unread'}" data-release-alert="${n.notification_id}"><span class="bell-art">${releaseCoverArt(cover, n.album_id)}</span><span class="bell-copy"><strong>${esc(n.artist_name || 'An artist you follow')} released ${esc(n.album_title || 'new music')}</strong><small>${esc(agoText(n.created_at))}${n.reminded ? ' · You asked to be reminded' : ''}</small></span>${n.seen_at ? '' : '<span class="bell-dot" aria-label="Unread"></span>'}</button>`;
  }).join('');
  const body = !ra.available
    ? `<div class="bell-empty"><strong>Alerts are not set up yet</strong><small>Run <code>sql/RUN_ME_v79_release_alerts.sql</code> once in the Supabase SQL editor, then refresh.</small></div>`
    : (soonHtml || itemsHtml) ? `${soonHtml ? `<div class="bell-group">Coming up</div>${soonHtml}` : ''}${itemsHtml ? `<div class="bell-group">New releases</div>${itemsHtml}` : ''}`
      : `<div class="bell-empty"><strong>No alerts yet</strong><small>Follow artists and you will hear here the moment they release something new.</small></div>`;
  return `<div class="bell-head"><strong>Release alerts</strong>${unread ? '<button type="button" class="text-link" data-bell-readall>Mark all read</button>' : ''}</div><div class="bell-list">${body}</div>`;
}
function closeBellPanel() { const p = document.getElementById('bell-panel'); if (!p || p.hidden) return; p.hidden = true; document.getElementById('bell-toggle')?.setAttribute('aria-expanded', 'false'); }
function toggleBellPanel() {
  const p = document.getElementById('bell-panel'); if (!p) return;
  const open = p.hidden;
  const pm = document.getElementById('profile-menu'); if (pm) pm.hidden = true;
  p.hidden = !open;
  document.getElementById('bell-toggle')?.setAttribute('aria-expanded', String(open));
  if (open) {
    // Seeing the "coming up" reminders counts as acknowledging them; unread release alerts stay until opened or marked read.
    const ack = readLocalJson(reminderAckKey(), {}); dueSoonReminders().forEach((u) => { ack[reminderAckId(u)] = 1; }); writeLocalJson(reminderAckKey(), ack);
    refreshReleaseSurfaces();
    void loadReleaseAlerts();
  }
}
async function markReleaseAlertsSeen(idsToMark) {
  const ra = state.releaseAlerts, stamp = new Date().toISOString();
  ra.items.forEach((n) => { if (!n.seen_at && (!idsToMark || idsToMark.includes(n.notification_id))) n.seen_at = stamp; });
  refreshReleaseSurfaces();
  try { const r = await db.rpc('mark_release_notifications_seen_v79', { p_ids: idsToMark || null }); if (r.error) throw r.error; }
  catch (e) { console.info('Could not mark release alerts as read', e); }
}
function openReleaseAlert(nid) {
  const n = state.releaseAlerts.items.find((x) => Number(x.notification_id) === Number(nid)); if (!n) return;
  void markReleaseAlertsSeen([n.notification_id]);
  return action(async () => {
    // The catalog was loaded before this release went live, so refresh it once if the album is not there yet.
    if (!albumById(n.album_id)) await loadData();
    if (albumById(n.album_id)) navigate('album-detail', { selectedAlbum: Number(n.album_id) });
    else if (state.artists.some((a) => Number(a.artist_id) === Number(n.artist_id))) navigate('artist-detail', { selectedArtist: Number(n.artist_id) });
    else toast('This release is not available right now.', true);
  });
}

// ---- Remind me ----
async function toggleReminder(albumId) {
  const u = state.releaseAlerts.upcoming.find((x) => Number(x.album_id) === Number(albumId));
  if (!u || reminderInFlight.has(albumId)) return;
  reminderInFlight.add(albumId);
  const next = !u.reminded;
  u.reminded = next; refreshReleaseSurfaces();
  try {
    const r = await db.rpc('set_release_reminder_v79', { p_album_id: Number(albumId), p_on: next });
    if (r.error) throw r.error;
    toast(next ? `We will remind you when “${u.album_title}” drops` : 'Reminder removed');
  } catch (e) {
    u.reminded = !next; refreshReleaseSurfaces();
    console.warn('Reminder failed', e);
    toast(/set_release_reminder_v79|schema cache|does not exist/i.test(String(e?.message || '')) ? 'Reminders are not set up yet. Run sql/RUN_ME_v79_release_alerts.sql in Supabase.' : humanErr(e), true);
  } finally { reminderInFlight.delete(albumId); }
}
const remindBtn = (u, cls = '') => `<button type="button" class="remind-btn ${cls} ${u.reminded ? 'on' : ''}" data-remind="${u.album_id}" aria-pressed="${u.reminded}">${u.reminded ? `${icon('check')} Reminder set` : `${icon('bell')} Remind me`}</button>`;

// ---- Surfaces ----
function upcomingTile(u) {
  return `<article class="release-tile card-link upcoming-tile" tabindex="0" role="link" data-open-artist="${u.artist_id}"><span class="release-art">${releaseCoverArt(u.cover_path, u.album_id, 'large')}<em class="release-badge soon" title="${esc(dropsText(u.when))}">${esc(dropsShort(u.when))}</em></span><strong>${esc(u.album_title)}</strong><small>${esc(u.artist_name)}${u.release_type && u.release_type !== 'Album' ? ' · ' + esc(u.release_type) : ''}</small>${remindBtn(u)}</article>`;
}
function followedReleasesShelf() {
  const followed = new Set((state.favorites || []).map((f) => Number(f.artist_id)));
  if (!followed.size) return '';
  const upcoming = upcomingList().filter((u) => followed.has(u.artist_id));
  const cutoff = Date.now() - 30 * 864e5;
  const fresh = catalogAlbums().filter((a) => a.artist && followed.has(Number(a.artist.artist_id)) && a.release_date && new Date(a.release_date).getTime() >= cutoff)
    .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')) || Number(b.album_id) - Number(a.album_id)).slice(0, 10);
  if (!upcoming.length && !fresh.length) return '';
  const tiles = upcoming.map(upcomingTile).join('') + fresh.map((a) => albumTile(a).replace('<span class="release-art">', '<span class="release-art"><em class="release-badge">New</em>')).join('');
  return `<section class="shelf-section release-alerts-shelf"><div class="section-heading discover-heading"><div><h2>From artists you follow</h2><p>New releases, and drops that are coming soon</p></div></div><div class="shelf">${tiles}</div></section>`;
}
function artistUpcomingHtml(artistId) {
  const list = upcomingList().filter((u) => u.artist_id === Number(artistId));
  if (!list.length) return '';
  return `<section class="artist-section upcoming-section"><div class="section-heading"><div><h2>Coming soon</h2></div></div>${list.map((u) => `<div class="upcoming-row"><span class="upcoming-art">${releaseCoverArt(u.cover_path, u.album_id, 'large')}</span><div class="upcoming-copy"><strong>${esc(u.album_title)}</strong><small>${esc(u.release_type || 'Album')} · ${esc(dropsText(u.when))}</small></div>${remindBtn(u)}</div>`).join('')}</section>`;
}
// In-place refresh (no full re-render, so playback, scroll and focus are untouched).
function refreshReleaseSurfaces() {
  const n = releaseUnreadCount(), badge = document.querySelector('.bell-badge');
  if (badge) { badge.textContent = n > 9 ? '9+' : String(n); badge.hidden = !n; }
  document.getElementById('bell-toggle')?.setAttribute('aria-label', bellBadgeLabel(n));
  const panel = document.getElementById('bell-panel'); if (panel) { panel.innerHTML = bellPanelHtml(); bindContent(panel); }
  const slot = document.getElementById('release-alerts-slot');
  if (slot && state.page === 'discover') { slot.innerHTML = followedReleasesShelf(); bindContent(slot); }
  const aslot = document.getElementById('artist-upcoming-slot');
  if (aslot && state.page === 'artist-detail') { aslot.innerHTML = artistUpcomingHtml(state.selectedArtist); bindContent(aslot); }
}
function bindReleaseAlerts(root = document) {
  root.querySelectorAll('[data-remind]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleReminder(Number(b.dataset.remind)).catch((err) => toast(humanErr(err), true)); });
  root.querySelectorAll('[data-release-alert]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); void openReleaseAlert(b.dataset.releaseAlert); });
  root.querySelectorAll('[data-bell-readall]').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); void markReleaseAlertsSeen(null); });
}

/* ---------- Sleep timer + podcast playback speed (v80) ----------
   Stored only in memory (sleep) and prefs (podcast speed); no database changes. */
const SLEEP_CHOICES = [15, 30, 60];
const SLEEP_CUSTOM_MAX = 720;   // custom sleep timer: 1 to 720 minutes (12 hours)
const minutesWord = (m) => `${m} minute${m === 1 ? '' : 's'}`;
const SPEED_CHOICES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const fmtRate = (r) => `${Number(r)}x`;
function sleepLabel() {
  const z = state.sleep; if (!z) return '';
  if (z.mode === 'track') return 'End';
  const m = Math.max(1, Math.ceil((z.endsAt - Date.now()) / 60000));
  return m >= 100 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}m`;
}
function playerToolButtons(podcast, cls, id) {
  const z = state.sleep, r = prefs.podcastRate;
  const sleep = `<button type="button" id="${id}-sleep" class="${cls} sleep-btn ${z ? 'active' : ''}" data-player-tool="sleep" aria-haspopup="true" aria-label="Sleep timer${z ? ', on' : ''}" title="Sleep timer">${icon('moon')}${z ? `<span class="tool-badge">${sleepLabel()}</span>` : ''}</button>`;
  const speed = podcast ? `<button type="button" id="${id}-speed" class="${cls} speed-btn ${r !== 1 ? 'active' : ''}" data-player-tool="speed" aria-haspopup="true" aria-label="Playback speed, ${fmtRate(r)}" title="Playback speed">${fmtRate(r)}</button>` : '';
  return speed + sleep;
}
function refreshPlayerTools() {
  document.querySelectorAll('[data-player-tool="sleep"]').forEach((btn) => {
    const z = state.sleep; btn.classList.toggle('active', !!z);
    btn.setAttribute('aria-label', `Sleep timer${z ? ', on' : ''}`);
    let b = btn.querySelector('.tool-badge');
    if (z) { if (!b) { b = document.createElement('span'); b.className = 'tool-badge'; btn.appendChild(b); } b.textContent = sleepLabel(); } else b?.remove();
  });
  document.querySelectorAll('[data-player-tool="speed"]').forEach((btn) => {
    btn.textContent = fmtRate(prefs.podcastRate); btn.classList.toggle('active', prefs.podcastRate !== 1);
    btn.setAttribute('aria-label', `Playback speed, ${fmtRate(prefs.podcastRate)}`);
  });
}
function clearSleepTimer() {
  clearTimeout(sleepTimeout); clearInterval(sleepTicker); sleepTimeout = sleepTicker = null;
  if (sleepFade) { clearInterval(sleepFade); sleepFade = null; const a = document.getElementById('sw-audio'); if (a) a.volume = prefs.muted ? 0 : prefs.volume; }
  if (state.sleep) { state.sleep = null; refreshPlayerTools(); }
}
// mode: null (off) | 'track' | 'minutes'
function setSleepTimer(mode, minutes) {
  clearSleepTimer();
  if (!mode) { toast('Sleep timer off'); return; }
  if (mode === 'track') { state.sleep = { mode }; toast(state.player?.kind === 'podcast' ? 'Playback will pause when this episode ends' : 'Playback will pause when this song ends'); }
  else {
    state.sleep = { mode, minutes, endsAt: Date.now() + minutes * 60000 };
    sleepTimeout = setTimeout(sleepExpire, minutes * 60000);
    // The ticker also covers phones that throttle timers while the screen is off.
    sleepTicker = setInterval(() => { if (state.sleep?.mode === 'minutes' && Date.now() >= state.sleep.endsAt) sleepExpire(); else refreshPlayerTools(); }, 1000);
    toast(`Sleep timer set for ${minutesWord(minutes)}`);
  }
  refreshPlayerTools();
}
// Fades out over ~4 seconds, then pauses (and restores the volume for the next play).
function sleepExpire() {
  clearTimeout(sleepTimeout); clearInterval(sleepTicker); sleepTimeout = sleepTicker = null; state.sleep = null; refreshPlayerTools();
  const a = document.getElementById('sw-audio'); if (!a || a.paused) return;
  const start = a.volume; let i = 0; const steps = 20;
  sleepFade = setInterval(() => {
    i++;
    if (a.paused || i >= steps) { clearInterval(sleepFade); sleepFade = null; a.pause(); a.volume = prefs.muted ? 0 : prefs.volume; if (i >= steps) toast('Sleep timer ended. Playback paused.'); return; }
    a.volume = Math.max(0, start * (1 - i / steps));
  }, 200);
}
// Called when a track finishes: true means "stop here, do not advance".
function sleepAfterTrack() {
  if (state.sleep?.mode !== 'track') return false;
  clearSleepTimer(); toast('Sleep timer ended. Playback paused.'); return true;
}
function setPodcastRate(r) {
  prefs.podcastRate = r; savePrefs();
  const a = document.getElementById('sw-audio'); if (a && state.player?.kind === 'podcast') a.defaultPlaybackRate = a.playbackRate = r;
  refreshPlayerTools();
  try { if ('mediaSession' in navigator && a && a.duration > 0) navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: r }); } catch { }
}

function closePlayerPopover() { document.getElementById('player-pop')?.remove(); document.querySelectorAll('[data-player-tool][aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
function openPlayerPopover(kind, anchor) {
  const was = document.getElementById('player-pop')?.dataset.kind === kind;
  closePlayerPopover(); if (was) return;
  const podcast = state.player?.kind === 'podcast', z = state.sleep;
  let title, items;
  if (kind === 'speed') {
    title = 'Playback speed';
    items = SPEED_CHOICES.map((r) => ({ label: r === 1 ? '1x (Normal)' : fmtRate(r), checked: prefs.podcastRate === r, run: () => setPodcastRate(r) }));
  } else {
    title = 'Sleep timer';
    items = [
      { label: 'Off', checked: !z, run: () => setSleepTimer(null) },
      ...SLEEP_CHOICES.map((m) => ({ label: `${m} minutes`, checked: z?.mode === 'minutes' && z.minutes === m, run: () => setSleepTimer('minutes', m) })),
      { label: podcast ? 'End of episode' : 'End of track', checked: z?.mode === 'track', run: () => setSleepTimer('track') },
    ];
  }
  const pop = document.createElement('div');
  pop.id = 'player-pop'; pop.className = 'player-pop'; pop.dataset.kind = kind; pop.setAttribute('role', 'menu'); pop.setAttribute('aria-label', title);
  // Sleep timer only: let the listener type their own number of minutes.
  const customActive = kind === 'sleep' && z?.mode === 'minutes' && !SLEEP_CHOICES.includes(z.minutes);
  const customRow = kind !== 'sleep' ? '' : `<form class="player-pop-custom ${customActive ? 'on' : ''}" id="sleep-custom-form" novalidate><label for="sleep-custom-minutes">Custom${customActive ? icon('check') : ''}</label><div class="player-pop-custom-row"><input id="sleep-custom-minutes" type="number" inputmode="numeric" min="1" max="${SLEEP_CUSTOM_MAX}" step="1" placeholder="Minutes" value="${customActive ? z.minutes : ''}" aria-describedby="sleep-custom-error"><button type="submit" class="player-pop-set">Set</button></div><small id="sleep-custom-error" class="player-pop-error" role="alert" hidden></small></form>`;
  pop.innerHTML = `<div class="player-pop-title">${esc(title)}</div>${items.map((it, i) => `<button type="button" role="menuitemradio" aria-checked="${it.checked}" class="player-pop-item ${it.checked ? 'on' : ''}" data-i="${i}"><span>${esc(it.label)}</span>${it.checked ? icon('check') : ''}</button>`).join('')}${customRow}`;
  pop.querySelectorAll('.player-pop-item').forEach((b) => b.onclick = (e) => { e.stopPropagation(); items[Number(b.dataset.i)].run(); closePlayerPopover(); });
  pop.querySelector('#sleep-custom-form')?.addEventListener('submit', (e) => {
    e.preventDefault(); e.stopPropagation();
    const input = pop.querySelector('#sleep-custom-minutes'), err = pop.querySelector('#sleep-custom-error');
    const raw = input.value.trim(), n = Number(raw);
    if (!raw || !Number.isInteger(n) || n < 1 || n > SLEEP_CUSTOM_MAX) {
      err.textContent = `Enter a whole number from 1 to ${SLEEP_CUSTOM_MAX} minutes.`; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    setSleepTimer('minutes', n); closePlayerPopover();
  });
  pop.querySelector('#sleep-custom-minutes')?.addEventListener('input', (e) => { pop.querySelector('#sleep-custom-error').hidden = true; e.target.removeAttribute('aria-invalid'); });
  document.body.appendChild(pop);
  anchor.setAttribute('aria-expanded', 'true');
  if (window.innerWidth > 700) {   // desktop: float above the player bar, aligned to the button; phones use a bottom sheet (CSS)
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    pop.style.bottom = (window.innerHeight - r.top + 8) + 'px';
  }
  (pop.querySelector('.player-pop-item.on') || pop.querySelector('.player-pop-item'))?.focus();
}
document.addEventListener('click', (e) => {
  const tool = e.target.closest?.('[data-player-tool]');
  if (tool) { e.stopPropagation(); openPlayerPopover(tool.dataset.playerTool, tool); return; }
  if (!e.target.closest?.('#player-pop')) closePlayerPopover();
});
document.addEventListener('keydown', (e) => {
  const pop = document.getElementById('player-pop'); if (!pop) return;
  if (e.key === 'Escape') { const k = pop.dataset.kind; closePlayerPopover(); document.querySelector(`[data-player-tool="${k}"]`)?.focus(); return; }
  if (e.target?.matches?.('#sleep-custom-minutes')) return;   // arrows step the number while typing
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); const items = [...pop.querySelectorAll('.player-pop-item')], i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
});

/* ---------- Follow podcast shows, "New episodes", "Save for later" (v81) ----------
   Needs sql/RUN_ME_v81_podcast_follows.sql (one table, podcast_library). Without it the buttons explain what to run. */
const NEW_EPISODE_DAYS = 21;
const podInFlight = new Set();
const podShowById = (id) => (state.podcasts || []).find((p) => Number(p.show_id) === Number(id));
const podIsFollowing = (id) => (state.podLib?.follows || []).includes(Number(id));
const podIsSaved = (id) => (state.podLib?.saved || []).includes(Number(id));
function podArt(show) {
  return show?.cover_path && state.coverUrls[show.cover_path] ? `<img class="cover-img" src="${esc(state.coverUrls[show.cover_path])}" alt="">` : icon('mic');
}
const podSetupMessage = (e) => /podcast_library|set_podcast_|schema cache|does not exist/i.test(String(e?.message || '')) ? 'Following is not set up yet. Run sql/RUN_ME_v81_podcast_follows.sql in Supabase.' : humanErr(e);

async function loadPodcastLibrary() {
  if (!db || !state.user) return;
  const uid = state.user.id, pl = state.podLib;
  try {
    const r = await db.from('podcast_library').select('item_id,show_id,episode_id,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(500);
    if (state.user?.id !== uid) return;
    if (r.error) {
      console.info('Podcast follows unavailable. Run sql/RUN_ME_v81_podcast_follows.sql.', r.error.message);
      Object.assign(pl, { available: false, loaded: true, follows: [], saved: [], newIds: [], episodes: {} });
      refreshPodcastSurfaces(); return;
    }
    const rows = r.data || [];
    pl.available = true;
    pl.follows = rows.filter((x) => x.show_id != null).map((x) => Number(x.show_id));
    pl.saved = rows.filter((x) => x.episode_id != null).map((x) => Number(x.episode_id));
    const cols = 'episode_id,show_id,episode_title,description,duration_seconds,release_at,is_active';
    const now = new Date().toISOString(), cutoff = new Date(Date.now() - NEW_EPISODE_DAYS * 864e5).toISOString();
    const [a, b] = await Promise.all([
      pl.follows.length ? db.from('podcast_episode').select(cols).in('show_id', pl.follows).eq('is_active', true).lte('release_at', now).gte('release_at', cutoff).order('release_at', { ascending: false }).limit(60) : { data: [] },
      pl.saved.length ? db.from('podcast_episode').select(cols).in('episode_id', pl.saved).eq('is_active', true) : { data: [] },
    ]);
    if (state.user?.id !== uid) return;
    pl.episodes = {};
    [...(a.data || []), ...(b.data || [])].forEach((e) => { pl.episodes[Number(e.episode_id)] = e; });
    pl.newIds = (a.data || []).map((e) => Number(e.episode_id));
    pl.loaded = true;
  } catch (e) { console.info('Podcast library could not load', e); return; }
  refreshPodcastSurfaces();
}

// New = released within the last 21 days by a show you follow, and not in your listening history yet.
function podNewEpisodes() {
  const pl = state.podLib, played = new Set((state.podcastHistory || []).map((h) => Number(h.episode_id)));
  return (pl.newIds || []).map((id) => pl.episodes[id]).filter((e) => e && pl.follows.includes(Number(e.show_id)) && podShowById(e.show_id) && !played.has(Number(e.episode_id)));
}
const followShowBtn = (show) => (!show || show.user_id === state.user?.id) ? '' :
  `<button type="button" class="button secondary follow-show-btn ${podIsFollowing(show.show_id) ? 'on' : ''}" data-follow-show="${show.show_id}" aria-pressed="${podIsFollowing(show.show_id)}">${podIsFollowing(show.show_id) ? `${icon('check')} Following` : `${icon('plus')} Follow`}</button>`;
const saveEpisodeBtn = (id) => `<button type="button" class="remind-btn save-btn ${podIsSaved(id) ? 'on' : ''}" data-save-episode="${id}" aria-pressed="${podIsSaved(id)}">${podIsSaved(id) ? `${icon('check')} Saved` : `${icon('bookmark')} Save for later`}</button>`;

function podEpisodeTile(e) {
  const show = podShowById(e.show_id);
  return `<article class="release-tile card-link episode-tile" tabindex="0" role="link" data-open-show="${e.show_id}"><span class="release-art"><span class="placeholder-art large" style="background:${grad(Number(e.show_id))}">${podArt(show)}</span><em class="release-badge">New</em><button type="button" class="hover-play" data-play-episode="${e.episode_id}" aria-label="Play ${esc(e.episode_title)}">${icon('play')}</button></span><strong>${esc(e.episode_title)}</strong><small>${esc(show?.show_title || 'Podcast')} · ${esc(agoText(e.release_at))}</small>${saveEpisodeBtn(e.episode_id)}</article>`;
}
function newEpisodesShelfHtml() {
  const list = podNewEpisodes().slice(0, 12);
  if (!list.length) return '';
  return `<section class="shelf-section podcast-new-shelf"><div class="section-heading discover-heading"><div><h2>New episodes</h2><p>Fresh from the shows you follow</p></div></div><div class="shelf">${list.map(podEpisodeTile).join('')}</div></section>`;
}
function yourShowsHtml() {
  const shows = (state.podLib.follows || []).map(podShowById).filter(Boolean);
  if (!shows.length) return '';
  const fresh = {}; podNewEpisodes().forEach((e) => { fresh[e.show_id] = (fresh[e.show_id] || 0) + 1; });
  const tiles = shows.map((p, i) => `<button type="button" class="cover-card show-tile" data-open-show="${p.show_id}"><span class="cover-art" style="background:${grad(i)}">${podArt(p)}${fresh[p.show_id] ? `<em class="release-badge">${fresh[p.show_id]} new</em>` : ''}</span><strong>${esc(p.show_title)}</strong><small>${esc(p.category || 'Podcast')}</small></button>`).join('');
  return `<section class="shelf-section podcast-your-shows"><div class="section-heading discover-heading"><div><h2>Your shows</h2><p>Shows you follow</p></div></div><div class="shelf">${tiles}</div></section>`;
}
function savedEpisodesHtml() {
  const pl = state.podLib, rows = (pl.saved || []).map((id) => pl.episodes[id]).filter(Boolean);
  if (!rows.length) return '';
  return `<section class="shelf-section podcast-saved"><div class="section-heading discover-heading"><div><h2>Saved for later</h2><p>${rows.length} ${rows.length === 1 ? 'episode' : 'episodes'} waiting for you</p></div></div>${rows.map((e) => {
    const show = podShowById(e.show_id);
    return `<div class="saved-row"><span class="saved-art" style="background:${grad(Number(e.show_id))}">${podArt(show)}</span><div class="saved-copy"><strong>${esc(e.episode_title)}</strong><small>${esc(show?.show_title || 'Podcast')}${e.duration_seconds ? ' · ' + esc(nice(e.duration_seconds)) : ''}${e.release_at ? ' · ' + esc(new Date(e.release_at).toLocaleDateString()) : ''}</small></div><button type="button" class="episode-listen-btn" data-play-episode="${e.episode_id}">${icon('play')}<span>Play</span></button>${saveEpisodeBtn(e.episode_id)}</div>`;
  }).join('')}</section>`;
}
const podcastLibraryHtml = () => newEpisodesShelfHtml() + yourShowsHtml() + savedEpisodesHtml();

// In-place refresh: no full re-render, so playback, scroll and focus are untouched.
function refreshPodcastSurfaces() {
  document.querySelectorAll('[data-follow-show]').forEach((b) => {
    const on = podIsFollowing(b.dataset.followShow); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? `${icon('check')} Following` : `${icon('plus')} Follow`;
  });
  document.querySelectorAll('[data-save-episode]').forEach((b) => {
    const on = podIsSaved(b.dataset.saveEpisode); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? `${icon('check')} Saved` : `${icon('bookmark')} Save for later`;
  });
  const lib = document.getElementById('podcast-library-slot');
  if (lib && state.page === 'podcasts' && !state.selectedShow) { lib.innerHTML = podcastLibraryHtml(); bindContent(lib); }
  const nw = document.getElementById('podcast-new-slot');
  if (nw && state.page === 'discover') { nw.innerHTML = newEpisodesShelfHtml(); bindContent(nw); }
  try { renderLibraryList(); } catch { }
}

async function togglePodcastFollow(showId) {
  showId = Number(showId); const key = 'f' + showId; if (podInFlight.has(key)) return;
  const pl = state.podLib, show = podShowById(showId), next = !podIsFollowing(showId), before = [...pl.follows];
  podInFlight.add(key);
  pl.follows = next ? [showId, ...pl.follows] : pl.follows.filter((x) => x !== showId);
  refreshPodcastSurfaces();
  try {
    const r = await db.rpc('set_podcast_follow_v81', { p_show_id: showId, p_on: next }); if (r.error) throw r.error;
    toast(next ? `Following ${show?.show_title || 'show'}` : `Unfollowed ${show?.show_title || 'show'}`);
    void loadPodcastLibrary();   // pulls in this show's recent episodes (or drops them)
  } catch (e) { pl.follows = before; refreshPodcastSurfaces(); console.warn('Follow failed', e); toast(podSetupMessage(e), true); }
  finally { podInFlight.delete(key); }
}
async function togglePodcastSaved(episodeId) {
  episodeId = Number(episodeId); const key = 's' + episodeId; if (podInFlight.has(key)) return;
  const pl = state.podLib, next = !podIsSaved(episodeId), before = [...pl.saved];
  podInFlight.add(key);
  if (next) {
    // Episodes saved from an open show page are already in memory: show them in the list immediately.
    const ep = (state.episodes || []).find((x) => Number(x.episode_id) === episodeId);
    if (ep && !pl.episodes[episodeId]) pl.episodes[episodeId] = { episode_id: ep.episode_id, show_id: ep.show_id, episode_title: ep.episode_title, description: ep.description, duration_seconds: ep.duration_seconds, release_at: ep.release_at, is_active: ep.is_active };
  }
  pl.saved = next ? [episodeId, ...pl.saved] : pl.saved.filter((x) => x !== episodeId);
  refreshPodcastSurfaces();
  try {
    const r = await db.rpc('set_podcast_saved_v81', { p_episode_id: episodeId, p_on: next }); if (r.error) throw r.error;
    toast(next ? 'Saved for later' : 'Removed from Saved for later');
  } catch (e) { pl.saved = before; refreshPodcastSurfaces(); console.warn('Save failed', e); toast(podSetupMessage(e), true); }
  finally { podInFlight.delete(key); }
}
// Plays an episode from a shelf or the saved list (the show page has its own handler).
function playPodcastEpisode(episodeId) {
  return action(async () => {
    await requirePlaybackAccess();
    const lk = await db.from('podcast_episode').select('episode_id,show_id,episode_title,duration_seconds,audio_path,is_active').eq('episode_id', episodeId).maybeSingle();
    if (lk.error) throw lk.error;
    const ep = lk.data;
    if (!ep || ep.is_active === false) throw Error('This episode is no longer available.');
    if (!ep.audio_path) throw Error('This episode has no playable audio file attached.');
    const u = check(await db.storage.from('podcast-audio').createSignedUrl(ep.audio_path, 3600));
    const resume = Number(state.podcastHistory.find((h) => Number(h.episode_id) === Number(ep.episode_id) && Number(h.resume_position_seconds) > 5)?.resume_position_seconds) || 0;
    startPlayer({ kind: 'podcast', id: ep.episode_id, title: ep.episode_title, artist: podShowById(ep.show_id)?.show_title || 'SoundWave podcasts', url: u.signedUrl, duration: ep.duration_seconds, resumeAt: resume });
  }, { quiet: true });
}
// Capture phase so a button inside a clickable tile does not also open the show.
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-follow-show],[data-save-episode],[data-play-episode]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.followShow) void togglePodcastFollow(t.dataset.followShow);
  else if (t.dataset.saveEpisode) void togglePodcastSaved(t.dataset.saveEpisode);
  else if (t.dataset.playEpisode) void playPodcastEpisode(Number(t.dataset.playEpisode));
}, true);

/* ---------- Daily Mix + Repeat Rewind: "Made for you" (v82) ----------
   Computed entirely on the device from data that is already loaded (catalog, likes, playlists, follows, history).
   No database changes. Daily mixes are stable within a day and reshuffle the next day. */
const MIX_SIZE = 25, MIX_MIN_GENRE_SONGS = 5, MIX_ARTIST_CAP = 3, MIX_REWIND_MIN = 5;
const MIX_PALETTES = [['#f2a65a', '#c4476a'], ['#3fb4a6', '#2c5fa8'], ['#9b6bd6', '#d1478f'], ['#8fbf5a', '#d9a441']];

// Small deterministic hash -> [0,1): same input gives the same number all day, so a mix does not shift while you browse.
function mixRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const mixDayKey = () => new Date().toLocaleDateString('en-CA');
const mixQualified = (r) => String(r.completion_status || '').toLowerCase() === 'completed' || Number(r.duration_played_seconds || 0) >= 30;

// Two familiar songs, then one new one, repeating; no more than MIX_ARTIST_CAP songs per artist.
function interleaveMix(fam, disc, size = MIX_SIZE, cap = MIX_ARTIST_CAP) {
  const out = [], count = new Map();
  const take = (arr) => { while (arr.length) { const x = arr.shift(), c = count.get(x.aid) || 0; if (c >= cap) continue; count.set(x.aid, c + 1); out.push(x.song); return true; } return false; };
  for (let n = 0; out.length < size && (fam.length || disc.length); n++) {
    const ok = n % 3 !== 2 ? (take(fam) || take(disc)) : (take(disc) || take(fam));
    if (!ok) break;
  }
  return out;
}

function buildMadeForYou() {
  const songs = (state.songs || []).filter((s) => s.is_active !== false && s.album?.is_active !== false && s.album?.artist?.is_active !== false);
  const hist = (state.insightHistory?.length ? state.insightHistory : state.history) || [];
  const day = mixDayKey(), uid = state.user?.id || 'anon';
  const aff = buildAffinity();
  const likedIds = new Set((state.liked || []).map((r) => Number(r.song_id)));
  const playlistIds = new Set((state.playlistSignal || []).map((r) => Number(r.song_id)));
  const plays = new Map();   // qualified plays per song, plus when it was last played
  for (const r of hist) {
    if (!mixQualified(r)) continue;
    const id = Number(r.song_id), cur = plays.get(id) || { n: 0, last: 0 };
    cur.n++; cur.last = Math.max(cur.last, Date.parse(r.stream_date) || 0); plays.set(id, cur);
  }
  const mixes = [], now = Date.now();

  // Daily mixes: your three strongest genres, each a blend of songs you know and fresh picks.
  const byGenre = new Map();
  for (const s of songs) { const g = Number(s.genre_id); if (g) { if (!byGenre.has(g)) byGenre.set(g, []); byGenre.get(g).push(s); } }
  const genres = [...byGenre.entries()].filter(([g, list]) => list.length >= MIX_MIN_GENRE_SONGS && (aff.genreScores.get(g) || 0) > 0)
    .sort((a, b) => (aff.genreScores.get(b[0]) || 0) - (aff.genreScores.get(a[0]) || 0)).slice(0, 3);
  for (const [g, list] of genres) {
    const scored = list.map((song) => {
      const sid = Number(song.song_id), aid = Number(song.album?.artist?.artist_id) || 0;
      const artistScore = affinityScore(aff, aid, g, '').score, pc = plays.get(sid)?.n || 0;
      const liked = likedIds.has(sid), inPlaylist = playlistIds.has(sid), familiar = liked || inPlaylist || pc > 0;
      const rd = song.album?.release_date ? new Date(song.album.release_date).getTime() : 0;
      const recent = rd && now - rd <= 60 * 864e5 ? 5 : 0;
      const jitter = mixRand(`${day}:${uid}:${g}:${sid}`) * 15;
      const own = (liked ? 30 : 0) + (inPlaylist ? 15 : 0) + Math.min(pc, 6) * 5;
      return { song, aid, familiar, score: (familiar ? own + artistScore * 0.5 : artistScore + recent) + jitter };
    });
    const byScore = (a, b) => b.score - a.score || Number(b.song.song_id) - Number(a.song.song_id);
    const picked = interleaveMix(scored.filter((x) => x.familiar).sort(byScore), scored.filter((x) => !x.familiar).sort(byScore));
    if (picked.length < MIX_REWIND_MIN) continue;
    const genre = (state.genres || []).find((x) => Number(x.genre_id) === g)?.genre_name || 'Mixed';
    const artists = [...new Set(picked.map((s) => s.album?.artist?.artist_name).filter(Boolean))];
    mixes.push({
      id: mixes.length + 1, kind: 'daily', title: `Daily Mix ${mixes.length + 1}`, label: genre, songs: picked,
      subtitle: artists.slice(0, 3).join(', ') + (artists.length > 3 ? ' and more' : ''),
      blurb: `Songs you know and new picks in ${genre}, refreshed every day.`
    });
  }

  // Repeat Rewind: what you play on repeat, with a tilt toward songs you have not heard in a while.
  const rewind = [...plays.entries()].map(([id, v]) => ({ song: songs.find((s) => Number(s.song_id) === id), v })).filter((x) => x.song && x.v.n >= 2)
    .map((x) => ({ song: x.song, score: x.v.n * (1 + Math.min(30, (now - x.v.last) / 864e5) / 30) }))
    .sort((a, b) => b.score - a.score || Number(b.song.song_id) - Number(a.song.song_id)).slice(0, 30).map((x) => x.song);
  if (rewind.length >= MIX_REWIND_MIN) {
    const artists = [...new Set(rewind.map((s) => s.album?.artist?.artist_name).filter(Boolean))];
    mixes.push({
      id: 4, kind: 'rewind', title: 'Repeat Rewind', label: 'On repeat', songs: rewind,
      subtitle: artists.slice(0, 3).join(', ') + (artists.length > 3 ? ' and more' : ''),
      blurb: 'The songs you keep coming back to, starting with the ones you have not heard lately.'
    });
  }
  return mixes;
}
// Cached per day and per amount of signal, so rendering Discover repeatedly does not redo the work.
function madeForYou() {
  const sig = [mixDayKey(), state.user?.id, (state.songs || []).length, (state.liked || []).length, (state.history || []).length, (state.insightHistory || []).length, (state.favorites || []).length, (state.playlistSignal || []).length, (state.genres || []).length].join('|');
  if (state.madeForYouCache?.sig !== sig) state.madeForYouCache = { sig, mixes: buildMadeForYou() };
  return state.madeForYouCache.mixes;
}
const mixGradient = (id) => { const [a, b] = MIX_PALETTES[(Number(id) - 1 + MIX_PALETTES.length) % MIX_PALETTES.length]; return `linear-gradient(145deg, ${a}, ${b})`; };
const mixArtHtml = (m) => `<span class="mix-art-inner"><span class="mix-art-label">${esc(m.label)}</span><span class="mix-art-title">${esc(m.title)}</span></span>`;

function madeForYouShelfHtml() {
  if ((state.discoverFilter || 'all') === 'podcasts') return '';
  const mixes = madeForYou();
  if (!mixes.length) return '';
  const tiles = mixes.map((m) => `<article class="release-tile card-link mix-tile" tabindex="0" role="link" data-open-mix="${m.id}" data-queue="${ids(m.songs).join(',')}"><span class="release-art mix-art" style="background:${mixGradient(m.id)}">${mixArtHtml(m)}<button type="button" class="hover-play" data-play="${m.songs[0].song_id}" aria-label="Play ${esc(m.title)}">${icon('play')}</button></span><strong>${esc(m.title)}</strong><small>${esc(m.subtitle)}</small></article>`).join('');
  return `<section class="shelf-section made-for-you"><div class="section-heading discover-heading"><div><h2>Made for you</h2><p>Mixes built from what you like and play. Daily mixes refresh every day.</p></div></div><div class="shelf">${tiles}</div></section>`;
}
function mixPage() {
  const mix = madeForYou().find((m) => m.id === Number(state.selectedMix));
  if (!mix) {
    state.tint = '#2a3350';
    shell(`<div class="empty-state"><h3>This mix is not ready yet</h3><p>Mixes appear once you have liked or played a few songs. Keep listening and check back on Discover.</p><button class="button" type="button" data-nav="discover">Back to Discover</button></div>`, '', '');
    return;
  }
  state.tint = MIX_PALETTES[(mix.id - 1) % MIX_PALETTES.length][1];
  const list = mix.songs, display = state.profile?.display_name || 'You';
  shell(`<header class="coll-hero"><div class="coll-cover mix-art mix-cover" style="background:${mixGradient(mix.id)}">${mixArtHtml(mix)}</div><div class="coll-meta"><span class="coll-kind">Made for you</span><h1 class="coll-title">${esc(mix.title)}</h1><p class="coll-desc">${esc(mix.blurb)}</p><p class="coll-sub"><span class="sw-owner-avatar">${esc(display[0]?.toUpperCase() || 'S')}</span><strong>${esc(display)}</strong> · ${list.length} songs${mix.subtitle ? ' · ' + esc(mix.subtitle) : ''}</p></div></header>
    <div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${ids(list).join(',')}" aria-label="Play ${esc(mix.title)}">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${ids(list).join(',')}" aria-label="Shuffle play">${icon('shuffle')} Shuffle</button></div>
    ${trackTable(list, { queue: ids(list), showAlbum: true })}`, '', '');
}
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-open-mix]');
  if (!t || e.target.closest('[data-play],[data-play-ids]')) return;   // the play button inside a tile just plays
  navigate('mix', { selectedMix: Number(t.dataset.openMix) });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target.closest?.('[data-open-mix]'); if (!t || e.target !== t) return;
  e.preventDefault(); navigate('mix', { selectedMix: Number(t.dataset.openMix) });
});

/* ---------- Browse by mood or activity (v83) ----------
   Needs sql/RUN_ME_v83_song_moods.sql (adds song.moods). Until it is run, the column is never requested, the
   upload/edit forms show no mood field and Search shows no mood tiles: the rest of the app is unaffected. */
const MOODS = [
  { key: 'focus', n: 1, label: 'Focus', blurb: 'Music to concentrate, study and get things done.', icon: 'clock', colors: ['#2c5fa8', '#3fb4a6'] },
  { key: 'workout', n: 2, label: 'Workout', blurb: 'High-energy tracks to keep you moving.', icon: 'chart', colors: ['#e13300', '#f2a65a'] },
  { key: 'chill', n: 3, label: 'Chill', blurb: 'Easy, relaxed listening for any time of day.', icon: 'volume', colors: ['#3fb4a6', '#8fbf5a'] },
  { key: 'late_night', n: 4, label: 'Late night', blurb: 'Slow, moody and made for after dark.', icon: 'moon', colors: ['#1e3264', '#9b6bd6'] },
  { key: 'party', n: 5, label: 'Party', blurb: 'Songs for dancing and good company.', icon: 'users', colors: ['#d1478f', '#f2a65a'] },
  { key: 'feel_good', n: 6, label: 'Feel good', blurb: 'Bright, happy songs to lift your mood.', icon: 'heart', colors: ['#d9a441', '#e8115b'] },
];
const MOOD_MAX = 3;
const moodByKey = (k) => MOODS.find((m) => m.key === k);
const moodByN = (n) => MOODS.find((m) => m.n === Number(n));
const moodGradient = (m) => `linear-gradient(145deg, ${m.colors[0]}, ${m.colors[1]})`;
let moodColumn = 'unknown';   // 'unknown' | 'yes' | 'no': does song.moods exist yet?
async function probeMoodColumn() {
  if (moodColumn !== 'unknown' || !db) return;
  try { const r = await db.from('song').select('moods').limit(1); moodColumn = r.error ? 'no' : 'yes'; if (r.error) console.info('Song moods unavailable. Run sql/RUN_ME_v83_song_moods.sql.', r.error.message); }
  catch { moodColumn = 'no'; }
}
const moodColumnSql = () => moodColumn === 'yes' ? ',moods' : '';
// Only known tags, no duplicates, at most MOOD_MAX.
const songMoods = (song) => [...new Set((Array.isArray(song?.moods) ? song.moods : []).filter((k) => moodByKey(k)))].slice(0, MOOD_MAX);

// ---- Artist forms (upload wizard + Edit song) ----
function moodFieldHtml(id) {
  if (moodColumn !== 'yes') return '';
  return `<div class="single-field mood-field" id="${id}" data-mood-group><span class="field-label">Mood <span class="field-optional">Optional · up to ${MOOD_MAX}</span></span><div class="mood-chips" role="group" aria-label="Song mood">${MOODS.map((m) => `<button type="button" class="mood-chip" data-mood-chip="${m.key}" aria-pressed="false">${esc(m.label)}</button>`).join('')}</div><small class="field-help">Helps listeners find this song under Moods &amp; activities in Search.</small></div>`;
}
const selectedMoods = (id) => [...document.querySelectorAll(`#${id} [data-mood-chip][aria-pressed="true"]`)].map((b) => b.dataset.moodChip);
function setMoodChips(id, moods) {
  const on = new Set((Array.isArray(moods) ? moods : []));
  document.querySelectorAll(`#${id} [data-mood-chip]`).forEach((b) => { const v = on.has(b.dataset.moodChip); b.setAttribute('aria-pressed', String(v)); b.classList.toggle('on', v); });
}
// A patch to spread into a song insert/update: empty when the column does not exist or the form has no mood field.
const moodPatch = (id) => (moodColumn === 'yes' && document.getElementById(id)) ? { moods: selectedMoods(id) } : {};
document.addEventListener('click', (e) => {
  const chip = e.target.closest?.('[data-mood-chip]'); if (!chip) return;
  e.preventDefault();
  const group = chip.closest('[data-mood-group]'), turningOn = chip.getAttribute('aria-pressed') !== 'true';
  if (turningOn && group.querySelectorAll('[aria-pressed="true"]').length >= MOOD_MAX) { toast(`Pick up to ${MOOD_MAX} moods.`, true); return; }
  chip.setAttribute('aria-pressed', String(turningOn)); chip.classList.toggle('on', turningOn);
});

// Small coloured pills showing a song's moods (rows + player). Clicking one opens that mood's page.
function moodPillsHtml(song, max = 2) {
  if (moodColumn !== 'yes') return '';
  const list = songMoods(song).map(moodByKey).filter(Boolean).slice(0, max); if (!list.length) return '';
  return `<span class="mood-pills">${list.map((m) => `<button type="button" class="mood-pill" data-open-mood="${m.n}" style="background:${moodGradient(m)}" title="More ${esc(m.label)} songs" aria-label="Mood: ${esc(m.label)}">${esc(m.label)}</button>`).join('')}</span>`;
}
// ---- Listener side ----
const moodSongs = (m) => (state.songs || []).filter((s) => s.is_active !== false && s.album?.is_active !== false && s.album?.artist?.is_active !== false && songMoods(s).includes(m.key));
function moodTilesHtml() {
  if (moodColumn !== 'yes') return '';
  const tiles = MOODS.map((m) => ({ m, n: moodSongs(m).length })).filter((x) => x.n > 0);
  if (!tiles.length) return '';
  return `<div class="section-heading"><h2>Moods &amp; activities</h2></div><div class="browse-grid mood-grid">${tiles.map(({ m, n }) => `<button type="button" class="browse-tile mood-tile" data-open-mood="${m.n}" style="background:${moodGradient(m)}"><span>${esc(m.label)}<small>${n} ${n === 1 ? 'song' : 'songs'}</small></span><i>${icon(m.icon)}</i></button>`).join('')}</div>`;
}
// Songs from artists you follow / like / play come first, then the newest uploads.
function rankMoodSongs(list) {
  const aff = buildAffinity();
  return list.map((song) => ({ song, score: affinityScore(aff, Number(song.album?.artist?.artist_id), Number(song.genre_id), '').score }))
    .sort((a, b) => b.score - a.score || Number(b.song.song_id) - Number(a.song.song_id)).map((x) => x.song);
}
function moodPage() {
  const m = moodByN(state.selectedMood);
  const list = m ? rankMoodSongs(moodSongs(m)) : [];
  if (!m || !list.length) {
    state.tint = '#2a3350';
    shell(`<div class="empty-state"><h3>${m ? `No ${esc(m.label)} songs yet` : 'This mood is not available'}</h3><p>Artists tag their songs with moods when they upload. Check back soon, or browse by genre in Search.</p><button class="button" type="button" data-nav="music">Back to Search</button></div>`, '', '');
    return;
  }
  state.tint = m.colors[1];
  const others = MOODS.filter((x) => x.n !== m.n).map((x) => ({ x, n: moodSongs(x).length })).filter((o) => o.n > 0);
  shell(`<header class="coll-hero"><div class="coll-cover mix-art mix-cover" style="background:${moodGradient(m)}"><span class="mix-art-inner"><span class="mix-art-label">Mood</span><span class="mix-art-title">${esc(m.label)}</span></span></div><div class="coll-meta"><span class="coll-kind">Moods &amp; activities</span><h1 class="coll-title">${esc(m.label)}</h1><p class="coll-desc">${esc(m.blurb)}</p><p class="coll-sub"><strong>${list.length} ${list.length === 1 ? 'song' : 'songs'}</strong> · artists you follow and like come first</p></div></header>
    <div class="coll-actions"><button type="button" class="sw-big-play" data-play-ids="${ids(list).join(',')}" aria-label="Play ${esc(m.label)}">${icon('play')}</button><button type="button" class="sw-quiet-action shuffle-toggle" data-toggle-shuffle data-shuffle-ids="${ids(list).join(',')}" aria-label="Shuffle play">${icon('shuffle')} Shuffle</button></div>
    ${trackTable(list, { queue: ids(list), showAlbum: true })}
    ${others.length ? `<section class="shelf-section mood-more"><div class="section-heading"><h2>More moods</h2></div><div class="browse-grid mood-grid">${others.map(({ x, n }) => `<button type="button" class="browse-tile mood-tile" data-open-mood="${x.n}" style="background:${moodGradient(x)}"><span>${esc(x.label)}<small>${n} ${n === 1 ? 'song' : 'songs'}</small></span><i>${icon(x.icon)}</i></button>`).join('')}</div></section>` : ''}`, '', '');
}
document.addEventListener('click', (e) => {
  const t = e.target.closest?.('[data-open-mood]'); if (!t) return;
  navigate('mood', { selectedMood: Number(t.dataset.openMood) });
});


document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quick-add-cq]');
  if (!btn) return;
  e.preventDefault(); e.stopPropagation();
  void addSongToCrowdQueue(Number(btn.dataset.quickAddCq));
});

function checkPendingInviteLink() {
  const h = window.location.hash || '';
  const s = window.location.search || '';
  const m = /[?&](?:join|code)=([A-Za-z0-9_-]+)/i.exec(h) || /[?&](?:join|code)=([A-Za-z0-9_-]+)/i.exec(s) || /#\/join-queue\/([A-Za-z0-9_-]+)/i.exec(h);
  if (m && m[1]) {
    const code = m[1].toUpperCase();
    if (state.user) {
      void joinCrowdQueueSession(code);
    } else {
      sessionStorage.setItem('pending-cq-join', code);
      toast('Sign in to join the CrowdQueue session.');
    }
  }
}
window.addEventListener('load', checkPendingInviteLink);
window.addEventListener('hashchange', checkPendingInviteLink);

window.__soundwave = {
  state,
  navigate,
  render,
  shell,
  openReportSong,
  openCaseDetail,
  crowdQueue,
  songReportsPage,
  crowdQueuePage,
  isPremiumUser,
  applyTheme,
  currentTheme,
  getCrowdQueueInviteLink,
  copyCrowdQueueInviteLink,
  joinCrowdQueueSession,
  addSongToCrowdQueue,
  refreshRail,
  toggleRail
};
