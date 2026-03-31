// ============================================================
// setup.js  –  Admin setup page
// ============================================================

const SCHEMA_SQL = `-- ============================================================
-- IronPit Horseshoe Tracker — Supabase Schema
-- Run this entire block in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── SESSIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type  TEXT NOT NULL DEFAULT 'practice',   -- 'practice' | 'game'
  session_name  TEXT NOT NULL,
  players       JSONB NOT NULL DEFAULT '[]',         -- [{name, team}]
  scoring_rules TEXT NOT NULL DEFAULT 'cancellation',-- 'cancellation' | 'all-counting'
  status        TEXT NOT NULL DEFAULT 'active',      -- 'active' | 'complete'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── THROWS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS throws (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  end_number   INT NOT NULL,
  position     INT NOT NULL,       -- 1=closest, 4=furthest
  player_name  TEXT NOT NULL,
  player_team  TEXT NOT NULL,      -- 'A' | 'B'
  shot_type    TEXT NOT NULL,      -- 'Ringer'|'Leaner'|'Scorer'|'No Score'
  thrown_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_id   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_throws_session_id  ON throws(session_id);
CREATE INDEX IF NOT EXISTS idx_throws_user_id     ON throws(user_id);
CREATE INDEX IF NOT EXISTS idx_throws_thrown_at   ON throws(thrown_at);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE throws   ENABLE ROW LEVEL SECURITY;

-- Sessions: users can only see/edit/delete their own rows
CREATE POLICY "sessions_select" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Throws: users can only see/edit/delete their own rows
CREATE POLICY "throws_select" ON throws
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "throws_insert" ON throws
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "throws_update" ON throws
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "throws_delete" ON throws
  FOR DELETE USING (auth.uid() = user_id);
`;

const SetupPage = {
  init() {
    document.getElementById('btn-save-setup')?.addEventListener('click',  () => this.save());
    document.getElementById('btn-clear-setup')?.addEventListener('click', () => this.clear());

    // Populate schema block
    const schemaEl = document.getElementById('schema-block');
    if (schemaEl) schemaEl.textContent = SCHEMA_SQL;

    // Pre-fill if config already saved
    const cfg = getConfig();
    if (cfg) {
      const urlEl = document.getElementById('setup-url');
      const keyEl = document.getElementById('setup-key');
      if (urlEl) urlEl.value = cfg.url || '';
      if (keyEl) keyEl.value = cfg.key || '';
    }
  },

  showMsg(type, text) {
    const el = document.getElementById('msg-setup');
    if (!el) return;
    el.className = `auth-message ${type}`;
    el.textContent = text;
  },

  async save() {
    const url = document.getElementById('setup-url')?.value.trim();
    const key = document.getElementById('setup-key')?.value.trim();
    if (!url || !key) return this.showMsg('error', 'Both URL and API key are required.');
    if (!url.startsWith('https://')) return this.showMsg('error', 'URL must start with https://');

    const btn = document.getElementById('btn-save-setup');
    setLoading(btn, true);
    this.showMsg('', '');

    // Test connection by hitting the REST endpoint
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
      });
      if (!res.ok && res.status !== 200 && res.status !== 404) throw new Error(`Status ${res.status}`);
      // 200 or 404 are both "connected" — 404 just means no route, which is expected on the root
      initSupabase(url, key);
      this.showMsg('success', '✓ Connection successful! Config saved. You can now sign in.');
      toast('Supabase connected!', 'success');
    } catch (err) {
      this.showMsg('error', `Connection failed: ${err.message}. Check URL and key.`);
    } finally {
      setLoading(btn, false);
    }
  },

  clear() {
    clearConfig();
    resetSupabaseClient();
    document.getElementById('setup-url').value = '';
    document.getElementById('setup-key').value = '';
    this.showMsg('success', 'Config cleared. Enter new credentials to reconnect.');
    toast('Config cleared.', 'info');
  },

  copySchema() {
    navigator.clipboard.writeText(SCHEMA_SQL).then(() => {
      toast('SQL copied to clipboard!', 'success');
    }).catch(() => {
      toast('Copy failed — please select and copy manually.', 'error');
    });
  },
};
