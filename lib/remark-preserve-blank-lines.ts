import type { Root } from "mdast";
import type { VFile } from "vfile";

/**
 * Preserve multiple blank lines between block-level elements.
 *
 * Standard Markdown collapses consecutive blank lines into a single
 * paragraph boundary.  This plugin uses source positions to detect
 * extra blank lines and inserts visible spacer paragraphs so the
 * rendered page mirrors the original formatting.
 */
export function remarkPreserveBlankLines() {
  return (tree: Root, _file: VFile) => {
    const children = tree.children;
    if (children.length < 2) return;

    const inserts: Array<{ index: number; count: number }> = [];

    for (let i = 0; i < children.length - 1; i++) {
      const cur = children[i];
      const nxt = children[i + 1];
      if (!cur.position || !nxt.position) continue;

      const gap = nxt.position.start.line - cur.position.end.line - 1;
      if (gap > 1) {
        inserts.push({ index: i + 1, count: gap - 1 });
      }
    }

    // Apply from the end so earlier indices stay valid
    for (let j = inserts.length - 1; j >= 0; j--) {
      const { index, count } = inserts[j];
      const spacer: Array<{
        type: "paragraph";
        children: [{ type: "text"; value: string }];
        data?: { hProperties?: { className?: string[] } };
      }> = [];
      for (let k = 0; k < count; k++) {
        spacer.push({
          type: "paragraph",
          children: [{ type: "text", value: "\u00A0" }],
          data: { hProperties: { className: ["blank-line-spacer"] } },
        });
      }
      children.splice(index, 0, ...spacer);
    }
  };
}
