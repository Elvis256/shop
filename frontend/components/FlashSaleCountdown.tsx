"use client";

import { useEffect, useState } from "react";

interface Props {
  endTime: Date;
}

function getTimeLeft(endTime: Date) {
  const diff = endTime.getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { h, m, s };
}

export default function FlashSaleCountdown({ endTime }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(endTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  if (!timeLeft) {
    return <span className="text-sm font-medium text-red-500">Ended</span>;
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-1">
      {[
        { label: "HH", value: pad(timeLeft.h) },
        { label: "MM", value: pad(timeLeft.m) },
        { label: "SS", value: pad(timeLeft.s) },
      ].map(({ label, value }, i) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-flex flex-col items-center bg-red-500 text-white rounded px-2 py-1 min-w-[2.5rem] text-center">
            <span className="text-lg font-bold leading-none">{value}</span>
            <span className="text-[9px] opacity-75 mt-0.5">{label}</span>
          </span>
          {i < 2 && <span className="text-red-500 font-bold text-lg">:</span>}
        </span>
      ))}
    </div>
  );
}
