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

## 致谢与许可

本项目是在 [Firefly](https://github.com/CuteLeaf/Firefly) 的基础上进行个人化改造而成；Firefly 的原始设计又参考并继承自 [Fuwari](https://github.com/saicaca/fuwari)。感谢这些开源项目及其贡献者。

项目代码继续遵循 [MIT License](./LICENSE)。原有许可证文件与应有的开源归属均被保留。

本站的“余烬书库”视觉、文字和主题图片为本项目使用的原创内容；未使用任何游戏官方角色、商标或场景素材。
