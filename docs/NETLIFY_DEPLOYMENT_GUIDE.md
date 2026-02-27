# Netlify Deployment Guide — M88 ITEIMS

Step-by-step guide to import the M88 IT Assets System codebase into another GitHub account and deploy it live on Netlify.

**Prerequisites:**
- The source code is currently in a GitHub repository
- A separate GitHub account owns the Netlify connection
- Netlify account exists and is connected to the target GitHub account
- Supabase project is fully set up (migrations run, data loaded)
- You have your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` ready

---

## Phase 1: Fix .gitignore Before Transferring

Your current `.gitignore` excludes `*.sql` and `package-lock.json`, which will cause problems. Fix this **before** pushing to the new repo.

### Step 1.1 — Update .gitignore

Open `.gitignore` in the project root and make these changes:

**Remove or comment out these lines:**
```diff
# Dependencies
  node_modules/
- package-lock.json
  yarn.lock
  pnpm-lock.yaml
```

```diff
# Database
  *.db
  *.sqlite
  *.sqlite3
- *.sql
```

**Why:**
- `package-lock.json` must be committed so Netlify installs the exact same dependency versions you tested with. Without it, builds can fail or behave differently.
- `*.sql` blocks all 33 migration files in `database/migrations/` from being committed. You want those in the repo for version control.

### Step 1.2 — Verify the fixes locally

Open a terminal in the project root and run:

```powershell
git status
```

You should now see `package-lock.json` and all `database/migrations/*.sql` files as untracked or modified. Stage and commit them:

```powershell
git add .gitignore package-lock.json database/migrations/
git commit -m "Fix .gitignore: include package-lock.json and SQL migrations"
```

---

## Phase 2: Import Codebase to the Other GitHub Account

Since the target account is a different owner, you have two options. **Option A is recommended** for a clean copy.

### Option A — Create a New Repo and Push (Recommended)

This gives you a clean, independent repository.

**On the target GitHub account:**

1. Go to **github.com** → log in to the **target account**
2. Click **"+"** (top-right) → **"New repository"**
3. Configure:
   - **Repository name:** `M88ITAssetsSystem` (or your preferred name)
   - **Visibility:** Private
   - **Do NOT** initialize with README, .gitignore, or license (the repo must be empty)
4. Click **"Create repository"**
5. Copy the new repo's HTTPS URL (e.g., `https://github.com/target-account/M88ITAssetsSystem.git`)

**On your local machine (in the project folder):**

```powershell
# Navigate to your project
cd "c:\Users\johns\Documents\Github\M88ITAssetsSystem-main"

# Add the new repo as a remote (use a different name to avoid conflicts)
git remote add deploy https://github.com/TARGET-ACCOUNT/M88ITAssetsSystem.git

# Push all branches to the new repo
git push deploy main
```

> **Note:** Replace `TARGET-ACCOUNT` with the actual GitHub username. Replace `main` with your branch name if it's different (check with `git branch`).

If prompted for credentials, use the **target account's** GitHub username and a **Personal Access Token** (not password). To create a token:
1. On the target GitHub account → **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **"Generate new token"**
3. Select scopes: `repo` (full control)
4. Copy the token and use it as the password when pushing

**Verify:** Go to the target GitHub account and confirm all files are there, including:
- `index.html` at root
- `src/pages/`, `src/scripts/`, `src/styles/`
- `database/migrations/*.sql` (33 files)
- `package.json` and `package-lock.json`
- `vite.config.js`
- `.env.example` (but NOT `.env` — it's gitignored)

### Option B — Fork the Repository

Use this only if both accounts can see the source repo (e.g., the source is public).

1. Log in to the **target GitHub account**
2. Navigate to the source repository URL
3. Click **"Fork"** (top-right)
4. Select the target account as the owner
5. Click **"Create fork"**

> **Limitation:** Forks maintain a link to the source repo. If the source is private, this won't work unless the target account is a collaborator.

---

## Phase 3: Deploy on Netlify

### Step 3.1 — Create a New Site

1. Log in to **[app.netlify.com](https://app.netlify.com)**
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **"GitHub"** as the Git provider
4. Authorize Netlify to access the target GitHub account if not already done
5. Find and select your **M88ITAssetsSystem** repository

### Step 3.2 — Configure Build Settings

On the deployment configuration screen, set:

| Setting | Value |
|---------|-------|
| **Branch to deploy** | `main` (or your default branch) |
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |

Leave everything else as default.

**Do NOT click "Deploy" yet** — set environment variables first.

### Step 3.3 — Add Environment Variables

On the same deployment page (or go to **Site settings → Environment variables** if you already deployed):

1. Click **"Add environment variables"** or **"New variable"**
2. Add these two variables:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://abcdefg.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

> **Critical:** These must be set BEFORE the first build, otherwise the build will fail with a "Missing Supabase credentials" error because `config.js` validates them at build time.

### Step 3.4 — Deploy

Click **"Deploy site"**.

Netlify will:
1. Clone your repo
2. Run `npm install` (installs dependencies from `package.json` and `package-lock.json`)
3. Run `npm run build` (Vite builds all 13 HTML entry points into `dist/`)
4. Publish the `dist/` folder

**Build time:** Typically 30–90 seconds.

### Step 3.5 — Verify the Deploy

Once the deploy is complete:

1. Netlify assigns a URL like `https://random-name-12345.netlify.app`
2. Click the URL to open your site
3. You should see the **login page** (`index.html`)

---

## Phase 4: Configure Supabase for Your Live URL

Your live Netlify URL must be registered in Supabase so that auth features (password reset emails, user invites) redirect to the correct site.

### Step 4.1 — Update Supabase Site URL

1. Go to **Supabase Dashboard** → your project
2. Navigate to **Authentication → URL Configuration**
3. Set:
   - **Site URL:** `https://YOUR-SITE-NAME.netlify.app`
4. Under **Redirect URLs**, add these entries:
   - `https://YOUR-SITE-NAME.netlify.app/**`

   This allows Supabase auth to redirect back to any page on your site (including `/src/pages/set-password.html` for password resets).

> **Why this is required:** When users click "Set Password" or "Reset Password" links in emails, Supabase redirects them to your site. Without the correct URL configured, those links will point to `localhost:3000` and fail in production.

### Step 4.2 — Test Authentication Flow

1. Open `https://YOUR-SITE-NAME.netlify.app`
2. Log in with an existing admin account
3. Verify you reach the dashboard
4. Test logout — should return to login page
5. Test password reset — click "Forgot Password", enter email, check that the email link redirects to your Netlify URL (not localhost)

---

## Phase 5: Customize Your Netlify Site Name (Optional)

The random Netlify URL isn't great for sharing. Change it:

1. In Netlify → **Site configuration** → **Site details** → **Change site name**
2. Enter a readable name like `m88-assets`
3. Your site becomes `https://m88-assets.netlify.app`
4. **Important:** If you change the site name, go back to **Phase 4** and update the Supabase Site URL and Redirect URLs accordingly.

---

## Phase 6: Post-Deployment Verification Checklist

Test each item on the live Netlify site:

### Authentication
- [ ] Login page loads at root URL
- [ ] Can log in with valid credentials
- [ ] Invalid credentials show error message
- [ ] Logout redirects back to login page
- [ ] Password reset email sends and links to correct URL

### Navigation & Pages
- [ ] Dashboard loads with charts and stats
- [ ] All sidebar navigation links work
- [ ] Assets page loads and shows data
- [ ] Employees page loads and shows data
- [ ] Assignments page loads (both Table and By Employee views)
- [ ] Maintenance page loads
- [ ] Software Licenses page loads
- [ ] Lost Assets page loads
- [ ] Audit Logs page loads
- [ ] Reports page loads
- [ ] Settings page loads
- [ ] User Maintenance page loads

### Core Features
- [ ] Can create/edit/delete an asset
- [ ] Can create/edit an employee
- [ ] Can assign an asset to an employee
- [ ] Can log a maintenance record
- [ ] Can generate a PDF report
- [ ] Can generate an Excel report
- [ ] Can import data from CSV
- [ ] Audit logs record actions

### Role-Based Access
- [ ] Executive sees all regions in dashboard dropdown
- [ ] Admin sees only their region's data
- [ ] IT Staff access matches their permissions
- [ ] Viewer sees dashboard only (read-only)

### Visual & UX
- [ ] Logo displays in sidebar
- [ ] Favicon shows in browser tab
- [ ] Dark theme renders correctly
- [ ] Responsive on mobile (if applicable)

---

## Troubleshooting

### Build fails: "Missing Supabase credentials"
**Cause:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set in Netlify.
**Fix:** Go to **Site settings → Environment variables** and add both variables. Then trigger a redeploy: **Deploys → Trigger deploy → Deploy site**.

### Build fails: "npm install" errors
**Cause:** `package-lock.json` was not committed to the repo.
**Fix:** On your local machine, run `npm install` to generate `package-lock.json`, then commit and push it.

### Pages return 404 ("Page Not Found")
**Cause:** Netlify can't find the built HTML file.
**Fix:** Check that all 13 HTML entry points are listed in `vite.config.js` under `rollupOptions.input`. Then redeploy.

### Password reset emails link to localhost
**Cause:** Supabase Site URL is still set to `http://localhost:3000`.
**Fix:** Go to Supabase → **Authentication → URL Configuration** → update **Site URL** to your Netlify URL. Add the Netlify URL to **Redirect URLs**.

### Login works but dashboard shows no data
**Cause:** Row Level Security (RLS) policies may be blocking data access, or the user doesn't have a `user_profiles` record.
**Fix:** Check that the user exists in both `auth.users` and `user_profiles` tables. Verify RLS policies are configured correctly.

### Styles look broken or missing
**Cause:** The Tailwind CSS build may have failed silently.
**Fix:** Check the build log in Netlify for CSS-related warnings. Locally test with `npm run build && npm run preview` to see if the issue reproduces.

### Subsequent pushes don't deploy
**Cause:** Auto-deploy may be disabled.
**Fix:** In Netlify → **Site settings → Build & deploy → Continuous deployment**, ensure the branch is set correctly and auto-publishing is enabled. Every push to `main` will trigger a new deploy automatically.

---

## Quick Reference: Key Settings

| Item | Value |
|------|-------|
| **Build command** | `npm run build` |
| **Publish directory** | `dist` |
| **Node version** | 18+ (Netlify default is fine) |
| **Env var 1** | `VITE_SUPABASE_URL` |
| **Env var 2** | `VITE_SUPABASE_ANON_KEY` |
| **Supabase Site URL** | `https://YOUR-SITE.netlify.app` |
| **Supabase Redirect URL** | `https://YOUR-SITE.netlify.app/**` |

---

## Continuous Deployment

After initial setup, every `git push` to the `main` branch on the target GitHub account will automatically trigger a new Netlify build and deploy. No manual action needed.

```powershell
# Make a change locally, then:
git add .
git commit -m "Your change description"
git push deploy main
```

The site updates within 1–2 minutes.
