import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import ts from "typescript";
import { z } from "astro/zod";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(root, "scripts/new-post.js");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "firefly-writing-check-"));
const posts = path.join(temporary, "src/content/posts");
const run = (...args) => spawnSync(process.execPath, [script, ...args], {
	cwd: temporary,
	encoding: "utf8",
});

// Evaluate the actual repository schema, without starting Astro or its loaders.
const schemaFile = ts.createSourceFile("content.config.ts", fs.readFileSync(path.join(root, "src/content.config.ts"), "utf8"), ts.ScriptTarget.Latest, true);
let postSchema;
function findSchema(node) {
	if (ts.isVariableDeclaration(node) && node.name.getText(schemaFile) === "postsCollection") {
		const object = node.initializer.arguments[0];
		const property = object.properties.find((item) => item.name?.getText(schemaFile) === "schema");
		postSchema = new Function("z", `return (${property.initializer.getText(schemaFile)});`)(z);
	}
	ts.forEachChild(node, findSchema);
}
findSchema(schemaFile);
assert.ok(postSchema, "Locate the actual posts schema");

try {
	// A regression to draft:false must fail even if the CLI still succeeds.
	const result = run("first-note");
	assert.equal(result.status, 0, result.stderr);
	const post = matter(fs.readFileSync(path.join(temporary, "src/content/posts/first-note.md"), "utf8"));
	assert.equal(post.data.draft, true, "New articles must start as drafts");
	assert.equal(post.data.slug, "first-note");
	assert.ok(post.data.published instanceof Date);
	assert.equal(postSchema.parse(post.data).draft, true);
	// Unsafe input must exit before creating a file, not silently normalize it.
	for (const name of ["../escape", "notes/../../escape", "notes\\escape", "/absolute", "C:/escape", ".", "notes//empty", "bad\nname", "CON", "trailing.", ".md", "notes/.mdx"]) {
		assert.notEqual(run(name).status, 0, `Must reject unsafe filename: ${JSON.stringify(name)}`);
	}
	assert.equal(fs.existsSync(path.join(temporary, "src/content/escape.md")), false);
	const first = fs.readFileSync(path.join(posts, "first-note.md"), "utf8");
	assert.notEqual(run("first-note").status, 0);
	assert.equal(fs.readFileSync(path.join(posts, "first-note.md"), "utf8"), first, "Do not overwrite a draft");
	const title = '调试记录: "一步" #保留';
	const quoted = run("notes/quote-test", "--title", title);
	assert.equal(quoted.status, 0, quoted.stderr);
	const quotedPost = matter(fs.readFileSync(path.join(posts, "notes/quote-test.md"), "utf8"));
	assert.equal(quotedPost.data.title, title, "Titles must round-trip through YAML");
	assert.equal(quotedPost.data.slug, "notes/quote-test");
	assert.equal(quotedPost.data.author, "守夜人");
	assert.equal(quotedPost.data.lightImage, "");
	postSchema.parse(quotedPost.data);
	assert.notEqual(run("missing-title", "--title").status, 0);
	assert.notEqual(run("empty-title", "--title", "   ").status, 0);
	assert.equal(run("中文/index.mdx").status, 0);
	assert.equal(matter(fs.readFileSync(path.join(posts, "中文/index.mdx"), "utf8")).data.slug, "zhong-wen", "Keep the existing pinyin and /index convention");
	const external = path.join(temporary, "outside-posts");
	fs.mkdirSync(external);
	fs.symlinkSync(external, path.join(posts, "linked"), process.platform === "win32" ? "junction" : "dir");
	assert.notEqual(run("linked/escape").status, 0, "Do not follow an author folder link out of posts");
	assert.deepEqual(fs.readdirSync(external), []);
	fs.unlinkSync(path.join(posts, "linked"));
	const config = JSON.parse(fs.readFileSync(path.join(root, "frontmatter.json"), "utf8"));
	const contentType = config["frontMatter.taxonomy.contentTypes"].find((item) => item.name === "default");
	assert.ok(contentType);
	const fixture = { title: '记录: "保留标题"', slug: "sample-note", now: "2026-10-04" };
	const defaults = Object.fromEntries(contentType.fields.map((field) => {
		const value = typeof field.default === "string"
			? field.default.replace(/\{\{(title|slug|now)\}\}/g, (_, key) => fixture[key])
			: field.default;
		return [field.name, value];
	}));
	// Exercise the boundary payload the configured controls create, against Astro.
	const frontMatter = matter.stringify("", defaults, { language: "yaml" });
	const metadata = matter(frontMatter).data;
	metadata.published = matter(`---\npublished: ${defaults.published}\n---\n`).data.published;
	const validated = postSchema.parse(metadata);
	assert.equal(validated.title, fixture.title);
	assert.equal(validated.draft, true);
	assert.equal(validated.category, "");
	assert.deepEqual(validated.tags, []);
	assert.equal(typeof validated.image, "string");
	assert.equal(typeof validated.lightImage, "string");
	const edit = postSchema.parse({ ...metadata, category: "调试", tags: ["记录"], image: "../../assets/images/diagrams/debugging-flow.svg" });
	assert.equal(edit.category, "调试");
	assert.deepEqual(edit.tags, ["记录"]);
	assert.ok(fs.existsSync(path.resolve(root, "src/content/posts", edit.image)));
	assert.equal(config["frontMatter.content.publicFolder"].relative, true);
	assert.equal(config["frontMatter.taxonomy.alignFilename"], false);
	assert.equal(config["frontMatter.git.enabled"], false);
	assert.ok(config["frontMatter.panel.actions.disabled"].includes("optimizeSlug"));
	const scene = JSON.parse(fs.readFileSync(path.join(root, "writing/diagrams/debugging-flow.excalidraw"), "utf8"));
	assert.equal(scene.type, "excalidraw");
	assert.equal(scene.version, 2);
	assert.deepEqual(scene.files, {}, "No embedded images, source data or credentials");
	const ids = new Set(scene.elements.map((element) => element.id));
	assert.equal(ids.size, scene.elements.length);
	assert.equal(scene.elements.filter((element) => element.type === "arrow").length, 4);
	assert.equal(scene.elements.filter((element) => element.type === "rectangle").length, 5);
	for (const element of scene.elements) {
		assert.ok(Number.isFinite(element.x) && Number.isFinite(element.y));
		assert.ok(element.width >= 0 && element.height >= 0);
		if (element.containerId) assert.ok(ids.has(element.containerId));
		for (const bound of element.boundElements ?? []) assert.ok(ids.has(bound.id));
		if (element.type === "text") assert.ok(element.text.trim() && element.fontSize >= 18);
	}
	console.log("Writing tools: drafts, YAML titles, stable slugs, path safety, Astro metadata and editable diagram structure passed.");
} finally {
	// Only remove the unique temporary tree created above, never the workspace.
	assert.equal(path.dirname(temporary), fs.realpathSync(os.tmpdir()));
	fs.rmSync(temporary, { recursive: true, force: true });
}
