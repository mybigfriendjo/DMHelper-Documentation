import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// --- Site identity -----------------------------------------------------------
// Hosted on GitHub Pages as a *project* site, so the site lives under
// https://<owner>.github.io/<repo>/. `url` + `baseUrl` must match that location,
// otherwise asset links break. Both can be overridden through environment
// variables, which the GitHub workflow uses so that forks deploy correctly.
const GITHUB_ORG = 'mybigfriendjo';
const GITHUB_REPO = 'DMHelper-Documentation';
const REPO_URL = `https://github.com/${GITHUB_ORG}/${GITHUB_REPO}`;

const SITE_URL = process.env.DOCS_SITE_URL ?? `https://${GITHUB_ORG}.github.io`;
const BASE_URL = process.env.DOCS_BASE_URL ?? `/${GITHUB_REPO}/`;

const config: Config = {
  title: 'DMHelper Documentation',
  tagline: 'Battlemaps, tokens, fog of war and campaign notes for Dungeon Masters',
  favicon: 'img/favicon.ico',

  url: SITE_URL,
  baseUrl: BASE_URL,
  trailingSlash: false,

  // GitHub Pages deployment metadata (only used by `docusaurus deploy`, which
  // we do not use; deployment happens in .github/workflows/docs.yml).
  organizationName: GITHUB_ORG,
  projectName: GITHUB_REPO,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'warn',

  // Opt in to upcoming Docusaurus v4 behaviour today so the eventual upgrade
  // is a no-op. `faster` enables the Rspack/SWC-based build pipeline
  // (requires @docusaurus/faster; stable since 3.10, default in v4).
  future: {
    v4: true,
    faster: true,
  },

  // Exposed to components via `siteConfig.customFields`.
  customFields: {
    appName: 'DMHelper',
    repoUrl: REPO_URL,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    // 'detect': `.md` files are parsed as CommonMark (no JSX/MDX parsing, so
    // legacy Markdown with `<`, `{` or HTML comments just works), `.mdx` files
    // get the full MDX treatment. Rename a file to .mdx when it needs components.
    format: 'detect',
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'throw',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          // Docs-only mode: the documentation IS the site. Pages live at `/`.
          routeBasePath: '/',
          path: 'docs',
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: false,
          // "Edit this page" links. Docusaurus points them at docs/ for the
          // current version and at versioned_docs/version-X/ for released ones.
          editUrl: `${REPO_URL}/edit/main/`,

          // --- Versioning ------------------------------------------------------
          // Docusaurus versioning lives in this branch, not in git branches:
          //   docs/                        "current" version, work in progress
          //   versioned_docs/version-3.5/  frozen snapshot of the 3.5 manual
          //   versioned_sidebars/          sidebar config per snapshot
          //   versions.json                list of released versions (newest first)
          // The newest entry in versions.json is the default version and is
          // served at `/`; the current version is served at `/next` with an
          // "unreleased" banner. When the 3.11 manual is complete, release it with
          //   npx docusaurus docs:version 3.11
          // which snapshots docs/ into versioned_docs/version-3.11/, makes 3.11
          // the default and moves 3.5 to `/3.5`. docs/ then becomes the draft
          // of the following version (give it a new label below).
          versions: {
            current: {
              label: '3.11',
            },
            '3.5': {
              label: '3.5',
            },
          },
        },
        blog: false,
        pages: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      // Offline/local search: works on any static host, no Algolia account.
      // One index is built per docs version. Swap for Algolia DocSearch later
      // if desired (themeConfig.algolia).
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        docsRouteBasePath: '/',
        indexBlog: false,
        indexPages: false,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 10,
      },
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: false,
      },
    },
    navbar: {
      title: 'DMHelper',
      logo: {
        alt: 'DMHelper logo',
        src: 'img/dmhelper192x192.png',
        srcDark: 'img/dmhelper192x192-dark.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          type: 'docsVersionDropdown',
          position: 'right',
        },
        {
          href: REPO_URL,
          label: 'GitHub',
          position: 'right',
        },
        // Uncomment once the PDF is published alongside the site or releases:
        // {href: 'https://github.com/<org>/<app-repo>/releases', label: 'Download PDF', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Contribute',
          items: [
            {label: 'Source on GitHub', href: REPO_URL},
            {label: 'Report a problem with the docs', href: `${REPO_URL}/issues`},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} DMHelper. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
