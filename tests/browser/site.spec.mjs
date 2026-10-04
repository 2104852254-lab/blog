import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const article = "posts/balancing-car-learning-and-debugging/";

test("单图首屏封面的优先级直接包含在 HTML 中", async ({ request }) => {
	const response = await request.get(article);
	expect(response.ok()).toBe(true);
	const hasPriorityCover =
		/<img(?=[^>]*data-cover-img)(?=[^>]*loading="eager")(?=[^>]*fetchpriority="high")[^>]*>/.test(
			await response.text(),
		);
	expect(hasPriorityCover).toBe(true);
});

// 等待导航栏 Svelte 岛完成挂载，避免测试点击了尚未绑定事件的 SSR 按钮。
async function ready(page, route = "") {
	await page.goto(route);
	await page.waitForFunction(
		() => !document.querySelector('astro-island[client="load"][ssr]'),
	);
	// Expressive Code 在空闲时按溢出情况添加键盘入口，扫描前等真实行为完成。
	await page.waitForFunction(() =>
		[...document.querySelectorAll(".expressive-code pre")]
			.filter((pre) => pre.scrollWidth > pre.clientWidth)
			.every((pre) => pre.tabIndex >= 0),
	);
	await expect(page.locator("h1")).toHaveCount(1);
}

async function openSearch(page, isMobile) {
	if (isMobile) await page.locator("#search-switch").click();
	return page.locator(
		isMobile ? "#search-bar-inside input" : "#search-bar input",
	);
}

test.beforeEach(async ({ page }) => {
	// 仅隔离第三方评论网络；本站脚本、图片和 Pagefind 均使用真实产物。
	// 不登录、不发评论，GitHub 是否限流不能决定本站功能测试的结果。
	await page.route("https://giscus.app/**", (route) => route.abort());
});

test("首页资源可加载，手机卡片不挤出屏幕", async ({
	page,
	isMobile,
}, testInfo) => {
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await ready(page);
	await expect(page.locator("html")).toHaveClass(/dark/);
	await expect(page.locator("h1")).not.toBeEmpty();
	await expect(
		page.locator(".vite-error-overlay, astro-error-overlay"),
	).toHaveCount(0);
	const images = await page
		.locator("img:visible")
		.evaluateAll(async (images) => {
			await Promise.all(images.map((image) => image.decode().catch(() => {})));
			return images
				.filter((image) => !image.naturalWidth)
				.map((image) => image.src);
		});
	expect(images).toEqual([]);
	if (isMobile) {
		await expect(page.locator("#post-container")).toHaveCount(0);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth + 1,
			),
		).toBe(true);
	}
	expect(errors).toEqual([]);
	await testInfo.attach("首页预览", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
});

test("主题切换后刷新仍保留，个人图片位置不跳动", async ({ page }) => {
	await ready(page);
	const avatar = page
		.getByRole("link", { name: "Go to About Page", exact: true })
		.first();
	// 只等待头像及祖先已有的有限动画完成，不禁用网站动画或放宽位移阈值。
	const settleAvatar = async () =>
		avatar.evaluate(async (element) => {
			await document.fonts.ready;
			const animations = [];
			for (let node = element; node; node = node.parentElement) {
				animations.push(
					...node
						.getAnimations()
						.filter((animation) =>
							Number.isFinite(animation.effect?.getComputedTiming().endTime),
						),
				);
			}
			await Promise.allSettled(
				animations.map((animation) => animation.finished),
			);
		});
	await settleAvatar();
	const before = await avatar.boundingBox();
	await page.locator("#scheme-switch").click();
	await page.getByRole("menuitemradio", { name: "亮色", exact: true }).click();
	await expect(page.locator("html")).not.toHaveClass(/dark/);
	await settleAvatar();
	const after = await avatar.boundingBox();
	expect(before).not.toBeNull();
	expect(after).not.toBeNull();
	expect(Math.abs(before.y - after.y)).toBeLessThan(2);
	expect(Math.abs(before.height - after.height)).toBeLessThan(2);
	await page.reload();
	await page.waitForFunction(
		() => !document.querySelector('astro-island[client="load"][ssr]'),
	);
	await expect(page.locator("html")).not.toHaveClass(/dark/);
	await page.locator("#scheme-switch").click();
	await page.getByRole("menuitemradio", { name: "暗色", exact: true }).click();
	await expect(page.locator("html")).toHaveClass(/dark/);
});

test("真实索引能找到平衡车，结果链接保留当前平台路径", async ({
	page,
	isMobile,
	baseURL,
}) => {
	await ready(page);
	const input = await openSearch(page, isMobile);
	if (isMobile) await expect(input).toBeFocused();
	await input.fill("平衡车");
	const result = page
		.locator("#search-panel a")
		.filter({ hasText: "平衡车" })
		.first();
	await expect(result).toBeVisible();
	await expect(result).toHaveAttribute(
		"href",
		new URL(article, baseURL).pathname,
	);
	await result.click();
	await expect(page).toHaveURL(new URL(article, baseURL).href);
	await expect(page.locator("#post-container")).toBeVisible();
	await expect(
		page.locator(".post-page-theme-cover img[data-cover-img]:visible"),
	).toHaveAttribute("fetchpriority", "high");
});

test("搜索下载失败会提示重试，恢复网络后能再次找到文章", async ({
	page,
	isMobile,
}) => {
	await page.route("**/pagefind/**", (route) => route.abort());
	await ready(page);
	const input = await openSearch(page, isMobile);
	await input.fill("平衡车");
	await expect(page.getByRole("alert")).toContainText("搜索暂时不可用");
	await page.unroute("**/pagefind/**");
	await page.getByRole("button", { name: "重试", exact: true }).click();
	await expect(
		page.locator("#search-panel a").filter({ hasText: "平衡车" }).first(),
	).toBeVisible();
	await expect(input).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(page.locator("#search-panel")).toHaveAttribute("inert", "");
});

test("键盘可以跳过导航直达正文", async ({ page }) => {
	await ready(page);
	await page.keyboard.press("Tab");
	await expect(page.getByRole("link", { name: "跳到正文" })).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.locator("#swup-container")).toBeFocused();
});

test("分类导航使用单个链接，不嵌套第二个按钮", async ({ page }) => {
	await ready(page);
	const categories = page.locator(
		"widget-layout[data-id=categories]:visible a",
	);
	await expect(categories.first()).toBeVisible();
	await expect(categories.locator("button")).toHaveCount(0);
	// 同一帧读两个矩形，避免入场动画在两次异步测量之间移动整张卡片。
	const offset = await categories.first().evaluate((link) => {
		const row = link.getBoundingClientRect();
		const content = link.firstElementChild.getBoundingClientRect();
		return Math.abs(row.y + row.height / 2 - (content.y + content.height / 2));
	});
	expect(offset).toBeLessThan(1);
});

test("沉浸阅读仅由桌面按钮进入，退出和切页不残留", async ({
	page,
	isMobile,
	baseURL,
}, testInfo) => {
	await ready(page, article);
	const entry = page.getByRole("button", { name: "进入沉浸阅读", exact: true });
	await expect(page.locator("html")).not.toHaveClass(/immersive-reading/);
	if (isMobile) {
		await expect(entry).toBeHidden();
		return;
	}
	await entry.click();
	await expect(page.locator("html")).toHaveClass(/immersive-reading/);
	await expect(page.locator("#navbar-wrapper")).toBeHidden();
	await expect(page.locator("#post-container")).toBeVisible();
	await testInfo.attach("沉浸阅读预览", {
		body: await page.screenshot(),
		contentType: "image/png",
	});
	await page.keyboard.press("Escape");
	await expect(page.locator("html")).not.toHaveClass(/immersive-reading/);
	await expect(entry).toBeFocused();
	await entry.click();
	// 真实 Swup 切页：离开文章后必须撤销阅读态，不用硬刷新掩盖问题。
	await page.evaluate((url) => window.swup.navigate(url), baseURL);
	await expect(page).toHaveURL(baseURL);
	await expect(page.locator("html")).not.toHaveClass(/immersive-reading/);
});

for (const route of ["", article]) {
	for (const theme of ["dark", "light"]) {
		test(`${route || "首页"} ${theme} 无可自动检测的 WCAG 2.2 A/AA 问题`, async ({
			page,
		}, testInfo) => {
			await page.addInitScript(
				(theme) => localStorage.setItem("theme", theme),
				theme,
			);
			await ready(page, route);
			const result = await new AxeBuilder({ page })
				.options({
					runOnly: {
						type: "tag",
						values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
					},
					rules: { "label-content-name-mismatch": { enabled: true } },
				})
				.analyze();
			await testInfo.attach("无障碍明细", {
				body: JSON.stringify(result, null, 2),
				contentType: "application/json",
			});
			expect(
				result.violations.map(({ id, nodes }) => ({
					id,
					targets: nodes.map(({ target }) => target),
				})),
			).toEqual([]);
		});
	}
}

for (const route of [article, "posts/ashen-prologue/"]) {
	for (const theme of ["dark", "light"]) {
		test(`${route} ${theme} 只优先加载首屏可见封面`, async ({ page }) => {
			await page.addInitScript(
				(theme) => localStorage.setItem("theme", theme),
				theme,
			);
			await ready(page, route);
			const covers = page.locator(".post-page-theme-cover img[data-cover-img]");
			await expect(covers.locator("visible=true")).toHaveCount(1);
			await expect(covers.locator("visible=true")).toHaveAttribute(
				"loading",
				"eager",
			);
			await expect(covers.locator("visible=true")).toHaveAttribute(
				"fetchpriority",
				"high",
			);
			for (const hidden of await covers.locator("visible=false").all()) {
				await expect(hidden).toHaveAttribute("loading", "lazy");
				await expect(hidden).not.toHaveAttribute("fetchpriority", "high");
			}
		});
	}
}
