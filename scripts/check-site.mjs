// 检查真实构建产物；分别在根目录部署和 /blog/ 部署后运行。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { tsImport } from "tsx/esm/api";

const base = process.argv[2] || (process.env.DEPLOY_TARGET === "github-pages" ? "/blog/" : "/");
if (base === "/blog/") process.env.DEPLOY_TARGET = "github-pages";
const { siteConfig } = await tsImport("../src/config/siteConfig.ts", import.meta.url);
const { commentConfig } = await tsImport("../src/config/commentConfig.ts", import.meta.url);
const origin = new URL(siteConfig.site_url).origin;
const canonicalRoot = (siteConfig.canonical_url || siteConfig.site_url).replace(/\/?$/, "/");
const read = (path) => readFileSync(`dist/${path}`, "utf8");
const errors = [];
function check(name, run) {
	try { run(); console.log(`✓ ${name}`); }
	catch (error) { errors.push(`${name}: ${error.message.split("\n")[0]}`); }
}

// 从实际产物发现文章，新增、删除文章时不需要修改这份检查。
const postRoutes = readdirSync("dist/posts", { recursive: true })
	.map((path) => path.replaceAll("\\", "/"))
	.filter((path) => path.endsWith("/index.html"))
	.map((path) => `posts/${path.replace(/index\.html$/, "")}`);
for (const route of ["", ...postRoutes]) {
	const html = read(`${route}index.html`);
	check(`${route || "首页"} 分享与收录`, () => {
		assert.ok(html.includes(`rel="canonical" href="${canonicalRoot}${route}"`), "缺少正确的主收录地址");
		assert.match(html, /property="og:image"[^>]+content="https:\/\//);
		assert.match(html, /name="twitter:image"[^>]+content="https:\/\//);
		assert.match(html, /rel="alternate"[^>]+type="application\/rss\+xml"/);
	});
	check(`${route || "首页"} 站内链接`, () => {
		for (const [, href] of html.matchAll(/href="(\/[^"\s]*)"/g)) {
			if (!href.startsWith("//")) assert.ok(href.startsWith(base), `漏掉部署前缀: ${href}`);
		}
	});
	if (html.includes('id="giscus-comments"')) {
		check(`${route} 双平台评论归属`, () => {
			const config = html.match(/id="giscus-comments"[^>]*data-config="([^"]+)"/)[1];
			const parsed = JSON.parse(config.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
			assert.equal(parsed.mapping, "specific");
			assert.equal(parsed.term, `/${route.replace(/\/$/, "")}`);
			assert.equal(parsed.repo, commentConfig.giscus.repo);
		});
	}
}
check("爬虫可以加载资源，站点地图地址有效", () => {
	const robots = read("robots.txt");
	assert.ok(!robots.includes("Disallow: /_astro/"));
	assert.ok(robots.includes(`Sitemap: ${origin}${base}sitemap-index.xml`));
});
check("关闭的功能不进入站点地图", () => {
	const sitemap = read("sitemap-0.xml");
	for (const [section, enabled] of Object.entries(siteConfig.pages)) {
		if (!enabled) assert.doesNotMatch(sitemap, new RegExp(`/${section}(/|<)`));
	}
});
check("RSS 使用当前平台的文章地址", () => {
	for (const route of postRoutes) assert.ok(read("rss.xml").includes(`${origin}${base}${route}`));
});
check("关闭功能的跳转保留部署前缀", () => {
	if (!siteConfig.pages.dynamic) assert.ok(read("dynamic/comments/index.html").includes(`${base}404/`));
});

if (errors.length) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
}
