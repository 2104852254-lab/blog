import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tsImport } from "tsx/esm/api";

const module = await tsImport(
	"../src/utils/article-links.ts",
	import.meta.url,
).catch(() => null);
assert.ok(
	module?.createArticleLinkIndex,
	"缺少共享文章链接解析器：路径/别名必须解析到真实 entry.id",
);

const entries = [
	{
		id: "nested/中文",
		filePath: "src/content/posts/nested/中文.md",
		data: {
			title: "目标文章",
			slug: "custom-alias",
			image: "/covers/target.webp",
		},
		body: "",
	},
	{
		id: "folder/index",
		filePath: "src/content/posts/folder/index.md",
		data: { title: "索引文件" },
		body: "",
	},
	{
		id: "draft",
		filePath: "src/content/posts/draft.md",
		data: {
			title: "隐藏草稿",
			draft: true,
			description: "草稿秘密",
			image: "/secret.jpg",
		},
		body: "[[custom-alias]]",
	},
	{
		id: "locked",
		filePath: "src/content/posts/locked.md",
		data: {
			title: "隐藏密码",
			password: "pw",
			description: "密码秘密",
			tags: ["secret"],
			image: "/secret.jpg",
		},
		body: "[[custom-alias]]",
	},
	{
		id: "z-source",
		filePath: "src/content/posts/z-source.md",
		data: { title: "Z 来源" },
		body: "[[custom-alias]] [[nested/中文#标题|别名]] [target](/blog/posts/nested/%E4%B8%AD%E6%96%87/?x=1#h)",
	},
	{
		id: "a-source",
		filePath: "src/content/posts/a-source.mdx",
		data: { title: "A 来源" },
		body: "import Thing from './Thing.jsx';\n\n[ref][target]\n\n[target]: https://example.test/blog/posts/nested/%E4%B8%AD%E6%96%87/\n\n<Thing>[[custom-alias]]</Thing>\n\n{/* [[locked]] */}",
	},
	{
		id: "examples",
		filePath: "src/content/posts/examples.md",
		data: { title: "不是引用" },
		body: "`[[custom-alias]]`\n\n```md\n[[custom-alias]]\n[target](/blog/posts/nested/中文/)\n```\n\n![target](/blog/posts/nested/中文/)\n\n![[custom-alias]]\n\n<!-- [[custom-alias]] -->\n\n[external](https://other.test/blog/posts/nested/中文/)",
	},
];
const options = { base: "/blog/", site: "https://example.test/" };
const index = module.createArticleLinkIndex(entries, options);
assert.equal(
	module
		.createArticleLinkIndex(entries, {
			...options,
			canonicalSite: "https://canonical.test/",
		})
		.resolve("https://canonical.test/posts/nested/中文/")?.url,
	"/blog/posts/nested/%E4%B8%AD%E6%96%87/",
	"正式主域名引用必须映射当前部署路径",
);
for (const target of [
	"custom-alias",
	"nested/中文.md",
	"/posts/nested/中文/",
	"/blog/posts/nested/%E4%B8%AD%E6%96%87/?q=1#h",
	"https://example.test/blog/posts/nested/中文/",
]) {
	assert.equal(
		index.resolve(target)?.url,
		"/blog/posts/nested/%E4%B8%AD%E6%96%87/",
		`真实路由不能使用别名：${target}`,
	);
}
assert.equal(
	index.resolve("folder/index.md")?.url,
	"/blog/posts/folder/index/",
	"index id 必须与实际路由一致",
);
assert.equal(
	module.createArticleLinkIndex(entries, { base: "/" }).resolve("custom-alias")
		?.url,
	"/posts/nested/%E4%B8%AD%E6%96%87/",
);
for (const target of [
	"missing",
	"../nested/中文",
	"%2e%2e/nested/中文",
	"/blog/posts/%2e%2e/nested/中文",
	"https://other.test/blog/posts/nested/中文/",
	"draft",
	"locked",
]) {
	assert.equal(
		index.resolve(target),
		null,
		`不应链接到未解析或非公开目标：${target}`,
	);
}
const backlinks = await module.buildArticleBacklinks(
	[...entries, { ...entries[0], body: "[[custom-alias]]" }].filter(
		(entry, position, all) =>
			all.findLastIndex((other) => other.id === entry.id) === position,
	),
	options,
);
assert.deepEqual(
	backlinks.get("nested/中文"),
	[
		{ id: "a-source", title: "A 来源", url: "/blog/posts/a-source/" },
		{ id: "z-source", title: "Z 来源", url: "/blog/posts/z-source/" },
	],
	"引用索引必须按真实 AST 收集、去重，排除自身/代码/图片/注释/非公开来源",
);
assert.deepEqual(backlinks.get("draft"), undefined);
assert.deepEqual(backlinks.get("locked"), undefined);
const duplicateDefinitions = await module.buildArticleBacklinks(
	[
		...entries,
		{
			id: "duplicate-def",
			filePath: "src/content/posts/duplicate-def.md",
			data: { title: "重复定义" },
			body: "[实际引用][same]\n\n[same]: /blog/posts/nested/中文/\n[same]: /blog/posts/folder/index/",
		},
	],
	options,
);
assert.ok(
	duplicateDefinitions
		.get("nested/中文")
		?.some((article) => article.id === "duplicate-def"),
	"重复引用定义必须遵循 CommonMark 首个定义生效",
);
assert.equal(
	duplicateDefinitions
		.get("folder/index")
		?.some((article) => article.id === "duplicate-def") ?? false,
	false,
	"后出现的重复定义不能制造虚假反链",
);
const relativeEntries = [
	{
		id: "nested/nearby",
		filePath: "src/content/posts/nested/nearby.md",
		data: { title: "同目录目标" },
		body: "",
	},
	{
		id: "nested/wiki-only",
		filePath: "src/content/posts/nested/wiki-only.md",
		data: { title: "不解析的 wiki" },
		body: "[[nearby]]",
	},
	{
		id: "nested/normal",
		filePath: "src/content/posts/nested/normal.md",
		data: { title: "同目录引用" },
		body: "[相对链接](./nearby.md)",
	},
];
assert.deepEqual(
	(await module.buildArticleBacklinks(relativeEntries, options)).get(
		"nested/nearby",
	),
	[
		{
			id: "nested/normal",
			title: "同目录引用",
			url: "/blog/posts/nested/normal/",
		},
	],
	"Wiki 与渲染器一致按内容路径查找，Markdown 文件相对链接按来源目录查找",
);
assert.equal(
	module
		.createArticleLinkIndex(
			[
				...relativeEntries,
				{
					id: "nearby",
					filePath: "src/content/posts/nearby.md",
					data: { title: "根目标" },
					body: "",
				},
			],
			options,
		)
		.resolve("./nearby.md", "nested/normal")?.url,
	"/blog/posts/nested/nearby/",
	"明确相对文件路径不能错误匹配同名根文章",
);
const parentRelativeIndex = module.createArticleLinkIndex(
	[
		...relativeEntries,
		{
			id: "nearby",
			filePath: "src/content/posts/nearby.md",
			data: { title: "根目标" },
			body: "",
		},
	],
	options,
);
assert.equal(
	parentRelativeIndex.resolve("../nearby.md", "nested/normal")?.url,
	"/blog/posts/nearby/",
	"Markdown 父目录引用在内容根内应安全解析",
);
assert.equal(
	parentRelativeIndex.resolve("../../nearby.md", "nested/normal"),
	null,
	"Markdown 相对路径不能逃出内容根",
);
assert.equal(
	index.resolve("../folder/index/#标题", "z-source")?.url,
	"/blog/posts/folder/index/",
	"无文件扩展名的相对路由按当前文章 URL 解析",
);
assert.equal(
	index.resolve("../../outside/", "z-source"),
	null,
	"相对路由不能逃出 posts 路由",
);
const bareRelativeIndex = module.createArticleLinkIndex(
	[
		{
			id: "source",
			filePath: "src/content/posts/source.md",
			data: { title: "来源" },
			body: "",
		},
		{
			id: "source/target",
			filePath: "src/content/posts/source/target.md",
			data: { title: "子路由目标" },
			body: "",
		},
		{
			id: "target",
			filePath: "src/content/posts/target.md",
			data: { title: "根目标" },
			body: "",
		},
	],
	options,
);
assert.equal(
	bareRelativeIndex.resolve("target/", "source")?.url,
	"/blog/posts/source/target/",
	"裸相对普通链接必须遵循浏览器语义，不能错误改写到同名根文章",
);
assert.equal(
	bareRelativeIndex.resolve("target")?.url,
	"/blog/posts/target/",
	"Wiki 无来源参数时仍按全局内容路径解析",
);
for (const target of [
	"",
	"#heading",
	"?view=full",
	"//other.test/posts/target/",
])
	assert.equal(bareRelativeIndex.resolve(target, "source"), null);
const routeRelativeBacklinks = await module.buildArticleBacklinks(
	[
		entries[1],
		{
			id: "route-source",
			filePath: "src/content/posts/route-source.md",
			data: { title: "路由引用" },
			body: "[引用目标](../folder/index/#标题)",
		},
	],
	options,
);
assert.deepEqual(routeRelativeBacklinks.get("folder/index"), [
	{ id: "route-source", title: "路由引用", url: "/blog/posts/route-source/" },
]);

// 真实文件读取必须跟随 Astro 的 slug/大小写/index id 规则，不能改动线上文章。
const fixtureDir = mkdtempSync(path.join(tmpdir(), "firefly-article-links-"));
try {
	mkdirSync(path.join(fixtureDir, "Folder"));
	writeFileSync(
		path.join(fixtureDir, "Folder", "index.md"),
		"---\ntitle: 索引\n---\n正文",
	);
	writeFileSync(
		path.join(fixtureDir, "Mixed Name.mdx"),
		"---\ntitle: 自定义\nslug: custom-route\n---\n[[Folder/index.md]]",
	);
	const loaded = module.loadArticleEntries(fixtureDir);
	assert.deepEqual(loaded.map((entry) => entry.id).sort(), [
		"custom-route",
		"folder",
	]);
	const loadedIndex = module.createArticleLinkIndex(loaded, options);
	assert.equal(
		loadedIndex.resolve("Folder/index.md")?.url,
		"/blog/posts/folder/",
	);
	assert.equal(
		loadedIndex.resolve("Mixed Name.mdx")?.url,
		"/blog/posts/custom-route/",
	);
	assert.deepEqual(
		(await module.buildArticleBacklinks(loaded, options)).get("folder"),
		[{ id: "custom-route", title: "自定义", url: "/blog/posts/custom-route/" }],
	);
} finally {
	rmSync(fixtureDir, { recursive: true, force: true });
}

const { remarkWikiLink } = await tsImport(
	"../src/plugins/remark-wiki-link.js",
	import.meta.url,
);
const { createMarkdownProcessor } = await import("@astrojs/markdown-remark");
const processor = await createMarkdownProcessor({
	syntaxHighlight: false,
	smartypants: false,
	remarkPlugins: [[remarkWikiLink, { entries, ...options }]],
});
const inline = (
	await processor.render(
		"前文 [[custom-alias#中文标题|显示别名]] [[missing]] [[draft]] [[locked]]",
	)
).code;
assert.match(
	inline,
	/href="\/blog\/posts\/nested\/%E4%B8%AD%E6%96%87\/#%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98"/,
);
assert.match(inline, />显示别名<\/a>/);
assert.equal(
	(inline.match(/<a\b/g) || []).length,
	1,
	"未知/草稿/密码 wiki 目标保留文字，不生成死链接",
);
assert.doesNotMatch(inline, /隐藏|秘密|secret/);
const card = (await processor.render("[[custom-alias]]")).code;
assert.match(card, /class="card-wiki-link no-styling"/);
assert.match(card, /href="\/blog\/posts\/nested\/%E4%B8%AD%E6%96%87\/"/);
assert.match(card, /src="\/blog\/covers\/target.webp"/);
assert.doesNotMatch(
	(await processor.render("[[locked]]\n\n[[draft]]")).code,
	/<a\b|<img\b|隐藏|秘密|secret/,
);
assert.match(
	(await processor.render("[[#中文标题|本页]]")).code,
	/href="#%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98"/,
);
const normalProcessor = await createMarkdownProcessor({
	syntaxHighlight: false,
	smartypants: false,
	remarkPlugins: [
		[remarkWikiLink, { entries: [...entries, ...relativeEntries], ...options }],
	],
});
const normalHtml = (
	await normalProcessor.render(
		"[同目录](./nearby.md?view=full#保留标题) [引用][article] [密码](/blog/posts/locked/) [草稿][draft]\n\n[article]: ../nested/中文.md?mode=read#原锚点\n[draft]: /blog/posts/draft/\n\n![图片][article]\n\n[外链](https://other.test/posts/locked/) [未知](./missing.md) ` [代码](./nearby.md) `",
		{
			fileURL: new URL(
				"../src/content/posts/nested/normal.md",
				import.meta.url,
			),
		},
	)
).code;
assert.match(
	normalHtml,
	/href="\/blog\/posts\/nested\/nearby\/\?view=full#%E4%BF%9D%E7%95%99%E6%A0%87%E9%A2%98"/,
	"Markdown 文件路径必须输出真实文章路由且保留查询/锚点",
);
assert.match(
	normalHtml,
	/href="\/blog\/posts\/nested\/%E4%B8%AD%E6%96%87\/\?mode=read#%E5%8E%9F%E9%94%9A%E7%82%B9"/,
	"引用式链接必须与普通链接统一解析",
);
assert.doesNotMatch(
	normalHtml,
	/href="\/(?:blog\/)?posts\/(?:locked|draft)\/"/,
	"私密目标的普通/引用式链接不可点击",
);
assert.match(
	normalHtml,
	/\.\.\/nested\/中文.md\?mode=read#原锚点/,
	"Astro 图片管线收到的图片引用不能被文章路由改写",
);
assert.match(normalHtml, /href="https:\/\/other.test\/posts\/locked\/"/);
assert.match(
	normalHtml,
	/href="\.\/missing.md"/,
	"未解析的普通链接保持作者原始地址",
);
assert.match(normalHtml, /<code>.*\.\/nearby.md.*<\/code>/);
console.log("✓ 共享文章路由、AST 引用索引、Wiki 卡片及草稿/密码隐私");
