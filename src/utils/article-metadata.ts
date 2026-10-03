type ArticleMetadataInput = {
	title: string;
	description?: string;
	author: string;
	authorUrl: string;
	canonicalUrl: string;
	published: Date;
	updated?: Date;
	tags?: string[];
	lang: string;
	imageUrl?: string;
};

/** 与页面实际封面共用图片地址；更新时间只取作者填写的 updated。 */
export function buildArticleMetadata(input: ArticleMetadataInput): {
	"@context": string;
	"@type": string;
	headline: string;
	description: string;
	url: string;
	mainEntityOfPage: { "@type": string; "@id": string };
	author: { "@type": string; name: string; url: string };
	datePublished: string;
	dateModified?: string;
	image?: string;
	keywords?: string[];
	inLanguage: string;
} {
	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: input.title,
		description: input.description || input.title,
		url: input.canonicalUrl,
		mainEntityOfPage: { "@type": "WebPage", "@id": input.canonicalUrl },
		author: { "@type": "Person", name: input.author, url: input.authorUrl },
		datePublished: input.published.toISOString().slice(0, 10),
		dateModified: input.updated?.toISOString().slice(0, 10),
		image: input.imageUrl,
		keywords: input.tags,
		inLanguage: input.lang.replace("_", "-"),
	};
}
