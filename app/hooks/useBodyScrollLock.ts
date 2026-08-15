"use client";

import { useEffect } from "react";

/**
 * Lock document scroll while a full-screen overlay is open.
 * Handles iOS Safari / Chrome / WebViews: position:fixed + restore scrollY.
 * Reference-counted so nested modals don't unlock early.
 */

let lockCount = 0;
let savedScrollY = 0;
let savedHtmlOverflow = "";
let savedBodyOverflow = "";
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyLeft = "";
let savedBodyRight = "";
let savedBodyWidth = "";
let savedBodyTouchAction = "";

function applyLock() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const body = document.body;

  savedScrollY = window.scrollY || window.pageYOffset || 0;
  savedHtmlOverflow = html.style.overflow;
  savedBodyOverflow = body.style.overflow;
  savedBodyPosition = body.style.position;
  savedBodyTop = body.style.top;
  savedBodyLeft = body.style.left;
  savedBodyRight = body.style.right;
  savedBodyWidth = body.style.width;
  savedBodyTouchAction = body.style.touchAction;

  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.touchAction = "none";
  body.classList.add("spa-scroll-locked");
  html.classList.add("spa-scroll-locked");
}

function releaseLock() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const body = document.body;

  html.style.overflow = savedHtmlOverflow;
  body.style.overflow = savedBodyOverflow;
  body.style.position = savedBodyPosition;
  body.style.top = savedBodyTop;
  body.style.left = savedBodyLeft;
  body.style.right = savedBodyRight;
  body.style.width = savedBodyWidth;
  body.style.touchAction = savedBodyTouchAction;
  body.classList.remove("spa-scroll-locked");
  html.classList.remove("spa-scroll-locked");

  window.scrollTo(0, savedScrollY);
}

/**
 * @param locked - when true, freeze background page scroll
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === "undefined") return;

    lockCount += 1;
    if (lockCount === 1) applyLock();

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };
  }, [locked]);
}
