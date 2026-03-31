# IronPit — Horseshoe Pitching Tracker

A personal horseshoe pitching throw tracker and game scorer, deployable to GitHub Pages with Supabase as the backend.

## 🚀 Deployment (GitHub Pages)

1. **Fork / push this repository** to your GitHub account.
2. Go to **Settings → Pages** → set source to `main` branch, root `/`.
3. Your site will be live at `https://yourusername.github.io/repositoryname/`.

## 🗄️ Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In your project, go to **SQL Editor** and run the schema SQL found on the Setup page of the app (or copy it from `js/setup.js`).
3. Go to **Settings → API** and copy your **Project URL** and **anon/public key**.
4. Open your deployed site and navigate to `#setup` (the URL looks like `https://…/#setup`).
5. Paste the URL and anon key, click **Save & Test Connection**.
6. You're ready to sign up and start pitching!

## 📁 File Structure

```
horseshoes/
├── index.html          # Single-page app
├── css/
│   └── style.css       # Full stylesheet (Americana / Aged Wood aesthetic)
└── js/
    ├── supabase.js     # Lightweight Supabase REST client (no SDK)
    ├── app.js          # Routing, auth UI, shared helpers
    ├── throw-form.js   # Session wizard & shoe entry form
    ├── dashboard.js    # Throw dashboard + game scoring logic
    └── setup.js        # Admin setup page & SQL schema
```

## ⚙️ Features

- **Intro page** — sport description, rules, links to NHPA
- **Auth** — sign in, create account, forgot password (via Supabase Auth); session persists across refreshes
- **Throw logging** — wizard for 1–4 player sessions (practice or game), shoe-by-shoe entry per end
- **Throw dashboard** — stacked bar chart by week, toggle totals/%, filter last 50/100/1000 throws, filter by player
- **Game scoring** — live scoreboard with cancellation or all-counting rules, per-end breakdown
- **Setup page** — admin-only Supabase credentials config + SQL schema with RLS policies

## 🔒 Security Notes

- The anon key is stored in `localStorage` (standard for Supabase SPA apps).
- All database rows are protected by Row Level Security — users can only read/write their own data.
- Never use your `service_role` key in the frontend.
