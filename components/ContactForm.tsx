"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle, Mail, MessageSquare, Send, User } from "lucide-react";

interface ContactFormProps {
  email: string;
  submissionForm?: {
    action: string;
    entries: {
      name: string;
      email: string;
      subject: string;
      message: string;
    };
  };
}

const quickSubjects = ["সাধারণ প্রশ্ন", "পরামর্শ", "গল্প জমা", "সমস্যা জানাতে"];
const MESSAGE_LIMIT = 3000;

export function ContactForm({ email, submissionForm }: ContactFormProps) {
  const [name, setName] = useState("");
  const [emailAddr, setEmailAddr] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !message.trim()) return;

    if (!submissionForm) {
      const body = `নাম: ${name.trim()}\nইমেইল: ${emailAddr.trim() || "দেওয়া হয়নি"}\n\n${message.trim()}`;
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject.trim() || "যোগাযোগের বার্তা")}&body=${encodeURIComponent(body)}`;
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/submit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: submissionForm.action,
          entries: submissionForm.entries,
          values: {
            name: name.trim(),
            email: emailAddr.trim(),
            subject: subject.trim() || "যোগাযোগের বার্তা",
            message: message.trim(),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.errors?.join(" ") || "বার্তা পাঠাতে সমস্যা হয়েছে।");
      }
      setSubmitted(true);
    } catch (submitError) {
      console.error("Failed to send contact message", submitError);
      setError(submitError instanceof Error ? submitError.message : "বার্তা পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="motion-safe:animate-fade-in-up rounded-2xl border border-border bg-surface p-8 text-center sm:p-10" role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-fg">
          <CheckCircle className="h-7 w-7" />
        </span>
        <h3 className="mt-5 text-xl font-bold text-fg">বার্তাটি পৌঁছে গেছে!</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-fg-muted">
          যোগাযোগ করার জন্য ধন্যবাদ। আমরা যত দ্রুত সম্ভব আপনার সঙ্গে যোগাযোগ করব।
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setName("");
            setEmailAddr("");
            setSubject("");
            setMessage("");
          }}
          className="mt-6 rounded-xl border border-border bg-surface-alt px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-hover"
        >
          আরেকটি বার্তা পাঠান
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="group block space-y-2">
          <span className="text-sm font-semibold text-fg">আপনার নাম <span aria-hidden="true">*</span></span>
          <span className="relative block">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle transition-colors group-focus-within:text-fg" />
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="যে নামে সম্বোধন করব"
              autoComplete="name"
              required
              maxLength={100}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 pl-11 text-sm text-fg outline-none transition-all placeholder:text-fg-subtle focus:border-fg/50 focus:ring-2 focus:ring-fg/10"
            />
          </span>
        </label>

        <label className="group block space-y-2">
          <span className="text-sm font-semibold text-fg">ইমেইল <span className="font-normal text-fg-muted">(ঐচ্ছিক)</span></span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle transition-colors group-focus-within:text-fg" />
            <input
              type="email"
              value={emailAddr}
              onChange={(event) => setEmailAddr(event.target.value)}
              placeholder="উত্তর পেতে ইমেইল দিন"
              autoComplete="email"
              maxLength={254}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 pl-11 text-sm text-fg outline-none transition-all placeholder:text-fg-subtle focus:border-fg/50 focus:ring-2 focus:ring-fg/10"
            />
          </span>
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-fg">কী বিষয়ে লিখছেন?</legend>
        <div className="flex flex-wrap gap-2">
          {quickSubjects.map((item) => {
            const selected = subject === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setSubject(selected ? "" : item)}
                aria-pressed={selected}
                className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 motion-reduce:transform-none ${
                  selected
                    ? "border-fg bg-fg text-surface"
                    : "border-border bg-surface text-fg hover:bg-surface-hover"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="group block space-y-2">
        <span className="flex items-center justify-between gap-3 text-sm font-semibold text-fg">
          <span>আপনার বার্তা <span aria-hidden="true">*</span></span>
          <span className="text-xs font-normal text-fg-muted">{message.length}/{MESSAGE_LIMIT}</span>
        </span>
        <span className="relative block">
          <MessageSquare className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-fg-subtle transition-colors group-focus-within:text-fg" />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_LIMIT))}
            placeholder="যা বলতে চান, এখানে লিখুন..."
            rows={6}
            required
            maxLength={MESSAGE_LIMIT}
            className="min-h-40 w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 pl-11 text-sm leading-6 text-fg outline-none transition-all placeholder:text-fg-subtle focus:border-fg/50 focus:ring-2 focus:ring-fg/10"
          />
        </span>
      </label>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-muted">* চিহ্নিত তথ্যগুলো আবশ্যক।</p>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fg px-6 py-3 text-sm font-bold text-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none sm:w-auto"
        >
          <Send className={`h-4 w-4 ${sending ? "animate-pulse" : ""}`} />
          {sending ? "পাঠানো হচ্ছে..." : "বার্তা পাঠান"}
        </button>
      </div>
    </form>
  );
}
