// ============================================================
// dashboard.js  –  Throw Summary Dashboard
// ============================================================

const DashboardPage = {
  allThrows: [],
  chart: null,
  viewMode: 'totals',   // 'totals' | 'percentages'
  throwLimit: 'all',    // 'all' | 50 | 100 | 1000
  filterPlayer: 'all',

  async init() {
    if (!App.user) return;
    await this.loadData();
    this.renderControls();
    this.renderChart();
    this.renderStatCards();
  },

  async loadData() {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await (await sb.from('throws'))
      .eq('user_id', App.user.id)
      .order('thrown_at', { ascending: true })
      .select('*')
      .get();
    if (!error && data) this.allThrows = data;
  },

  getFiltered() {
    let throws = [...this.allThrows];
    if (this.filterPlayer !== 'all') {
      throws = throws.filter(t => t.player_name === this.filterPlayer);
    }
    const limit = parseInt(this.throwLimit);
    if (!isNaN(limit)) throws = throws.slice(-limit);
    return throws;
  },

  getPlayers() {
    const names = [...new Set(this.allThrows.map(t => t.player_name))];
    return names;
  },

  renderControls() {
    const players = this.getPlayers();
    const playerSelect = document.getElementById('dash-player-filter');
    if (playerSelect) {
      playerSelect.innerHTML = '<option value="all">All Players</option>' +
        players.map(p => `<option value="${p}">${p}</option>`).join('');
      playerSelect.value = this.filterPlayer;
      playerSelect.onchange = () => {
        this.filterPlayer = playerSelect.value;
        this.renderChart();
        this.renderStatCards();
      };
    }

    document.querySelectorAll('.toggle-view').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.viewMode);
      btn.onclick = () => {
        this.viewMode = btn.dataset.view;
        document.querySelectorAll('.toggle-view').forEach(b => b.classList.toggle('active', b.dataset.view === this.viewMode));
        this.renderChart();
      };
    });

    document.querySelectorAll('.toggle-limit').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.limit === String(this.throwLimit));
      btn.onclick = () => {
        this.throwLimit = btn.dataset.limit === 'all' ? 'all' : parseInt(btn.dataset.limit);
        document.querySelectorAll('.toggle-limit').forEach(b => b.classList.toggle('active', b.dataset.limit === btn.dataset.limit));
        this.renderChart();
        this.renderStatCards();
      };
    });
  },

  renderChart() {
    const throws = this.getFiltered();
    if (!throws.length) {
      const canvas = document.getElementById('throw-chart');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      document.getElementById('dash-no-data').style.display = '';
      return;
    }
    document.getElementById('dash-no-data').style.display = 'none';

    // Group by week
    const weeks = {};
    throws.forEach(t => {
      const w = weekOf(t.thrown_at);
      weeks[w] = weeks[w] || { Ringer: 0, Leaner: 0, Scorer: 0, 'No Score': 0, total: 0 };
      weeks[w][t.shot_type] = (weeks[w][t.shot_type] || 0) + 1;
      weeks[w].total++;
    });

    const labels = Object.keys(weeks).sort();
    const shotTypes = ['Ringer', 'Leaner', 'Scorer', 'No Score'];
    const COLORS = {
      'Ringer':   { bg: 'rgba(201,146,42,0.75)',  border: '#C9922A' },
      'Leaner':   { bg: 'rgba(61,107,63,0.75)',   border: '#3D6B3F' },
      'Scorer':   { bg: 'rgba(44,95,138,0.75)',   border: '#2C5F8A' },
      'No Score': { bg: 'rgba(106,106,106,0.55)', border: '#6A6A6A' },
    };

    const datasets = shotTypes.map(type => ({
      label: type,
      data: labels.map(w => {
        if (this.viewMode === 'percentages') {
          return weeks[w].total ? Math.round((weeks[w][type] / weeks[w].total) * 100) : 0;
        }
        return weeks[w][type] || 0;
      }),
      backgroundColor: COLORS[type].bg,
      borderColor:     COLORS[type].border,
      borderWidth: 2,
      borderRadius: 3,
    }));

    const canvas = document.getElementById('throw-chart');
    if (!canvas) return;

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: labels.map(w => {
        const d = new Date(w + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: "'Source Code Pro', monospace", size: 11 },
              color: '#444',
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}${this.viewMode === 'percentages' ? '%' : ''}`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(201,146,110,0.12)' },
            ticks: { font: { family: "'Source Code Pro', monospace", size: 10 }, color: '#6A6A6A' },
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(201,146,110,0.12)' },
            ticks: {
              font: { family: "'Source Code Pro', monospace", size: 10 },
              color: '#6A6A6A',
              callback: v => this.viewMode === 'percentages' ? v + '%' : v,
            },
            max: this.viewMode === 'percentages' ? 100 : undefined,
          },
        },
      },
    });
  },

  renderStatCards() {
    const throws = this.getFiltered();
    const total  = throws.length;
    const counts = { Ringer: 0, Leaner: 0, Scorer: 0, 'No Score': 0 };
    throws.forEach(t => { counts[t.shot_type] = (counts[t.shot_type] || 0) + 1; });
    const pct = t => total ? Math.round((counts[t] / total) * 100) : 0;

    document.getElementById('stat-total').textContent       = total;
    document.getElementById('stat-ringers').textContent     = `${counts.Ringer} (${pct('Ringer')}%)`;
    document.getElementById('stat-leaners').textContent     = `${counts.Leaner} (${pct('Leaner')}%)`;
    document.getElementById('stat-scorers').textContent     = `${counts.Scorer} (${pct('Scorer')}%)`;
    document.getElementById('stat-noscores').textContent    = `${counts['No Score']} (${pct('No Score')}%)`;
  },
};

// ============================================================
// scoring.js  –  Game Scoring Dashboard
// ============================================================

const ScoringPage = {
  sessions: [],
  selectedSession: null,
  throws: [],
  refreshInterval: null,

  async init() {
    if (!App.user) return;
    await this.loadSessions();
    this.renderSessionList();

    const sel = document.getElementById('score-session-select');
    sel?.addEventListener('change', () => {
      const id = sel.value;
      this.selectedSession = this.sessions.find(s => s.id === id) || null;
      this.loadGameThrows();
    });

    document.getElementById('btn-refresh-score')?.addEventListener('click', () => this.loadGameThrows());

    // Auto-refresh every 15 seconds
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(() => {
      if (this.selectedSession) this.loadGameThrows();
    }, 15000);
  },

  async loadSessions() {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await (await sb.from('sessions'))
      .eq('user_id', App.user.id)
      .eq('session_type', 'game')
      .order('created_at', { ascending: false })
      .select('*')
      .get();
    if (data) {
      this.sessions = data.map(s => ({
        ...s,
        players: typeof s.players === 'string' ? JSON.parse(s.players) : s.players,
      }));
    }
  },

  renderSessionList() {
    const sel = document.getElementById('score-session-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select a game —</option>' +
      this.sessions.map(s =>
        `<option value="${s.id}">${s.session_name} (${new Date(s.created_at).toLocaleDateString()}) ${s.status === 'active' ? '🟢' : '✓'}</option>`
      ).join('');
  },

  async loadGameThrows() {
    if (!this.selectedSession) return;
    const sb = getSupabase();
    const { data } = await (await sb.from('throws'))
      .eq('session_id', this.selectedSession.id)
      .order('end_number', { ascending: true })
      .order('position', { ascending: true })
      .select('*')
      .get();
    this.throws = data || [];
    this.renderScoreboard();
  },

  renderScoreboard() {
    const session = this.selectedSession;
    if (!session || !session.players) return;

    const players  = session.players;
    const teams    = [...new Set(players.map(p => p.team))].sort();
    const byEnd    = {};
    const teamScores = {};
    teams.forEach(t => teamScores[t] = 0);

    this.throws.forEach(t => {
      byEnd[t.end_number] = byEnd[t.end_number] || [];
      byEnd[t.end_number].push(t);
    });

    const endNums = Object.keys(byEnd).map(Number).sort((a,b)=>a-b);

    // Header
    document.getElementById('score-game-name').textContent   = session.session_name;
    document.getElementById('score-rules-label').textContent = session.scoring_rules === 'all-counting' ? 'All-Counting' : 'Cancellation';

    // Build rows
    const tbody = document.getElementById('score-tbody');
    const thead = document.getElementById('score-thead');

    // Header row
    thead.innerHTML = `<tr>
      <th>End</th>
      ${teams.map(t => {
        const tPlayers = players.filter(p => p.team === t).map(p=>p.name).join(' / ');
        return `<th>Team ${t}<br><small style="font-weight:400;font-size:0.7rem;opacity:0.7">${tPlayers}</small></th>`;
      }).join('')}
    </tr>`;

    tbody.innerHTML = '';
    const runTotals = {};
    teams.forEach(t => runTotals[t] = 0);

    endNums.forEach(end => {
      const shoes = byEnd[end];
      const endScore = calcEndScore(shoes, session.scoring_rules, players);
      teams.forEach(t => { runTotals[t] = (runTotals[t] || 0) + (endScore[t] || 0); });

      // Shoe detail rows
      for (let pos = 1; pos <= 4; pos++) {
        const shoe = shoes.find(s => s.position === pos);
        if (!shoe) continue;
        const typeClass = {
          Ringer: 'badge-ringer', Leaner: 'badge-leaner',
          Scorer: 'badge-scorer', 'No Score': 'badge-noscore'
        }[shoe.shot_type] || '';

        tbody.innerHTML += `<tr style="font-size:0.82rem;opacity:0.8">
          <td style="padding-left:1.5rem;color:#888">#${pos}</td>
          ${teams.map(t => {
            const isTeam = shoe.player_team === t;
            return `<td>${isTeam ? `<span class="badge ${typeClass}">${shoe.shot_type}</span> <span style="font-size:0.75rem;color:#888">${shoe.player_name}</span>` : ''}</td>`;
          }).join('')}
        </tr>`;
      }

      // End score summary row
      const maxScore = Math.max(...teams.map(t => endScore[t] || 0));
      tbody.innerHTML += `<tr style="background:rgba(201,146,110,0.07);font-weight:700">
        <td>End ${end}</td>
        ${teams.map(t => {
          const s = endScore[t] || 0;
          const leader = s === maxScore && maxScore > 0;
          return `<td class="score-cell ${leader ? 'score-leader' : ''}">+${s}</td>`;
        }).join('')}
      </tr>`;
    });

    // Totals row
    const maxTotal = Math.max(...teams.map(t => runTotals[t] || 0));
    tbody.innerHTML += `<tr style="border-top:2px solid var(--iron);background:var(--iron);color:var(--cream)">
      <td style="color:var(--tan);font-family:var(--font-mono);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em">Total</td>
      ${teams.map(t => {
        const s = runTotals[t] || 0;
        return `<td class="score-cell" style="color:${s === maxTotal && maxTotal > 0 ? '#a8e6cf' : 'var(--cream)'}">
          <span class="score-end-total">${s}</span>
        </td>`;
      }).join('')}
    </tr>`;

    document.getElementById('score-table-wrap').style.display = '';
    document.getElementById('score-no-data').style.display = 'none';
  },
};
