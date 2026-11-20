# Verification report — 2026-11-20

## Reproduced installation failure

The supplied iPhone logs show `SyntaxError: Unexpected token ':'` for both `zh.copymanga` and the dependency-free `zh.sourcecheck` source. Both fail during script evaluation, before manga-site requests.

The earlier instructions gave a Saved List address ending in `/sources.json`. Using that value as the installation base produces `/sources.json/sources/<path>.stt`. The raw GitHub request returns HTTP 404 with `404: Not Found`, which reproduces the colon syntax error when evaluated as JavaScript. The actual bundles at `/sources/<path>.stt` contain executable JavaScript. This is a diagnosis supported by the matching HTTP/error reproduction and the official toolchain's install links, not a captured iPhone network trace.

The corrected Saved List address is:

```text
https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages
```

The JSON file remains at `<base>/sources.json`; that inspection URL is not the Saved List base.

## Verification coverage

- TypeScript checking and mocked AES, search, chapter-list and image extraction tests.
- Catalog-derived installation paths and compiled bootstrap checks for both plugins.
- Native Apple JavaScriptCore evaluation of both plugins in macOS CI.
- Published catalog and artifact downloads checked after deployment, including HTTP success, JavaScript evaluation and metadata identity.

Earlier direct bundle checks did not test the incorrect download path and could not establish successful installation.

## Remaining device checks

Installation on the user's iPhone, real CopyManga API access, authentication, image delivery and end-to-end reading remain unverified. Successful CI and published-artifact checks do not substitute for these device checks.
