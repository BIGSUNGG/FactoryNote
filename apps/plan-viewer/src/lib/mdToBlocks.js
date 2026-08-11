import MarkdownIt from "markdown-it";

// 모든 마크다운 문법(heading/paragraph/list+task/code/image/table/blockquote/hr) 지원.
// strikethrough·table 빌트인 규칙 활성화. .md 는 신뢰하는 산출물이므로 html 허용.
const md = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
}).enable(["table", "strikethrough"]);

// inline 토큰 → html (strong/em/code/link/strike 보존)
function inlineHtml(tok) {
	if (!tok) return "";
	if (!tok.children || tok.children.length === 0) return tok.content || "";
	return md.renderer.renderInline(tok.children, md.options, {});
}

// 마크다운 소스 → 블록 배열. 각 블록이 코멘트 대상(id = b{인덱스}).
// 그래프 JSON 참조 코멘트(`<!-- graph: <파일명> -->`, ADR-016). 본문에 인라인 JSON 없음.
const GRAPH_REF_RE = /<!--\s*graph:\s*([\w.-]+)\s*-->/;

export function mdToBlocks(src) {
	const tokens = md.parse(src, {});
	const blocks = [];
	const bid = () => `b${blocks.length}`;
	let i = 0;

	while (i < tokens.length) {
		const t = tokens[i];

		if (t.type === "heading_open") {
			const level = Number(t.tag.slice(1));
			const inline = tokens[i + 1];
			blocks.push({
				id: bid(),
				type: "heading",
				level,
				html: inlineHtml(inline),
			});
			i += 3; // open, inline, close
		} else if (t.type === "paragraph_open") {
			const inline = tokens[i + 1];
			const children = inline?.children || [];
			const img = children.find((c) => c.type === "image");
			const onlyImg =
				img &&
				children.every(
					(c) =>
						c.type === "image" ||
						c.type === "softbreak" ||
						c.type === "hardbreak" ||
						(c.type === "text" && !c.content.trim()),
				);
			if (onlyImg) {
				blocks.push({
					id: bid(),
					type: "image",
					src: img.src,
					alt: img.content || img.alt || "",
				});
			} else {
				blocks.push({ id: bid(), type: "paragraph", html: inlineHtml(inline) });
			}
			i += 3;
		} else if (t.type === "fence" || t.type === "code_block") {
			const lang = (t.info || "").trim();
			blocks.push({ id: bid(), type: "code", lang, code: t.content });
			i += 1;
		} else if (t.type === "html_block") {
			// 그래프 참조 코멘트 → 그래프 블록(실제 데이터는 동반 .json, ADR-016).
			const m = (t.content || "").match(GRAPH_REF_RE);
			if (m) blocks.push({ id: bid(), type: "graph", graphFile: m[1] });
			i += 1;
		} else if (t.type === "hr") {
			blocks.push({ id: bid(), type: "hr" });
			i += 1;
		} else if (
			t.type === "bullet_list_open" ||
			t.type === "ordered_list_open"
		) {
			const ordered = t.type === "ordered_list_open";
			const closeType = ordered ? "ordered_list_close" : "bullet_list_close";
			const items = [];
			i++; // list_open
			while (tokens[i] && tokens[i].type !== closeType) {
				if (tokens[i].type === "list_item_open") {
					i++; // item_open
					let itemHtml = "";
					let checked = null;
					while (tokens[i] && tokens[i].type !== "list_item_close") {
						const it = tokens[i];
						if (it.type === "inline") {
							const first = (it.children || [])[0];
							if (
								first &&
								first.type === "text" &&
								/^\[[ xX]\]\s/.test(first.content)
							) {
								checked = /^\[[xX]\]/.test(first.content);
								first.content = first.content.replace(/^\[[ xX]\]\s/, "");
							}
							itemHtml += inlineHtml(it);
						}
						i++;
					}
					i++; // list_item_close
					items.push({ html: itemHtml, checked });
				} else {
					i++;
				}
			}
			i++; // list_close
			blocks.push({ id: bid(), type: "list", ordered, items });
		} else if (t.type === "table_open") {
			i++; // table_open
			const headers = [];
			const rows = [];
			let cur = null;
			let mode = "head"; // head | body
			while (tokens[i] && tokens[i].type !== "table_close") {
				const tt = tokens[i];
				if (tt.type === "thead_open") mode = "head";
				else if (tt.type === "tbody_open") mode = "body";
				else if (tt.type === "tr_open") cur = [];
				else if (tt.type === "tr_close") {
					if (mode === "head") headers.push(...cur);
					else rows.push(cur);
				} else if (tt.type === "th_open" || tt.type === "td_open") {
					const inline = tokens[i + 1];
					cur.push(inlineHtml(inline));
					i += 2; // inline + close — close는 아래 i++ 로 건너뜀
				}
				i++;
			}
			i++; // table_close
			blocks.push({ id: bid(), type: "table", headers, rows });
		} else if (t.type === "blockquote_open") {
			i++; // open
			let html = "";
			while (tokens[i] && tokens[i].type !== "blockquote_close") {
				if (tokens[i].type === "inline")
					html += inlineHtml(tokens[i]) + "<br/>";
				i++;
			}
			i++; // close
			blocks.push({ id: bid(), type: "quote", html });
		} else {
			i++; // open/close/inline(독립) 등 무시
		}
	}
	return blocks;
}
