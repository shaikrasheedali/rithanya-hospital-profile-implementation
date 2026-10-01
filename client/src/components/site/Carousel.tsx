"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Carousel({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * Math.min(420, ref.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="mb-6 flex justify-end gap-3">
        <button onClick={() => scroll(-1)} aria-label="Scroll left" className="rounded-full border border-line bg-white p-3 text-navy hover:border-royal hover:text-royal">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => scroll(1)} aria-label="Scroll right" className="rounded-full border border-line bg-white p-3 text-navy hover:border-royal hover:text-royal">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div ref={ref} className="no-scrollbar -mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 sm:-mx-8 sm:px-8">
        {children}
      </div>
    </div>
  );
}
