"use client";

import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useBooking } from "@/components/site/BookingProvider";
import { prettyPhone, telHref } from "@/lib/utils";

const VIDEO_URL = "/hero.webm";

export function Hero({ phone }: { phone: string }) {
  const { open } = useBooking();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {
      /* autoplay blocked: silently stay on the first frame */
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <section className="relative h-screen overflow-hidden">
        {/* Plays once on page load only, then holds the very last frame */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={VIDEO_URL}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          tabIndex={-1}
          aria-hidden="true"
          onEnded={(e) => {
            const v = e.currentTarget;
            v.pause();
            if (v.duration && !Number.isNaN(v.duration)) {
              v.currentTime = v.duration;
            }
          }}
        />

        <div className="relative flex h-full flex-col">
          <div className="h-24 flex-none" aria-hidden />
          <div className="flex flex-1 items-center justify-center px-8">
            <div className="hero-halo -mt-10 flex flex-col items-center text-center md:-mt-20 lg:-mt-28">
              <p className="hero-glow mb-4 text-sm font-semibold uppercase tracking-wider text-[#0D47A1]">
                RITHANYA HOSPITAL • KHAMMAM
              </p>
              <h1 className="font-normal">
                <span className="hero-glow block text-6xl font-normal leading-none tracking-tighter text-[#0A2540] md:text-7xl lg:text-8xl">
                  Advanced.
                </span>
                <span
                  className="hero-glow block text-6xl font-normal leading-none tracking-tighter text-[#0D47A1] md:text-7xl lg:text-8xl"
                  style={{ marginTop: "-12px" }}
                >
                  Healthcare.
                </span>
              </h1>
              <p className="hero-glow mb-6 mt-6 max-w-2xl text-lg font-medium text-[#1e293b] md:text-xl">
                Providing world-class medical care, advanced technology, and compassionate treatment in Khammam.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/clinical-care"
                  className="hero-btn-glow inline-flex min-h-11 items-center rounded-full bg-white/95 px-5 py-2.5 font-semibold text-[#0A2540] shadow-md backdrop-blur-sm transition-all hover:bg-white hover:scale-105"
                >
                  Explore Services
                </Link>
                <button
                  type="button"
                  onClick={() => open("", "WEBSITE")}
                  className="hero-btn-glow inline-flex min-h-11 items-center rounded-full bg-[#0D47A1] px-5 py-2.5 font-semibold text-white shadow-md transition-all hover:bg-[#D32F2F] hover:scale-105"
                >
                  Book Appointment
                </button>
              </div>
              <p className="hero-glow mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-base font-semibold text-[#0A2540]">
                <a
                  href={telHref(phone)}
                  className="underline decoration-[#D32F2F] decoration-2 underline-offset-4 transition-colors hover:text-[#D32F2F]"
                >
                  Emergency {prettyPhone(phone)}
                </a>
                <button
                  type="button"
                  onClick={() => open("Thalassemia & Sickle Cell Daycare", "THALASSEMIA")}
                  className="underline decoration-[#0D47A1] decoration-2 underline-offset-4 transition-colors hover:text-[#0D47A1]"
                >
                  Thalassemia daycare support
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
