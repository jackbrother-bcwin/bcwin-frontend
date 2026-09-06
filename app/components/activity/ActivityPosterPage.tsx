"use client";

/**
 * Full-page activity promo poster — navbar + back + scrollable CDN image
 * or an in-app CSS body (Creative Video).
 */

import React from "react";
import Image from "next/image";
import PageHeader from "../ui/PageHeader";

interface Props {
  title: string;
  image?: string;
  children?: React.ReactNode;
  onBack: () => void;
}

export default function ActivityPosterPage({
  title,
  image,
  children,
  onBack,
}: Props) {
  return (
    <div
      className="flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-clip pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      style={{ background: "#110D14" }}
    >
      <PageHeader title={title} onBack={onBack} />

      <div className="px-2 sm:px-3 pt-2 pb-6">
        {children ? (
          children
        ) : image ? (
          <div
            className="relative w-full overflow-hidden rounded-[12px]"
            style={{
              border: "1px solid rgba(254,211,88,0.18)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
              background: "#1a1519",
            }}
          >
            <Image
              src={image}
              alt={title}
              width={1080}
              height={1920}
              className="w-full h-auto block select-none"
              sizes="(max-width: 480px) 100vw, 480px"
              priority
              unoptimized
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
