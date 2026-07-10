"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type VideoState = "checking" | "ready" | "missing";

export default function DemoPage() {
  const [videoState, setVideoState] = useState<VideoState>("checking");
  const [playbackRate, setPlaybackRate] = useState(0.75);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/demo.mp4", { method: "HEAD", cache: "no-store" })
      .then((r) => {
        if (!mounted) return;
        setVideoState(r.ok ? "ready" : "missing");
      })
      .catch(() => {
        if (!mounted) return;
        setVideoState("missing");
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, videoState]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <header className="bg-wb-surface border border-wb-border rounded-xl p-4 sm:p-5 shadow-card">
        <h1 className="text-[20px] sm:text-[24px] font-bold text-wb-text tracking-tight">Helios Product Demo (MP4)</h1>
        <p className="text-[13px] sm:text-[14px] text-wb-muted mt-1">
          Slow, first-timer friendly walkthrough of all tabs and core workflows.
        </p>
      </header>

      <section className="bg-wb-surface border border-wb-border rounded-xl overflow-hidden shadow-card">
        {videoState === "ready" ? (
          <div className="bg-wb-surface2 border-b border-wb-border px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] text-wb-muted">Playback speed (default is slower for beginners)</div>
            <div className="flex items-center gap-1.5">
              {[0.5, 0.75, 1].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={playbackRate === rate ? "btn btn-primary h-8 px-3 text-[12px]" : "btn btn-ghost h-8 px-3 text-[12px]"}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {videoState === "ready" ? (
          <div className="aspect-video bg-black">
            <video ref={videoRef} className="w-full h-full" controls preload="metadata" playsInline>
              <source src="/demo.mp4" type="video/mp4" />
            </video>
          </div>
        ) : (
          <div className="aspect-video bg-wb-surface2 flex items-center justify-center px-6 text-center">
            <div>
              <div className="text-[16px] font-semibold text-wb-text">
                {videoState === "checking" ? "Loading demo video..." : "Demo video is not uploaded yet"}
              </div>
              <p className="text-[13px] text-wb-muted mt-2">
                {videoState === "checking"
                  ? "Checking video availability."
                  : "Please add demo.mp4 to frontend/public to enable playback."}
              </p>
            </div>
          </div>
        )}
        <div className="p-4">
          {videoState === "ready" ? (
            <div className="space-y-3">
              <a href="/demo.mp4" className="btn btn-primary" download>Download MP4</a>
              <p className="text-[12px] text-wb-muted">
                Tip: Start with <span className="text-wb-text font-medium">0.75x</span> or <span className="text-wb-text font-medium">0.5x</span> for a detailed, first-time walkthrough.
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-wb-muted">
              Expected file path: <code className="text-wb-text">frontend/public/demo.mp4</code>
            </p>
          )}
        </div>
      </section>

      <div className="flex gap-2">
        <Link href="/dashboard" className="btn btn-ghost">Go to Dashboard</Link>
        <Link href="/settings" className="btn btn-ghost">Back to Settings</Link>
      </div>
    </div>
  );
}
