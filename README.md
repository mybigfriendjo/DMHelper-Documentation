# DMHelper Documentation

User documentation for **DMHelper**, the desktop assistant for Dungeon Masters
(battlemaps, tokens, fog of war, campaign notes).

- **Website:** <https://mybigfriendjo.github.io/DMHelper-Documentation/>
- **PDF:** one per documentation version, published with the website under
  `/pdf/` (for example `/pdf/DMHelper-Documentation-3.5.pdf`) and attached to
  every workflow run as an artifact.

## Contributing

Contributions are welcome, no local setup needed for small fixes:

1. Open the page on the website and click **Edit this page** at the bottom.
2. GitHub opens the Markdown source in your fork; edit, then open a pull request.
3. The pull request is built automatically (website + PDF). Once it is merged,
   the site is redeployed within a few minutes.

For larger changes clone the repository and run it locally (see below).

### Where things live

| Path | Content |
| --- | --- |
| `docs/` | The version currently being written (DMHelper **3.11**). Shown on the site as `/next` with an "unreleased" banner. |
| `versioned_docs/version-3.5/` | The frozen manual for DMHelper 3.5. Only fix mistakes here. |
| `versions.json`, `versioned_sidebars/` | Docusaurus version bookkeeping. |
| `docs/**/img/` | Screenshots and icons, stored next to the pages that use them. |
| `static/img/` | Site-wide assets (logo, favicon, social card). |
| `pdf/` | PDF pipeline (`build-pdf.mjs`) and print stylesheet (`print.css`). |
| `src/css/custom.css` | Website theme. |

Pages are plain Markdown (`.md`). The folder structure defines the sidebar and
the PDF chapter order: `sidebar_position` in a page's frontmatter orders pages,
`_category_.json` labels and orders folders.

### Writing conventions

- Every page starts with frontmatter containing `title` and `sidebar_position`
  and has one `# Heading`.
- Link to other pages with relative file paths (`./other-page.md`,
  `../section/page.md`) so broken links fail the build.
- Images: `![What the reader sees](./img/screenshot.png)` next to the page.
  Keep screenshots under about 400 KB.
- Toolbar/button tables: put the icon in the first column with the normal image
  syntax; it is rendered at icon size automatically.
- Highlight words that correspond to coloured areas in a screenshot with
  `<mark>text</mark>` (yellow) or `<mark class="hl-lime">text</mark>`
  (`hl-orange`, `hl-magenta`, `hl-cornflowerblue`, `hl-blue`).
- Call-outs: `:::note`, `:::tip`, `:::info`, `:::warning`, `:::danger`, with an
  optional title `:::note[Title]`.
- Write for Dungeon Masters, not developers: plain language, task-oriented
  headings, one idea per section.

## Local development

The repository ships a VS Code dev container with everything installed
(Node 24, Chromium for the PDF, poppler tools). Alternatively install Node 24
and run:

```bash
npm ci
npm start              # dev server on http://localhost:3000 (no search index in dev)
npm run build          # production website -> build/
npm run serve          # serve build/ locally
npm run pdf            # PDFs for all versions -> dist/pdf/ (needs build/)
npm run pdf -- --version 3.5   # one version only
npm run build:all      # build + pdf
npm run lint:md        # markdownlint
npm run typecheck      # tsc on config/components
```

## Releasing a documentation version

Versioning is handled by Docusaurus inside this branch, not with git branches.
When the manual in `docs/` is complete for the DMHelper release it describes:

```bash
npm run docs:version 3.11
```

This snapshots `docs/` into `versioned_docs/version-3.11/`, makes 3.11 the
default version at `/` and moves 3.5 to `/3.5/`. `docs/` then becomes the draft
for the following release; give it its new label in `docusaurus.config.ts`
(`versions.current.label`).

## Deployment

`.github/workflows/docs.yml` builds the website and the PDFs on every pull
request and deploys to GitHub Pages on every push to `main`. The repository's
Pages source must be set to "GitHub Actions" once (Settings → Pages). The site
URL is derived from the repository owner and name, so forks deploy to their own
`https://<owner>.github.io/<repo>/` without configuration changes.
