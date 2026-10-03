// 构建后统一检查真实产物和交互逻辑；不额外引入测试框架。
import { spawnSync } from "node:child_process";

const checks = [
	["scripts/check-site.mjs"],
	["scripts/check-panel-controls.mjs"],
	["scripts/check-article-metadata.mjs"],
	["scripts/check-comments.mjs"],
	["scripts/check-reading-mode.mjs"],
	["--experimental-vm-modules", "scripts/check-search-loader.mjs"],
];
for (const args of checks) {
	const result = spawnSync(process.execPath, args, { stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status || 1);
}
