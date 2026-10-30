import { visit } from "unist-util-visit";
import type { Root, Text } from "hast";

/**
 * Preserve ALL whitespace in text nodes so the browser never
 * collapses multiple spaces, leading indentation, or tabs.
 *
 * Strategy (preserves line-wrapping for single spaces):
 *   - Leading whitespace   → non-breaking spaces
 *   - Tabs anywhere        → 4 non-breaking spaces
 *   - 2+ consecutive spaces → non-breaking spaces each
 *   - Single space between words → left as regular space
 */
export function rehypePreserveIndent() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text) => {
      let value = node.value;

      // Replace tabs with 4 non-breaking spaces
      if (value.includes("\t")) {
        value = value.replace(/\t/g, "\u00A0\u00A0\u00A0\u00A0");
      }

      // Replace sequences of 2+ spaces with non-breaking spaces
      // (single spaces between words are left alone so text wraps)
      if (/  /.test(value)) {
        value = value.replace(/  +/g, (match) => "\u00A0".repeat(match.length));
      }

      // Replace leading whitespace with non-breaking spaces
      // (handles indentation at the start of a text node)
      const lead = value.match(/^[ \t\u00A0]+/);
      if (lead) {
        const raw = lead[0];
        // If already processed, just confirm everything is already nbsp
        // Otherwise convert remaining regular spaces
        const converted = raw
          .replace(/ /g, "\u00A0")
          .replace(/\t/g, "\u00A0\u00A0\u00A0\u00A0");
        value = converted + value.slice(raw.length);
      }

      node.value = value;
    });
  };
}
