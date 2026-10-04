import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function ready(page) {
	await page.goto("");
	await page.waitForFunction(
		() => !document.querySelector('astro-island[client="load"][ssr]'),
	);
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(
			[...document.querySelectorAll(".post-card-image img")].map((image) =>
				image.decode().catch(() => {}),
			),
		);
	});
	// 截图等待现有有限入场动画结束，保留无限飘灰效果与全部网站动画。
	await page.evaluate(async () => {
		await Promise.allSettled(
			document
				.getAnimations()
				.filter((animation) =>
					Number.isFinite(animation.effect?.getComputedTiming().endTime),
				)
				.map((animation) => animation.finished),
		);
	});
}

// Removing the pinned/catalog split would duplicate or misplace the opener.
test("首页卷首与目录各自链接真实文章，不重复置顶内容", async ({
	page,
	baseURL,
}) => {
	await ready(page);
	const opener = page.getByRole("region", { name: "卷首", exact: true });
	const catalog = page.getByRole("region", { name: "书库目录", exact: true });
	await expect(opener).toBeVisible();
	await expect(catalog).toBeVisible();
	const openerPath = new URL("posts/ashen-prologue/", baseURL).pathname;
	await expect(
		opener.locator(`.post-card-title[href="${openerPath}"]`),
	).toHaveCount(1);
	await expect(
		catalog.locator(`.post-card-title[href="${openerPath}"]`),
	).toHaveCount(0);
	const articleLink = catalog.locator(
		`.post-card-title[href="${new URL("posts/balancing-car-learning-and-debugging/", baseURL).pathname}"]`,
	);
	await expect(articleLink).toHaveCount(1);
	await expect(articleLink).toHaveAttribute(
		"href",
		new URL("posts/balancing-car-learning-and-debugging/", baseURL).pathname,
	);
	await articleLink.focus();
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(
		new URL("posts/balancing-car-learning-and-debugging/", baseURL).href,
	);
	await expect(page.locator("#post-container")).toBeVisible();
});

for (const theme of ["dark", "light"]) {
	for (const layout of ["list", "grid"]) {
		// contain 会缩成带留白的小图；卷首单独放大会破坏列表封面的统一比例。
		test(`首页 ${theme} ${layout} 封面填满，列表封面框一致`, async ({
			page,
			isMobile,
		}) => {
			await page.addInitScript(
				({ theme, layout }) => {
					localStorage.setItem("theme", theme);
					localStorage.setItem("postListLayout", layout);
				},
				{ theme, layout },
			);
			await ready(page);
			const covers = await page
				.locator(".home-archive .post-card-image")
				.evaluateAll((elements) =>
					elements.map((element) => {
						const frame = element.getBoundingClientRect();
						const themeCover = [
							...element.querySelectorAll(".post-card-theme-cover"),
						].find((cover) => getComputedStyle(cover).visibility !== "hidden");
						const image = themeCover.querySelector("img");
						const box = image.getBoundingClientRect();
						const fit = getComputedStyle(image).objectFit;
						const scale =
							fit === "cover"
								? Math.max(
										box.width / image.naturalWidth,
										box.height / image.naturalHeight,
									)
								: Math.min(
										box.width / image.naturalWidth,
										box.height / image.naturalHeight,
									);
						const paintedWidth = image.naturalWidth * scale;
						const paintedHeight = image.naturalHeight * scale;
						return {
							width: frame.width,
							height: frame.height,
							radius: getComputedStyle(element).borderTopRightRadius,
							loaded: image.naturalWidth > 0,
							fit,
							imageBox: {
								x: box.x,
								y: box.y,
								width: box.width,
								height: box.height,
							},
							frame: {
								x: frame.x,
								y: frame.y,
								right: frame.right,
								bottom: frame.bottom,
							},
							paint: {
								x: box.x + (box.width - paintedWidth) / 2,
								y: box.y + (box.height - paintedHeight) / 2,
								right: box.x + (box.width + paintedWidth) / 2,
								bottom: box.y + (box.height + paintedHeight) / 2,
							},
						};
					}),
				);
			expect(covers.length).toBeGreaterThanOrEqual(2);
			for (const cover of covers) {
				expect(cover.loaded).toBe(true);
				expect(cover.fit).toBe("cover");
				expect(Math.abs(cover.imageBox.x - cover.frame.x)).toBeLessThan(1);
				expect(Math.abs(cover.imageBox.y - cover.frame.y)).toBeLessThan(1);
				expect(Math.abs(cover.imageBox.width - cover.width)).toBeLessThan(1);
				expect(Math.abs(cover.imageBox.height - cover.height)).toBeLessThan(1);
				expect(cover.paint.x).toBeLessThanOrEqual(cover.frame.x + 1);
				expect(cover.paint.y).toBeLessThanOrEqual(cover.frame.y + 1);
				expect(cover.paint.right).toBeGreaterThanOrEqual(cover.frame.right - 1);
				expect(cover.paint.bottom).toBeGreaterThanOrEqual(cover.frame.bottom - 1);
			}
			if (!isMobile && layout === "list") {
				for (const cover of covers.slice(1)) {
					expect(Math.abs(cover.width - covers[0].width)).toBeLessThan(2);
					expect(Math.abs(cover.height - covers[0].height)).toBeLessThan(2);
					expect(cover.radius).toBe(covers[0].radius);
				}
			}
		});

		test(`首页 ${theme} ${layout} 封面与长标题不重叠，切换主题不移动卡片`, async ({
			page,
			isMobile,
		}, testInfo) => {
			await page.addInitScript(
				({ theme, layout }) => {
					localStorage.setItem("theme", theme);
					localStorage.setItem("postListLayout", layout);
				},
				{ theme, layout },
			);
			await ready(page);
			const cards = page.locator(".home-archive .post-card-wrapper");
			expect(await cards.count()).toBeGreaterThanOrEqual(2);
			for (const card of await cards.all()) {
				await card.evaluate(async (element) => {
					await Promise.allSettled(
						element.getAnimations().map((animation) => animation.finished),
					);
				});
				const boxes = await card.evaluate((element) => {
					const title = element
						.querySelector(".post-card-title")
						.getBoundingClientRect();
					const cover = element
						.querySelector(".post-card-image")
						?.getBoundingClientRect();
					return {
						title: { x: title.x, y: title.y, right: title.right },
						cover: cover && { x: cover.x, bottom: cover.bottom },
					};
				});
				if (boxes.cover) {
					if (
						isMobile ||
						(layout === "grid" &&
							!(await card.getAttribute("class")).includes("pinned"))
					) {
						expect(boxes.title.y).toBeGreaterThanOrEqual(
							boxes.cover.bottom - 1,
						);
					} else {
						expect(boxes.title.right).toBeLessThanOrEqual(boxes.cover.x + 1);
					}
				} else {
					await expect(card.locator(".post-card-enter-btn")).toBeVisible();
				}
			}
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth + 1,
				),
			).toBe(true);
			await mkdir(".scratch/home-archive-previews", { recursive: true });
			await testInfo.attach("首页书库样稿", {
				body: await page.screenshot({
					path: `.scratch/home-archive-previews/${testInfo.project.name}-${theme}-${layout}.png`,
					fullPage: true,
				}),
				contentType: "image/png",
			});
			const before = await cards.first().boundingBox();
			await page.locator("#scheme-switch").click();
			await page
				.getByRole("menuitemradio", {
					name: theme === "dark" ? "亮色" : "暗色",
					exact: true,
				})
				.click();
			await expect(page.locator("html")).toHaveClass(
				theme === "dark" ? /^(?!.*\bdark\b).*$/ : /dark/,
			);
			const after = await cards.first().boundingBox();
			expect(Math.abs(after.y - before.y)).toBeLessThan(2);
			expect(Math.abs(after.height - before.height)).toBeLessThan(2);
		});
	}
}

test("首页日期没有被旧列表样式缩小到难读", async ({ page }) => {
	await page.addInitScript(() =>
		localStorage.setItem("postListLayout", "list"),
	);
	await ready(page);
	for (const date of await page
		.locator(".home-archive .post-meta-root .text-sm")
		.all()) {
		const visibleFontSize = await date.evaluate(
			(element) =>
				(parseFloat(getComputedStyle(element).fontSize) *
					element.getBoundingClientRect().height) /
				element.offsetHeight,
		);
		expect(visibleFontSize).toBeGreaterThanOrEqual(11.9);
	}
});

for (const theme of ["dark", "light"]) {
	test(`窄屏首页 ${theme} 保持标题、链接和封面在屏幕内`, async ({
		page,
		isMobile,
	}) => {
		test.skip(!isMobile, "窄屏检查仅在移动设备项目运行");
		await page.addInitScript(
			(value) => localStorage.setItem("theme", value),
			theme,
		);
		await ready(page);
		for (const width of [320, 375, 430]) {
			await page.setViewportSize({ width, height: 850 });
			await expect
				.poll(() =>
					page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth + 1,
					),
				)
				.toBe(true);
			for (const title of await page
				.locator(".home-archive .post-card-title")
				.all()) {
				const box = await title.boundingBox();
				expect(box.x).toBeGreaterThanOrEqual(0);
				expect(box.x + box.width).toBeLessThanOrEqual(width);
			}
		}
	});
}
