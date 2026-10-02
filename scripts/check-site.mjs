// 检查真实构建产物；分别在根目录部署和 /blog/ 部署后运行。
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { tsImport } from "tsx/esm/api";

const base =
	process.argv[2] ||
	(process.env.DEPLOY_TARGET === "github-pages" ? "/blog/" : "/");
if (base === "/blog/") process.env.DEPLOY_TARGET = "github-pages";
const { siteConfig } = await tsImport(
	"../src/config/siteConfig.ts",
	import.meta.url,
);
const { commentConfig } = await tsImport(
	"../src/config/commentConfig.ts",
	import.meta.url,
);
const origin = new URL(siteConfig.site_url).origin;
const canonicalRoot = (siteConfig.canonical_url || siteConfig.site_url).replace(
	/\/?$/,
	"/",
);
const read = (path) => readFileSync(`dist/${path}`, "utf8");
const errors = [];
function check(name, run) {
	try {
		run();
		console.log(`✓ ${name}`);
	} catch (error) {
		errors.push(`${name}: ${error.message.split("\n")[0]}`);
	}
}

// 检查页面实际输出，而不是检查源码有没有某行文字。
for (const route of ["", "about/"]) {
	check(`${route || "首页"} 只有一个非空主标题`, () => {
		const headings = [
			...read(`${route}index.html`).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g),
		];
		assert.equal(headings.length, 1, "主标题应当只有一个");
		assert.ok(
			headings[0][1].replace(/<[^>]+>/g, "").trim(),
			"主标题不能是空的",
		);
	});
}
check("首页封面不与首屏壁纸争抢下载", () => {
	const covers = [
		...read("index.html").matchAll(/<img\b[^>]*data-cover-img[^>]*>/g),
	];
	assert.ok(covers.length > 0);
	for (const [image] of covers) assert.match(image, /loading="lazy"/);
});
check("只优先加载当前主题和设备可见的首屏壁纸", () => {
	const script = [
		...read("index.html").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),
	].find(([, content]) => content.includes("prioritizeVisibleBanner"))?.[1];
	assert.ok(script, "缺少首屏优先级处理");
	// 分别模拟暗色桌面、亮色手机、文章页手机隐藏壁纸的布局结果。
	for (const visible of [1, 2, -1]) {
		const images = Array.from({ length: 4 }, (_, index) => ({
			attributes: { loading: "lazy", fetchpriority: "low" },
			getClientRects: () => (index === visible ? [{}] : []),
			setAttribute(name, value) {
				this.attributes[name] = value;
			},
		}));
		runInNewContext(script, {
			document: { getElementById: () => ({ querySelectorAll: () => images }) },
		});
		images.forEach((image, index) => {
			assert.equal(
				image.attributes.loading,
				index === visible ? "eager" : "lazy",
			);
			assert.equal(
				image.attributes.fetchpriority,
				index === visible ? "high" : "low",
			);
		});
	}
});
check("普通手机宽度也使用上图下文卡片", () => {
	const html = read("index.html");
	const script = [
		...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),
	].find(
		([, content]) =>
			content.includes("mobileDefaultLayout") &&
			content.includes("effectiveDefault"),
	)?.[1];
	assert.ok(script, "找不到布局初始化脚本");
	const classes = new Set(["list-mode", "flex"]);
	const container = {
		style: {},
		offsetHeight: 100,
		classList: {
			remove: (...names) =>
				names.forEach((name) => {
					classes.delete(name);
				}),
			add: (...names) =>
				names.forEach((name) => {
					classes.add(name);
				}),
		},
	};
	runInNewContext(script, {
		window: { innerWidth: 430 },
		localStorage: { getItem: () => null },
		document: { getElementById: () => container },
	});
	assert.ok(classes.has("grid-mode"), "430px 手机仍然使用左右挤压的列表卡片");
});

// 从实际产物发现文章，新增、删除文章时不需要修改这份检查。
const postRoutes = readdirSync("dist/posts", { recursive: true })
	.map((path) => path.replaceAll("\\", "/"))
	.filter((path) => path.endsWith("/index.html"))
	.map((path) => `posts/${path.replace(/index\.html$/, "")}`);
for (const route of ["", ...postRoutes]) {
	const html = read(`${route}index.html`);
	check(`${route || "首页"} 分享与收录`, () => {
		assert.ok(
			html.includes(`rel="canonical" href="${canonicalRoot}${route}"`),
			"缺少正确的主收录地址",
		);
		assert.match(html, /property="og:image"[^>]+content="https:\/\//);
		assert.match(html, /name="twitter:image"[^>]+content="https:\/\//);
		assert.match(html, /rel="alternate"[^>]+type="application\/rss\+xml"/);
	});
	check(`${route || "首页"} 站内链接`, () => {
		for (const [, href] of html.matchAll(/href="(\/[^"\s]*)"/g)) {
			if (!href.startsWith("//"))
				assert.ok(href.startsWith(base), `漏掉部署前缀: ${href}`);
		}
	});
	if (html.includes('id="giscus-comments"')) {
		check(`${route} 双平台评论归属`, () => {
			const config = html.match(
				/id="giscus-comments"[^>]*data-config="([^"]+)"/,
			)[1];
			const parsed = JSON.parse(
				config.replaceAll("&quot;", '"').replaceAll("&amp;", "&"),
			);
			assert.equal(parsed.mapping, "specific");
			assert.equal(parsed.term, `/${route.replace(/\/$/, "")}`);
			assert.equal(parsed.repo, commentConfig.giscus.repo);
		});
	}
	if (route.startsWith("posts/")) {
		check(`${route} 提供沉浸阅读入口但不自动进入`, () => {
			assert.ok(
				html.includes('id="immersive-reading-toggle"'),
				"缺少进入/退出按钮",
			);
			assert.doesNotMatch(
				html.match(/<html\b[^>]*>/)?.[0] || "",
				/immersive-reading/,
			);
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
	for (const route of postRoutes)
		assert.ok(read("rss.xml").includes(`${origin}${base}${route}`));
});
check("关闭功能的跳转保留部署前缀", () => {
	if (!siteConfig.pages.dynamic)
		assert.ok(read("dynamic/comments/index.html").includes(`${base}404/`));
});

if (errors.length) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
}
