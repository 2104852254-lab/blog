/**
 * remark-wiki-link — Obsidian 风格 Wiki Link 插件
 * @author CuteLeaf <xiaye@msn.com>
 */

import { statSync } from "node:fs";
import path from "node:path";
import { slug } from "github-slugger";
import {
	createArticleLinkIndex,
	loadArticleEntries,
	parseWikiLinkValue,
	withArticleBase,
} from "../utils/article-links";
import { getApiUrlList, processCoverImageSync } from "../utils/image-utils";

const MARKDOWN_EXTENSION = /\.(?:md|mdx|markdown)$/i;
const WIKI_LINK = /!?\[\[([^[\]\n]+)\]\]/g;
const STANDALONE_WIKI_LINK = /^\[\[([^[\]\n]+)\]\]$/;
const SKIPPED_NODE_TYPES = new Set(["link", "linkReference"]);

function formatPublishedDate(value) {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === "string") {
		const match = value.match(/^\d{4}-\d{2}-\d{2}/);
		if (match) {
			return match[0];
		}
	}
	return "";
}

function createRemoteCoverImg(src, extraProperties) {
	return createElement(
		"img",
		{
			src,
			alt: "",
			loading: "lazy",
			decoding: "async",
			...extraProperties,
		},
		[],
	);
}

function createCoverNode(meta, parsed, context) {
	const image =
		typeof meta.data.image === "string" ? meta.data.image.trim() : "";

	if (!image) {
		return null;
	}

	// 随机封面图 API：复用 CoverImage 的 data-api-urls 客户端重试机制
	if (image === "api") {
		const seed = parsed.contentPath.replace(/\/index$/i, "");
		const firstUrl = processCoverImageSync(image, seed);
		if (!firstUrl) {
			return null;
		}
		const apiUrls = getApiUrlList(image, seed);
		return createElement(
			"div",
			{
				class: "cover-image-container",
				dataApiUrls: apiUrls.length > 0 ? JSON.stringify(apiUrls) : undefined,
			},
			[
				createRemoteCoverImg(firstUrl, {
					dataCoverImg: "true",
					dataRemote: "true",
				}),
			],
		);
	}

	// 外链或 public 目录下的封面：直接输出 img，不经过构建期图片管线
	if (/^(?:https?:)?\/\//i.test(image) || image.startsWith("/")) {
		return createRemoteCoverImg(withArticleBase(image, context.base));
	}

	if (!context.currentDir) {
		return null;
	}

	const absolutePath = path.resolve(path.dirname(meta.filePath), image);
	try {
		if (!statSync(absolutePath).isFile()) {
			return null;
		}
	} catch {
		return null;
	}

	const relativePath = path
		.relative(context.currentDir, absolutePath)
		.replaceAll("\\", "/");
	const coverUrl = relativePath.startsWith(".")
		? relativePath
		: `./${relativePath}`;

	// 走 Astro 图片管线，width:640 生成小尺寸缩略图
	return {
		type: "image",
		url: coverUrl,
		alt: "",
		data: { hProperties: { width: 480 } },
	};
}

function createElement(tagName, properties, children) {
	return {
		type: "paragraph",
		data: { hName: tagName, hProperties: properties },
		children,
	};
}

function createText(value) {
	return { type: "text", value };
}

function createWikiLinkCard(parsed, context) {
	const meta = context.index.resolve(parsed.contentPath);
	if (!meta) {
		return null;
	}

	const title =
		typeof meta.data.title === "string" && meta.data.title
			? meta.data.title
			: parsed.contentPath;
	const description =
		typeof meta.data.description === "string"
			? meta.data.description.trim()
			: "";
	const published = formatPublishedDate(meta.data.published);
	const category =
		typeof meta.data.category === "string" ? meta.data.category.trim() : "";
	const tags = Array.isArray(meta.data.tags)
		? meta.data.tags.filter((tag) => typeof tag === "string" && tag)
		: [];

	const metaItems = [];
	if (published) {
		metaItems.push(
			createElement("span", { class: "wlc-date" }, [createText(published)]),
		);
	}
	if (category) {
		metaItems.push(
			createElement("span", { class: "wlc-category" }, [createText(category)]),
		);
	}
	if (tags.length > 0) {
		// 标签作为一个整体，宽度不够时整组换行
		metaItems.push(
			createElement(
				"span",
				{ class: "wlc-tags" },
				tags.map((tag) =>
					createElement("span", { class: "wlc-tag" }, [createText(`#${tag}`)]),
				),
			),
		);
	}

	const info = [
		createElement("div", { class: "wlc-title" }, [createText(title)]),
	];
	if (description) {
		info.push(
			createElement("div", { class: "wlc-description" }, [
				createText(description),
			]),
		);
	}
	if (metaItems.length > 0) {
		info.push(createElement("div", { class: "wlc-meta" }, metaItems));
	}

	const children = [createElement("div", { class: "wlc-info" }, info)];

	const cover = createCoverNode(meta, parsed, context);
	if (cover) {
		children.push(createElement("div", { class: "wlc-cover" }, [cover]));
	}

	return createElement(
		"a",
		{
			class: "card-wiki-link no-styling",
			href: meta.url,
		},
		children,
	);
}

function createWikiLink(value, context) {
	const parsed = parseWikiLinkValue(value);
	if (!parsed) {
		return null;
	}

	const meta = parsed.contentPath
		? context.index.resolve(parsed.contentPath)
		: null;
	// 未解析或非公开目标保留原文，不生成死链接或泄露元数据。
	if (parsed.contentPath && !meta) return null;
	const title =
		typeof meta?.data.title === "string" && meta.data.title
			? meta.data.title
			: "";

	let text = parsed.alias;
	if (!text) {
		if (parsed.contentPath) {
			const pageText =
				title || parsed.destination.replace(MARKDOWN_EXTENSION, "");
			text = parsed.heading ? `${pageText}#${parsed.heading}` : pageText;
		} else {
			text = parsed.heading;
		}
	}

	const pageUrl = meta?.url || "";
	const url = `${pageUrl}${parsed.heading ? `#${slug(parsed.heading)}` : ""}`;

	return {
		type: "link",
		url,
		children: [createText(text)],
	};
}

function replaceWikiLinks(value, context) {
	const children = [];
	let cursor = 0;
	let changed = false;

	for (const match of value.matchAll(WIKI_LINK)) {
		if (match[0].startsWith("!")) {
			continue;
		}

		const link = createWikiLink(match[1], context);
		if (!link) {
			continue;
		}

		const index = match.index;
		if (index > cursor) {
			children.push({ type: "text", value: value.slice(cursor, index) });
		}
		children.push(link);
		cursor = index + match[0].length;
		changed = true;
	}

	if (!changed) {
		return null;
	}

	if (cursor < value.length) {
		children.push({ type: "text", value: value.slice(cursor) });
	}

	return children;
}

function tryCreateCardFromParagraph(node, context) {
	if (node.type !== "paragraph" || node.children?.length !== 1) {
		return null;
	}

	const child = node.children[0];
	if (child.type !== "text") {
		return null;
	}

	const match = child.value.trim().match(STANDALONE_WIKI_LINK);
	if (!match) {
		return null;
	}

	const parsed = parseWikiLinkValue(match[1]);
	if (!parsed || parsed.alias || parsed.heading || !parsed.contentPath) {
		return null;
	}

	return createWikiLinkCard(parsed, context);
}

function transformNode(node, context) {
	if (SKIPPED_NODE_TYPES.has(node.type) || !Array.isArray(node.children)) {
		return;
	}

	for (let index = 0; index < node.children.length; index++) {
		const child = node.children[index];
		if (child.type === "link" || child.type === "linkReference") {
			const definition =
				child.type === "linkReference"
					? context.definitions.get(child.identifier.toLowerCase())
					: null;
			const target = child.type === "link" ? child.url : definition?.url;
			if (target) {
				const article = context.index.resolve(target, context.sourceId);
				if (article) {
					// 只改写已识别的文章；锚点和查询保留作者原意，图片定义不受影响。
					node.children[index] = {
						type: "link",
						url: article.url + (target.match(/[?#].*$/)?.[0] || ""),
						title: child.title ?? definition?.title,
						children: child.children,
					};
				} else if (context.index.isPrivateTarget(target, context.sourceId)) {
					node.children.splice(index, 1, ...child.children);
					index += child.children.length - 1;
				}
			}
			continue;
		}

		const card = tryCreateCardFromParagraph(child, context);
		if (card) {
			node.children[index] = card;
			continue;
		}

		if (child.type === "text") {
			const replacement = replaceWikiLinks(child.value, context);
			if (replacement) {
				node.children.splice(index, 1, ...replacement);
				index += replacement.length - 1;
			}
			continue;
		}

		transformNode(child, context);
	}
}

/**
 * Convert Obsidian-style Wiki Links into Markdown links and post link cards.
 *
 * - `[[slug]]` alone in a paragraph becomes a link card with the post's
 *   title, description, published date, category, tags and cover image.
 * - Inline `[[slug]]` becomes a normal link whose text is the post title.
 * - `[[slug|alias]]` and `[[slug#heading]]` always render as normal links.
 */
export function remarkWikiLink(options = {}) {
	return (tree, file) => {
		const entries = options.entries ?? loadArticleEntries();
		const sourceId = entries.find(
			(entry) =>
				entry.filePath &&
				file?.path &&
				path.resolve(entry.filePath) === path.resolve(file.path),
		)?.id;
		const definitions = new Map();
		function collectDefinitions(node) {
			if (
				node.type === "definition" &&
				!definitions.has(node.identifier.toLowerCase())
			)
				definitions.set(node.identifier.toLowerCase(), node);
			for (const child of node.children || []) collectDefinitions(child);
		}
		collectDefinitions(tree);
		const base =
			options.base ??
			(process.env.DEPLOY_TARGET === "github-pages" ? "/blog/" : "/");
		const context = {
			currentDir: file?.path ? path.dirname(file.path) : null,
			base,
			sourceId,
			definitions,
			index: createArticleLinkIndex(entries, {
				base,
				site: options.site,
				canonicalSite: options.canonicalSite,
			}),
		};
		transformNode(tree, context);
	};
}
