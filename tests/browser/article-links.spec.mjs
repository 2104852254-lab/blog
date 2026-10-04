import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// 普通构建没有临时文章；完整功能验证由 with-article-link-fixtures.mjs 驱动。
test.skip(process.env.ARTICLE_LINK_FIXTURES !== "1", "本轮没有创建临时引用文章");

for (const theme of ["dark", "light"]) {
	test(`反向链接 ${theme}：去重、隐私、双路径和真实切页`, async ({ page, baseURL }, testInfo) => {
		await page.route("https://giscus.app/**", (route) => route.abort());
		await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
		const target = new URL("posts/__link-check-destination/", baseURL);
		const source = new URL("posts/__link-check-source/", baseURL);
		await page.goto(target.href);
		await expect(page.locator("#post-container")).toBeVisible();
		const section = page.getByRole("region", { name: "引用本文的文章", exact: true });
		await expect(section).toBeVisible();
		const reference = section.getByRole("link", { name: /反向链接验证来源/ });
		await expect(reference).toHaveCount(1);
		await expect(reference).toHaveAttribute("href", source.pathname);
		await expect(section).not.toContainText("不应泄露");
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
		const result = await new AxeBuilder({ page }).include('[aria-label="引用本文的文章"]').analyze();
		expect(result.violations).toEqual([]);
		await section.scrollIntoViewIfNeeded();
		await testInfo.attach("反向链接预览", { body: await page.screenshot(), contentType: "image/png" });
		await reference.focus();
		await expect(reference).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(source.href);
		await expect(page.locator("#post-container")).toBeVisible();
		const body = page.locator("#post-container");
		await expect(body).not.toContainText("DRAFT_PRIVATE_DESCRIPTION");
		await expect(body).not.toContainText("LOCKED_PRIVATE_DESCRIPTION");
		await expect(body).not.toContainText("不应泄露的草稿标题");
		await expect(body).not.toContainText("不应泄露的加密引用标题");
		const card = body.locator("a.card-wiki-link");
		await expect(card).toHaveCount(1);
		await expect(card).toHaveAttribute("href", target.pathname);
		for (const name of ["按文件引用", "按参考引用"]) {
			const link = body.getByRole("link", { name, exact: true });
			const destination = new URL(await link.getAttribute("href"), source);
			expect(destination.pathname).toBe(target.pathname);
			expect(destination.hash).toBe("#%E9%AA%8C%E8%AF%81%E7%AB%A0%E8%8A%82");
			if (name === "按参考引用") expect(destination.search).toBe("?from=reference");
		}
		await card.click();
		await expect(page).toHaveURL(target.href);
		await expect(section).toBeVisible();
	});
}
