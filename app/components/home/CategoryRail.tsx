"use client";

import React from "react";
import Image from "next/image";
import { CATEGORIES, type CategoryId } from "../../lib/home-catalog";
import { CDN_CAT_ICONS, type CdnCatIconId } from "../../lib/banner-cdn";

interface Props {
  active: CategoryId;
  onChange: (id: CategoryId) => void;
  /** True when shown inside the fixed top chrome (replacing TopNav) */
  pinned?: boolean;
}

/**
 * Home category rail — icon stack + label, gold when active + gold underline.
 * Icons: ImageKit CDN (`CDN_CAT_ICONS`) — idle `icon_*` / active `click_*`.
 */
export default function CategoryRail({ active, onChange, pinned = false }: Props) {
  return (
    <div
      className={`home-cat-rail${pinned ? " home-cat-rail--pinned" : ""}`}
      role="navigation"
      aria-label="Game categories"
    >
      <div className="home-cat-rail-track">
        {CATEGORIES.map((cat) => {
          const isActive = active === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={`home-cat-item${isActive ? " home-cat-item--active" : ""}`}
            >
              <span className="home-cat-ico" aria-hidden>
                <CatIcon id={cat.id} active={isActive} />
              </span>
              <span className="home-cat-label">{cat.name}</span>
              {isActive && <span className="home-cat-underline" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CatIcon({ id, active }: { id: CategoryId; active: boolean }) {
  const key = id as CdnCatIconId;
  const pair = CDN_CAT_ICONS[key];
  if (!pair) {
    return <span className="home-cat-ico-fallback" />;
  }

  const src = active ? pair.active : pair.idle;

  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      className="home-cat-ico-img"
      sizes="32px"
      unoptimized
    />
  );
}
