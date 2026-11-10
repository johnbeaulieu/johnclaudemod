// What the buttons know about the session's folder; null when it is not a git repo.
export type GitInfo = {
  isDirty: boolean
  hasRemote: boolean
  // commits not on the upstream; null when the branch has no upstream yet
  ahead: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'quick-actions': { git: Shaped<GitInfo | null> }
  }
}
