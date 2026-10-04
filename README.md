<div align="center">
  <img src="./src/assets/images/theme/ashen-citadel.png" alt="余烬书库暗色主题预览" width="860" />

  # 余烬书库

  **在余烬与长夜之间，记录尚未熄灭的故事。**

  一个以技术实践、游戏见闻、阅读与随笔为内容的个人博客。
</div>

## 关于这座书库

这里收纳真实项目中的实践与排错，也记录值得反复回看的作品，以及那些不适合被压缩成一句话的思考。

它不急着给出答案；更希望成为一盏留在路边的小灯，让走过的弯路、偶然的灵感和仍在生长的问题，都能被再次找到。

## 内容与主题

- 文章：技术笔记、创作随笔、游戏与阅读记录。
- 主题：暗色为余烬与旧石，亮色为冰月与晨雪。
- 写作：保留过程、修正与不确定之处，优先清楚而诚实的表达。

## 本地运行

```bash
pnpm install
pnpm dev
```

启动后访问 `http://localhost:4321`。

## 常用位置

| 想修改的内容 | 文件位置 |
| --- | --- |
| 文章 | `src/content/posts/` |
| 关于页面正文 | `src/content/spec/about.md` |
| 站点名称、作者、主题 | `src/config/` |
| 暗色与亮色主题图片 | `src/assets/images/theme/` |
| 网站样式 | `src/styles/ashen-souls.css` |

## 部署

仓库保留了 GitHub Pages 工作流。将变更推送到默认分支后，可在仓库的 **Settings → Pages** 中选择 GitHub Actions 作为发布方式。

默认分支为 `master`，推送后 GitHub Pages 与 Vercel 自动构建。同一份代码会自动适配 Pages 的 `/blog/` 路径和 Vercel 的根路径。

- [Vercel 主站](https://blog-seven-tau-84.vercel.app/)：搜索引擎的主收录地址。
- [GitHub Pages 镜像](https://2104852254-lab.github.io/blog/)：可正常浏览、搜索与评论。
- 改域名时同步修改 `src/config/siteConfig.ts` 中的平台网址和 `canonical_url`，不要在文章中填写本地网址。

## 功能与配置

| 功能 | 配置或使用方式 |
| --- | --- |
| 评论 | `src/config/commentConfig.ts`，使用本仓库的 Giscus；仓库需开启 Discussions 并安装 [Giscus App](https://github.com/apps/giscus) |
| 评论归属 | 根据文章固定路径匹配，Vercel 和 Pages 共用评论；修改标题不改变评论归属 |
| RSS | 页面头部自动提供订阅地址；侧栏 RSS 按钮也支持两种部署路径 |
| 搜索 | 构建时由 Pagefind 生成索引；本地开发预览搜索需先执行 `pnpm build` |
| 文章封面 | frontmatter 中的 `image`；需要明暗两张图时填写不同的 `lightImage`，同一张实拍照片无需重复填写 |
| 背景与个人图片 | `backgroundWallpaper.ts`、`profileConfig.ts`；默认暗色，读者选择会保存 |
| 分享预览 | 自动使用文章封面，无封面时使用站点暗色图片 |
| 公告 | `src/config/announcementConfig.ts` |
| 音乐、相册、看板娘 | 功能代码保留，当前关闭；补充自己的素材后在对应配置中启用，不会自动恢复模板素材 |

使用说明参见 [Firefly 官方文档](https://docs-firefly.cuteleaf.cn/zh/) 和 [评论教程](https://docs-firefly.cuteleaf.cn/zh/guide/comment.html)。最新文档可能包含本仓库版本尚未提供的功能，请先确认对应组件是否存在。

## 发布前检查

```bash
pnpm check
pnpm type-check
pnpm build
pnpm test
```

检查 Pages 构建时，设置 `DEPLOY_TARGET=github-pages` 后执行构建，再运行 `node scripts/check-site.mjs /blog/`。检查脚本会验证正式链接、分享信息、RSS 与站点地图，防止子路径问题再次出现。

### 浏览器、性能与链接检查

这些工具只用于本地和 CI，不会增加访客下载的脚本。先构建，再运行：

```bash
pnpm exec playwright install chromium
pnpm test:browser
pnpm audit:performance
pnpm audit:links:local
pnpm audit:links
```

- **浏览器检查**：桌面和手机布局、主题保存、真实搜索及失败重试、沉浸阅读进出、键盘操作，以及明暗主题的自动无障碍扫描。报告在 `playwright-report/index.html`，包含截图；自动扫描不替代人工体验检查。
- **性能报告**：首页和平衡车文章各测三次，报告在 `reports/lighthouse/`。分数低于基线只提醒，不要求满分；保留本站原有动画。报告保存在本地或工作流附件，不上传公共报告服务。
- **链接检查**：需要安装 [lychee 0.24.2](https://github.com/lycheeverse/lychee/releases/tag/lychee-v0.24.2)，或用 `LYCHEE_BIN` 指定其可执行文件。站内资源和锚点离线严格检查；外部引用单独报告。403、429 和超时需复核，不会当作正常链接，也不因暂时限流阻止构建。

Windows PowerShell 检查 Pages 的完整路径：

```powershell
$env:DEPLOY_TARGET = "github-pages"
pnpm build
pnpm test
pnpm test:browser
pnpm audit:links:local
pnpm audit:performance
Remove-Item Env:DEPLOY_TARGET
```

切回 Vercel 根路径时，重新执行 `pnpm build`。不要对根路径产物运行 `/blog/` 测试，反之亦然。浏览器与性能检查会分别临时使用本地端口 4175、4176；若端口被占用，先关闭对应预览。

性能工具默认使用 Playwright 安装的 Chromium。Windows 如无法启动完整浏览器，可将 `CHROME_PATH` 指向 Playwright 安装的 `chrome-headless-shell.exe`；无需改网站代码。

推送后，**Build and Check** 工作流会分别检查 Vercel 与 Pages，并保留检查报告 14 天。新增检查与现有部署工作流独立运行，不会在本地自动上传。

## 致谢与许可

本项目是在 [Firefly](https://github.com/CuteLeaf/Firefly) 的基础上进行个人化改造而成；Firefly 的原始设计又参考并继承自 [Fuwari](https://github.com/saicaca/fuwari)。感谢这些开源项目及其贡献者。

项目代码继续遵循 [MIT License](./LICENSE)。原有许可证文件与应有的开源归属均被保留。

导航栏与浏览器标签的火焰图标来自 Google [Material Symbols](https://github.com/google/material-design-icons) 的 `local-fire-department-rounded`，仅调整配色；遵循 [Apache-2.0](./public/favicon/LICENSE-material-symbols.txt)。

本站的“余烬书库”视觉、文字和主题图片为本项目使用的原创内容；未使用任何游戏官方角色、商标或场景素材。

## 写作工具

VSCode Front Matter 元数据表单、新文章草稿流程和可编辑 Excalidraw 调试图模板，见[写作指南](./writing/README.md)。原有文章地址与自定义元数据无需迁移。
