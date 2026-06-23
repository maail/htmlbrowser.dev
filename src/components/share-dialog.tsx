import { useEffect, useState } from "react";
import {
  getShareStatus,
  openExternalPath,
  shareArtifact,
} from "@/lib/tauri";
import type { ShareResult, ShareStatus } from "@/types";

interface ShareDialogProps {
  root: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function ShareDialog({
  root,
  filePath,
  fileName,
  onClose,
}: ShareDialogProps) {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingStatus(true);
    getShareStatus(root, filePath)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [root, filePath]);

  const alreadyShared = !!status;
  const currentUrl = result?.url ?? status?.url ?? null;

  async function doShare() {
    setWorking(true);
    setError(null);
    try {
      const res = await shareArtifact(
        root,
        filePath,
        alreadyShared ? message.trim() || undefined : undefined,
      );
      setResult(res);
      setStatus({ docId: res.docId, url: res.url });
      setMessage("");
    } catch (err) {
      setError(typeof err === "string" ? err : String(err));
    } finally {
      setWorking(false);
    }
  }

  const primaryLabel = working
    ? "Working…"
    : alreadyShared
      ? "Push update"
      : "Create share link";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-9 z-50 w-80 rounded-lg border border-border bg-bg-subtle/95 p-3 shadow-xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-fg-warm">
            Share artifact
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-5 w-5 items-center justify-center rounded text-fg-subtle hover:text-fg-warm"
          >
            ×
          </button>
        </div>
        <div className="mb-3 truncate font-mono text-[11px] text-fg-subtle">
          {fileName}
        </div>

        {loadingStatus ? (
          <div className="py-2 text-[11px] text-fg-subtle">Checking…</div>
        ) : (
          <>
            {currentUrl && (
              <LinkRow url={currentUrl} version={result?.version} />
            )}

            {currentUrl && (
              <div className="mb-3 flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => openExternalPath(currentUrl)}
                  className="text-accent hover:underline"
                >
                  Open in browser
                </button>
                <span className="text-fg-subtle">·</span>
                <button
                  type="button"
                  onClick={() => openExternalPath(`${currentUrl}/changes`)}
                  className="text-accent hover:underline"
                >
                  Version history
                </button>
              </div>
            )}

            {alreadyShared && (
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Update message (optional)"
                maxLength={200}
                className="mb-2 w-full rounded-md border border-border bg-bg-muted/40 px-2.5 py-1.5 text-[12px] text-fg placeholder:text-fg-subtle focus:border-accent/50 focus:outline-none"
              />
            )}

            <button
              type="button"
              onClick={doShare}
              disabled={working}
              className="w-full rounded-md bg-accent/25 px-3 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent/70 hover:text-bg disabled:opacity-50"
            >
              {primaryLabel}
            </button>

            {result && (
              <div className="mt-2 text-[11px] text-fg-subtle">
                {result.updated
                  ? `Pushed v${result.version}.`
                  : `Live at v${result.version}. Anyone with the link can view it.`}
              </div>
            )}

            {error && (
              <div className="mt-2 text-[11px] text-red-400">{error}</div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function LinkRow({ url, version }: { url: string; version?: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; silently ignore.
    }
  }

  return (
    <div className="mb-2 flex items-center gap-1.5">
      <code className="flex-1 truncate rounded-md border border-border bg-bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-fg-warm">
        {url}
      </code>
      {version !== undefined && (
        <span className="font-mono text-[10px] text-fg-subtle">v{version}</span>
      )}
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md border border-border bg-white/5 px-2 py-1.5 text-[11px] text-fg-muted transition-colors hover:bg-white/10 hover:text-fg-warm"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
