import type { Live2DWidgetConfig, SpineModelConfig } from "../types/pioConfig";

// Spine 看板娘配置。模型资源已清理；填入自己的模型路径后再把 enable 改为 true。
export const spineModelConfig: SpineModelConfig = {
	enable: false,
	model: {
		path: "",
		scale: 1,
		x: 0,
		y: 0,
	},
	position: {
		corner: "bottom-left",
		offsetX: 0,
		offsetY: 0,
	},
	size: {
		width: 135,
		height: 165,
	},
	interactive: {
		enabled: true,
		clickAnimations: [],
		clickMessages: [],
		messageDisplayTime: 3000,
		idleAnimations: [],
		idleInterval: 8000,
	},
	responsive: {
		hideOnMobile: true,
		mobileBreakpoint: 768,
	},
	zIndex: 1000,
	opacity: 1,
};

// Live2D 看板娘配置。将自己的 model.json 路径加入 model 数组后再启用。
export const live2dWidgetConfig: Live2DWidgetConfig = {
	enable: false,
	model: [],
	position: "bottom-left",
	size: { width: 200, height: 200 },
	primaryColor: "var(--l2d-msg-bg)",
	transitionDuration: 1500,
	transitionType: "slide",
	menus: {
		items: [
			{ icon: "mdi:home", label: "返回首页", action: "home" },
			{ icon: "mdi:arrow-up", label: "返回顶部", action: "scrollToTop" },
			{ icon: "mdi:bed", label: "休眠", action: "sleep" },
			{ icon: "mdi:swap-horizontal", label: "切换模型", action: "switchModel" },
			{ icon: "mdi:github", label: "GitHub", action: "github" },
		],
		align: "right",
	},
	tips: {
		enable: true,
		welcomeMessage: ["你好呀！", "欢迎来到我的书库。"],
		messages: ["有需要帮忙的吗？", "记得按时休息。"],
		duration: 3000,
		interval: 6000,
		offset: { x: 0, y: 0 },
	},
	responsive: {
		hideOnMobile: true,
		mobileBreakpoint: 768,
	},
};
