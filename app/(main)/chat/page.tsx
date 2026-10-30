"use client";

import React, { Suspense } from "react";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

export default function ChatPage() {
  const { user, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [headerBottom, setHeaderBottom] = React.useState<number | null>(null);

  React.useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  React.useLayoutEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const updateHeaderPosition = () => {
      setHeaderBottom(header.getBoundingClientRect().bottom);
    };
    updateHeaderPosition();

    const observer = new ResizeObserver(updateHeaderPosition);
    observer.observe(header);
    window.addEventListener("resize", updateHeaderPosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderPosition);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="text-fg-muted animate-pulse">লোড হচ্ছে...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-100px)] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-3xl font-bold text-fg">গ্লোবাল চ্যাট</h1>
          <p className="text-fg-muted">
            চ্যাট রুমে প্রবেশ করতে এবং অন্যান্য পাঠকদের সাথে সরাসরি কথা বলতে লগইন করুন।
          </p>
          <button onClick={() => setAuthModalOpen(true)} className="btn-primary w-full max-w-[200px] mx-auto">
            লগইন করুন
          </button>
          <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-40 mx-auto flex min-h-0 w-full max-w-[1400px] flex-col overflow-hidden bg-surface md:bottom-0 md:p-4"
      style={{
        top: headerBottom === null ? "100vh" : `${headerBottom + 12}px`,
      }}
    >
      <Suspense fallback={<div className="flex min-h-0 flex-1 items-center justify-center text-fg-muted animate-pulse">লোড হচ্ছে...</div>}>
        <ChatRoom />
      </Suspense>
    </div>
  );
}
