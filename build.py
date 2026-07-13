#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
DAWRAQ — tiny static-site generator (no Node needed; same pattern as milim-veharozem).
Wraps each src/pages/*.html in src/layout.html, sets the active nav item,
fills <title>/<meta description>, and copies styles.css, app.js and assets/ to dist/.

Usage:  python build.py
"""
import os, re, shutil, glob, hashlib


def _ver(path):
    """Short content hash of an asset, for cache-busting ?v= stamps."""
    return hashlib.md5(open(path, "rb").read()).hexdigest()[:8]

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
DIST = os.path.join(ROOT, "dist")

# Canonical origin. When a custom domain is connected in Vercel, flip this
# ONE line and rebuild. No hreflang: one URL serves He+Ar via the JS toggle.
SITE_URL = "https://dawraq.vercel.app"

# Content flags: <!--IF:NAME--> ... <!--ENDIF:NAME--> blocks kept only when True.
# JOURNEYS_LIST stays False until Mostafa sends the real names of the 20 journeys.
FLAGS = {"JOURNEYS_LIST": False}

# IndexNow ownership key — must stay stable and match the {key}.txt file at the
# site root. Ping after deploys: POST https://api.indexnow.org/indexnow
INDEXNOW_KEY = "c4036613d05e05cc0c3d2117a1140bc3"

META_RE = re.compile(r"^\s*<!--meta(.*?)-->", re.DOTALL)
FLAG_RE = re.compile(r"<!--IF:(\w+)-->(.*?)<!--ENDIF:\1-->", re.DOTALL)


def apply_flags(html):
    return FLAG_RE.sub(lambda m: m.group(2) if FLAGS.get(m.group(1)) else "", html)


# Structured data: the educational organization + its GEFEN program.
def jsonld():
    import json
    graph = {"@context": "https://schema.org", "@graph": [
        {
            "@type": "EducationalOrganization",
            "@id": SITE_URL + "/#org",
            "name": "דורק — DAWRAQ",
            "alternateName": ["Dawraq", "دورق"],
            "description": "מסעות מדע חווייתיים לתלמידי בית הספר היסודי — תוכנית גפ\"ן 43964",
            "url": SITE_URL + "/",
            "logo": SITE_URL + "/assets/icons/icon-512.png",
            "email": "Dawraqfactory@gmail.com",
            "telephone": "+972-52-775-8483",
            "availableLanguage": ["he", "ar"],
        },
        {
            "@type": "Course",
            "name": "דורק — מסעות מדע לבית הספר היסודי (גפ\"ן 43964)",
            "description": "20 מסעות למידה מדעיים חווייתיים בהשראת הימים הבינלאומיים של האו\"ם, בהנחיית דמות מונפשת — ערכות ניסוי, חוברות עבודה והדרכה למורים.",
            "provider": {"@id": SITE_URL + "/#org"},
            "educationalLevel": "בית ספר יסודי",
            "inLanguage": ["he", "ar"],
        },
    ]}
    return '<script type="application/ld+json">%s</script>' % json.dumps(graph, ensure_ascii=False)


def write_sitemap(pages):
    urls = "".join(
        "  <url><loc>%s/%s</loc></url>\n" % (SITE_URL, "" if p == "index.html" else p)
        for p in sorted(pages)
    )
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls)
    open(os.path.join(DIST, "sitemap.xml"), "w", encoding="utf-8").write(xml)
    open(os.path.join(DIST, "robots.txt"), "w", encoding="utf-8").write(
        "User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n" % SITE_URL)
    open(os.path.join(DIST, INDEXNOW_KEY + ".txt"), "w", encoding="utf-8").write(INDEXNOW_KEY)
    # llms.txt — AI-search discovery file (ChatGPT/Perplexity-class crawlers)
    open(os.path.join(DIST, "llms.txt"), "w", encoding="utf-8").write(
"""# DAWRAQ (דורק / دورق)

> Experiential science program for Israeli elementary schools (grades 1-6):
> 20 hands-on "learning journeys" themed on UN International Days, led by the
> animated character DAWRAK. Each journey ships as a classroom kit (experiment
> materials, animation videos, workbooks, teacher guide) stored in a custom
> classroom cabinet. Experiments written and validated by Dr. Shadi Farah,
> senior scientist at the Technion. Approved program #43964 in the Israeli
> Ministry of Education GEFEN marketplace (fixed 4%% budget). Site is bilingual
> Hebrew/Arabic on single URLs (client-side toggle). Registered TM 378828.

## Pages
- [Home](%s/): program overview, goals, how a journey works
- [The Journeys](%s/journeys.html): journey anatomy, kit contents, UN days, classroom cabinet
- [For Schools / GEFEN](%s/schools.html): program card #43964, what schools receive, how to order
- [Contact](%s/contact.html): phone 052-775-8483, WhatsApp, Dawraqfactory@gmail.com

## Contact
- Email: Dawraqfactory@gmail.com
- Phone/WhatsApp: +972-52-775-8483
""" % (SITE_URL, SITE_URL, SITE_URL, SITE_URL))


def parse_meta(text):
    m = META_RE.match(text)
    meta = {}
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text.strip()


def build():
    layout = open(os.path.join(SRC, "layout.html"), encoding="utf-8").read()

    # fresh dist — clear CONTENTS (not the dir itself; may be locked on Windows)
    os.makedirs(DIST, exist_ok=True)
    for entry in os.listdir(DIST):
        p = os.path.join(DIST, entry)
        if os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)
        else:
            try:
                os.remove(p)
            except OSError:
                pass

    # static assets + content-hash versions; CSS/JS conservatively slimmed, fail-open
    ver = {}
    for fname in ("styles.css", "app.js"):
        src_file = os.path.join(SRC, fname)
        text = open(src_file, encoding="utf-8").read()
        try:
            slim = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
            slim = "\n".join(l.strip() for l in slim.splitlines() if l.strip())
        except Exception:
            slim = text
        open(os.path.join(DIST, fname), "w", encoding="utf-8").write(slim)
        ver[fname] = _ver(src_file)
    if os.path.isdir(os.path.join(SRC, "assets")):
        shutil.copytree(os.path.join(SRC, "assets"), os.path.join(DIST, "assets"))

    pages = sorted(glob.glob(os.path.join(SRC, "pages", "*.html")))
    built = []
    for path in pages:
        name = os.path.basename(path)
        raw = open(path, encoding="utf-8").read()
        meta, body = parse_meta(raw)
        body = apply_flags(body)

        html = layout
        html = html.replace('href="styles.css"', 'href="styles.css?v=%s"' % ver["styles.css"])
        html = html.replace('src="app.js"', 'src="app.js?v=%s"' % ver["app.js"])
        title = meta.get("title", "דורק — DAWRAQ")
        html = html.replace("{{TITLE}}", title)
        html = html.replace("{{TITLE_AR}}", meta.get("title_ar", title))
        html = html.replace("{{DESC}}", meta.get("desc", ""))
        html = html.replace("{{DESC_AR}}", meta.get("desc_ar", meta.get("desc", "")))
        html = html.replace("{{CANONICAL}}",
                            SITE_URL + "/" + ("" if name == "index.html" else name))
        html = html.replace("{{SITE_URL}}", SITE_URL)
        html = html.replace("{{JSONLD}}",
                            jsonld() if name in ("index.html", "schools.html") else "")
        html = html.replace("{{CONTENT}}", body)

        nav = meta.get("nav", "")
        if nav:
            html = html.replace(
                'data-nav="%s"' % nav,
                'data-nav="%s" class="active" aria-current="page"' % nav,
            )

        out = os.path.join(DIST, name)
        open(out, "w", encoding="utf-8").write(html)
        built.append(name)

    write_sitemap(built)

    print("Built %d page(s): %s" % (len(built), ", ".join(built)))
    print("Output: %s (+ sitemap.xml, robots.txt)" % DIST)


if __name__ == "__main__":
    build()
