"use client";

import { useEffect, useState } from "react";

interface Props {
  target: string; // ISO date string
}

export function CountdownTimer({ target }: Props) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const targetMs = new Date(target).getTime();

    const tick = () => {
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        setRemaining("এখনই প্রকাশিত!");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) setRemaining(`${days} দিন ${hours} ঘন্টা বাকি`);
      else if (hours > 0) setRemaining(`${hours} ঘন্টা ${mins} মিনিট বাকি`);
      else if (mins > 0) setRemaining(`${mins} মিনিট ${secs} সেকেন্ড বাকি`);
      else setRemaining(`${secs} সেকেন্ড বাকি`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
      {remaining}
    </span>
  );
}