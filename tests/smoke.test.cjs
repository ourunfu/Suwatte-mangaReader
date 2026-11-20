const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const KEY = "0123456789abcdef";
function encrypt(payload) {
  const iv = "abcdefghijklmnop";
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(KEY), Buffer.from(iv));
  return iv + Buffer.concat([cipher.update(JSON.stringify(payload),"utf8"),cipher.final()]).toString("hex");
}
const chapters = { groups: {
  default: { chapters: [{ id: "ch1", name: "第1话" }, { id: "ch2", name: "第2话" }] },
  tankobon: { chapters: [{ id: "vol1", name: "第1卷" }] }
} };
const images = [{ url:"https://images.example.org/1.webp" },{ url:"https://images.example.org/2.webp" }];
const html = '<div class="comicParticulars-left-img"><img src="https://images.example.org/cover.webp"></div><div class="comicParticulars-title-right"><h6>示例漫画</h6></div><script>var ccx="'+KEY+'";</script>';
const chapterHtml = '<script>var ccy="'+KEY+'";var contentKey="'+encrypt(images)+'";</script>';
class FakeHttpClient {
  constructor(config){this.config=config;}
  async get(url) {
    let payload;
    if(url.startsWith("/search/comic")) payload={results:{list:[{path_word:"sample",name:"示例漫画",cover:"https://images.example.org/cover.webp"}],total:1,offset:0,limit:20}};
    else if(url.startsWith("/comicdetail/")) payload={results:encrypt(chapters)};
    else if(url.startsWith("/comic/sample/chapter/")) payload=chapterHtml;
    else if(url.startsWith("/comic/sample")) payload=html;
    else if(url.startsWith("/comics")) payload={results:{list:[],total:0,limit:50,offset:0}};
    else throw new Error("Unmocked endpoint "+url);
    return {ok:true,status:200,json:async()=>payload,text:async()=>payload};
  }
}
function loadSource(){
  const filename=path.join(__dirname,"..","src","sources","zh.copymanga","index.ts");
  const code=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports={};
  vm.runInNewContext(code,{exports,require:(id)=>id==="@suwatte/toolchain/types"?{ContentRating:{EVERYONE:0}}:require(id),HttpClient:FakeHttpClient,console,Set,URL}, {filename});
  return exports;
}
test("mocked search, chapters, pages and AES-CBC",async()=>{
  const mod=loadSource();
  assert.equal(mod.decodePayload(encrypt(chapters),KEY).groups.default.chapters.length,2);
  assert.equal(mod.extractChapters(chapters).length,3);
  assert.equal(mod.extractPages(images).length,2);
  const source=new mod.default();
  const results=await source.getSearchResults({query:"示例"},1);
  assert.equal(results.items[0].id,"sample");
  assert.equal(results.isLastPage,true);
  const item=await source.getContent("sample");
  assert.equal(item.title,"示例漫画");
  assert.equal((await source.getChapters("sample")).length,3);
  const pages=await source.getChapterPages("sample","ch2");
  assert.deepEqual(Array.from(pages,p=>p.url),images.map(p=>p.url));
});
