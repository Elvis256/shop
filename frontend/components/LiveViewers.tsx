"use client";

import { useState, useEffect, useRef } from "react";

export default function LiveViewers() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    const base = Math.floor(Math.random() * 13) + 3; // 3–15
    setCount(base);
    setVisible(true);

    const interval = setInterval(() => {
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const next = Math.max(2, prev + delta);
        prevCount.current = prev;
        return next;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!visible || count <= 0) return null;

  return (
    <div className="inline-flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-lg">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
      </span>
      <span>
        🔥{" "}
        <strong
          className="transition-all duration-300"
          key={count}
        >
          {count}
        </strong>{" "}
        {count === 1 ? "person is" : "people are"} viewing this right now
      </span>
    </div>
  );
}
