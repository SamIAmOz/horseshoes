// ============================================================
// supabase.js  –  config loader + client factory
// ============================================================

const STORAGE_KEY = 'ironpit_supabase_config';

function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveConfig(url, key) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Lightweight Supabase REST client (no SDK required) ──────
class SupabaseClient {
  constructor(url, key) {
    this.url  = url.replace(/\/$/, '');
    this.key  = key;
    this.auth = new SupabaseAuth(this);
  }

  headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'apikey':        this.key,
      'Authorization': `Bearer ${this.getToken() || this.key}`,
      ...extra,
    };
  }

  getToken() {
    try {
      const s = localStorage.getItem('ironpit_session');
      return s ? JSON.parse(s).access_token : null;
    } catch { return null; }
  }

  // ── REST helpers ──────────────────────────────────────────

  async from(table) {
    return new QueryBuilder(this, table);
  }

  async rpc(fn, params = {}) {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return { data: res.ok ? data : null, error: res.ok ? null : data };
  }
}

class QueryBuilder {
  constructor(client, table) {
    this.client  = client;
    this.table   = table;
    this._select = '*';
    this._filters = [];
    this._order   = null;
    this._limit   = null;
    this._single  = false;
  }

  select(cols = '*') { this._select = cols; return this; }
  eq(col, val)  { this._filters.push(`${col}=eq.${encodeURIComponent(val)}`); return this; }
  neq(col, val) { this._filters.push(`${col}=neq.${encodeURIComponent(val)}`); return this; }
  gte(col, val) { this._filters.push(`${col}=gte.${encodeURIComponent(val)}`); return this; }
  lte(col, val) { this._filters.push(`${col}=lte.${encodeURIComponent(val)}`); return this; }
  in(col, vals) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; }
  order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? 'asc' : 'desc'}`; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = true; return this; }

  _buildUrl(method) {
    let url = `${this.client.url}/rest/v1/${this.table}?select=${this._select}`;
    if (this._filters.length) url += '&' + this._filters.join('&');
    if (this._order)  url += `&order=${this._order}`;
    if (this._limit)  url += `&limit=${this._limit}`;
    return url;
  }

  async _execute(method, body) {
    const url = this._buildUrl(method);
    const extra = method !== 'GET' ? {} : {};
    if (this._single) extra['Accept'] = 'application/vnd.pgrst.object+json';

    const res = await fetch(url, {
      method,
      headers: this.client.headers(extra),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return { data: null, error: null };
    const data = await res.json();
    if (!res.ok) return { data: null, error: data };
    return { data, error: null };
  }

  async get() { return this._execute('GET'); }

  async insert(row) {
    const res = await fetch(`${this.client.url}/rest/v1/${this.table}`, {
      method: 'POST',
      headers: this.client.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    const data = await res.json();
    return res.ok ? { data, error: null } : { data: null, error: data };
  }

  async update(row) {
    const url = this._buildUrl('PATCH');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: this.client.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    });
    const data = await res.json();
    return res.ok ? { data, error: null } : { data: null, error: data };
  }

  async delete() {
    const url = this._buildUrl('DELETE');
    const res = await fetch(url, { method: 'DELETE', headers: this.client.headers() });
    return res.ok ? { data: null, error: null } : { data: null, error: await res.json() };
  }
}

// ── Auth ─────────────────────────────────────────────────────
class SupabaseAuth {
  constructor(client) {
    this.client = client;
    this.SESSION_KEY = 'ironpit_session';
    this._listeners = [];
  }

  _saveSession(session) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    this._notify(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
  }

  _clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
    this._notify('SIGNED_OUT', null);
  }

  getSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return { data: { session: null }, error: null };
      const session = JSON.parse(raw);
      // Check expiry
      if (session.expires_at && Date.now() / 1000 > session.expires_at) {
        this._clearSession();
        return { data: { session: null }, error: null };
      }
      return { data: { session }, error: null };
    } catch { return { data: { session: null }, error: null }; }
  }

  onAuthStateChange(cb) {
    this._listeners.push(cb);
    // Immediately fire with current state
    const { data } = this.getSession();
    cb(data.session ? 'SIGNED_IN' : 'SIGNED_OUT', data.session);
    return { data: { subscription: { unsubscribe: () => {
      this._listeners = this._listeners.filter(l => l !== cb);
    }}}};
  }

  _notify(event, session) {
    this._listeners.forEach(l => l(event, session));
  }

  async signInWithPassword({ email, password }) {
    const res = await fetch(`${this.client.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.client.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { data: { user: null, session: null }, error: data };
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: data.user,
    };
    this._saveSession(session);
    return { data: { user: data.user, session }, error: null };
  }

  async signUp({ email, password }) {
    const res = await fetch(`${this.client.url}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.client.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { data: { user: null, session: null }, error: data };
    return { data: { user: data.user, session: null }, error: null };
  }

  async signOut() {
    const token = this.client.getToken();
    if (token) {
      await fetch(`${this.client.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': this.client.key, 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    }
    this._clearSession();
    return { error: null };
  }

  async resetPasswordForEmail(email) {
    const res = await fetch(`${this.client.url}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': this.client.key },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return res.ok ? { data, error: null } : { data: null, error: data };
  }
}

// ── Global client factory ─────────────────────────────────────
let _client = null;

function getSupabase() {
  if (_client) return _client;
  const cfg = getConfig();
  if (cfg && cfg.url && cfg.key) {
    _client = new SupabaseClient(cfg.url, cfg.key);
    return _client;
  }
  return null;
}

function initSupabase(url, key) {
  saveConfig(url, key);
  _client = new SupabaseClient(url, key);
  return _client;
}

function resetSupabaseClient() { _client = null; }
