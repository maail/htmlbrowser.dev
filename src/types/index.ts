export type DirEntryKind = "file" | "directory";

export interface DirEntry {
  name: string;
  path: string;
  kind: DirEntryKind;
  /** Only present for files. Undefined for directories. */
  modifiedMs?: number;
  /** Children loaded lazily for directories. */
  children?: DirEntry[];
}

export interface WorkspaceTree {
  root: string;
  entries: DirEntry[];
}

export type TrustMode = "safe" | "trusted";

export interface WorkspaceSettings {
  trustMode: TrustMode;
}

export interface StartupBundle {
  recentWorkspaces: string[];
  lastWorkspace: string | null;
}

export interface FileChangeEvent {
  workspace: string;
  path: string;
  kind: "modified" | "created" | "removed" | "renamed";
}

export interface DirectoryChangeEvent {
  workspace: string;
  path: string;
}

export interface SearchMatch {
  path: string;
  name: string;
  lineNumber: number;
  before: string;
  hit: string;
  after: string;
}

export interface SearchResults {
  matches: SearchMatch[];
  truncated: boolean;
}

export interface ShareResult {
  docId: string;
  url: string;
  version: number;
  /** true when a new version was pushed to an already-shared file. */
  updated: boolean;
}

export interface ShareStatus {
  docId: string;
  url: string;
}
