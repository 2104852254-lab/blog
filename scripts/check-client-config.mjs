// 运行项目 Vite 配置产出的浏览器模块；VM 初始环境不提供 Node 的 process。
// node scripts/check-client-config.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const scenarios = [
	{
		name: "local",
		target: undefined,
		url: "https://blog-seven-tau-84.vercel.app",
	},
	{
		name: "vercel",
		target: "vercel",
		url: "https://blog-seven-tau-84.vercel.app",
	},
	{
		name: "github-pages",
		target: "github-pages",
		url: "https://2104852254-lab.github.io/blog",
	},
];
const scenarioName = process.argv[2];

if (!scenarioName) {
	let failed = false;
	for (const scenario of scenarios) {
		// 独立进程避免 Astro 配置和其站点配置导入缓存串用部署目标。
		const env = { ...process.env, NODE_ENV: "development" };
		if (scenario.target === undefined) delete env.DEPLOY_TARGET;
		else env.DEPLOY_TARGET = scenario.target;
		const result = spawnSync(
			process.execPath,
			[fileURLToPath(import.meta.url), scenario.name],
			{ cwd: root, env, stdio: "inherit" },
		);
		if (result.error) throw result.error;
		if (result.status !== 0) failed = true;
	}
	if (failed) process.exitCode = 1;
} else {
	const scenario = scenarios.find(({ name }) => name === scenarioName);
	assert.ok(scenario, `未知客户端配置检查目标：${scenarioName}`);
	const requireFromAstro = createRequire(import.meta.resolve("astro"));
	const { createServer, build, loadConfigFromFile } = await import(
		pathToFileURL(requireFromAstro.resolve("vite")).href
	);
	// Vite runner 同时解析配置里的 TS 和 ?raw 依赖，使用配置的实际导出。
	const loaded = await loadConfigFromFile(
		{ command: "serve", mode: "development" },
		resolve(root, "astro.config.mjs"),
		root,
		"error",
		undefined,
		"runner",
	);
	assert.ok(loaded, "Astro 配置加载失败");
	const config = loaded.config;
	const viteConfig = { ...config.vite, root, configFile: false, logLevel: "error" };

	function evaluate(code, context, filename) {
		// Vite 已处理 TS、define 和模块；这里只将导出语法转为 VM 可读取的 exports。
		const { outputText } = ts.transpileModule(code, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
			fileName: `${filename}.js`,
		});
		context.exports = {};
		runInContext(outputText, context, { filename, timeout: 1000 });
		return context.exports;
	}

	function assertSiteConfig(exports, mode) {
		assert.ok(exports.siteConfig, `${scenario.name} ${mode} 缺少 siteConfig 导出`);
		assert.equal(
			exports.siteConfig.site_url,
			scenario.url,
			`${scenario.name} ${mode} 浏览器配置应保留当前发布平台地址`,
		);
	}

	const server = await createServer({
		...viteConfig,
		server: { middlewareMode: true, watch: null, hmr: false, ws: false },
		optimizeDeps: { noDiscovery: true, include: [] },
	});
	try {
		const context = createContext({});
		assert.equal(runInContext("typeof process", context), "undefined");
		// Vite 8 的开发期 define 通过 /@vite/env 初始化；浏览器也先执行此模块。
		const envModule = await server.transformRequest("/@vite/env");
		assert.ok(envModule, "Vite 开发环境初始化模块缺失");
		evaluate(envModule.code, context, "/@vite/env");
		const module = await server.transformRequest("/src/config/siteConfig.ts");
		assert.ok(module, "Vite 开发客户端站点配置模块缺失");
		assertSiteConfig(
			evaluate(module.code, context, "/src/config/siteConfig.ts"),
			"dev",
		);
	} finally {
		await server.close();
	}

	const result = await build({
		...viteConfig,
		mode: "production",
		build: {
			...viteConfig.build,
			write: false,
			minify: false,
			lib: {
				entry: resolve(root, "src/config/siteConfig.ts"),
				formats: ["es"],
			},
		},
	});
	const outputs = Array.isArray(result) ? result : [result];
	const chunk = outputs
		.flatMap((output) => output.output)
		.find((item) => item.type === "chunk" && item.isEntry);
	assert.ok(chunk, "Vite 生产客户端站点配置入口缺失");
	assertSiteConfig(
		evaluate(chunk.code, createContext({}), "client-config.js"),
		"build",
	);
	console.log(`✓ ${scenario.name} 客户端配置在开发和生产环境执行，站点地址正确`);
}
