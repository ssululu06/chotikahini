/**
 * Copy & Inline Attribution Configuration
 *
 * Two independent features:
 *   `copyAttribution` — appended to clipboard when user copies text.
 *   `inlineAttribution` — rendered as a visible divider within article content.
 *
 * Edit values below — no application code changes needed.
 */

export const copyAttribution = {
  /** Set to false to disable clipboard attribution entirely. */
  enabled: true,

  /** Text appended after copied article content (plain text only). */
  text: `
━━━━━━━━━━━━━━━━━━━━
Originally published on ChotiKahini
https://chotikahini.vercel.app/
━━━━━━━━━━━━━━━━━━━━
`,

  /** Separator placed between the user's text and the attribution. */
  separator: "\n\n",
};

export const inlineAttribution = {
  /** Set to false to remove the inline dividers entirely. */
  enabled: false,

  /**
   * The visible inline attribution rendered inside the article body
   * every `interval` paragraphs.
   */
  text: "© বাংলা চটি কাহিনী — https://chotikahini.vercel.app",

  /**
   * Insert the attribution after every N paragraphs (5–8 recommended).
   */
  interval: 6,
};
