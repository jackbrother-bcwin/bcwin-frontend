"use client";

import React from "react";
import Image from "next/image";

export type CategoryId =
  | "lobby"
  | "popular"
  | "mini"
  | "lottery"
  | "slots"
  | "fishing"
  | "sports"
  | "casino"
  | "pvc";

interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  count: number;
}

export const CATEGORIES: Category[] = [
  { id: "lobby",    name: "Lobby",     icon: "/gamecategory/category_slots.png",     count: 30 },
  { id: "popular",  name: "Popular",   icon: "/gamecategory/category_popular.png",   count: 8  },
  { id: "mini",     name: "Mini Game", icon: "/gamecategory/gamecategory_202603241755279vxy.png", count: 6 },
  { id: "lottery",  name: "Lottery",   icon: "/gamecategory/category_lottery.png",   count: 5  },
  { id: "slots",    name: "Slots",     icon: "/gamecategory/category_slots.png",     count: 12 },
  { id: "fishing",  name: "Fishing",   icon: "/gamecategory/category_fishing.png",   count: 4  },
  { id: "sports",   name: "Sports",    icon: "/gamecategory/category_sports.png",    count: 2  },
  { id: "casino",   name: "Casino",    icon: "/gamecategory/category_casino.png",    count: 3  },
];

interface GameCategoryTabsProps {
  activeCategory: CategoryId;
  onSelectCategory: (id: CategoryId) => void;
}

export default function GameCategoryTabs({
  activeCategory,
  onSelectCategory,
}: GameCategoryTabsProps) {
  return (
    <div
      className="mt-[12px] px-3 overflow-x-auto no-scrollbar"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex min-w-max gap-[4px] pb-[0px]">
        {CATEGORIES.map((category) => {
          const isActive = category.id === activeCategory;
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={`relative flex flex-col items-center gap-[4px] px-[10px] pt-[6px] pb-[8px] min-w-[58px] transition-colors ${
                isActive ? "text-[#FED358]" : "text-[#837064]"
              }`}
            >
              {/* Icon */}
              <span className="relative block h-[28px] w-[28px]">
                <Image
                  src={category.icon}
                  alt=""
                  fill
                  sizes="28px"
                  className={`object-contain transition-all ${isActive ? "brightness-110" : "grayscale brightness-75"}`}
                />
              </span>

              {/* Label */}
              <span className="text-[13px] leading-none font-medium whitespace-nowrap">
                {category.name}
              </span>

              {/* Active underline */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-[24px] rounded-full"
                  style={{ background: "#FED358" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
