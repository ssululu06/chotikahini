import type { Metadata } from "next";
import { ArrowUpRight, Mail, MessageCircle, Sparkles } from "lucide-react";
import { getSiteConfig } from "@/lib/config";
import { ContactForm } from "@/components/ContactForm";
import { buildMetadata } from "@/lib/metadata";

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return buildMetadata({
    title: `যোগাযোগ — ${site.title}`,
    description: "আপনার মতামত, পরামর্শ বা প্রশ্ন আমাদের কাছে পাঠান",
    url: `${site.url.endsWith("/") ? site.url.slice(0, -1) : site.url}/contact`,
  });
}

export default function ContactPage() {
  const site = getSiteConfig();

  return (
    <main className="container-page py-8 sm:py-14">
      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-surface-alt shadow-sm">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 animate-pulse rounded-full bg-fg/5 blur-3xl motion-reduce:animate-none" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-fg/5 blur-3xl" />

        <div className="relative grid lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="flex flex-col justify-between border-b border-border p-6 sm:p-10 lg:border-b-0 lg:border-r">
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg">
                <Sparkles className="h-3.5 w-3.5" />
                আমরা শুনছি
              </span>
              <h1 className="mt-6 text-3xl font-black leading-tight tracking-tight text-fg sm:text-4xl">
                আপনার কথা
                <br />
                <span className="text-fg-muted">আমাদের কাছে পৌঁছাক।</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-fg-muted sm:text-base">
                কোনো প্রশ্ন, পরামর্শ, গল্প জমা বা ছোট্ট মতামত—যা বলতে চান, সহজেই লিখে পাঠান।
                আমরা যত দ্রুত সম্ভব উত্তর দেওয়ার চেষ্টা করব।
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <div className="rounded-2xl border border-border bg-surface p-4 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-fg">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-fg">যেভাবে লিখতে স্বচ্ছন্দ</p>
                    <p className="mt-1 text-xs leading-5 text-fg-muted">
                      ছোট বা বিস্তারিত—আপনার বার্তা আপনার মতো করেই লিখুন।
                    </p>
                  </div>
                </div>
              </div>
              {site.email && (
                <a
                  href={`mailto:${site.email}`}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-transform duration-300 hover:-translate-y-1"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-alt text-fg">
                    <Mail className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-fg-muted">ইমেইল করতে চাইলে</span>
                    <span className="mt-1 block truncate text-sm font-semibold text-fg">{site.email}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              )}
            </div>
          </aside>

          <div className="p-5 sm:p-10">
            <div className="mb-6 animate-fade-in-up">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-muted">বার্তা পাঠান</p>
              <h2 className="mt-2 text-2xl font-bold text-fg">কীভাবে সাহায্য করতে পারি?</h2>
              <p className="mt-2 text-sm text-fg-muted">নাম ও বার্তা লিখলেই পাঠানো যাবে।</p>
            </div>
            <ContactForm email={site.email} submissionForm={site.submissionForm} />
          </div>
        </div>
      </section>
    </main>
  );
}
