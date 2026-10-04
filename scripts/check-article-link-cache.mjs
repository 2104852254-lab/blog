// 慢速集成检查：只创建自有临时文章，验证连续构建与开发期的引用卡片缓存。
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const targetPath = path.join(root, "src/content/posts/__cache-probe-target.md");
const sourcePath = path.join(root, "src/content/posts/__cache-probe-source.md");
const addedPath = path.join(root, "src/content/posts/__cache-probe-added.md");
const sourceOutput = path.join(
	root,
	"dist/posts/__cache-probe-source/index.html",
);
let devServer;
const createdFiles = new Set();
assert.equal(existsSync(targetPath), false, "缓存检查不能覆盖已有文章");
assert.equal(existsSync(sourcePath), false, "缓存检查不能覆盖已有文章");
assert.equal(existsSync(addedPath), false, "缓存检查不能覆盖已有文章");

function target({ title, draft = false, password = "" }) {
	return `---\ntitle: ${title}\npublished: 2026-01-01\ndescription: ${title}_DESCRIPTION\ndraft: ${draft}\npassword: '${password}'\ncomment: false\n---\n缓存验证正文\n`;
}
function build() {
	const result = spawnSync(
		process.execPath,
		["node_modules/astro/bin/astro.mjs", "build"],
		{ cwd: root, env: { ...process.env, DEPLOY_TARGET: "" }, stdio: "inherit" },
	);
	assert.equal(result.status, 0, "缓存集成检查的 Astro 构建必须成功");
	return readFileSync(sourceOutput, "utf8");
}

async function devHtml(expectation) {
	let html = "";
	for (let attempt = 0; attempt < 80; attempt++) {
		try {
			const response = await fetch(
				"http://127.0.0.1:4327/posts/__cache-probe-source/",
				{ signal: AbortSignal.timeout(5000) },
			);
			if (response.ok) {
				html = await response.text();
				if (html.includes("缓存验证来源") && expectation(html)) return html;
			}
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	assert.ok(
		html.includes("缓存验证来源") && expectation(html),
		`开发服务器在仅修改目标后必须更新未改动来源的卡片：实际元素=${/<a\b[^>]*class="card-wiki-link no-styling"/.test(html)}，旧描述=${html.includes("CACHE_PUBLIC_TITLE_DESCRIPTION")}`,
	);
	return html;
}

try {
	writeFileSync(
		sourcePath,
		"---\ntitle: 缓存验证来源\npublished: 2026-01-02\ncomment: false\n---\n[[__cache-probe-target]]\n\n[[__cache-probe-added]]\n",
		{ flag: "wx" },
	);
	createdFiles.add(sourcePath);
	writeFileSync(targetPath, target({ title: "CACHE_PUBLIC_TITLE" }), {
		flag: "wx",
	});
	createdFiles.add(targetPath);
	if (process.argv.includes("--dev")) {
		devServer = spawn(
			process.execPath,
			[
				"node_modules/astro/bin/astro.mjs",
				"dev",
				"--host",
				"127.0.0.1",
				"--port",
				"4327",
				"--ignore-lock",
			],
			{
				cwd: root,
				env: { ...process.env, DEPLOY_TARGET: "", ASTRO_DEV_BACKGROUND: "1" },
				stdio: "inherit",
				windowsHide: true,
			},
		);
		await devHtml((html) => html.includes("CACHE_PUBLIC_TITLE_DESCRIPTION"));
		writeFileSync(
			targetPath,
			target({
				title: "CACHE_PRIVATE_TITLE",
				draft: true,
				password: "fixture-only",
			}),
		);
		await devHtml(
			(html) =>
				!/<a\b[^>]*class="card-wiki-link no-styling"/.test(html) &&
				!html.includes("CACHE_PUBLIC_TITLE_DESCRIPTION") &&
				!html.includes("CACHE_PRIVATE_TITLE_DESCRIPTION"),
		);
		writeFileSync(targetPath, target({ title: "CACHE_UPDATED_TITLE" }));
		await devHtml((html) => html.includes("CACHE_UPDATED_TITLE_DESCRIPTION"));
		writeFileSync(addedPath, target({ title: "CACHE_ADDED_TITLE" }), {
			flag: "wx",
		});
		createdFiles.add(addedPath);
		await devHtml((html) => html.includes("CACHE_ADDED_TITLE_DESCRIPTION"));
		unlinkSync(addedPath);
		createdFiles.delete(addedPath);
		await devHtml((html) => !html.includes("CACHE_ADDED_TITLE_DESCRIPTION"));
		console.log("✓ 开发服务器：目标变化即时更新来源卡片，来源文件不变");
	} else {
		const initial = build();
		assert.match(initial, /card-wiki-link/);
		assert.match(initial, /CACHE_PUBLIC_TITLE_DESCRIPTION/);
		writeFileSync(
			targetPath,
			target({
				title: "CACHE_PRIVATE_TITLE",
				draft: true,
				password: "fixture-only",
			}),
		);
		const hidden = build();
		assert.doesNotMatch(
			hidden,
			/card-wiki-link|CACHE_PUBLIC_TITLE|CACHE_PRIVATE_TITLE/,
			"目标变为草稿/密码文章后，来源 digest 未变也不能保留旧卡片及公开元数据",
		);
		writeFileSync(targetPath, target({ title: "CACHE_UPDATED_TITLE" }));
		const updated = build();
		assert.match(
			updated,
			/CACHE_UPDATED_TITLE_DESCRIPTION/,
			"恢复公开后引用卡片必须显示新目标元数据",
		);
		assert.doesNotMatch(updated, /CACHE_PUBLIC_TITLE/);
		console.log("✓ 连续构建：目标文章变化即时更新来源卡片，来源文件不变");
	}
} finally {
	devServer?.kill();
	for (const ownedFile of createdFiles)
		if (existsSync(ownedFile)) unlinkSync(ownedFile);
}
