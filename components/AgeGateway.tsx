"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export function AgeGateway() {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const isVerified = localStorage.getItem("adult_confirmed");
    if (isVerified === "true") {
      setVerified(true);
    } else {
      setVerified(false);
      // Lock scrolling when modal is open
      document.body.style.overflow = "hidden";
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem("adult_confirmed", "true");
    setVerified(true);
    document.body.style.overflow = "auto";
  };

  const handleReject = () => {
    window.location.href = "https://www.google.com";
  };

  if (verified === null || verified === true) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">বয়স যাচাইকরণ</h2>
        
        <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
          এই ওয়েবসাইটে প্রাপ্তবয়স্কদের (১৮+) জন্য উপযোগী গল্প ও লেখা রয়েছে। ওয়েবসাইটে প্রবেশ করার জন্য আপনার বয়স অবশ্যই ১৮ বা তার বেশি হতে হবে।
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-900/20"
          >
            হ্যাঁ, আমার বয়স ১৮+
          </button>
          
          <button
            onClick={handleReject}
            className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-colors"
          >
            না, আমি প্রবেশ করতে চাই না
          </button>
        </div>
      </div>
    </div>
  );
}
