# CopyManga for Suwatte

Unofficial experimental Suwatte source for [拷贝漫画 (CopyManga)](https://www.mangacopy.com/), using `@suwatte/toolchain` v5.x.

## Installation

After a successful GitHub Pages deployment, add the **source list** in Suwatte → Settings → Sources → Manage Sources → Saved Lists:

```text
https://ourunfu.github.io/Suwatte-mangaReader/sources.json
```

Do **not** add this GitHub repository URL or the `.stt` URL directly. The HTTPS catalog must first return JSON with `catalogVersion: 2`. Then install **拷贝漫画 CopyManga** from the list.

## Features

- Manga search and browsing; basic sorting and filters
- Manga information, covers and chapter groups
- AES-CBC decoding of encrypted chapter lists and pages
- Chapter image URL extraction and referer support

## Build

Node.js 22+:

```bash
npm install
npm run check
npm test
npm run build
```

The build should produce `dist/sources.json` and `dist/sources/zh.copymanga.stt`.

## GitHub Pages

The GitHub Actions workflow at `.github/workflows/deploy-pages.yml` runs on pushes to `main` and publishes the `dist` directory via GitHub Pages. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Then inspect the **Actions** tab for build/deployment status.

- Repository: https://github.com/ourunfu/Suwatte-mangaReader
- Expected catalog: https://ourunfu.github.io/Suwatte-mangaReader/sources.json
- Expected package: https://ourunfu.github.io/Suwatte-mangaReader/sources/zh.copymanga.stt

## Important status

This is an experimental implementation tested against **mock responses**, not confirmed to work with current real CopyManga endpoints or iOS. Site APIs, anti-bot checks, login requirements, image hotlink protection, and encryption may change. A successful build confirms the package format, **not** successful manga reading. Please report relevant errors from Suwatte → Settings → Advanced → Logs.

The source does not include or redistribute copyrighted chapter images; it obtains URLs from the remote website. Follow website and copyright rules.
