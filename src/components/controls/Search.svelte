<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { navigateToPage } from "@utils/navigation-utils";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import {
	createPanelController,
	type PanelController,
} from "@/utils/panel-controls";
import { url as formatUrl, getSearchUrl } from "@/utils/url-utils";

// --- State ---
let keywordDesktop = "";
let keywordMobile = "";
let result: SearchResult[] = [];
let isSearching = false;
let searchFailed = false;
let searchRequest = 0;
let activeDesktop = true;
let debounceTimer: NodeJS.Timeout;
let panelControl: PanelController | undefined;
let desktopInput: HTMLInputElement;
let mobileInput: HTMLInputElement;
let searchButton: HTMLButtonElement;
let searchPanel: HTMLDivElement;

// --- Mocks for Dev Mode ---
const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/"),
		meta: { title: "This Is a Fake Search Result" },
		excerpt:
			"Because Pagefind cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: formatUrl("/"),
		meta: { title: "If You Want to Test the Search" },
		excerpt: "Try running <mark>npm build && npm preview</mark> instead.",
	},
];

// --- UI Logic ---
const setPanelVisibility = (show: boolean): void => {
	panelControl?.setOpen(show);
};

const resetSearch = (): void => {
	clearTimeout(debounceTimer);
	searchRequest++;
	isSearching = false;
	searchFailed = false;
	keywordDesktop = "";
	keywordMobile = "";
	result = [];
};
const closeSearchPanel = (): void => {
	resetSearch();
	setPanelVisibility(false);
};

const handleResultClick = (event: Event, url: string): void => {
	event.preventDefault();
	closeSearchPanel();
	navigateToPage(url);
};

// --- Core Search Logic ---
const retrySearch = (): void => {
	(activeDesktop ? desktopInput : mobileInput).focus({ preventScroll: true });
	void search(
		activeDesktop ? keywordDesktop : keywordMobile,
		activeDesktop,
		true,
	);
};

const search = async (
	keyword: string,
	isDesktop: boolean,
	retry = false,
): Promise<void> => {
	const request = ++searchRequest;
	clearTimeout(debounceTimer);
	activeDesktop = isDesktop;
	searchFailed = false;
	if (!keyword.trim()) {
		// 手机清空输入仍能继续打字；桌面无关键词时收起结果。
		setPanelVisibility(!isDesktop);
		result = [];
		isSearching = false;
		return;
	}

	isSearching = true;
	setPanelVisibility(true);

	debounceTimer = setTimeout(async () => {
		try {
			let searchResults: SearchResult[] = [];

			if (import.meta.env.PROD) {
				const pagefind = await window.loadPagefind?.(retry);
				if (!pagefind) throw new Error("搜索加载入口不可用");
				const response = await pagefind.search(keyword.trim());
				searchResults = await Promise.all(
					response.results.map((item) => item.data()),
				);
			} else if (import.meta.env.DEV) {
				searchResults = fakeResult;
			}

			// 输入变更或离开页面后，旧请求不能覆盖新结果。
			if (request !== searchRequest) return;
			result = searchResults;
			setPanelVisibility(true);
		} catch (error) {
			if (request !== searchRequest) return;
			console.error("Search error:", error);
			result = [];
			searchFailed = true;
		} finally {
			if (request === searchRequest) isSearching = false;
		}
	}, 300); // 300ms debounce
};

// 离开页面时取消防抖，并让仍在下载的旧请求失效。
onMount(() => {
	const desktopBar = document.getElementById("search-bar");
	panelControl = createPanelController(searchPanel, {
		trigger: searchButton,
		ignore: desktopBar ? [desktopBar] : [],
		focusOnOpen: () => {
			activeDesktop = false;
			return mobileInput;
		},
		returnFocus: () => (activeDesktop ? desktopInput : searchButton),
		onClose: resetSearch,
	});
	return () => {
		panelControl?.destroy();
		clearTimeout(debounceTimer);
		searchRequest++;
	};
});
</script>

<!-- search bar for desktop view -->
<div id="search-bar" class="hidden lg:flex transition-all items-center h-11 mr-2 rounded-lg
      bg-black/4 hover:bg-black/6 focus-within:bg-black/6
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
">
    <Icon icon="material-symbols:search"
          class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
    <input placeholder="{i18n(I18nKey.search)}" bind:value={keywordDesktop} bind:this={desktopInput}
           aria-label={i18n(I18nKey.search)}
           on:input={(event) => search(event.currentTarget.value, true)}
           on:focus={() => search(keywordDesktop, true)}
           class="transition-all pl-10 text-sm bg-transparent outline-0
         h-full w-40 active:w-60 focus:w-60 text-black/50 dark:text-white/50"
    >
</div>

<!-- toggle btn for phone/tablet view -->
<button bind:this={searchButton} aria-label={i18n(I18nKey.search)} aria-expanded="false" aria-controls="search-panel" id="search-switch"
        class="btn-plain scale-animation lg:hidden! rounded-lg w-9 h-9 md:w-11 md:h-11 active:scale-90">
    <Icon icon="material-symbols:search" class="text-[1.25rem]"></Icon>
</button>

<!-- search panel -->
<div id="search-panel" bind:this={searchPanel} inert aria-hidden="true" class="float-panel float-panel-closed search-panel absolute md:w-120
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">

    <!-- search bar inside panel for phone/tablet -->
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/4 hover:bg-black/6 focus-within:bg-black/6
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
        <Icon icon="material-symbols:search"
              class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder={i18n(I18nKey.search)} bind:value={keywordMobile} bind:this={mobileInput}
               aria-label={i18n(I18nKey.search)}
               on:input={(event) => search(event.currentTarget.value, false)}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>

    <!-- search results -->
    {#if isSearching}
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-lg px-3 py-2 text-50">
            {i18n(I18nKey.searchLoading)}
        </div>
    {:else if searchFailed}
        <div role="alert" class="rounded-xl px-3 py-3 text-75">
            <p>搜索暂时不可用，请检查网络后重试。</p>
            <button class="btn-regular rounded-lg px-3 py-1 mt-2"
                    on:click={retrySearch}>重试</button>
        </div>
    {:else if result.length > 0}
        {#each result.slice(0, 5) as item}
            <a href={item.url}
               on:click={(e) => handleResultClick(e, item.url)}
               class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block
           rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active)">
                <div class="transition text-90 inline-flex font-bold group-hover:text-(--primary)">
                    {@html item.meta.title}
                    <Icon icon="fa7-solid:chevron-right"
                          class="transition text-[0.75rem] translate-x-1 my-auto text-(--primary)"></Icon>
                </div>
                {#if item.excerpt.includes('<mark>')}
                    <div class="transition text-sm text-50" style="display: flex; align-items: flex-start; margin-top: 0.1rem">
                        <div>
                            {@html item.excerpt}
                        </div>
                    </div>
                {/if}

                {#if item.content && item.content.includes('<mark>')}
                    <div class="transition text-sm text-30" style="display: flex; align-items: flex-start; margin-top: 0.1rem">
                        <span style="display: inline-block; background-color: var(--btn-plain-bg-active); color: var(--primary); padding: 0.1em 0.4em; border-radius: 5px; font-size: 0.75em; font-weight: 600; margin-right: 0.5em; shrink: 0;">
                            {i18n(I18nKey.searchContent)}
                        </span>
                        <div>
                            {@html item.content}
                        </div>
                    </div>
                {/if}
            </a>
        {/each}
        {#if result.length > 5}
            <a href={getSearchUrl(keywordDesktop || keywordMobile)}
               on:click={(e) => handleResultClick(e, getSearchUrl(keywordDesktop || keywordMobile))}
               class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) text-(--primary) font-bold text-center">
                <span class="inline-flex items-center">
                    {i18n(I18nKey.searchViewMore).replace('{count}', (result.length - 5).toString())}
                    <Icon icon="fa7-solid:arrow-right" class="transition text-[0.75rem] ml-1"></Icon>
                </span>
            </a>
        {/if}
    {:else if keywordDesktop.trim() || keywordMobile.trim()}
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-lg px-3 py-2 text-50">
            {i18n(I18nKey.searchNoResults)}
        </div>
    {:else}
        <div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-lg px-3 py-2 text-50">
            {i18n(I18nKey.searchTypeSomething)}
        </div>
    {/if}
</div>

<style>
    input:focus {
        outline: 0;
    }

    .search-panel {
        max-height: calc(100vh - 100px);
        overflow-y: auto;
    }
</style>
