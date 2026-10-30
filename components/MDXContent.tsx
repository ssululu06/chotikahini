import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { remarkPreserveBlankLines } from "@/lib/remark-preserve-blank-lines";
import { rehypePreserveIndent } from "@/lib/rehype-preserve-indent";
import { ScriptInjector } from "./ScriptInjector";

export function MDXContent({ source }: { source: string }) {
  return (
    <div className="prose-custom">
      <MDXRemote
        source={source}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm, remarkBreaks, remarkPreserveBlankLines],
            rehypePlugins: [rehypePreserveIndent, rehypeRaw],
          },
        }}
      />
      <ScriptInjector />
    </div>
  );
}
