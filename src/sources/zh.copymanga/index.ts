"use httpclient";

/**
 * CopyManga source for the Suwatte 2026 toolchain.
 * Source ID: zh.copymanga (keep stable after release).
 *
 * API responses and HTML are site-dependent; see README for limitations.
 * The website encrypts its chapter directory and page list with AES-128-CBC.
 */
import { ContentRating, type SourceInfo } from "@suwatte/toolchain/types";
import CryptoJS from "crypto-js";

const SITE = "https://www.mangacopy.com";
const API = "https://api.mangacopy.com/api/v3";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Do not log chapter keys, cookies or downloaded content.
function unwrap(json: any): any {
  if (json?.code && json.code !== 200 && json.code !== 0) {
    throw new Error(`CopyManga API returned code ${json.code}: ${json.message ?? "unknown"}`);
  }
  return json?.results ?? json?.result ?? json?.data ?? json;
}

function cleanText(str: unknown): string {
  if (str == null) return "";
  const s = String(str).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#(\d+);/gi, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return s.replace(/\s+/g, " ").trim();
}

function matchHtml(html: string, expressions: RegExp[]): string {
  for (const expression of expressions) {
    const m = html.match(expression);
    if (m?.[1]) return cleanText(m[1]);
  }
  return "";
}

function absoluteUrl(url: any): string {
  if (typeof url !== "string" || !url.trim()) return "";
  const str = url.trim().replace(/&amp;/g, "&");
  if (/^https?:\/\//i.test(str)) return str;
  if (str.startsWith("//")) return `https:${str}`;
  if (str.startsWith("/")) return `${SITE}${str}`;
  return `${SITE}/${str}`;
}

function coverFromHtml(html: string): string {
  const m = html.match(/class=["'][^"']*comicParticulars-left-img[^"']*["'][\s\S]{0,800}?<img\b([^>]+)>/i)
    || html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)/i);
  if (!m) return "";
  if (m[0].startsWith("<meta")) return absoluteUrl(m[1]);
  return absoluteUrl(m[1].match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? m[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? "");
}

function findKey(html: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`(?:var|let|const|window\\.)?\\s*${escaped}\\s*[:=]\\s*["']([^"']+)["']`, "i"));
  return match?.[1] || "";
}

function findContentKey(html: string): string {
  return html.match(/\bcontentKey\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? html.match(/\bcontentKey\s*:\s*["']([^"']+)["']/i)?.[1]
    ?? html.match(/\bcontent-key\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? "";
}

/** The first 16 ASCII characters encode the IV; remaining bytes are hex ciphertext. */
export function decodePayload(payload: any, key: string): any {
  if (payload != null && typeof payload === "object") return payload;
  if (typeof payload !== "string") throw new Error("Missing CopyManga payload");
  const str = payload.trim();
  if (/^[\[{]/.test(str)) return JSON.parse(str);
  if (key.length !== 16) throw new Error("CopyManga chapter AES key missing or invalid (ccx/ccy)");
  const iv = str.slice(0, 16);
  const hexCipher = str.slice(16);
  if (hexCipher.length < 32 || hexCipher.length % 32 !== 0 || !/^[0-9a-f]+$/i.test(hexCipher)) {
    throw new Error("CopyManga encrypted payload format changed");
  }
  const cipher = CryptoJS.enc.Hex.parse(hexCipher);
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: cipher } as any,
    CryptoJS.enc.Utf8.parse(key),
    { iv: CryptoJS.enc.Utf8.parse(iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  );
  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error("Could not decrypt CopyManga chapter data");
  return JSON.parse(plaintext);
}

function mapItem(src: any): any | null {
  const c = src?.comic ?? src?.build ?? src;
  const id = c?.path_word ?? c?.pathWord ?? c?.slug;
  if (!id) return null;
  return {
    id: String(id),
    title: String(c?.name ?? c?.title ?? id),
    coverImage: absoluteUrl(c?.cover ?? c?.cover_url ?? c?.coverImage),
    subtitle: Array.isArray(c?.author) ? c.author.map((x: any) => x?.name ?? x).join(", ") : "",
    webUrl: `${SITE}/comic/${encodeURIComponent(String(id))}`,
  };
}

function listResult(data: any, page: number, perPage: number): any {
  const body = unwrap(data);
  const raw = Array.isArray(body) ? body : (body?.list ?? body?.comics ?? body?.items ?? []);
  const items = (Array.isArray(raw) ? raw : []).map(mapItem).filter(Boolean);
  const total = Number(body?.total ?? body?.count);
  const offset = Number(body?.offset ?? (Math.max(page, 1) - 1) * perPage);
  const limit = Number(body?.limit ?? perPage);
  return {
    items,
    isLastPage: Number.isFinite(total) ? offset + limit >= total : items.length < perPage,
    ...(Number.isFinite(total) ? { total } : {}),
  };
}

const groupNames: Record<string, string> = {
  default: "普通章节", tankobon: "单行本", other_honyakuchimu: "其他汉化",
  karapeji: "全彩版", short: "短篇", serialize: "连载",
};

export function extractChapters(result: any): any[] {
  const data = unwrap(result);
  const groups = data?.groups ?? data?.results?.groups ?? {};
  const preferred = ["default", "tankobon", "other_honyakuchimu", "karapeji"];
  const names = [...preferred, ...Object.keys(groups).filter(k => !preferred.includes(k))];
  const ascending: any[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const group = groups[name];
    const chapters = Array.isArray(group) ? group : (group?.chapters ?? []);
    if (!Array.isArray(chapters)) continue;
    for (const chapter of chapters) {
      const id = chapter?.id ?? chapter?.uuid;
      if (id == null || seen.has(String(id))) continue;
      seen.add(String(id));
      ascending.push({
        id: String(id),
        // number is stable for normal append-only chapter lists.
        number: ascending.length + 1,
        title: `${groupNames[name] ?? group?.name ?? name} · ${chapter?.name ?? `第${ascending.length + 1}话`}`,
        language: "zh",
      });
    }
  }
  return ascending.reverse().map((c, index) => ({ ...c, index }));
}

export function extractPages(data: any): any[] {
  const payload = unwrap(data);
  const raw = Array.isArray(payload) ? payload : (payload?.pages ?? payload?.contents ?? payload?.list ?? []);
  if (!Array.isArray(raw)) throw new Error("CopyManga page payload structure changed");
  const urls = raw.map((item: any) => typeof item === "string" ? item : item?.url ?? item?.image ?? item?.src)
    .map(absoluteUrl).filter((url: string) => /^https?:\/\//.test(url));
  if (!urls.length) throw new Error("Chapter contained no valid image URLs");
  return urls.map((url: string) => ({ url }));
}

export default class CopyMangaSource {
  static info: SourceInfo = {
    id: "zh.copymanga",
    name: "拷贝漫画 CopyManga",
    version: 1.01,
    minSupportedAppVersion: "7.0.0",
    website: SITE,
    languages: ["zh-Hans", "zh-Hant"],
    rating: 2 as ContentRating, // mixed-audience catalogue: conservative upper-tier rating
  };

  client = new HttpClient({
    baseUrl: API,
    headers: {
      "User-Agent": "COPY/2.3.1", "version": "2.3.1", "platform": "3", "region": "1", "webp": "1",
      "Accept": "application/json",
    },
    rateLimit: { permits: 2, period: 1 },
  });

  siteClient = new HttpClient({
    baseUrl: SITE,
    headers: { "User-Agent": UA, "Referer": `${SITE}/` },
    rateLimit: { permits: 2, period: 1 },
  });

  getConfiguration(): any {
    return { imageReferer: `${SITE}/`, cloudflareResolutionURL: `${SITE}/`, useClientForImageRequests: false };
  }

  async api(path: string): Promise<any> {
    const response = await this.client.get(path);
    if (!response.ok) throw new Error(`CopyManga API HTTP ${response.status}: ${path}`);
    return response.json();
  }

  async html(path: string): Promise<string> {
    const response = await this.siteClient.get(path);
    if (!response.ok) throw new Error(`CopyManga webpage HTTP ${response.status}: ${path}`);
    return response.text();
  }

  async getSearchResults(request: any = {}, page = 1): Promise<any> {
    const query = String(request?.query ?? "").trim();
    const limit = query ? 20 : 50;
    const offset = Math.max(0, page - 1) * limit;
    let path: string;
    if (query) {
      path = `/search/comic?q=${encodeURIComponent(query)}&q_type=&limit=${limit}&offset=${offset}`;
    } else {
      const f = request?.filters ?? {};
      const theme = typeof f.theme === "string" ? f.theme : "";
      const top = typeof f.region === "string" ? f.region : "";
      const sort = request?.sort?.key || "popular";
      const ordering = `${request?.sort?.ascending ? "" : "-"}${sort}`;
      path = `/comics?theme=${encodeURIComponent(theme)}&top=${encodeURIComponent(top)}&ordering=${encodeURIComponent(ordering)}&limit=${limit}&offset=${offset}`;
    }
    return listResult(await this.api(path), page, limit);
  }

  async getItemList(request: any = {}, page = 1): Promise<any> {
    return this.getSearchResults(request, page);
  }

  async getSortOptions(): Promise<any> {
    return { options: [
      { id: "popular", title: "热度" },
      { id: "datetime_updated", title: "最近更新" },
    ], canChangeOrder: false, default: { key: "popular", ascending: false } };
  }

  async getSearchFilters(): Promise<any> {
    return [
      { id: "theme", title: "题材", type: "picker", options: [
        {id:"",title:"全部"},{id:"aiqing",title:"爱情"},{id:"huanlexiang",title:"欢乐向"},
        {id:"maoxian",title:"冒险"},{id:"qihuan",title:"奇幻"},{id:"baihe",title:"百合"},
        {id:"xiaoyuan",title:"校园"},{id:"kehuan",title:"科幻"},{id:"gedou",title:"格斗"},
        {id:"shenghuo",title:"生活"},{id:"xuanyi",title:"悬疑"},{id:"yishijie",title:"异世界"},
        {id:"zhiyu",title:"治愈"},{id:"rexue",title:"热血"},{id:"hougong",title:"后宫"},
      ]},
      { id: "region", title: "地区", type: "picker", options: [
        {id:"",title:"全部"},{id:"japan",title:"日本"},{id:"korea",title:"韩国"},{id:"west",title:"欧美"},
      ]},
    ];
  }

  async getContent(contentId: string): Promise<any> {
    const safeId = encodeURIComponent(contentId);
    let html = "";
    try { html = await this.html(`/comic/${safeId}`); }
    catch (error) { console.log("CopyManga detail HTML unavailable", String(error)); }

    const title = matchHtml(html, [
      /class=["'][^"']*comicParticulars-title-right[^"']*["'][\s\S]{0,3000}?<h6[^>]*>([\s\S]*?)<\/h6>/i,
      /<h6\b[^>]*>([\s\S]*?)<\/h6>/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]);
    const summary = matchHtml(html, [
      /class=["'][^"']*\bintro\b[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
      /<meta\s+name=["']description["']\s+content=["']([^"']+)/i,
    ]);
    const author = html.match(/class=["'][^"']*comicParticulars-right-txt[^"']*["'][\s\S]{0,1500}?(?:<a[^>]*>)([\s\S]*?)<\/a>/i)?.[1];
    const tags = Array.from(html.matchAll(/class=["'][^"']*comicParticulars-tag[^"']*["'][\s\S]{0,1500}?<a[^>]*>([\s\S]*?)<\/a>/gi))
      .map(m => cleanText(m[1]).replace(/^#/, "")).filter(Boolean);
    const isCompleted = /(?:已完結|已完结|完結|完结)/.test(html.slice(0, 40000));
    const cover = coverFromHtml(html);

    if (!title && !cover) {
      // Site HTML occasionally gets blocked; attempt the JSON detail endpoint.
      const data = unwrap(await this.api(`/comic2/${safeId}?platform=3`));
      const c = data?.comic ?? data;
      return {
        title: String(c?.name ?? contentId), coverImage: absoluteUrl(c?.cover),
        summary: String(c?.brief ?? ""), status: Number(c?.status?.value) === 1 ? 2 : 1,
        contentType: 0, readingMode: 0, webUrl: `${SITE}/comic/${safeId}`,
        genres: (c?.theme ?? []).map((t: any) => ({ id: String(t?.path_word ?? t?.name), title: String(t?.name) })),
      };
    }

    return {
      title: title || contentId,
      coverImage: cover,
      summary,
      status: isCompleted ? 2 : 1,
      contentType: 0, readingMode: 0,
      webUrl: `${SITE}/comic/${safeId}`,
      genres: tags.map(tag => ({ id: tag, title: tag })),
      credits: author ? [{ name: cleanText(author), role: "Story" }] : [],
    };
  }

  async getChapters(contentId: string): Promise<any[]> {
    const slug = encodeURIComponent(contentId);
    const html = await this.html(`/comic/${slug}`);
    const key = findKey(html, "ccx");
    const json = await this.siteClient.get(`/comicdetail/${slug}/chapters`, {
      headers: { "Referer": `${SITE}/comic/${slug}`, "X-Requested-With": "XMLHttpRequest" },
    });
    if (!json.ok) throw new Error(`CopyManga chapter list HTTP ${json.status}`);
    const body = await json.json();
    const decoded = decodePayload(unwrap(body), key);
    const chapters = extractChapters(decoded);
    if (!chapters.length) throw new Error("Chapter list empty: CopyManga may have changed its payload");
    return chapters.map(c => ({ ...c, webUrl: `${SITE}/comic/${slug}/chapter/${encodeURIComponent(c.id)}` }));
  }

  async getChapterPages(contentId: string, chapterId: string): Promise<any[]> {
    const url = `/comic/${encodeURIComponent(contentId)}/chapter/${encodeURIComponent(chapterId)}`;
    const html = await this.html(url);
    const key = findKey(html, "ccy");
    const encrypted = findContentKey(html);
    if (!encrypted) throw new Error("CopyManga reader contentKey not found; chapter may be locked");
    return extractPages(decodePayload(encrypted, key));
  }

  async getHomePage(): Promise<any> {
    return {
      sections: [
        { id: "rank_day", title: "今日热门", style: 12 },
        { id: "newest", title: "最新上架", style: 5 },
        { id: "updated", title: "最近更新", style: 4 },
        { id: "rank_week", title: "本周排行", style: 0 },
        { id: "recommend", title: "编辑推荐", style: 0 },
      ],
      isLastPage: true,
    };
  }

  async getPageSectionItems(sectionKey: string, _pageKey = ""): Promise<any[]> {
    const paths: Record<string, string> = {
      rank_day: "/ranks?date_type=day&limit=20&offset=0",
      rank_week: "/ranks?date_type=week&limit=20&offset=0",
      newest: "/update/newest?limit=20&offset=0",
      updated: "/comics?theme=&top=&ordering=-datetime_updated&limit=20&offset=0",
      recommend: "/recs?pos=3200102&limit=20&offset=0",
    };
    const path = paths[sectionKey];
    if (!path) return [];
    return listResult(await this.api(path), 1, 20).items;
  }
}