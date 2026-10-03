// 用轻量 DOM 边界执行真实控制器，不模拟 Svelte 内部实现。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { tsImport } from "tsx/esm/api";

const module = await tsImport(
	"../src/utils/panel-controls.ts",
	import.meta.url,
).catch(() => null);
assert.ok(
	module?.createPanelController,
	"缺少让面板同步焦点和可访问状态的控制器",
);
class Target {
	listeners = new Map();
	addEventListener(name, fn) {
		this.listeners.set(name, [...(this.listeners.get(name) || []), fn]);
	}
	removeEventListener(name, fn) {
		this.listeners.set(
			name,
			(this.listeners.get(name) || []).filter((item) => item !== fn),
		);
	}
	emit(name, values = {}) {
		const event = {
			target: this,
			preventDefault() {
				this.prevented = true;
			},
			stopPropagation() {},
			...values,
		};
		this.listeners
			.get(name)
			?.slice()
			.forEach((fn) => {
				fn(event);
			});
		return event;
	}
}
const document = new Target();
globalThis.document = document;
class Element extends Target {
	attributes = {};
	inert = false;
	items = [];
	classes = new Set();
	classList = {
		contains: (name) => this.classes.has(name),
		toggle: (name, force = !this.classes.has(name)) => {
			force ? this.classes.add(name) : this.classes.delete(name);
		},
	};
	constructor(id = "") {
		super();
		this.id = id;
	}
	setAttribute(name, value) {
		this.attributes[name] = String(value);
	}
	contains(target) {
		return target === this || this.items.includes(target);
	}
	querySelectorAll() {
		return this.items;
	}
	focus() {
		document.activeElement = this;
		document.emit("focusin", { target: this });
	}
}
const panel = new Element("theme-mode-panel");
panel.classes.add("float-panel-closed");
const trigger = new Element("scheme-switch");
panel.items = [new Element(), new Element(), new Element()];
const control = module.createPanelController(panel, { trigger, menu: true });
assert.equal(panel.inert, true, "关闭菜单不能让看不见的按钮进入 Tab 序列");
assert.equal(trigger.attributes["aria-expanded"], "false");
trigger.emit("keydown", { key: "ArrowDown" });
assert.equal(panel.inert, false);
assert.equal(trigger.attributes["aria-expanded"], "true");
assert.equal(document.activeElement, panel.items[0]);
panel.emit("keydown", { key: "ArrowUp", target: panel.items[0] });
assert.equal(document.activeElement, panel.items[2], "菜单方向键应循环");
panel.emit("keydown", { key: "Home", target: panel.items[2] });
assert.equal(document.activeElement, panel.items[0]);
panel.emit("keydown", { key: "End", target: panel.items[0] });
assert.equal(document.activeElement, panel.items[2]);
document.emit("keydown", { key: "Escape" });
assert.equal(panel.inert, true);
assert.equal(document.activeElement, trigger, "Esc 恢复打开菜单的按钮焦点");
trigger.emit("click");
document.emit("click", {
	target: new Element(),
	composedPath: () => [panel.items[0], panel],
});
assert.equal(panel.inert, false, "被更新掉的按钮仍属面板内点击");
new Element().focus();
assert.equal(panel.inert, true, "Tab 离开菜单后关闭，不把焦点拉回来");
assert.notEqual(document.activeElement, trigger);
control.destroy();
trigger.emit("click");
assert.equal(panel.inert, true, "卸载后不残留监听");

const searchPanel = new Element("search-panel");
searchPanel.classes.add("float-panel-closed");
const searchButton = new Element();
const mobileInput = new Element();
searchPanel.items = [mobileInput];
const desktopInput = new Element();
let cancelled = 0;
let desktop = false;
const search = module.createPanelController(searchPanel, {
	trigger: searchButton,
	focusOnOpen: () => mobileInput,
	returnFocus: () => (desktop ? desktopInput : searchButton),
	ignore: [desktopInput],
	onClose: () => {
		cancelled++;
	},
});
searchButton.emit("click");
assert.equal(document.activeElement, mobileInput, "手机打开搜索后直接输入");
document.emit("keydown", { key: "Escape" });
assert.equal(document.activeElement, searchButton);
assert.equal(cancelled, 1);
desktop = true;
desktopInput.focus();
search.setOpen(true);
assert.equal(
	document.activeElement,
	desktopInput,
	"输入时打开结果不能偷走焦点",
);
document.emit("keydown", { key: "Escape" });
assert.equal(
	document.activeElement,
	desktopInput,
	"桌面 Escape 回到搜索输入框",
);
search.setOpen(true);
document.emit("astro:before-swap");
assert.equal(searchPanel.inert, true, "切页应关闭面板并取消旧搜索");
assert.equal(cancelled, 3);
search.destroy();

// 执行真实的重试动作：先将焦点交给常驻输入框，再移除会被更新掉的重试按钮。
const searchSource = readFileSync(
	"src/components/controls/Search.svelte",
	"utf8",
);
const retryAction = searchSource.match(
	/const retrySearch = \(\): void => \{[\s\S]*?\n\};/,
)?.[0];
assert.ok(retryAction, "搜索重试缺少输入框焦点恢复");
for (const activeDesktop of [true, false]) {
	const calls = [];
	runInNewContext(
		`${retryAction.replace("(): void =>", "() =>")}; retrySearch();`,
		{
			activeDesktop,
			keywordDesktop: "PID",
			keywordMobile: "调试",
			desktopInput: { focus: () => calls.push("desktop") },
			mobileInput: { focus: () => calls.push("mobile") },
			search: (query, desktop, retry) => calls.push([query, desktop, retry]),
		},
	);
	assert.deepEqual(calls, [
		activeDesktop ? "desktop" : "mobile",
		[activeDesktop ? "PID" : "调试", activeDesktop, true],
	]);
}
console.log("✓ 面板初始关闭、方向键、Esc、焦点恢复、手机聚焦及切页清理");
