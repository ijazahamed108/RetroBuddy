# Deployment guide

RetroBuddy is a plain static website. The **repository root is the site**: there is no build step, no server code and no environment variables. Any static host works. This guide covers the two free options it was designed for, plus how to ship updates safely.

- [GitHub Pages](#option-a-github-pages)
- [Vercel](#option-b-vercel)
- [Custom domain](#custom-domain)
- [Releasing updates](#releasing-updates)
- [Pre-deploy checklist](#pre-deploy-checklist)
- [Other hosts](#other-hosts)
- [Hosting limits to keep in mind](#hosting-limits-to-keep-in-mind)

---

## Option A: GitHub Pages

**Result:** `https://<your-user>.github.io/RetroBuddy/`

1. Push the code to GitHub (for this project: `https://github.com/ijazahamed108/RetroBuddy`).
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Under **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main`, folder **`/ (root)`** → **Save**.
4. Wait about 1 minute. The URL appears at the top of the Pages settings (and under **Actions** you'll see a "pages build and deployment" run).
5. Open the URL on your phone and laptop and play a game.

Notes:

- The empty `.nojekyll` file tells GitHub Pages to serve files as-is (no Jekyll processing).
- All links in the app are **relative**, so it works under the `/RetroBuddy/` sub-path without configuration. To preview that exact setup locally, run `npm start -- --base /RetroBuddy/`.
- GitHub Pages can't set custom HTTP headers, so the security policy is delivered through `<meta http-equiv="Content-Security-Policy">` tags in each HTML file, which works on every host.
- Every push to `main` redeploys automatically.

## Option B: Vercel

**Result:** `https://retrobuddy-<something>.vercel.app/` (or your own domain)

### Using the dashboard (recommended)

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account (the free *Hobby* plan is enough).
2. **Add New… → Project** → find **RetroBuddy** → **Import**.
3. Configure:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Build Command:** *leave empty* (toggle the override on and clear it if Vercel pre-fills one)
   - **Output Directory:** `.`
   - **Install Command:** *leave empty* (nothing needs installing to serve the site)
4. **Deploy**. Every push to `main` creates a production deployment, and every pull request gets a preview URL.

### Using the CLI

```bash
npm i -g vercel
vercel          # first run links the project; accept the defaults, no build command
vercel --prod   # deploy to production
```

`vercel.json` adds production headers on Vercel:

| Header | Purpose |
| --- | --- |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` | Security hardening |
| `Cache-Control: no-cache` on `sw.js` and `games/games.json` | Updates to the app and the catalog reach users immediately |
| Long-lived `Cache-Control` on ROMs and assets | Fast repeat visits |

The local dev server (`npm start`) applies the same headers, so you can test them before deploying.

## Custom domain

- **GitHub Pages:** Settings → Pages → **Custom domain** → enter `games.example.com`, then create a DNS `CNAME` record pointing to `<your-user>.github.io`. Tick **Enforce HTTPS** once the certificate is issued.
- **Vercel:** Project → **Settings → Domains** → add the domain and follow the DNS instructions shown.

HTTPS is required: service workers (offline play and installation) and gamepad support only work in secure contexts. Both hosts provide free certificates.

## Releasing updates

1. Make your changes and run the checks:

   ```bash
   npm test
   npm run validate
   npm run test:e2e        # optional but recommended; needs `npm install` and Chrome
   ```

2. **If you changed any file in the app shell** (HTML, CSS, JS, icons, font), bump `VERSION` at the top of `sw.js`:

   ```js
   const VERSION = 'v1.0.1';
   ```

   The service worker serves cached shell files instantly and refreshes them in the background. Bumping the version makes every visitor download a fresh copy on their next visit, and old caches are deleted.

3. **If you replaced a ROM file in place** (same path), bump `ROM_CACHE` in `sw.js` (`'rb-roms-v2'`), or give the new file a new name. ROMs are cached permanently once played.

4. **If you upgrade EmulatorJS**, change `EMULATORJS_VERSION` in `assets/js/play.js` **and** `EMULATOR_CACHE` in `sw.js` (the unit tests enforce that they match). Then run `npm run test:e2e` with `ALL_GAMES=1` to confirm every game still boots.

5. Commit and push to `main`. GitHub Pages / Vercel redeploy automatically.

## Pre-deploy checklist

- [ ] `npm test` passes (CI runs this on every push and pull request).
- [ ] `npm run validate` reports no errors.
- [ ] `sw.js` `VERSION` bumped if shell files changed.
- [ ] New games have a license and source entry in `games/games.json` and in [CREDITS.md](../CREDITS.md).
- [ ] Tested on a phone. Use `npm start -- --host 0.0.0.0` and open `http://<computer-ip>:8080/` on the same Wi-Fi. Offline mode and installing need HTTPS, so test those on the deployed site.

## Other hosts

Because it's static, the same folder deploys unchanged to **Netlify** (drag-and-drop the folder or connect the repo, publish directory `.`), **Cloudflare Pages** (build command empty, output directory `/`), **Firebase Hosting**, **Surge**, an S3 bucket, or any nginx/Apache server. If your host supports custom headers, copy the ones from `vercel.json`.

## Hosting limits to keep in mind

| | GitHub Pages | Vercel Hobby |
| --- | --- | --- |
| Max single file | 100 MB (GitHub's git limit) | 100 MB (same GitHub limit when deploying from the repo) |
| Site size | Recommended ≤ 1 GB | Fine for a site this size |
| Bandwidth | Soft limit ~100 GB/month | ~100 GB/month included |
| Custom headers | ❌ (meta CSP used instead) | ✅ `vercel.json` |
| Commercial use | Not intended for commercial SaaS | Hobby plan is non-commercial |

The bundled library is about 15 MB. The emulator runtime and cores (a few MB per system) are served from the EmulatorJS CDN, so they don't count against your bandwidth.
