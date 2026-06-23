import { invoke } from "@tauri-apps/api/core";
import type {
  DirEntry,
  SearchResults,
  ShareResult,
  ShareStatus,
  StartupBundle,
  TrustMode,
  WorkspaceTree,
} from "@/types";

export function getStartupState(): Promise<StartupBundle> {
  return invoke("get_startup_state");
}

export function openWorkspace(root: string): Promise<WorkspaceTree> {
  return invoke("open_workspace", { root });
}

export function readDirectory(path: string): Promise<DirEntry[]> {
  return invoke("read_directory", { path });
}

export function readWorkspaceFile(path: string): Promise<string> {
  return invoke("read_workspace_file", { path });
}

export interface HtmlInspection {
  hasScripts: boolean;
  hasExternalResources: boolean;
}

export function inspectHtml(path: string): Promise<HtmlInspection> {
  return invoke("inspect_html", { path });
}

export function setTrustMode(workspace: string, mode: TrustMode): Promise<void> {
  return invoke("set_trust_mode", { workspace, mode });
}

export function getTrustMode(workspace: string): Promise<TrustMode> {
  return invoke("get_trust_mode", { workspace });
}

export function pushRecentWorkspace(root: string): Promise<string[]> {
  return invoke("push_recent_workspace", { root });
}

export function removeRecentWorkspace(root: string): Promise<string[]> {
  return invoke("remove_recent_workspace", { root });
}

export function revealInFinder(path: string): Promise<void> {
  return invoke("reveal_in_finder", { path });
}

export function openExternalPath(path: string): Promise<void> {
  return invoke("open_external", { path });
}

export function searchWorkspace(
  root: string,
  query: string,
  caseSensitive = false,
): Promise<SearchResults> {
  return invoke("search_workspace", { root, query, caseSensitive });
}

export function shareArtifact(
  root: string,
  path: string,
  message?: string,
): Promise<ShareResult> {
  return invoke("share_artifact", { root, path, message: message ?? null });
}

export function getShareStatus(
  root: string,
  path: string,
): Promise<ShareStatus | null> {
  return invoke("get_share_status", { root, path });
}

/** Build a `htmlartifact://` URL for a file in the active workspace. */
export function artifactUrl(path: string): string {
  // Tauri v2 normalizes custom protocols to <scheme>://localhost/<...> on macOS.
  // We pass the absolute file path as the URL path component.
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `htmlartifact://localhost${encoded}`;
}
