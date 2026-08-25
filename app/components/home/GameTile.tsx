"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { GameDef } from "../../lib/home-catalog";

interface GameTileProps {
  game: GameDef;
  onOpen: (game: GameDef) => void;
  loading?: boolean;
  /**
   * poster — vertical 3:4 (Win Go style, default for Inout/home grids)
   * square — 1:1
   * lottery — landscape SPA lottery cards
   */
  variant?: "poster" | "square" | "lottery";
  /** Fixed width for horizontal rails (e.g. 112) */
  fixedWidth?: number;
  className?: string;
}

function isRemoteSrc(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

/**
 * Production game tile.
 * Default poster (vertical) matches legacy Win Go recommended cards.
 * Title baked into art → no text overlay for Inout / titleInImage.
 */
export default function GameTile({
  game,
  onOpen,
  loading,
  variant,
  fixedWidth,
  className = "",
}: GameTileProps) {
  const v =
    variant ??
    (game.layout === "lottery"
      ? "lottery"
      : game.layout === "square"
        ? "square"
        : "poster");

  const hideLabel =
    Boolean(game.titleInImage) || isRemoteSrc(game.image);
  const remote = isRemoteSrc(game.image);
  const [imgFailed, setImgFailed] = useState(false);

  if (v === "lottery") {
    return (
      <button
        type="button"
        onClick={() => onOpen(game)}
        disabled={loading}
        className={`home-tile home-tile-lottery relative aspect-[17/10] w-full overflow-hidden group ${className}`}
        aria-label={game.name}
      >
        <Image
          src={game.image}
          alt={game.name}
          fill
          sizes="(max-width: 480px) 48vw, 220px"
          className="lottery-card-img object-cover transition-transform duration-200 group-active:scale-[1.02]"
        />
        {loading && <TileLoading />}
      </button>
    );
  }

  const aspect = v === "poster" ? "aspect-[3/4]" : "aspect-square";
  const fallbackBg =
    game.accent ??
    "linear-gradient(165deg,#2c2418 0%,#16120e 55%,#0e0b09 100%)";

  const style: React.CSSProperties = {
    background: fallbackBg,
    ...(fixedWidth
      ? { width: fixedWidth, minWidth: fixedWidth, maxWidth: fixedWidth }
      : { width: "100%" }),
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(game)}
      disabled={loading}
      className={`home-tile home-tile--poster relative ${aspect} overflow-hidden group shrink-0 ${className}`}
      style={style}
      aria-label={game.name}
    >
      {!imgFailed ? (
        <Image
          src={game.image}
          alt={game.name}
          fill
          sizes={fixedWidth ? `${fixedWidth}px` : v === "poster" ? "120px" : "110px"}
          unoptimized={remote}
          // Cover fills the vertical card like original Win Go art
          className="object-cover transition-transform duration-200 group-active:scale-[1.03]"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/30 px-1">
          <span className="line-clamp-3 text-center text-[13px] font-extrabold text-white/90">
            {game.name}
          </span>
        </div>
      )}
      <div className="home-tile-shine pointer-events-none absolute inset-0 z-[2]" />
      {!hideLabel && !imgFailed && (
        <div className="home-tile-label absolute inset-x-0 bottom-0 z-[3] px-1.5 pb-1.5 pt-6">
          <span className="block truncate text-center text-[12px] font-extrabold tracking-wide text-white drop-shadow">
            {game.name}
          </span>
        </div>
      )}
      {loading && <TileLoading />}
    </button>
  );
}

function TileLoading() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#FED358] border-t-transparent" />
    </div>
  );
}
