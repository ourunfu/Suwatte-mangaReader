/** Lightweight installation probe: no network access and no third-party libraries. */
import { ContentRating, type SourceInfo } from "@suwatte/toolchain/types";

export default class SourceInstallCheck {
  static info: SourceInfo = {
    id: "zh.sourcecheck",
    name: "安装诊断（无网络）",
    version: 1.1,
    website: "https://github.com/ourunfu/Suwatte-mangaReader",
    languages: ["zh-Hans"],
    rating: ContentRating.EVERYONE,
  };

  async getItemList(): Promise<any> {
    return { items: [], isLastPage: true };
  }

  async getSearchResults(): Promise<any> {
    return this.getItemList();
  }

  async getContent(): Promise<any> {
    throw new Error("这是安装诊断图源，不提供漫画内容");
  }

  async getChapters(): Promise<any[]> {
    return [];
  }

  async getChapterPages(): Promise<any[]> {
    return [];
  }
}
