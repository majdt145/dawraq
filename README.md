# דורק — DAWRAQ · Website

Bilingual (He/Ar) marketing site for DAWRAQ — an experiential STEM program for
elementary schools (GEFEN program #43964). Client: Mostafa.

## Stack
- Static site, no Node locally: `src/pages/*.html` are wrapped in `src/layout.html`
  by `build.py` (Python) → `dist/`.
- Language toggle He↔Ar via `data-he`/`data-ar` attributes (`src/app.js`), both RTL.
- Forms: `api/form.js` (Vercel serverless → Resend). Env vars: `RESEND_API_KEY`, `FORM_TO_EMAIL`.
- Deploy: GitHub → Vercel (`vercel.json`: `python3 build.py` → `dist/`).

## Develop
```
python build.py        # build to dist/
# serve dist/ with any static server (launch.json: "dawraq-site" :8830)
```

## Content flags (build.py)
- `JOURNEYS_LIST` — flip to True when Mostafa sends the real names of the 20 journeys.
