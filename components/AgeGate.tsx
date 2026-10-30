"use client";

import { useState, useEffect } from "react";

export function AgeGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem("cittakkho_age_verified");
    if (!verified) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cittakkho_age_verified", "yes");
    setVisible(false);
  };

  const handleDecline = () => {
    window.location.href = "https://www.google.com";
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        style={{ animation: "fadeInScale 0.3s ease-out" }}
      >
        {/* Site Icon */}
        <div className="w-16 h-16 rounded-2xl bg-fg text-surface flex items-center justify-center text-3xl font-bold mx-auto mb-6">
          ১৮+
        </div>

        <h1 className="text-2xl font-bold text-fg mb-3">বয়স যাচাই</h1>
        <p className="text-fg-muted text-sm leading-relaxed mb-2">
          এই ওয়েবসাইটের কন্টেন্ট শুধুমাত্র{" "}
          <strong className="text-fg">১৮ বছর বা তার বেশি বয়সীদের</strong> জন্য।
        </p>
        <p className="text-fg-subtle text-xs mb-8">
          প্রবেশ করে আপনি নিশ্চিত করছেন যে আপনার বয়স ১৮ বছরের বেশি।
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAccept}
            className="w-full py-3 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors text-base"
          >
            হ্যাঁ, আমার বয়স ১৮+
          </button>
          <button
            onClick={handleDecline}
            className="w-full py-3 px-6 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 font-medium rounded-xl transition-colors text-sm"
          >
            না, আমি চলে যাচ্ছি
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
