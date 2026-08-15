"use client";

import { useEffect, useId, useRef } from "react";
import { dismissSpaOverlay, pushSpaOverlay } from "../lib/spa-overlay";

/**
 * When `open` becomes true, push a SPA history entry.
 * System / browser / swipe back closes via `onClose`.
 * When closed from UI (X), history is cleaned with dismissSpaOverlay.
 *
 * @param open - whether the dialog / sheet / nested view is open
 * @param onClose - set open to false (must be stable or latest via ref)
 * @param id - optional stable id (defaults to React useId)
 */
export function useSpaBackClose(
  open: boolean,
  onClose: () => void,
  id?: string
): void {
  const autoId = useId();
  const layerId = id ?? `spa-${autoId}`;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      pushSpaOverlay(layerId, () => {
        onCloseRef.current();
      });
      return;
    }

    if (!open && wasOpen.current) {
      wasOpen.current = false;
      dismissSpaOverlay(layerId);
    }
  }, [open, layerId]);

  // Unmount while open
  useEffect(() => {
    return () => {
      if (wasOpen.current) {
        wasOpen.current = false;
        dismissSpaOverlay(layerId);
      }
    };
  }, [layerId]);
}
