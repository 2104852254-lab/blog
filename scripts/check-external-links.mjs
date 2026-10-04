// 外部服务限流或断网时保留失败明细；由人复核，不把 403/429 当作成功。
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("reports", { recursive: true });
const result = spawnSync(
	process.env.LYCHEE_BIN || "lychee",
	[
		"--config",
		"lychee.toml",
		"--base-url=https://blog-seven-tau-84.vercel.app/",
		"--no-ignore",
		"--no-progress",
		"--format",
		"markdown",
		"--output",
		"reports/links.md",
		"README.md",
		"dist/**/*.html",
	],
	{ stdio: "inherit" },
);
if (result.error) {
	console.error(
		"请先安装 lychee 0.24.2，或通过 LYCHEE_BIN 指定其位置。",
		result.error.message,
	);
}
process.exitCode = result.status ?? 1;
