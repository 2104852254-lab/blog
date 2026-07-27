import type { MusicPlayerConfig } from "../types/musicConfig";

export const musicPlayerConfig: MusicPlayerConfig = {
	// 打开其中一个开关后，音乐播放器才会显示。
	showInNavbar: false,
	showInSidebar: false,

	// "meting" 使用在线歌单；"local" 使用 public/assets/music/ 中的本地文件。
	mode: "meting",
	volume: 0.7,
	playMode: "list",
	showLyrics: true,

	meting: {
		api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		server: "netease",
		type: "playlist",
		// 填入自己的歌单、专辑或歌曲 ID 后再开启播放器。
		id: "",
		auth: "",
		fallbackApis: [
			"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		],
	},

	local: {
		// 放入自己的音乐后，按下面格式添加歌曲；现在没有保留模板音乐。
		playlist: [],
	},
};
