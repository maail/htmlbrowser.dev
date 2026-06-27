import { create } from "zustand";

interface PreviewState {
  /** Monotonic counter the preview pane uses to force-reload. */
  reloadToken: number;
  lastReloadAt: number | null;
  /**
   * True while a DOM overlay (e.g. the share popover) needs to sit above the
   * preview. The preview is a native child webview that always paints over the
   * DOM, so we hide it while an overlay is open.
   */
  overlayOpen: boolean;
  bumpReload: () => void;
  setOverlayOpen: (open: boolean) => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  reloadToken: 0,
  lastReloadAt: null,
  overlayOpen: false,
  bumpReload() {
    set((s) => ({
      reloadToken: s.reloadToken + 1,
      lastReloadAt: Date.now(),
    }));
  },
  setOverlayOpen(open) {
    set({ overlayOpen: open });
  },
}));
