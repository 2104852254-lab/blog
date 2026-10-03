// 运行真实构建里的搜索加载脚本；只替代浏览器网络/动态导入这一外部边界。
// node --experimental-vm-modules scripts/check-search-loader.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, Script, SyntheticModule } from "node:vm";

const html = readFileSync("dist/index.html", "utf8");
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(
	([, content]) =>
		content.includes("loadPagefind") && content.includes("scriptUrl"),
)?.[1];
assert.ok(script, "首页缺少共享搜索加载入口");
let oldLoader;
let requests = 0;
const imports = [];
let brokenIndex = false;
let destroyed = 0;
const context = createContext({
	window: {},
	document: {
		readyState: "loading",
		addEventListener: (_, handler) => {
			oldLoader = handler;
		},
		dispatchEvent() {},
	},
	CustomEvent: class {},
	console: { log() {}, error() {} },
	fetch: async () => {
		requests++;
		return { ok: true, status: 200 };
	},
});
const module = new SyntheticModule(
	["search", "options", "destroy"],
	function () {
		this.setExport("search", async () => {
			// Pagefind 会记住索引/片段失败，只有销毁内部实例后才能恢复。
			if (brokenIndex) throw new Error("Failed to load Pagefind metadata");
			return {
				results: [
					{
						data: async () => ({
							url: "/posts/car/",
							meta: { title: "平衡车" },
							excerpt: "调试记录",
						}),
					},
				],
			};
		});
		this.setExport("options", async () => {});
		this.setExport("destroy", async () => {
			destroyed++;
			brokenIndex = false;
		});
	},
	{ context },
);
await module.link(() => {});
await module.evaluate();
new Script(script, {
	importModuleDynamically: async (specifier) => {
		imports.push(specifier);
		if (imports.length === 1) throw new Error("network unavailable");
		return module;
	},
}).runInContext(context);
const load = context.window.loadPagefind || oldLoader;
assert.equal(typeof load, "function");
await assert.rejects(
	load,
	/network unavailable/,
	"下载失败不能伪装成空搜索结果",
);
assert.equal(context.window.pagefind, undefined);
const [first, second] = await Promise.all([load(), load()]);
assert.equal(first, second, "同时搜索应复用一次下载");
assert.equal(requests, 2);
assert.equal(imports.length, 2);
assert.notEqual(
	imports[0],
	imports[1],
	"失败后重试不能复用浏览器缓存的失败模块",
);
assert.match(imports[1], /[?&]retry=1/);
assert.equal((await first.search("平衡车")).results.length, 1);
assert.equal(await load(), first, "成功后复用已加载的搜索模块");
brokenIndex = true;
await assert.rejects(first.search("平衡车"), /metadata/);
const [recovered, sharedRetry] = await Promise.all([load(true), load(true)]);
assert.equal(destroyed, 1, "重试必须清理引擎缓存的失败，并发重试只清理一次");
assert.equal(recovered, sharedRetry);
assert.equal((await recovered.search("平衡车")).results.length, 1);
assert.equal(requests, 3);

// 面板内点击和键盘重试焦点已由 check-panel-controls.mjs 检查真实的新控制器。
console.log("✓ 搜索下载/索引失败、并发重试和成功缓存");
