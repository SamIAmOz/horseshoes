// ============================================================
// throw-form.js  –  Session wizard + shoe entry
// ============================================================

const ThrowForm = {
  step: 1,          // 1 = setup, 2 = throwing
  sessionData: null,
  endNumber: 1,
  shoes: [],

  init() {
    document.getElementById('btn-start-session')?.addEventListener('click', () => this.startSession());
    document.getElementById('btn-submit-end')?.addEventListener('click',    () => this.submitEnd());
    document.getElementById('btn-new-session')?.addEventListener('click',   () => this.resetWizard());
    document.getElementById('btn-end-game')?.addEventListener('click',      () => this.endGame());
    document.getElementById('session-type')?.addEventListener('change', () => this.onTypeChange());
    document.getElementById('player-count')?.addEventListener('change', () => this.renderPlayerInputs());
    this.renderPlayerInputs();
  },

  onTypeChange() {
    const type = document.getElementById('session-type')?.value;
    const scoringRow = document.getElementById('scoring-rules-row');
    if (scoringRow) scoringRow.style.display = type === 'game' ? '' : 'none';
  },

  renderPlayerInputs() {
    const count = parseInt(document.getElementById('player-count')?.value || '2');
    const container = document.getElementById('player-inputs');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const teamLabel = count >= 3
        ? `<span class="badge" style="background:${['#B34A2E','#B34A2E','#3D6B3F','#3D6B3F'][i]};color:#fff;margin-left:6px">Team ${i < 2 ? 'A' : 'B'}</span>`
        : '';
      container.innerHTML += `
        <div class="form-group">
          <label>Player ${i+1} Name ${teamLabel}</label>
          <input type="text" id="player-${i}" placeholder="Enter name" value="Player ${i+1}">
        </div>`;
    }
  },

  async startSession() {
    const sb = getSupabase();
    if (!sb || !App.user) return toast('Not signed in.', 'error');

    const type       = document.getElementById('session-type')?.value || 'practice';
    const name       = document.getElementById('session-name')?.value.trim() || `Session ${new Date().toLocaleDateString()}`;
    const count      = parseInt(document.getElementById('player-count')?.value || '2');
    const scoring    = document.getElementById('scoring-rules')?.value || 'cancellation';
    const players    = [];

    for (let i = 0; i < count; i++) {
      const n = document.getElementById(`player-${i}`)?.value.trim() || `Player ${i+1}`;
      const team = count >= 3 ? (i < 2 ? 'A' : 'B') : (count === 2 ? (i === 0 ? 'A' : 'B') : 'A');
      players.push({ name: n, team });
    }

    const btn = document.getElementById('btn-start-session');
    setLoading(btn, true);

    const client = await sb.from('sessions');
    const { data, error } = await client.insert({
      user_id:       App.user.id,
      session_type:  type,
      session_name:  name,
      players:       JSON.stringify(players),
      scoring_rules: scoring,
      status:        'active',
      created_at:    new Date().toISOString(),
    });

    setLoading(btn, false);

    if (error) {
      toast('Failed to create session: ' + (error.message || JSON.stringify(error)), 'error');
      return;
    }

    const session = Array.isArray(data) ? data[0] : data;
    this.sessionData = { ...session, players };
    this.endNumber = 1;
    this.step = 2;
    this.renderEndForm();
    this.showStep(2);
    toast(`Session "${name}" started!`, 'success');
  },

  renderEndForm() {
    const sd = this.sessionData;
    if (!sd) return;
    const players = sd.players;

    // Update step indicators
    document.getElementById('step-label-setup').classList.remove('active');
    document.getElementById('step-label-setup').classList.add('done');
    document.getElementById('step-label-throw').classList.add('active');

    // End badge
    document.getElementById('current-end-number').textContent = this.endNumber;

    // Session info pills
    document.getElementById('session-info-name').textContent  = sd.session_name;
    document.getElementById('session-info-type').textContent  = sd.session_type === 'game' ? '⚡ Game' : '🎯 Practice';
    document.getElementById('session-info-rules').textContent = sd.scoring_rules === 'all-counting' ? 'All-Counting' : 'Cancellation';

    // Build shoe entries
    const container = document.getElementById('shoe-entries');
    container.innerHTML = '';
    const labels = ['1st (Closest)', '2nd', '3rd', '4th (Furthest)'];
    for (let i = 0; i < 4; i++) {
      const playerOptions = players.map((p, idx) =>
        `<option value="${idx}">${p.name}${players.length >= 3 ? ` (Team ${p.team})` : ''}</option>`
      ).join('');

      container.innerHTML += `
        <div class="shoe-entry">
          <div class="shoe-number">
            <span class="shoe-icon">🧲</span> Shoe ${i+1} — ${labels[i]}
          </div>
          <div class="form-group mb-1">
            <label>Player</label>
            <select id="shoe-player-${i}">${playerOptions}</select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Shot Type</label>
            <select id="shoe-type-${i}">
              <option value="Ringer">Ringer</option>
              <option value="Leaner">Leaner</option>
              <option value="Scorer">Scorer</option>
              <option value="No Score" selected>No Score</option>
            </select>
          </div>
        </div>`;
    }

    // Running score (only for games)
    const scoreSection = document.getElementById('score-display-section');
    if (sd.session_type === 'game') {
      scoreSection.style.display = '';
      this.updateRunningScore();
    } else {
      scoreSection.style.display = 'none';
    }
  },

  async submitEnd() {
    const sb = getSupabase();
    if (!sb || !this.sessionData) return;

    const shoes = [];
    for (let i = 0; i < 4; i++) {
      shoes.push({
        position:   i + 1,
        player_idx: parseInt(document.getElementById(`shoe-player-${i}`)?.value || '0'),
        shot_type:  document.getElementById(`shoe-type-${i}`)?.value || 'No Score',
      });
    }

    const btn = document.getElementById('btn-submit-end');
    setLoading(btn, true);

    const rows = shoes.map(s => ({
      session_id:  this.sessionData.id,
      user_id:     App.user.id,
      end_number:  this.endNumber,
      position:    s.position,
      player_name: this.sessionData.players[s.player_idx]?.name || '',
      player_team: this.sessionData.players[s.player_idx]?.team || 'A',
      shot_type:   s.shot_type,
      thrown_at:   new Date().toISOString(),
    }));

    // Insert all 4 shoes
    let hasError = false;
    for (const row of rows) {
      const { error } = await (await sb.from('throws')).insert(row);
      if (error) { hasError = true; toast('Error saving throw: ' + (error.message || ''), 'error'); break; }
    }

    setLoading(btn, false);
    if (hasError) return;

    toast(`End ${this.endNumber} recorded!`, 'success');
    this.endNumber++;
    document.getElementById('current-end-number').textContent = this.endNumber;
    this.renderEndForm();
  },

  async endGame() {
    if (!this.sessionData) return;
    const sb = getSupabase();
    const { error } = await (await sb.from('sessions')).eq('id', this.sessionData.id).update({ status: 'complete' });
    if (error) return toast('Error ending session.', 'error');
    toast('Session ended and saved.', 'success');
    this.resetWizard();
  },

  async updateRunningScore() {
    if (!this.sessionData) return;
    const sb = getSupabase();
    const { data: throws } = await (await sb.from('throws')).eq('session_id', this.sessionData.id).select('*').get();
    if (!throws) return;

    const scores = {};
    const players = this.sessionData.players;
    players.forEach(p => { scores[p.team] = scores[p.team] || 0; });

    // Calculate by end using scoring rules
    const byEnd = {};
    throws.forEach(t => {
      byEnd[t.end_number] = byEnd[t.end_number] || [];
      byEnd[t.end_number].push(t);
    });

    Object.entries(byEnd).forEach(([end, shoes]) => {
      const endScore = calcEndScore(shoes, this.sessionData.scoring_rules, this.sessionData.players);
      Object.entries(endScore).forEach(([team, pts]) => {
        scores[team] = (scores[team] || 0) + pts;
      });
    });

    const container = document.getElementById('running-scores');
    const teams = [...new Set(players.map(p => p.team))];
    container.innerHTML = teams.map(team => {
      const teamPlayers = players.filter(p => p.team === team).map(p => p.name).join(' & ');
      return `<div class="stat-card">
        <div class="stat-value">${scores[team] || 0}</div>
        <div class="stat-label">Team ${team}<br><small>${teamPlayers}</small></div>
      </div>`;
    }).join('');
  },

  showStep(n) {
    document.getElementById('step-setup').style.display = n === 1 ? '' : 'none';
    document.getElementById('step-throw').style.display = n === 2 ? '' : 'none';
  },

  resetWizard() {
    this.step = 1;
    this.sessionData = null;
    this.endNumber = 1;
    this.showStep(1);
    document.getElementById('step-label-setup').classList.remove('done');
    document.getElementById('step-label-setup').classList.add('active');
    document.getElementById('step-label-throw').classList.remove('active');
    document.getElementById('session-name').value = '';
    this.renderPlayerInputs();
  },
};

// ── Scoring Logic ─────────────────────────────────────────────
function calcEndScore(shoes, rules, players) {
  // Group by team
  const byTeam = {};
  shoes.forEach(s => {
    byTeam[s.player_team] = byTeam[s.player_team] || [];
    byTeam[s.player_team].push(s);
  });

  const teams = Object.keys(byTeam);
  if (teams.length < 2) return {};

  const POINTS = { Ringer: 3, Leaner: 2, Scorer: 1, 'No Score': 0 };

  if (rules === 'all-counting') {
    const result = {};
    teams.forEach(team => {
      result[team] = byTeam[team].reduce((s, shoe) => s + POINTS[shoe.shot_type], 0);
    });
    return result;
  }

  // Cancellation scoring
  const scores = {};
  teams.forEach(t => scores[t] = 0);

  // Sort all scoreable shoes by value desc
  const allScoring = shoes
    .filter(s => s.shot_type !== 'No Score')
    .map(s => ({ ...s, pts: POINTS[s.shot_type] }))
    .sort((a, b) => b.pts - a.pts);

  // Cancel opposing ringers first
  const remaining = [...allScoring];
  const cancelled = new Set();

  for (let i = 0; i < remaining.length; i++) {
    if (cancelled.has(i)) continue;
    for (let j = i + 1; j < remaining.length; j++) {
      if (cancelled.has(j)) continue;
      if (remaining[i].player_team !== remaining[j].player_team &&
          remaining[i].pts === remaining[j].pts) {
        cancelled.add(i);
        cancelled.add(j);
        break;
      }
    }
  }

  remaining.forEach((shoe, idx) => {
    if (!cancelled.has(idx)) {
      scores[shoe.player_team] = (scores[shoe.player_team] || 0) + shoe.pts;
    }
  });

  return scores;
}
