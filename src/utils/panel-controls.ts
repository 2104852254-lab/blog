type PanelOptions = {
	trigger: HTMLElement;
	menu?: boolean;
	ignore?: HTMLElement[];
	focusOnOpen?: () => HTMLElement | null | undefined;
	returnFocus?: () => HTMLElement | null | undefined;
	onClose?: () => void;
};

export type PanelController = {
	setOpen: (open: boolean, restoreFocus?: boolean) => void;
	destroy: () => void;
};

/** 搜索与主题面板共用焦点管理；只改交互状态，保留原有过渡动画。 */
export function createPanelController(
	panel: HTMLElement,
	options: PanelOptions,
): PanelController {
	const { trigger, menu, ignore = [] } = options;
	const isOpen = () => !panel.classList.contains("float-panel-closed");
	const items = () =>
		Array.from(
			panel.querySelectorAll<HTMLElement>(
				'[role="menuitem"], [role="menuitemradio"]',
			),
		);
	const setOpen = (open: boolean, restoreFocus = false): void => {
		const wasOpen = isOpen();
		panel.classList.toggle("float-panel-closed", !open);
		// 透明度只能隐藏外观；inert 同时移除键盘焦点和读屏访问。
		panel.inert = !open;
		panel.setAttribute("aria-hidden", String(!open));
		trigger.setAttribute("aria-expanded", String(open));
		if (!open && wasOpen) options.onClose?.();
		if (!open && restoreFocus) {
			(options.returnFocus?.() || trigger).focus({ preventScroll: true });
		}
	};
	trigger.setAttribute("aria-controls", panel.id);
	setOpen(isOpen());
	const toggle = (): void => {
		const open = !isOpen();
		setOpen(open);
		if (open) (options.focusOnOpen?.() || (menu ? items()[0] : null))?.focus();
	};
	const triggerKey = (event: KeyboardEvent): void => {
		if (!menu || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
		event.preventDefault();
		event.stopPropagation();
		setOpen(true);
		const list = items();
		(event.key === "ArrowUp" ? list.at(-1) : list[0])?.focus();
	};
	const menuKey = (event: KeyboardEvent): void => {
		if (!menu || !isOpen()) return;
		const list = items();
		if (!list.length) return;
		const current = list.indexOf(document.activeElement as HTMLElement);
		let next: number;
		switch (event.key) {
			case "ArrowDown":
				next = (current + 1) % list.length;
				break;
			case "ArrowUp":
				next = (current - 1 + list.length) % list.length;
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = list.length - 1;
				break;
			default:
				return;
		}
		event.preventDefault();
		list[next]?.focus();
	};
	const closeOnEscape = (event: KeyboardEvent): void => {
		if (event.key !== "Escape" || !isOpen()) return;
		event.preventDefault();
		setOpen(false, true);
	};
	const outside = (event: MouseEvent): void => {
		if (!isOpen()) return;
		const path = event.composedPath();
		if ([panel, trigger, ...ignore].some((element) => path.includes(element)))
			return;
		setOpen(false, panel.contains(document.activeElement));
	};
	const leave = (event: FocusEvent): void => {
		if (!isOpen()) return;
		const target = event.target as Node;
		if ([panel, trigger, ...ignore].some((element) => element.contains(target)))
			return;
		setOpen(false);
	};
	const beforeSwap = (): void => setOpen(false);
	trigger.addEventListener("click", toggle);
	trigger.addEventListener("keydown", triggerKey);
	panel.addEventListener("keydown", menuKey);
	document.addEventListener("keydown", closeOnEscape);
	document.addEventListener("click", outside);
	document.addEventListener("focusin", leave);
	document.addEventListener("astro:before-swap", beforeSwap);
	return {
		setOpen,
		destroy() {
			setOpen(false);
			trigger.removeEventListener("click", toggle);
			trigger.removeEventListener("keydown", triggerKey);
			panel.removeEventListener("keydown", menuKey);
			document.removeEventListener("keydown", closeOnEscape);
			document.removeEventListener("click", outside);
			document.removeEventListener("focusin", leave);
			document.removeEventListener("astro:before-swap", beforeSwap);
		},
	};
}
