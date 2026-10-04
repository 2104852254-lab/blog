// 不访问网络，检查真实 HTML 中的图片、脚本、导航和锚点。
// /blog/ 只是一层部署前缀，磁盘上的文件仍放在 dist 根目录。
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

mkdirSync("reports", { recursive: true });
const root = resolve("dist");
const rootUrl = `${pathToFileURL(root).href}/`;
const args = [
	"--config",
	"lychee.toml",
	"--scheme",
	"file",
	"--offline",
	"--root-dir",
	root,
	"--index-files",
	"index.html",
	// Astro 的错误页输出为 404.html；关闭功能跳转 /404 是有意的。
	"--fallback-extensions",
	"html",
	"--include-fragments=anchor-only",
	"--no-ignore",
	"--no-progress",
	"--format",
	"markdown",
	"--output",
	"reports/internal-links.md",
];
if (process.env.DEPLOY_TARGET === "github-pages") {
	const escapedRoot = rootUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// file URL 会规范化首页的末尾斜杠，/blog 和 /blog/ 都映射到 dist。
	args.push(
		"--remap",
		`${escapedRoot}blog/?$ ${rootUrl}`,
		"--remap",
		`${escapedRoot}blog/(.*) ${rootUrl}$1`,
	);
}
args.push("dist/**/*.html");
const result = spawnSync(process.env.LYCHEE_BIN || "lychee", args, {
	stdio: "inherit",
});
if (result.error) {
	console.error(
		"请先安装 lychee 0.24.2，或通过 LYCHEE_BIN 指定其位置。",
		result.error.message,
	);
}
process.exitCode = result.status ?? 1;
