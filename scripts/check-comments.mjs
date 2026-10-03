// 执行真正的评论脚本；DOM、可见性和网络边界由测试提供，不请求 GitHub。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync("src/components/comment/Giscus.astro", "utf8");
const script = source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "缺少评论加载脚本");
function fixture({
	visible = false,
	supportsObserver = true,
	query = "",
	sharedWindow,
} = {}) {
	const events = new Map();
	const add = (name, fn) => events.set(name, [...(events.get(name) || []), fn]);
	const observers = [];
	const children = [];
	const button = {
		hidden: false,
		addEventListener: add,
		removeEventListener() {},
	};
	const messages = [];
	const iframe = {
		contentWindow: {
			postMessage: (message, origin) => messages.push({ message, origin }),
		},
	};
	const container = {
		isConnected: true,
		classes: new Set(["giscus"]),
		dataset: {
			config: JSON.stringify({
				repo: "2104852254-lab/blog",
				mapping: "specific",
				term: "/posts/car",
				loading: "lazy",
			}),
		},
		querySelector: (selector) =>
			selector === "script"
				? children[0]
				: selector === "iframe"
					? iframe
					: null,
		appendChild: (child) => {
			children.push(child);
		},
		getBoundingClientRect: () => ({ top: visible ? 100 : 3000, bottom: 3300 }),
	};
	container.classList = {
		add: (name) => container.classes.add(name),
		remove: (name) => container.classes.delete(name),
		contains: (name) => container.classes.has(name),
	};
	class Observer {
		constructor(callback) {
			this.callback = callback;
			this.disconnected = false;
			observers.push(this);
		}
		observe(target) {
			this.target = target;
		}
		disconnect() {
			this.disconnected = true;
		}
	}
	const document = {
		documentElement: { classList: { contains: () => true }, clientHeight: 900 },
		getElementById: (id) => (id === "giscus-comments" ? container : button),
		createElement: () => ({
			attributes: {},
			listeners: new Map(),
			setAttribute(name, value) {
				this.attributes[name] = value;
			},
			addEventListener(name, callback) {
				this.listeners.set(name, callback);
			},
			remove() {
				children.splice(children.indexOf(this), 1);
			},
		}),
		addEventListener: add,
		removeEventListener: (name, fn) =>
			events.set(
				name,
				(events.get(name) || []).filter((item) => item !== fn),
			),
	};
	const window = sharedWindow || {
		innerHeight: 900,
		MutationObserver: Observer,
	};
	if (supportsObserver) window.IntersectionObserver = Observer;
	const context = {
		document,
		window,
		MutationObserver: Observer,
		IntersectionObserver: Observer,
		location: { search: query },
		URLSearchParams,
	};
	const run = () => runInNewContext(script, context);
	const emit = (name) =>
		events
			.get(name)
			?.slice()
			.forEach((fn) => {
				fn();
			});
	return {
		run,
		emit,
		observers,
		children,
		container,
		window,
		button,
		messages,
	};
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

const delayed = fixture();
delayed.run();
assert.equal(
	delayed.children.length,
	0,
	"远离评论区时不能立即请求外部评论脚本",
);
const visibility = delayed.observers.find(
	(item) => item.target === delayed.container,
);
assert.ok(visibility, "需要观察评论区可见性");
visibility.callback([{ isIntersecting: true }]);
await flush();
assert.equal(delayed.children.length, 1);
assert.equal(delayed.children[0].src, "https://giscus.app/client.js");
assert.equal(delayed.children[0].attributes["data-term"], "/posts/car");
assert.equal(delayed.children[0].attributes["data-theme"], "dark_dimmed");
assert.ok(visibility.disconnected);
delayed.emit("click");
assert.equal(delayed.children.length, 1, "手动加载不能重复挂载");
delayed.emit("astro:before-swap");
assert.ok(
	delayed.observers.every((item) => item.disconnected),
	"离开文章后清理全部监听",
);

const stale = fixture();
stale.run();
stale.emit("astro:before-swap");
stale.observers[0]?.callback([{ isIntersecting: true }]);
assert.equal(
	stale.children.length,
	0,
	"切页后的旧观察回调不能加载上一篇文章的评论",
);

const manual = fixture({ supportsObserver: false });
manual.run();
assert.equal(manual.children.length, 0, "无观察器时允许读者手动加载，不抢首屏");
manual.emit("click");
await flush();
assert.equal(manual.children.length, 1);

const retry = fixture({ supportsObserver: false });
retry.run();
retry.emit("click");
await flush();
const oldThemeObserver = retry.observers[0];
retry.children[0].listeners.get("error")();
assert.equal(retry.children.length, 0, "失败的脚本应移除，允许再次请求");
assert.equal(retry.button.hidden, false, "加载失败后保留手动重试入口");
assert.ok(
	oldThemeObserver.disconnected,
	"重试前断开旧主题观察器，避免重复发送消息",
);
retry.emit("click");
await flush();
assert.equal(retry.children.length, 1);
retry.observers.at(-1).callback();
assert.equal(retry.messages.length, 1);
assert.equal(retry.messages[0].origin, "https://giscus.app");
assert.equal(retry.messages[0].message.giscus.setConfig.theme, "dark_dimmed");
retry.emit("astro:before-swap");
assert.ok(retry.observers.every((item) => item.disconnected));

// 官方客户端执行时全局查找 .giscus；A 下载未完成时，B 不能成为它的挂载目标。
const articleA = fixture({ supportsObserver: false });
articleA.run();
articleA.emit("click");
await flush();
const pendingA = articleA.children[0];
articleA.emit("astro:before-swap");
articleA.container.isConnected = false;
const articleB = fixture({
	supportsObserver: false,
	sharedWindow: articleA.window,
});
articleB.run();
articleB.emit("click");
await flush();
assert.equal(
	articleB.children.length,
	0,
	"上一篇脚本未执行完成前，不启动会互相覆盖的客户端",
);
assert.equal(
	articleB.container.classList.contains("giscus"),
	false,
	"迟到的客户端不能匹配新文章的评论区",
);
pendingA.listeners.get("load")();
await flush();
assert.equal(articleB.children.length, 1, "旧客户端完成后正常加载新文章");
assert.equal(articleB.container.classList.contains("giscus"), true);
articleB.children[0].listeners.get("load")();
await flush();
assert.equal(
	articleB.button.disabled,
	false,
	"客户端成功后仍保留可用的重新加载入口",
);
articleB.emit("click");
await flush();
assert.equal(
	articleB.children.length,
	1,
	"手动重新加载替换旧请求，不重复保留脚本",
);
articleB.emit("astro:before-swap");
console.log("✓ 评论可见时加载、手动重试、主题同步、去重和切页清理");
