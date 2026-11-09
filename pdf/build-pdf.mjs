#!/usr/bin/env node
/**
 * Build one PDF per documentation version from the statically built Docusaurus site.
 *
 * How it works
 *  1. Reads the site's baseUrl and the list of docs versions from the metadata
 *     Docusaurus writes to `.docusaurus/` during `npm run build`.
 *  2. Serves `build/` on a local port under that baseUrl (so absolute
 *     `/<baseUrl>/assets/...` URLs resolve).
 *  3. For each version, opens its start page in headless Chromium and follows
 *     the "Next" link of the docs paginator, collecting each page's article
 *     HTML. The page order is therefore exactly the sidebar order.
 *  4. Composes one HTML document per version: cover page + table of contents +
 *     all pages, with the site's own stylesheets plus `pdf/print.css` on top.
 *  5. Prints it to PDF with headers/footers, page numbers and PDF bookmarks.
 *
 * Usage
 *   npm run build && npm run pdf                 # every version
 *   node pdf/build-pdf.mjs --version 3.5         # one version (label or name, e.g. "current")
 *   node pdf/build-pdf.mjs [--keep-html] [--out dist/pdf/x.pdf] [--start /path --label X]
 *
 * Environment
 *   PDF_FORMAT     paper format, e.g. A4 (default) or Letter
 *   PDF_MAX_PAGES  safety limit for the crawl per version (default 500)
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const META_DIR = path.join(ROOT, '.docusaurus');
const OUT_DIR = path.join(ROOT, 'dist', 'pdf');
const TMP_DIR = path.join(ROOT, '.pdf-tmp');

const pkg = JSON.parse(await fsp.readFile(path.join(ROOT, 'package.json'), 'utf8'));
const args = parseArgs(process.argv.slice(2));

const OPTIONS = {
  appName: 'DMHelper',
  title: 'DMHelper Documentation',
  subtitle: 'User manual',
  date: new Date().toISOString().slice(0, 10),
  format: process.env.PDF_FORMAT ?? 'A4',
  maxPages: Number(process.env.PDF_MAX_PAGES ?? 500),
  keepHtml: Boolean(args['keep-html']),
  outFile: args.out ?? null,
  // Selectors for the Docusaurus classic theme (3.x). Adjust if the theme is swizzled.
  // Regular doc pages carry `.theme-doc-markdown`; category "generated index"
  // pages only have a <header> (title + description) followed by nav cards,
  // so the header is used for those and they become section dividers.
  contentSelector: 'article .theme-doc-markdown',
  fallbackContentSelector: 'main header',
  titleSelector: 'article .theme-doc-markdown h1, main header h1',
  nextSelector: '.pagination-nav__link--next',
  // Elements removed from the collected content before printing.
  stripSelectors: [
    '.hash-link',
    '.theme-doc-toc-mobile',
    '.theme-edit-this-page',
    '.theme-doc-version-badge',
    '.theme-doc-version-banner',
    '.theme-doc-breadcrumbs',
    '.pagination-nav',
    'nav',
    'button.clean-btn',
    'section.row', // DocCardList on generated category pages (pure navigation)
  ],
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

// --- Site metadata (written by `docusaurus build`) ---------------------------
async function readSiteMetadata() {
  let baseUrl = '/';
  const configFile = path.join(META_DIR, 'docusaurus.config.mjs');
  if (fs.existsSync(configFile)) {
    const {default: siteConfig} = await import(pathToFileURL(configFile).href);
    baseUrl = siteConfig.baseUrl ?? '/';
  }
  baseUrl = `/${baseUrl.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, ''); // '' for root, '/repo' otherwise

  let versions = [];
  const globalDataFile = path.join(META_DIR, 'globalData.json');
  if (fs.existsSync(globalDataFile)) {
    const globalData = JSON.parse(await fsp.readFile(globalDataFile, 'utf8'));
    const docsPlugin = globalData['docusaurus-plugin-content-docs']?.default;
    versions = (docsPlugin?.versions ?? []).map((v) => ({
      name: v.name,
      label: v.label,
      isLast: v.isLast,
      startPath: v.path.replace(/\/$/, '') || '/',
    }));
  }
  return {baseUrl, versions};
}

// Decide which PDFs to build from CLI args + site metadata.
function selectTargets({baseUrl, versions}) {
  if (args.start) {
    // Manual mode: one PDF from an explicit start path.
    return [{label: args.label ?? pkg.version ?? 'dev', isLast: true, startPath: args.start}];
  }
  if (versions.length === 0) {
    // Site without docs versioning: single PDF from the site root.
    return [{label: pkg.version ?? 'dev', isLast: true, startPath: baseUrl || '/'}];
  }
  if (args.version) {
    const wanted = String(args.version);
    const match = versions.find((v) => v.label === wanted || v.name === wanted);
    if (!match) {
      throw new Error(`Unknown docs version "${wanted}". Available: ${versions.map((v) => `${v.label} (${v.name})`).join(', ')}`);
    }
    return [match];
  }
  return versions;
}

// --- Minimal static file server ---------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** Serve `rootDir` under `baseUrl` (e.g. '/repo' or '' for the root). */
function startServer(rootDir, baseUrl, extraFiles) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (extraFiles.has(urlPath)) {
          res.writeHead(200, {'Content-Type': MIME['.html']});
          res.end(await fsp.readFile(extraFiles.get(urlPath)));
          return;
        }
        let sitePath;
        if (!baseUrl || urlPath === baseUrl || urlPath.startsWith(`${baseUrl}/`)) {
          sitePath = urlPath.slice(baseUrl.length) || '/';
        } else {
          res.writeHead(404);
          res.end(`not found (site is served under ${baseUrl}/)`);
          return;
        }
        const requested = path.join(rootDir, sitePath);
        if (!requested.startsWith(rootDir)) throw new Error('forbidden');
        // trailingSlash: false -> /foo is served from /foo.html or /foo/index.html;
        // both /foo.html and /foo/ (for sub-pages) usually exist side by side.
        let filePath = null;
        let stat = null;
        for (const candidate of [requested, `${requested}.html`, path.join(requested, 'index.html')]) {
          const s = await fsp.stat(candidate).catch(() => null);
          if (s?.isFile()) {
            filePath = candidate;
            stat = s;
            break;
          }
        }
        if (!stat) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, {'Content-Type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'});
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500);
        res.end('error');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({server, port: server.address().port}));
  });
}

// --- Crawl -------------------------------------------------------------------
function slugify(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'page'
  );
}

async function collectPages(page, origin, startPath) {
  const pages = [];
  const seen = new Set();
  let current = new URL(startPath, origin).toString();
  let stylesheets = null;

  while (current && pages.length < OPTIONS.maxPages) {
    const pathname = new URL(current).pathname.replace(/\/$/, '') || '/';
    if (seen.has(pathname)) break;
    seen.add(pathname);

    const response = await page.goto(current, {waitUntil: 'networkidle'});
    if (!response || !response.ok()) {
      console.warn(`  ! skipping ${pathname} (HTTP ${response?.status()})`);
      break;
    }

    stylesheets ??= await page.$$eval('link[rel="stylesheet"]', (links) => links.map((l) => l.getAttribute('href')).filter(Boolean));

    const data = await page.evaluate(
      ({contentSelector, fallbackContentSelector, titleSelector, nextSelector, stripSelectors}) => {
        const isCategory = !document.querySelector(contentSelector);
        const content = document.querySelector(contentSelector) ?? document.querySelector(fallbackContentSelector);
        if (!content) return null;
        const clone = content.cloneNode(true);
        for (const sel of stripSelectors) clone.querySelectorAll(sel).forEach((el) => el.remove());
        // Open collapsed <details> so their content is printed.
        clone.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
        const titleEl = document.querySelector(titleSelector);
        const title = titleEl?.textContent?.trim() || document.title.replace(/\s*\|.*$/, '');
        const next = document.querySelector(nextSelector)?.getAttribute('href') ?? null;
        return {title, html: clone.innerHTML, next, isCategory};
      },
      OPTIONS,
    );

    if (!data) {
      console.warn(`  ! no content found on ${pathname} (selector: ${OPTIONS.contentSelector})`);
      break;
    }

    const id = `p-${slugify(pathname === '/' ? 'index' : pathname)}`;
    pages.push({pathname, id, title: data.title, html: data.html, isCategory: data.isCategory});
    console.log(`  + ${pathname}  —  ${data.title}`);
    current = data.next ? new URL(data.next, origin).toString() : null;
  }
  return {pages, stylesheets: stylesheets ?? []};
}

// --- Compose -----------------------------------------------------------------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
}

function rewriteInternalLinks(html, pages) {
  const byPath = new Map(pages.map((p) => [p.pathname, p.id]));
  // href="/base/some/page#anchor" -> href="#p-base-some-page" (keep deep anchors if present)
  return html.replace(/href="(\/[^"#]*)(#[^"]*)?"/g, (m, href, hash) => {
    const clean = href.replace(/\/$/, '') || '/';
    if (byPath.has(clean)) return `href="${hash ? hash : `#${byPath.get(clean)}`}"`;
    return m;
  });
}

function composeDocument({pages, stylesheets, origin, printCss, version}) {
  const toc = pages
    .map((p, i) => `<li class="${p.isCategory ? 'toc-category' : 'toc-doc'}"><a href="#${p.id}"><span class="toc-num">${i + 1}</span><span class="toc-title">${escapeHtml(p.title)}</span></a></li>`)
    .join('\n');

  const body = pages
    .map(
      (p, i) => `
<section class="pdf-page${p.isCategory ? ' pdf-category' : ''}" id="${p.id}" data-chapter="${i + 1}">
<div class="theme-doc-markdown markdown">
${rewriteInternalLinks(p.html, pages)}
</div>
</section>`,
    )
    .join('\n');

  const subtitle = version.isLast ? OPTIONS.subtitle : `${OPTIONS.subtitle} · draft`;

  return `<!doctype html>
<html lang="en" data-theme="light" dir="ltr">
<head>
<meta charset="utf-8">
<base href="${origin}/">
<title>${escapeHtml(OPTIONS.title)} ${escapeHtml(version.label)}</title>
${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')}
<style>
${printCss}
</style>
</head>
<body class="pdf-document">
<section class="pdf-cover">
  <div class="cover-brand">${escapeHtml(OPTIONS.appName)}</div>
  <h1 class="cover-title">${escapeHtml(OPTIONS.title)}</h1>
  <p class="cover-subtitle">${escapeHtml(subtitle)}</p>
  <div class="cover-meta">
    <div><span>Version</span><strong>${escapeHtml(version.label)}</strong></div>
    <div><span>Date</span><strong>${escapeHtml(OPTIONS.date)}</strong></div>
  </div>
</section>
<section class="pdf-toc">
  <h1>Contents</h1>
  <ol class="toc-list">
${toc}
  </ol>
</section>
${body}
</body>
</html>`;
}

// --- Main --------------------------------------------------------------------
async function buildOne({page, origin, printCss, extraFiles, version}) {
  console.log(`\nVersion ${version.label}: crawling ${origin}${version.startPath} ...`);
  const {pages, stylesheets} = await collectPages(page, origin, version.startPath);
  if (pages.length === 0) throw new Error(`No pages collected for version ${version.label}.`);

  const safeVersion = version.label.replace(/[^A-Za-z0-9._-]+/g, '_');
  const composedPath = path.join(TMP_DIR, `document-${safeVersion}.html`);
  const composedUrl = `/__pdf__/document-${safeVersion}.html`;
  extraFiles.set(composedUrl, composedPath);

  const html = composeDocument({pages, stylesheets, origin, printCss, version});
  await fsp.writeFile(composedPath, html, 'utf8');

  await page.goto(`${origin}${composedUrl}`, {waitUntil: 'networkidle'});
  await page.emulateMedia({media: 'print'});
  // Wait for web fonts so measurements are final.
  await page.evaluate(() => document.fonts?.ready);

  const outFile = OPTIONS.outFile ? path.resolve(ROOT, OPTIONS.outFile) : path.join(OUT_DIR, `${OPTIONS.appName}-Documentation-${safeVersion}.pdf`);

  const footerLeft = `${escapeHtml(OPTIONS.title)} · ${escapeHtml(version.label)}`;
  await page.pdf({
    path: outFile,
    format: OPTIONS.format,
    printBackground: true,
    preferCSSPageSize: false,
    displayHeaderFooter: true,
    // Header/footer templates are rendered by Chromium outside the page CSS:
    // inline styles and an explicit font-size are required.
    headerTemplate: `<div style="width:100%;font-size:8px;color:#888;font-family:Helvetica,Arial,sans-serif;padding:0 14mm;display:flex;justify-content:space-between;">
          <span class="title"></span><span>${escapeHtml(OPTIONS.appName)}</span></div>`,
    footerTemplate: `<div style="width:100%;font-size:8px;color:#888;font-family:Helvetica,Arial,sans-serif;padding:0 14mm;display:flex;justify-content:space-between;">
          <span>${footerLeft}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    margin: {top: '20mm', bottom: '18mm', left: '18mm', right: '18mm'},
    outline: true, // PDF bookmarks from headings
    tagged: true, // accessible/tagged PDF
  });
  await page.emulateMedia({media: 'screen'});

  const stat = await fsp.stat(outFile);
  console.log(`PDF written: ${path.relative(ROOT, outFile)} (${pages.length} pages of content, ${(stat.size / 1024).toFixed(0)} KiB)`);
  if (OPTIONS.keepHtml) {
    console.log(`Composed HTML kept at ${path.relative(ROOT, composedPath)} (open it in a browser to debug styling).`);
  }
}

async function main() {
  if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    console.error('build/ not found. Run `npm run build` first.');
    process.exit(1);
  }
  const site = await readSiteMetadata();
  const targets = selectTargets(site);
  if (targets.length > 1 && OPTIONS.outFile) {
    throw new Error('--out can only be used together with --version or --start (one PDF).');
  }

  await fsp.mkdir(OUT_DIR, {recursive: true});
  await fsp.mkdir(TMP_DIR, {recursive: true});

  const printCss = await fsp.readFile(path.join(__dirname, 'print.css'), 'utf8');
  const extraFiles = new Map();

  const {server, port} = await startServer(BUILD_DIR, site.baseUrl, extraFiles);
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    console.log(`Serving build/ at ${origin}${site.baseUrl}/ — ${targets.length} PDF(s) to build: ${targets.map((t) => t.label).join(', ')}`);
    for (const version of targets) {
      await buildOne({page, origin, printCss, extraFiles, version});
    }
  } finally {
    await browser.close();
    server.close();
    if (!OPTIONS.keepHtml) await fsp.rm(TMP_DIR, {recursive: true, force: true});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
