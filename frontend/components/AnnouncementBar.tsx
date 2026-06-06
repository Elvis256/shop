"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Announcement {
  id: string;
  text: string;
  link?: string;
  bgColor?: string;
}

export default function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedId = sessionStorage.getItem("announcement_dismissed");
    apiFetch("/api/settings/announcement")
      .then((data: any) => {
        if (data?.text && data.id !== dismissedId) {
          setAnnouncement(data);
        }
      })
      .catch(() => {
        // Fallback announcement
        const dismissedFallback = sessionStorage.getItem("announcement_dismissed");
        if (dismissedFallback !== "fallback") {
          setAnnouncement({
            id: "fallback",
            text: "Free discreet delivery on orders over UGX 100,000",
          });
        }
      });
  }, []);

  if (!announcement || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("announcement_dismissed", announcement.id);
  };

  const content = (
    <span className="text-sm font-medium">{announcement.text}</span>
  );

  return (
    <div
      className="relative bg-primary text-white text-center py-2 px-10"
      style={announcement.bgColor ? { backgroundColor: announcement.bgColor } : undefined}
    >
      {announcement.link ? (
        <a href={announcement.link} className="hover:underline">
          {content}
        </a>
      ) : (
        content
      )}
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
