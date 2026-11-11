// What the buttons know about the session's folder; null when it is not a git repo.
export type GitInfo = {
  // changed, staged and untracked files
  changes: number
  // lines added and removed across those files, new files included
  added: number
  removed: number
  hasRemote: boolean
  // commits not on the upstream; null when the branch has no upstream yet
  ahead: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'john-claude-mods': {
      git: Shaped<GitInfo | null>
      // set by `/johnclaudemod hide`, cleared by `/johnclaudemod show`
      hidden: boolean
    }
  }
}
