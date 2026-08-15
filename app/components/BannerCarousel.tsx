"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HOME_CAROUSEL_BANNERS } from "../lib/banner-cdn";

const BANNERS = HOME_CAROUSEL_BANNERS;

export default function BannerCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoScroll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startAutoScroll = () => {
    stopAutoScroll();
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BANNERS.length);
    }, 3800);
  };

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
    // startAutoScroll/stopAutoScroll are stable for this mount lifecycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    setTouchStart(x);
    stopAutoScroll();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const diff = touchStart - endX;
    if (Math.abs(diff) > 40) {
      setCurrentIndex((prev) =>
        diff > 0 ? (prev + 1) % BANNERS.length : (prev - 1 + BANNERS.length) % BANNERS.length
      );
    }
    setTouchStart(null);
    startAutoScroll();
  };

  return (
    <section
      className="mx-3 mt-2.5 overflow-hidden rounded-[12px] relative home-banner"
      /* ~2.15:1 creatives — avoid object-cover cropping title text at top/bottom */
      style={{ aspectRatio: "2.15 / 1", height: "auto", minHeight: 140 }}
      onMouseEnter={stopAutoScroll}
      onMouseLeave={startAutoScroll}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {BANNERS.map((banner, index) => {
        // Only hydrate current + adjacent slides (less decode work on low-end phones)
        const isNear =
          index === currentIndex ||
          index === (currentIndex + 1) % BANNERS.length ||
          index === (currentIndex - 1 + BANNERS.length) % BANNERS.length;
        if (!isNear && index !== 0) return null;
        return (
          <div
            key={banner}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <Image
              src={banner}
              alt=""
              fill
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
              quality={80}
              className="object-cover object-center"
              sizes="(max-width: 480px) 100vw, 480px"
            />
          </div>
        );
      })}

      <div className="absolute bottom-2.5 left-0 right-0 z-20 flex justify-center gap-[5px]">
        {BANNERS.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={`h-[5px] rounded-full transition-all ${
              index === currentIndex ? "w-[16px] bg-[#FED358] shadow-[0_0_6px_rgba(254,211,88,0.7)]" : "w-[5px] bg-white/35"
            }`}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
