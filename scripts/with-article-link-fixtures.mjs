// 只在本地验证期间创建测试文章；结束后移除本脚本创建的文件，不碰真实正文。
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const posts = path.resolve("src/content/posts");
const fixtures = {
	"__link-fixture-target.md": `---
title: 反向链接验证目标
published: 2026-10-04
slug: __link-check-destination
draft: false
---

## 验证章节

这是一篇临时测试文章，不会上传。
`,
	"__link-fixture-source.mdx": `---
title: 反向链接验证来源
published: 2026-10-04
slug: __link-check-source
draft: false
---

这是普通引用：[验证目标](../__link-check-destination/#验证章节)。

[[__link-check-destination]]

再次引用 [[__link-check-destination|同一篇文章]]。

按文件引用：[按文件引用](./__link-fixture-target.md#验证章节)。

按参考引用：[按参考引用][same-target]。

[same-target]: ./__link-fixture-target.md?from=reference#验证章节

这两个目标不应泄露元信息：[[__link-check-draft]]、[[__link-check-locked]]。

代码示例不是文章引用：

\`\`\`md
[[ashen-prologue]]
\`\`\`
`,
	"__link-fixture-draft.md": `---
title: 不应泄露的草稿标题
description: DRAFT_PRIVATE_DESCRIPTION
published: 2026-10-04
slug: __link-check-draft
draft: true
---

[[__link-check-destination]]
`,
	"__link-fixture-locked.md": `---
title: 不应泄露的加密引用标题
description: LOCKED_PRIVATE_DESCRIPTION
published: 2026-10-04
slug: __link-check-locked
password: test-fixture-not-a-real-secret
draft: false
---

[[__link-check-destination]]
`,
};

const created = [];
let status = 1;
try {
	mkdirSync(posts, { recursive: true });
	// 若存在同名文件立即停止，绝不覆盖用户的文章。
	for (const name of Object.keys(fixtures)) {
		if (existsSync(path.join(posts, name))) throw new Error(`测试文件已存在：${name}`);
	}
	for (const [name, body] of Object.entries(fixtures)) {
		const target = path.join(posts, name);
		writeFileSync(target, body, { flag: "wx" });
		created.push(target);
	}
	const args = process.argv.slice(2);
	if (!args.length) throw new Error("请传入要运行的 Node 脚本及参数。");
	const result = spawnSync(process.execPath, args, {
		stdio: "inherit",
		env: { ...process.env, ARTICLE_LINK_FIXTURES: "1" },
	});
	if (result.error) throw result.error;
	status = result.status ?? 1;
} finally {
	for (const target of created) unlinkSync(target);
}
process.exitCode = status;
