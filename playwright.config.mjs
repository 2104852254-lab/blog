import { defineConfig, devices } from "@playwright/test";

const base = process.env.DEPLOY_TARGET === "github-pages" ? "/blog/" : "/";

export default defineConfig({
	testDir: "./tests/browser",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : 2,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: `http://127.0.0.1:4175${base}`,
		// 本地可使用已安装的 Edge；CI 使用 Playwright 配套的 Chromium。
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "desktop",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
		{ name: "mobile", use: { ...devices["Pixel 5"] } },
	],
	webServer: {
		// 使用正式构建产物，才能测试真实 Pagefind 索引和 /blog/ 资源路径。
		command:
			"node node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4175",
		url: `http://127.0.0.1:4175${base}`,
		reuseExistingServer: false,
		timeout: 30_000,
	},
});
