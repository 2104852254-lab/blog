import type { SidebarLayoutConfig } from "../types/sidebarConfig";

/**
 * 单侧栏布局让正文成为视觉中心；演示站的小组件仅保留博客必需项。
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	enable: true,
	position: "right",
	tabletSidebar: "right",
	hideSidebarOnPostPage: false,
	showBothSidebarsOnPostPage: false,
	leftComponents: [],
	rightComponents: [
		{
			type: "profile",
			enable: true,
			position: "top",
			showOnPostPage: false,
		},
		{
			type: "announcement",
			enable: true,
			position: "top",
			showOnPostPage: false,
		},
		{
			type: "categories",
			enable: true,
			position: "sticky",
			showOnPostPage: false,
			specificConfig: {
				collapseThreshold: 6,
			},
		},
		{
			type: "tags",
			enable: true,
			position: "sticky",
			showOnPostPage: false,
			specificConfig: {
				collapseThreshold: 12,
			},
		},
		{
			type: "sidebarToc",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
			hideOnNonPostPage: true,
		},
	],
	mobileBottomComponents: [
		{
			type: "profile",
			enable: true,
			showOnPostPage: false,
		},
		{
			type: "announcement",
			enable: true,
			showOnPostPage: false,
		},
		{
			type: "categories",
			enable: true,
			showOnPostPage: false,
			specificConfig: {
				collapseThreshold: 6,
			},
		},
		{
			type: "tags",
			enable: true,
			showOnPostPage: false,
			specificConfig: {
				collapseThreshold: 12,
			},
		},
	],
};
