import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";

const module = await tsImport(
	"../src/utils/article-metadata.ts",
	import.meta.url,
).catch(() => null);
assert.ok(
	module?.buildArticleMetadata,
	"缺少统一文章图片、真实更新日期和主网址的元数据生成器",
);
const input = {
	title: "我的调试记录",
	description: "真实调试过程",
	author: "守夜人",
	canonicalUrl: "https://blog-seven-tau-84.vercel.app/posts/car/",
	authorUrl: "https://blog-seven-tau-84.vercel.app/about/",
	published: new Date("2026-08-01"),
	tags: ["PID"],
	lang: "zh_CN",
	imageUrl: "https://2104852254-lab.github.io/blog/_astro/car.jpg",
};
const original = module.buildArticleMetadata(input);
assert.equal(original["@type"], "BlogPosting");
assert.equal(original.url, "https://blog-seven-tau-84.vercel.app/posts/car/");
assert.equal(original.mainEntityOfPage["@id"], original.url);
assert.equal(
	original.author.url,
	"https://blog-seven-tau-84.vercel.app/about/",
);
assert.equal(
	original.image,
	"https://2104852254-lab.github.io/blog/_astro/car.jpg",
);
assert.equal(original.datePublished, "2026-08-01");
assert.equal(original.inLanguage, "zh-CN");
assert.equal(
	original.dateModified,
	undefined,
	"不能用构建时间伪造文章更新时间",
);
const updated = module.buildArticleMetadata({
	...input,
	updated: new Date("2026-09-03"),
	imageUrl: undefined,
});
assert.equal(updated.dateModified, "2026-09-03");
assert.equal(updated.image, undefined, "无代表图时不拼接不存在的图片地址");
console.log("✓ 文章主网址、作者资料、图片和真实更新时间");
