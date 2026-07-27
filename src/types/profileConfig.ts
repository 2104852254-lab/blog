export type ProfileConfig = {
	/** 暗色主题或未设置亮色图片时使用的头像。 */
	avatar?: string;
	/** 亮色主题的备用头像；不填写时沿用 avatar。 */
	lightAvatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
		showName?: boolean;
	}[];
};
