# 写作与流程图

文章仍是 `src/content/posts` 中的 Markdown / MDX 文件。Front Matter 只提供 VSCode 的元数据表单；流程图是作者端的可编辑源文件，网站只显示普通图片，不增加在线画布。

## 一次配置，日常使用

这台电脑已安装官方稳定版 **Front Matter CMS 10.12.0**（`eliostruyf.vscode-front-matter`）。其他电脑在 VSCode 中打开整个 Firefly 文件夹，然后安装“工作区推荐”中的 Front Matter CMS 即可。仓库根目录的 `frontmatter.json` 已配置好，无需再生成一套配置。

在 VSCode 打开文章，点击 Front Matter 图标或运行 `Front Matter: Open dashboard`，即可编辑标题、发布日期、摘要、深浅色封面、分类和标签。正文继续直接写 Markdown。表单没列出的自定义字段留在原文件中，不要批量删除或重建文章头部。

## 新建文章：先草稿，再发布

先选一个长期不变的文件名；建议短小的英文名称，中文标题单独填写：

```powershell
pnpm new-post debugging-notes --title "我的调试记录"
```

它创建 `src/content/posts/debugging-notes.md`，默认 `draft: true`、作者“守夜人”，保留现有脚本的 slug 规则。需要分目录时用正斜杠，如 `notes/debugging-notes`；`.md` 和 `.mdx` 均支持。重名、越界路径和目录链接会被拒绝，不覆盖文章。省略 `--title` 时沿用文件名作为标题，可随后在表单修改。

也可以通过 Front Matter 的“新建内容”创建文章，字段默认值同样设为草稿；创建时生成的新文件名与 slug 以扩展显示的值为准。想明确控制永久地址时，优先用上述命令，然后使用表单编辑。

常用元数据示例（仅作参考，不要覆盖旧文章的完整头部）：

```yaml
---
title: "我的调试记录"
published: 2026-10-04
description: "这次观察到了什么，怎样验证。"
image: "../../assets/images/posts/cover.jpg"
lightImage: ""
category: "学习记录"
tags: ["调试", "复盘"]
draft: true
author: "守夜人"
slug: "debugging-notes"
---
```

`published` 是日期，不叫 `date`，日期不要加引号；`category` 是单个字符串，不是 `categories` 数组；`tags` 是字符串数组。封面是相对当前文章文件的源图片路径，上例假定文章直接位于 `src/content/posts`；分目录文章需增加相应的 `../`。浅色封面留空时沿用深色封面。

运行 `pnpm dev` 后，在 `http://localhost:4321/posts/debugging-notes/` 预览；开发环境可查看草稿，生产构建会排除草稿。若实际端口不是 4321，按终端显示的地址访问，并相应修改 `frontMatter.preview.host`。Front Matter 预览使用 `/posts/` 前缀；现有文章按已有 slug 访问，未指定 slug 时沿用当前 Astro 的文件标识。

发布前确认正文、图片与元数据，再将 `draft` 改为 `false`，运行 `pnpm check`、`pnpm type-check`、`pnpm build`。写作工具专项检查为 `node scripts/check-writing-tools.mjs`。提交和部署仍由你明确发起，Front Matter 的 Git 自动同步未启用。

## 旧文章地址保持不变

改标题不等于改地址。不要移动或改名已有文章，不要修改、删除或重算原有 `slug`。配置已关闭“文件名随 slug 对齐”，并隐藏“优化 slug”快捷操作；也不要手动使用扩展的 Smart rename。没有自动重命名、日期前缀或批量迁移步骤，已有自定义元数据不需要迁移。

## 可编辑调试流程图

源文件：[diagrams/debugging-flow.excalidraw](./diagrams/debugging-flow.excalidraw)；对应静态图片：[debugging-flow.svg](../src/assets/images/diagrams/debugging-flow.svg)。模板只提供“观察 → 假设 → 只改一项 → 验证 → 记录”的占位框，不代表任何实际项目已经验证成功。

1. 在 [Excalidraw](https://excalidraw.com) 的菜单中打开本地 `.excalidraw` 文件。保留模板，为具体文章另存为 `writing/diagrams/<名称>.excalidraw`。
2. 填写现象、条件、证据、一个待验证的改动及结果；结果不符时回到观察，保留失败证据。不要填写密钥、账号或敏感原始日志。
3. 保存可编辑源文件，再导出 SVG（或 PNG）到 `src/assets/images/diagrams/<名称>.svg`（或 `.png`）。导出时保留背景、选浅色画布；**关闭“嵌入场景 / Embed scene”**，避免把可编辑 JSON 一起放入公开图片。这里的静态示例使用固定浅色背景与深色文字，适合深浅色页面和独立图片查看。
4. 修改源图后重新导出同名图片；只保存 `.excalidraw` 不会自动更新网站图片。流程图没有专用构建依赖，也没有嵌入 React / 在线画布。

对直接位于 `src/content/posts` 的文章，可在正文复制：

```markdown
![调试流程：观察、假设、只改一项、验证、记录](../../assets/images/diagrams/debugging-flow.svg)
```

这是可复制的引用示例，不会自动给现有文章插入流程图或发布示例文章。分目录文章请按文章文件位置调整相对路径。导出的 SVG / PNG 与 `.excalidraw` 源文件分开保存；`writing` 不属于网站公开目录。

## 文章互相引用

文章正文可以引用另一篇公开文章。把 Wiki 引用单独放一段，会显示摘要卡片；放在句子中则显示普通链接：

```markdown
[[debugging-notes]]

接着看 [[debugging-notes|这次调试记录]]。

[这次调试记录](./debugging-notes.md#验证结果)
```

`debugging-notes` 使用目标文章已有的 slug；文件引用按当前文章所在目录填写。标题改了不必修改 slug。页面底部的“引用本文的文章”会自动列出引用它的公开文章，同一来源只列一次；没有引用时不显示空栏目。代码示例、图片和文章自身的引用不计入。

草稿和加密码文章不参与公开引用关系，也不生成摘要卡片。目标改成草稿或加密码后，引用卡片会消失；作者手动写在正文中的链接文字仍然属于正文，请不要在其中填写私密信息。站内已识别的文章链接会自动适配 Vercel 根路径和 Pages 的 `/blog/`，不需要写死域名。

专项检查：`node scripts/check-article-links.mjs`。真实浏览器引用检查：`pnpm test:article-links:browser`。连续构建的缓存回归检查：`node scripts/check-article-link-cache.mjs`；本地预览缓存检查在后面加 `--dev`。这些集成检查会临时创建自有测试文章，结束后清理，不修改真实文章；运行期间不要另开同一项目的构建。

浏览器和连续构建检查结束后，再运行 `pnpm build`，把 `dist` 恢复成真实文章的正式产物。双平台 CI 已按“引用专项检查 → 正式构建 → 全站回归”的顺序配置，临时文章不会进入部署产物。

## 官方参考

- [Front Matter 字段类型](https://frontmatter.codes/docs/content-creation/fields/)与[配置 Schema](https://frontmatter.codes/frontmatter.schema.json)
- [Front Matter 内容类型](https://frontmatter.codes/docs/content-creation/content-types/)与[稳定地址相关设置](https://frontmatter.codes/docs/content-creation/slug/)
- [Excalidraw 文件格式](https://docs.excalidraw.com/docs/codebase/json-schema)与[导出选项](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export)
