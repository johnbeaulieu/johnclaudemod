import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { GitInfo } from '../types'

const COMMIT = 'Commit the current changes with a clear message.'
const COMMIT_PUSH =
  'Commit the current changes with a clear message, then push to the remote.'
const PUSH = 'Push the current branch to the remote.'

// diff colors readable on light and dark backgrounds
const GREEN = '#2da44e'
const RED = '#cf222e'

// git's empty tree: the diff base before the first commit
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
// ponytail: counts lines of at most this many new files per check; raise it if big untracked trees matter
const MAX_UNTRACKED = 50

const git = atom({ plugin: 'john-claude-mods', key: 'git' } as const, null, {
  shape: 'git-3',
})

// Reads `git status --porcelain=v2 --branch -uall` output.
export function parseStatus(out: string) {
  const lines = out.split('\n').filter(Boolean)
  const ab = lines.find(l => l.startsWith('# branch.ab '))
  return {
    changes: lines.filter(l => !l.startsWith('#')).length,
    untracked: lines.filter(l => l.startsWith('? ')).map(l => l.slice(2)),
    isInitial: lines.includes('# branch.oid (initial)'),
    ahead: ab ? Number(ab.split(' ')[2]) : null,
  }
}

// Sums `git diff --numstat` output; binary files ("-\t-") count as 0.
export function parseNumstat(out: string) {
  let added = 0
  let removed = 0
  for (const line of out.split('\n')) {
    const [a, r] = line.split('\t')
    added += Number(a) || 0
    removed += Number(r) || 0
  }
  return { added, removed }
}

export function countLines(text: string) {
  if (text === '' || text.includes('\0')) return 0 // empty or binary
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const run = (argv: string[]) =>
    $.process.run(argv, { cwd }).catch(() => ({ exitCode: 1, stdout: '' }))
  const [status, remotes] = await Promise.all([
    run(['git', 'status', '--porcelain=v2', '--branch', '-uall']),
    run(['git', 'remote']),
  ])

  let info: GitInfo | null = null
  if (status.exitCode === 0) {
    const s = parseStatus(status.stdout)
    const diff = await run(['git', 'diff', s.isInitial ? EMPTY_TREE : 'HEAD', '--numstat'])
    const lines = parseNumstat(diff.stdout)
    // untracked paths are relative to cwd; a file that can't be read counts 0
    const fresh = await Promise.all(
      s.untracked
        .slice(0, MAX_UNTRACKED)
        .map(p => $.fs.read(`${cwd}/${p}`).then(countLines, () => 0)),
    )
    info = {
      changes: s.changes,
      added: lines.added + fresh.reduce((a, b) => a + b, 0),
      removed: lines.removed,
      hasRemote: remotes.stdout.trim() !== '',
      ahead: s.ahead,
    }
  }

  // only write on change, so idle polling doesn't redraw
  if (JSON.stringify(info) !== JSON.stringify(await read($, git))) {
    await update($, git, () => info)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await refresh($)
    // ponytail: polls every 3s to catch changes made outside Claude; a file watcher if that ever costs too much
    $.clock.every(3000, () => refresh($))
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    await refresh($)
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const info = await read($, git)
    if (e.props.hasSurvey || !info) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const isDirty = info.changes > 0
    // No upstream yet means the branch has never been pushed.
    const needsPush = isDirty || info.ahead !== 0

    return (
      <Box flexGrow={1} justifyContent="flex-end" columnGap={2}>
        <Box columnGap={1}>
          <Button
            key="commit"
            label={isDirty ? `Commit (${info.changes})` : 'Commit'}
            dimColor={!isDirty}
            onPress={() =>
              isDirty
                ? void $.prompt.submit({ text: COMMIT })
                : $.ui.toast('Nothing to commit')
            }
          />
          {/* outside the Button: a desktop's native button drops child colors */}
          {isDirty && (
            <Box key="lines" columnGap={1}>
              <Text color={GREEN}>{`+${info.added}`}</Text>
              <Text color={RED}>{`-${info.removed}`}</Text>
            </Box>
          )}
        </Box>
        {info.hasRemote && (
          <Button
            key="push"
            label={isDirty ? 'Commit & push' : 'Push'}
            dimColor={!needsPush}
            onPress={() =>
              needsPush
                ? void $.prompt.submit({ text: isDirty ? COMMIT_PUSH : PUSH })
                : $.ui.toast('Remote is up to date')
            }
          />
        )}
      </Box>
    )
  })
}
