const base = process.env.DEPLOY_TARGET === "github-pages" ? "/blog/" : "/";

module.exports = {
	ci: {
		collect: {
			chromePath:
				process.env.CHROME_PATH ||
				require("@playwright/test").chromium.executablePath(),
			// Astro preview 正确挂载 /blog/；直接把 dist 当根目录会测到错误页面。
			startServerCommand:
				"node node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4176",
			startServerReadyPattern: "Local",
			startServerReadyTimeout: 30_000,
			url: [
				`http://127.0.0.1:4176${base}`,
				`http://127.0.0.1:4176${base}posts/balancing-car-learning-and-debugging/`,
			],
			numberOfRuns: 3,
			settings: { chromeFlags: "--no-sandbox" },
		},
		assert: {
			// 首轮建立基线；性能波动只警告，不要求满分，也不掩盖收集失败。
			assertions: {
				"categories:performance": [
					"warn",
					{ minScore: 0.8, aggregationMethod: "median" },
				],
				"categories:accessibility": ["warn", { minScore: 0.9 }],
				"categories:seo": ["warn", { minScore: 0.9 }],
				"categories:best-practices": ["warn", { minScore: 0.9 }],
				"cumulative-layout-shift": [
					"warn",
					{ maxNumericValue: 0.1, aggregationMethod: "median" },
				],
			},
		},
		// 仅保存在本地/工作流附件；不上传公共 Lighthouse 服务。
		upload: { target: "filesystem", outputDir: "reports/lighthouse" },
	},
};
