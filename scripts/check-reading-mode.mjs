// 执行真实产物的阅读脚本；模拟的只是浏览器 DOM、滚动和事件边界。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync("dist/posts/ashen-prologue/index.html", "utf8");
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(
	([, content]) => content.includes("initImmersiveReading"),
)?.[1];
assert.ok(script, "缺少沉浸阅读脚本");
const classes = new Set();
const classList = {
	add: (...names) =>
		names.forEach((name) => {
			classes.add(name);
		}),
	remove: (...names) =>
		names.forEach((name) => {
			classes.delete(name);
		}),
	contains: (name) => classes.has(name),
	toggle(name, force = !classes.has(name)) {
		force ? classes.add(name) : classes.delete(name);
		return force;
	},
};
const attributes = {};
const button = {
	setAttribute: (name, value) => {
		attributes[name] = value;
	},
	focus() {},
};
const entry = {
	hidden: true,
	classList: { toggle() {} },
	querySelector: () => button,
};
const toc = { ...entry };
let article = { getBoundingClientRect: () => ({ top: -200 }) };
const events = new Map();
const addEventListener = (name, handler) => {
	events.set(name, [...(events.get(name) || []), handler]);
};
const emit = (name, event = {}) =>
	events.get(name)?.forEach((handler) => {
		handler(event);
	});
const window = {
	innerWidth: 1440,
	scrollY: 800,
	addEventListener,
	scrollTo({ top }) {
		this.scrollY = top;
	},
};
const document = {
	readyState: "complete",
	addEventListener,
	documentElement: { classList, dataset: {} },
	getElementById: (id) =>
		({
			"post-container": article,
			"immersive-reading-toggle": entry,
			"immersive-toc-toggle": toc,
		})[id],
};
const context = { window, document };
const click = (id) =>
	emit("click", {
		target: { closest: (selector) => (selector === `#${id}` ? entry : null) },
	});
runInNewContext(script, context);
assert.equal(entry.hidden, false);
assert.equal(classes.has("immersive-reading"), false, "默认不能自动进入");
click("immersive-reading-toggle");
assert.ok(classes.has("immersive-reading"));
assert.ok(classes.has("immersive-toc-open"));
click("immersive-toc-toggle");
assert.equal(classes.has("immersive-toc-open"), false);
window.scrollY = 1200;
emit("keydown", { key: "Escape" });
assert.equal(classes.has("immersive-reading"), false);
assert.equal(window.scrollY, 800, "退出应恢复进入前的阅读位置");
click("immersive-reading-toggle");
window.innerWidth = 430;
emit("resize");
assert.equal(classes.has("immersive-reading"), false);
assert.equal(entry.hidden, true, "手机不应显示桌面阅读入口");
window.innerWidth = 1440;
emit("resize");
click("immersive-reading-toggle");
window.scrollY = 1500;
emit("astro:before-swap");
assert.equal(classes.has("immersive-reading"), false);
assert.equal(window.scrollY, 1500, "切页不能恢复旧文章的滚动位置");
article = null;
emit("astro:page-load");
assert.equal(entry.hidden, true);
runInNewContext(script, context);
assert.equal(events.get("click").length, 1, "切页不能重复绑定点击处理");
console.log("✓ 阅读按钮、目录、Esc、手机退出和切页清理");
