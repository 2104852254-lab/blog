// 用临时文章验证实际静态产物；浏览器测试在 / 与 /blog 两种构建下分别运行。
import { spawnSync } from "node:child_process";

for (const args of [
	["node_modules/astro/bin/astro.mjs", "build"],
	["node_modules/@playwright/test/cli.js", "test", "tests/browser/article-links.spec.mjs"],
]) {
	const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status || 1);
}
