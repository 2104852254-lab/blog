import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "旅人告示",

	// 公告内容
	content:
		"这里收录技术札记、游戏见闻与长夜里的零散思考。愿你能在此找到一束可带走的微光。",

	// 是否允许用户关闭公告
	closable: true,

	link: {
		// 启用链接
		enable: true,
		// 链接文本
		text: "阅读序章",
		// 链接 URL
		url: "/about/",
		// 内部链接
		external: false,
	},
};
