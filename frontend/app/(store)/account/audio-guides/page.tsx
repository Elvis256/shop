"use client";

import { useEffect, useState, useRef } from "react";
import { Headphones, Play, Pause, Lock, Shield, Volume2, Clock, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import Section from "@/components/Section";

interface AudioGuide {
  id: string;
  title: string;
  description: string | null;
  duration: number; // in seconds
  productId: string | null;
  locked: boolean;
  audioUrl: string | null;
  createdAt: string;
}

export default function AudioGuidesPage() {
  const [guides, setGuides] = useState<AudioGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Audio Player State
  const [activeGuide, setActiveGuide] = useState<AudioGuide | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    apiFetch("/api/audio-guides")
      .then((d) => {
        if (d.error) setError(d.error);
        else setGuides(d.guides || []);
      })
      .catch(() => setError("Failed to load intimacy & wellness audio guides."))
      .finally(() => setLoading(false));
  }, []);

  const handlePlayPause = (guide: AudioGuide) => {
    if (guide.locked) return;

    if (activeGuide?.id === guide.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      // Set new audio track
      setActiveGuide(guide);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(guide.duration);
      
      if (audioRef.current) {
        audioRef.current.src = guide.audioUrl || "";
        audioRef.current.load();
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      }
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  if (loading) return (
    <Section>
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="animate-pulse text-sm text-text-muted">Loading your audio sanctuary...</span>
      </div>
    </Section>
  );

  return (
    <Section>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-rose-500/10 via-purple-500/10 to-indigo-500/10 dark:from-rose-500/5 dark:via-purple-500/5 dark:to-indigo-500/5 border border-border/60 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:rose-400 bg-rose-100/50 dark:bg-rose-950/20 px-3 py-1 rounded-full">
              <Headphones className="w-3.5 h-3.5" /> Sensory Co-creation
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">Intimacy & Sexual Wellness Guides</h1>
            <p className="text-xs text-text-muted max-w-lg">
              Unlock professional sensory coaching, breathing sessions, and relationship intimacy guides. Linked physical products in our shop automatically activate corresponding audio courses below.
            </p>
          </div>
          <div className="shrink-0 flex items-center justify-center bg-white dark:bg-gray-800 border border-border w-14 h-14 rounded-2xl shadow-sm">
            <Headphones className="w-7 h-7 text-accent animate-bounce" />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-4 border border-red-100 rounded-lg">{error}</p>
        )}

        {/* Audio Element */}
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
        />

        {/* Audio Guides Grid */}
        {guides.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-3xl bg-surface/50">
            <p className="text-sm text-text-muted">No intimacy guides available in your library yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((guide) => {
              const isActive = activeGuide?.id === guide.id;
              return (
                <div
                  key={guide.id}
                  className={`border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden bg-surface dark:bg-gray-800 ${
                    isActive
                      ? "border-accent shadow-md ring-1 ring-accent/30"
                      : "border-border hover:border-gray-300 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-xs font-semibold text-text-muted flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {formatTime(guide.duration)} mins
                      </span>
                      {guide.locked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-200/20">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-100/60 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                          Unlocked
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-gray-900 dark:text-white">{guide.title}</h3>
                    <p className="text-xs text-text-muted leading-relaxed line-clamp-3">{guide.description || "No description provided."}</p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between gap-4">
                    {guide.locked ? (
                      <div className="flex-1 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="text-[10px] text-text-muted leading-tight">
                          Purchase physical product to unlock.
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePlayPause(guide)}
                        className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          isActive && isPlaying
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : "bg-primary hover:bg-primary/95 text-white shadow-sm"
                        }`}
                      >
                        {isActive && isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" /> Play Session
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Player Controller Bar */}
        {activeGuide && (
          <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[400px] z-50 bg-white dark:bg-gray-900 border border-border shadow-2xl rounded-2xl p-4 space-y-3 animate-slide-up">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-rose-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Headphones className="w-3 h-3" /> Intimacy Audio Session
                </p>
                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{activeGuide.title}</p>
              </div>
              <button
                onClick={() => handlePlayPause(activeGuide)}
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>
            </div>

            {/* Scrubber / Progress Bar */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-[10px] text-text-muted">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 pt-1">
              <Volume2 className="w-3.5 h-3.5 text-text-muted" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
