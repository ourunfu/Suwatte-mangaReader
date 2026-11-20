# CopyManga for Suwatte

Unofficial experimental Suwatte source for [拷贝漫画 (CopyManga)](https://www.mangacopy.com/), using published `@suwatte/toolchain` v1.x.

## Installation

Use the public source-list URL below in Suwatte → Settings → Sources → Manage Sources → Saved Lists:

```text
https://cdn.jsdelivr.net/gh/ourunfu/Suwatte-mangaReader@gh-pages/sources.json
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

## Automatic publishing (no GitHub Pages setup required)

GitHub Actions compiles the source and pushes the resulting source list and bundle to the `gh-pages` branch. The repository's Pages site itself does **not** need to be enabled to distribute the files via the CDN.

- Source branch: https://github.com/ourunfu/Suwatte-mangaReader/tree/gh-pages
- CDN catalog: https://cdn.jsdelivr.net/gh/ourunfu/Suwatte-mangaReader@gh-pages/sources.json
- Raw GitHub fallback: https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages/sources.json
- Raw GitHub bundle: https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages/sources/zh.copymanga.stt

The catalog and bundle have been confirmed present in the public `gh-pages` branch. CDN access and iOS installation still require device verification.


## Installation troubleshooting (Unexpected EOF)

If Suwatte shows `[SourceInstall] SyntaxError: Unexpected EOF`, first add the source list from **GitHub raw** rather than the CDN to rule out cache and transport differences:

```text
https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages/sources.json
```

The list also includes **安装诊断（无网络）** (`zh.sourcecheck`), a minimal, dependency-free source. Try to install that item before CopyManga:

- If the probe also fails with `Unexpected EOF`, the issue is likely related to the app's bundle download, caching, or installation/runtime compatibility, rather than CopyManga's site parser.
- If the probe installs but CopyManga still fails, the CopyManga bundle needs further compatibility analysis.

The compiled CopyManga bundle has passed both a Node VM bootstrap test and an Apple JavaScriptCore evaluation/bootstrap test on macOS. This does **not** substitute for testing the actual bytes received on iPhone.

## Important status

This is an experimental implementation tested against **mock responses**, not confirmed to work with current real CopyManga endpoints or iOS. Site APIs, anti-bot checks, login requirements, image hotlink protection, and encryption may change. A successful build confirms the package format, **not** successful manga reading. Please report relevant errors from Suwatte → Settings → Advanced → Logs.

The source does not include or redistribute copyrighted chapter images; it obtains URLs from the remote website. Follow website and copyright rules.
