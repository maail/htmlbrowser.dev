import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/store/workspace";
import { useSettingsStore } from "@/store/settings";
import { usePreviewStore } from "@/store/preview";

const PREVIEW_LABEL = "preview";

export function Preview() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const root = useWorkspaceStore((s) => s.root);
  const selectedFile = useWorkspaceStore((s) => s.selectedFile);
  const selectedFileHasScripts = useWorkspaceStore(
    (s) => s.selectedFileHasScripts,
  );
  const trustMode = useSettingsStore((s) => s.trustMode);
  const setTrustMode = useSettingsStore((s) => s.setTrustMode);
  const reloadToken = usePreviewStore((s) => s.reloadToken);
  const bumpReload = usePreviewStore((s) => s.bumpReload);
  const overlayOpen = usePreviewStore((s) => s.overlayOpen);

  const showJsBlockedBanner =
    !!selectedFile && trustMode === "safe" && selectedFileHasScripts;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      // Collapse the native preview webview to nothing when there's no file,
      // or while a DOM overlay (share popover) needs to render above it.
      if (!selectedFile || overlayOpen) {
        void invoke("update_preview_bounds", {
          label: PREVIEW_LABEL,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        });
        return;
      }
      const rect = el.getBoundingClientRect();
      // Skip transient zero-size measurements (mid-layout, hidden parents)
      // so unrelated re-renders can't accidentally blank the preview.
      if (rect.width <= 0 || rect.height <= 0) return;
      void invoke("update_preview_bounds", {
        label: PREVIEW_LABEL,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [showJsBlockedBanner, selectedFile, overlayOpen]);

  useEffect(() => {
    if (!selectedFile) return;
    void invoke("show_preview", {
      label: PREVIEW_LABEL,
      file: selectedFile,
      trust: trustMode,
      token: reloadToken,
    });
  }, [selectedFile, trustMode, reloadToken]);

  async function enableTrusted() {
    if (!root) return;
    await setTrustMode(root, "trusted");
    bumpReload();
  }

  return (
    <div className="flex h-full w-full flex-col bg-bg">
      {showJsBlockedBanner && (
        <div className="flex shrink-0 items-center gap-3 border-b border-warn/30 bg-warn/10 px-4 py-2 text-[12px] text-warn">
          <span className="text-base leading-none">⚡</span>
          <span className="flex-1 text-fg">
            This file uses JavaScript. Switch to{" "}
            <span className="font-medium text-warn">Trusted</span> to render it
            fully.
          </span>
          <button
            type="button"
            onClick={enableTrusted}
            className="rounded-md border border-warn/40 bg-warn/20 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-warn hover:bg-warn/30"
          >
            Switch to Trusted
          </button>
        </div>
      )}
      <div ref={containerRef} className="relative flex-1 bg-bg">
        {!selectedFile && (
          <div className="flex h-full w-full items-center justify-center text-fg-subtle">
            <div className="text-center">
              <div className="font-mono text-sm">Select a file to preview</div>
              <div className="mt-1 font-mono text-xs text-fg-subtle/80">
                Sidebar shows .html and .htm files in your workspace
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
