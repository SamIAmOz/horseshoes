// ============================================================
// app.js  –  routing, auth state, shared helpers
// ============================================================

const PLAYER_COLORS = ['p0-color','p1-color','p2-color','p3-color'];
const SHOT_TYPES = ['Ringer','Leaner','Scorer','No Score'];

// ── State ────────────────────────────────────────────────────
const App = {
  user: null,
  session: null,
  currentSession: null,   // active throw session
  currentGame: null,      // active game
  currentEndNumber: 1,
  navLinks: [],

  init() {
    this.navLinks = document.querySelectorAll('.nav-link[data-page]');

    // Route on hash change
    window.addEventListener('hashchange', () => this.route());

    // Auth state
    const sb = getSupabase();
    if (sb) {
      sb.auth.onAuthStateChange((event, session) => {
        this.session = session;
        this.user    = session?.user || null;
        this.updateHeader();
        this.route();
      });
    } else {
      // No config – go to setup
      this.showPage('setup');
    }

    this.route();
  },

  route() {
    const hash = window.location.hash.replace('#', '') || 'intro';
    const publicPages = ['intro','setup'];
    const sb = getSupabase();

    if (!sb && hash !== 'setup') {
      this.showPage('setup');
      return;
    }

    if (!this.user && !publicPages.includes(hash)) {
      AuthUI.show();
      this.showPage('intro');
      return;
    }

    AuthUI.hide();
    this.showPage(hash);
  },

  showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${id}`);
    if (page) {
      page.classList.add('active');
      this.navLinks.forEach(l => {
        l.classList.toggle('active', l.dataset.page === id);
      });
      // Trigger page init hooks
      if (id === 'dashboard' && typeof DashboardPage !== 'undefined') DashboardPage.init();
      if (id === 'scoring'   && typeof ScoringPage   !== 'undefined') ScoringPage.init();
    }
  },

  navigate(page) {
    window.location.hash = page;
  },

  updateHeader() {
    const pill = document.getElementById('user-pill');
    const protectedNav = document.querySelectorAll('.nav-auth');
    if (this.user) {
      const email = this.user.email || '';
      document.getElementById('user-initial').textContent = email.charAt(0).toUpperCase();
      document.getElementById('user-email-display').textContent = email;
      if (pill) pill.style.display = 'flex';
      protectedNav.forEach(n => n.style.display = '');
    } else {
      if (pill) pill.style.display = 'none';
      protectedNav.forEach(n => n.style.display = 'none');
    }
  },
};

// ── Auth UI ──────────────────────────────────────────────────
const AuthUI = {
  overlay: null,
  currentTab: 'signin',

  init() {
    this.overlay = document.getElementById('auth-overlay');
    document.getElementById('tab-signin')?.addEventListener('click', () => this.switchTab('signin'));
    document.getElementById('tab-signup')?.addEventListener('click', () => this.switchTab('signup'));
    document.getElementById('tab-forgot')?.addEventListener('click', () => this.switchTab('forgot'));

    document.getElementById('signin-form')?.addEventListener('submit', e => { e.preventDefault(); this.signIn(); });
    document.getElementById('signup-form')?.addEventListener('submit', e => { e.preventDefault(); this.signUp(); });
    document.getElementById('forgot-form')?.addEventListener('submit', e => { e.preventDefault(); this.forgot(); });

    // Enter key on password field
    document.getElementById('signin-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.signIn();
    });
  },

  show() { this.overlay?.classList.add('active'); },
  hide() { this.overlay?.classList.remove('active'); },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
    this.clearMessages();
  },

  clearMessages() {
    document.querySelectorAll('.auth-message').forEach(el => {
      el.className = 'auth-message';
      el.textContent = '';
    });
  },

  showMessage(panel, type, msg) {
    const el = document.getElementById(`msg-${panel}`);
    if (el) { el.className = `auth-message ${type}`; el.textContent = msg; }
  },

  async signIn() {
    const email    = document.getElementById('signin-email')?.value.trim();
    const password = document.getElementById('signin-password')?.value;
    const btn      = document.getElementById('btn-signin');
    if (!email || !password) return this.showMessage('signin', 'error', 'Please enter email and password.');
    setLoading(btn, true);
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(btn, false);
    if (error) return this.showMessage('signin', 'error', error.message || 'Sign in failed.');
    this.hide();
    App.navigate('dashboard');
  },

  async signUp() {
    const email = document.getElementById('signup-email')?.value.trim();
    const pw1   = document.getElementById('signup-password')?.value;
    const pw2   = document.getElementById('signup-confirm')?.value;
    const btn   = document.getElementById('btn-signup');
    if (!email || !pw1 || !pw2) return this.showMessage('signup', 'error', 'All fields required.');
    if (pw1.length < 8) return this.showMessage('signup', 'error', 'Password must be at least 8 characters.');
    if (pw1 !== pw2) return this.showMessage('signup', 'error', 'Passwords do not match.');
    setLoading(btn, true);
    const sb = getSupabase();
    const { error } = await sb.auth.signUp({ email, password: pw1 });
    setLoading(btn, false);
    if (error) return this.showMessage('signup', 'error', error.message || 'Sign up failed.');
    this.showMessage('signup', 'success', 'Account created! Check your email to confirm, then sign in.');
  },

  async forgot() {
    const email = document.getElementById('forgot-email')?.value.trim();
    const btn   = document.getElementById('btn-forgot');
    if (!email) return this.showMessage('forgot', 'error', 'Please enter your email.');
    setLoading(btn, true);
    const sb = getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email);
    setLoading(btn, false);
    if (error) return this.showMessage('forgot', 'error', error.message || 'Failed to send reset email.');
    this.showMessage('forgot', 'success', 'Reset link sent! Check your inbox.');
  },
};

// ── Sign Out ─────────────────────────────────────────────────
async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  App.user = null;
  App.session = null;
  App.updateHeader();
  App.navigate('intro');
  AuthUI.show();
}

// ── Shared helpers ───────────────────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.innerHTML = btn._orig || btn.innerHTML;
  }
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weekOf(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// ── DOM Ready ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  AuthUI.init();
  App.init();
  SetupPage.init();
  ThrowForm.init();
});
