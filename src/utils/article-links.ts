import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slug } from "github-slugger";
import matter from "gray-matter";
import type { Root, RootContent } from "mdast";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

const POSTS_DIR = fileURLToPath(new URL("../content/posts/", import.meta.url));
const EXTENSION = /\.(?:md|mdx|markdown)$/i;
const WIKI_LINK = /!?\[\[([^[\]\n]+)\]\]/g;

export type ArticleEntry = {
	id: string;
	filePath?: string;
	contentPath?: string;
	body?: string;
	data: {
		title?: string;
		slug?: string;
		draft?: boolean;
		password?: string;
		[key: string]: unknown;
	};
};
export type ArticleLinkOptions = {
	base?: string;
	site?: string;
	canonicalSite?: string;
};
export type ArticleBacklink = { id: string; title: string; url: string };
type ResolvedArticle = ArticleEntry & { url: string };

export function isPublicArticle(entry: ArticleEntry): boolean {
	// 与开发/生产模式无关，引用关系和卡片始终只使用公开文章。
	return !entry.data.draft && !entry.data.password;
}

function normalizePath(value: string): string | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(value.trim()).replaceAll("\\", "/");
	} catch {
		return null;
	}
	const segments = decoded.replace(/^\.\//, "").split("/").filter(Boolean);
	if (
		!segments.length ||
		segments.some(
			(part) => part === "." || part === ".." || /[\0?#]/.test(part),
		)
	)
		return null;
	return segments.join("/").replace(EXTENSION, "");
}

export function withArticleBase(value: string, base = "/"): string {
	if (
		/^[a-z][a-z\d+.-]*:/i.test(value) ||
		value.startsWith("//") ||
		value.startsWith("#")
	)
		return value;
	const prefix = `/${base.split("/").filter(Boolean).join("/")}`;
	const absolute = `/${value.replace(/^\/+/, "")}`;
	return prefix === "/" ||
		absolute === prefix ||
		absolute.startsWith(`${prefix}/`)
		? absolute
		: `${prefix}${absolute}`;
}

function articleUrl(id: string, base: string): string {
	return withArticleBase(
		`/posts/${id.replace(EXTENSION, "").split("/").map(encodeURIComponent).join("/")}/`,
		base,
	);
}

function fileAlias(entry: ArticleEntry): string | null {
	if (entry.contentPath) return normalizePath(entry.contentPath);
	if (!entry.filePath) return null;
	const relative = path.isAbsolute(entry.filePath)
		? path.relative(POSTS_DIR, entry.filePath)
		: entry.filePath
				.replaceAll("\\", "/")
				.replace(/^.*?src\/content\/posts\//, "");
	return normalizePath(relative);
}

export function createArticleLinkIndex(
	entries: ArticleEntry[],
	options: ArticleLinkOptions = {},
): {
	resolve: (target: string, sourceId?: string) => ResolvedArticle | null;
	isPrivateTarget: (target: string, sourceId?: string) => boolean;
} {
	const base = options.base ?? "/";
	const aliases = new Map<string, ArticleEntry | null>();
	const ids = new Map(entries.map((entry) => [entry.id, entry]));
	function addAlias(
		value: string | undefined | null,
		entry: ArticleEntry,
	): void {
		if (!value) return;
		const key = normalizePath(value);
		if (!key) return;
		// 重复别名不猜测目标；真实 id 在下方优先处理。
		aliases.set(
			key,
			aliases.has(key) && aliases.get(key)?.id !== entry.id ? null : entry,
		);
	}
	for (const entry of entries) {
		addAlias(entry.data.slug, entry);
		const file = fileAlias(entry);
		addAlias(file, entry);
		if (file?.endsWith("/index")) addAlias(file.slice(0, -6), entry);
	}
	for (const entry of entries)
		aliases.set(entry.id.replace(EXTENSION, ""), entry);
	function find(target: string, sourceId?: string): ArticleEntry | null {
		let value = target.trim();
		const relativeFile =
			!value.startsWith("/") &&
			!/^[a-z][a-z\d+.-]*:/i.test(value) &&
			EXTENSION.test(value.split(/[?#]/)[0]);
		if (
			sourceId &&
			!relativeFile &&
			value &&
			!value.startsWith("/") &&
			!value.startsWith("#") &&
			!value.startsWith("?") &&
			!/^[a-z][a-z\d+.-]*:/i.test(value)
		) {
			const source = ids.get(sourceId);
			if (!source) return null;
			// 无扩展名是浏览器路由相对地址；.md/.mdx 才按源文件目录解析。
			try {
				const route = new URL(
					value,
					`https://article.invalid${articleUrl(source.id, base)}`,
				).pathname;
				return find(route);
			} catch {
				return null;
			}
		}
		if (sourceId && relativeFile) {
			const source = ids.get(sourceId);
			const sourcePath = source && fileAlias(source);
			if (!sourcePath) return null;
			let decoded: string;
			try {
				decoded = decodeURIComponent(value.split(/[?#]/)[0]).replaceAll(
					"\\",
					"/",
				);
			} catch {
				return null;
			}
			if (decoded.startsWith("/")) return null;
			// 先按来源文件合并，再检查是否仍在内容根内；合法 ../ 不算越界。
			const key = normalizePath(
				path.posix.join(path.posix.dirname(sourcePath), decoded),
			);
			const entry = key ? aliases.get(key) : null;
			return entry ?? null;
		}
		// 在 URL 构造器消除 .. 之前校验，避免穿越路径误匹配。
		try {
			if (
				decodeURIComponent(value)
					.replaceAll("\\", "/")
					.split(/[/?#]/)
					.some((part) => part === ".." || part === ".")
			) {
				if (!value.startsWith("./") || value.slice(2).split("/").includes(".."))
					return null;
			}
		} catch {
			return null;
		}
		if (/^(?:https?:)?\/\//i.test(value)) {
			const knownSites = [options.site, options.canonicalSite].filter(
				(site): site is string => Boolean(site),
			);
			if (!knownSites.length) return null;
			try {
				const url = new URL(value, knownSites[0]);
				if (!knownSites.some((site) => url.origin === new URL(site).origin))
					return null;
				value = url.pathname;
			} catch {
				return null;
			}
		} else if (/^[a-z][a-z\d+.-]*:/i.test(value)) return null;
		value = value.split(/[?#]/)[0];
		const basePrefix = `/${base.split("/").filter(Boolean).join("/")}`;
		if (basePrefix !== "/" && value.startsWith(`${basePrefix}/`))
			value = value.slice(basePrefix.length);
		if (value.startsWith("/")) {
			if (!value.startsWith("/posts/")) return null;
			value = value.slice(7);
		} else value = value.replace(/^posts\//, "");
		const key = normalizePath(value);
		if (!key) return null;
		const source = sourceId ? ids.get(sourceId) : undefined;
		const sourcePath = source && fileAlias(source);
		const relativeKey = sourcePath
			? path.posix.join(path.posix.dirname(sourcePath), key)
			: null;
		let entry = aliases.get(key);
		if (!entry && sourceId && !aliases.has(key)) {
			if (relativeKey) entry = aliases.get(relativeKey);
		}
		return entry ?? null;
	}
	return {
		resolve(target, sourceId) {
			const entry = find(target, sourceId);
			return entry && isPublicArticle(entry)
				? { ...entry, url: articleUrl(entry.id, base) }
				: null;
		},
		isPrivateTarget(target, sourceId) {
			const entry = find(target, sourceId);
			return Boolean(entry && !isPublicArticle(entry));
		},
	};
}

export function parseWikiLinkValue(value: string): {
	destination: string;
	alias: string;
	contentPath: string;
	heading: string;
} | null {
	const [destinationPart, ...aliasParts] = value.split("|");
	const destination = destinationPart.trim();
	const headingAt = destination.indexOf("#");
	const contentPath = (
		headingAt < 0 ? destination : destination.slice(0, headingAt)
	).trim();
	const heading = headingAt < 0 ? "" : destination.slice(headingAt + 1).trim();
	return contentPath || heading
		? { destination, alias: aliasParts.join("|").trim(), contentPath, heading }
		: null;
}

export function loadArticleEntries(
	postsDir: string = POSTS_DIR,
): ArticleEntry[] {
	const entries: ArticleEntry[] = [];
	function walk(dir: string): void {
		for (const file of readdirSync(dir, { withFileTypes: true })) {
			const filePath = path.join(dir, file.name);
			if (file.isDirectory()) walk(filePath);
			else if (file.isFile() && /\.(md|mdx)$/i.test(file.name)) {
				const { data, content } = matter(readFileSync(filePath, "utf8"));
				const relative = path
					.relative(postsDir, filePath)
					.replaceAll("\\", "/")
					.replace(EXTENSION, "");
				// 与 Astro glob 默认 id 一致；frontmatter slug 是该加载器的真实 id。
				const id =
					typeof data.slug === "string" && data.slug
						? data.slug
						: relative
								.split("/")
								.map((segment) => slug(segment))
								.join("/")
								.replace(/\/index$/, "");
				entries.push({
					id,
					filePath,
					contentPath: relative,
					data,
					body: content,
				});
			}
		}
	}
	walk(postsDir);
	return entries;
}

export async function buildArticleBacklinks(
	entries: ArticleEntry[],
	options: ArticleLinkOptions = {},
): Promise<Map<string, ArticleBacklink[]>> {
	const index = createArticleLinkIndex(entries, options);
	const incoming = new Map<string, Map<string, ArticleBacklink>>();
	for (const source of entries.filter(isPublicArticle)) {
		const parser = unified().use(remarkParse).use(remarkGfm);
		if (source.filePath?.endsWith(".mdx")) parser.use(remarkMdx);
		const tree = parser.parse(source.body ?? "") as Root;
		const definitions = new Map<string, string>();
		function collectDefinitions(node: Root | RootContent): void {
			if (
				node.type === "definition" &&
				!definitions.has(node.identifier.toLowerCase())
			)
				definitions.set(node.identifier.toLowerCase(), node.url);
			if ("children" in node)
				for (const child of node.children)
					collectDefinitions(child as RootContent);
		}
		collectDefinitions(tree);
		function add(target: string, relative = false): void {
			const entry = index.resolve(target, relative ? source.id : undefined);
			if (!entry || entry.id === source.id) return;
			let sources = incoming.get(entry.id);
			if (!sources) {
				sources = new Map();
				incoming.set(entry.id, sources);
			}
			sources.set(source.id, {
				id: source.id,
				title: source.data.title || source.id,
				url: articleUrl(source.id, options.base ?? "/"),
			});
		}
		function visit(node: Root | RootContent): void {
			if (node.type === "link") {
				add(node.url, true);
				return;
			}
			if (node.type === "linkReference") {
				const target = definitions.get(node.identifier.toLowerCase());
				if (target) add(target, true);
				return;
			}
			if (node.type === "text") {
				for (const match of node.value.matchAll(WIKI_LINK)) {
					if (match[0].startsWith("!")) continue;
					const parsed = parseWikiLinkValue(match[1]);
					if (parsed?.contentPath) add(parsed.contentPath);
				}
			}
			// AST 中代码、图片、HTML 与 MDX 表达式没有可计入的正文链接。
			if (node.type === "image" || node.type === "imageReference") return;
			if ("children" in node)
				for (const child of node.children) visit(child as RootContent);
		}
		visit(tree);
	}
	return new Map(
		[...incoming].map(([id, sources]) => [
			id,
			[...sources.values()].sort((a, b) =>
				a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
			),
		]),
	);
}
