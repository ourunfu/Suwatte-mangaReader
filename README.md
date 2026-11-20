# CopyManga for Suwatte

Unofficial experimental Suwatte source for [拷贝漫画 (CopyManga)](https://www.mangacopy.com/), built with `@suwatte/toolchain` v1.x.

## Installation

In Suwatte → Settings → Sources → Manage Sources → Saved Lists, add this **base address**:

```text
https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages
```

Install **安装诊断（无网络）** first, then **拷贝漫画 CopyManga**. The diagnostic source has no network requests and provides no manga content.

CDN alternative:

```text
https://cdn.jsdelivr.net/gh/ourunfu/Suwatte-mangaReader@gh-pages
```

Use the base address without `/sources.json`. Suwatte fetches the list from `<base>/sources.json` and installs each plugin from `<base>/sources/<path>.stt`. The `path` field is an artifact name without the extension. Do not add the GitHub repository page or an individual `.stt` file as a Saved List.

If you previously saved an address ending in `/sources.json`, remove that Saved List and add the base address above. Refreshing the old entry does not correct its stored base address.

## Why both plugins failed to install

The earlier installation instructions supplied the JSON file address as the list base. Using that address as the download directory constructs:

```text
https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages/sources.json/sources/zh.sourcecheck.stt
```

That request returns HTTP 404 with the text `404: Not Found`. Evaluating this error response as JavaScript produces `SyntaxError: Unexpected token ':'`, matching the iPhone logs for both sources. The equivalent missing CDN path can produce `Unexpected EOF`. This diagnosis follows the official toolchain's directory-based install links and reproduces both logged errors; the iPhone's actual HTTP requests have not been captured.

The actual `.stt` files are executable JavaScript exporting `SourcePackage`; they are not JSON archives. Earlier checks evaluated a correctly downloaded bundle directly and therefore missed the incorrect address used during installation.

## Features

- Manga search, browsing, sorting and filters
- Manga information, covers and chapter groups
- AES-CBC decoding of encrypted chapter lists and pages
- Chapter image URL extraction and referer support

## Build and checks

Use Node.js 22 or later:

```bash
npm ci
npm run check
npm test
npm run build
npm run test:bundle
```

The build produces `dist/sources.json` and a JavaScript bundle for each source in `dist/sources/`. Tests validate the catalog-derived install paths and bootstrap both compiled plugins. CI also evaluates both bundles with native Apple JavaScriptCore on macOS.

After publishing, check the downloaded catalog and plugins:

```bash
npm run test:published
```

## Automatic publishing

GitHub Actions builds and validates the sources, publishes `dist/` to the `gh-pages` branch, and then verifies the published artifacts. GitHub Pages hosting does not need to be enabled for raw GitHub or jsDelivr distribution. Moving CDN addresses can retain older content; raw GitHub is the primary installation address.

- [Published files](https://github.com/ourunfu/Suwatte-mangaReader/tree/gh-pages)
- [Build and verification runs](https://github.com/ourunfu/Suwatte-mangaReader/actions)
- [Catalog JSON for inspection](https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages/sources.json)
- [Official source-list format](https://www.suwatte.app/developers/source-lists/)

## Verification limits

Automated checks cover the install address, downloaded package format, JavaScript initialization and mocked reader behavior. Installation on the user's iPhone and reading from current live CopyManga endpoints remain unverified. Site APIs, anti-bot checks, login requirements, image hotlink protection and encryption may change. Relevant app errors are available in Settings → Advanced → Logs.

The source does not include or redistribute chapter images; it obtains URLs from the remote website. Follow website and copyright rules.
