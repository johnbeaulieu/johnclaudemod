import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { GitInfo } from '../types'

const COMMIT = 'Commit the current changes with a clear message.'
const COMMIT_PUSH =
  'Commit the current changes with a clear message, then push to the remote.'
const PUSH = 'Push the current branch to the remote.'

const git = atom({ plugin: 'quick-actions', key: 'git' } as const, null, {
  shape: 'git-1',
})

// Reads `git status --porcelain=v2 --branch` output.
export function parseStatus(out: string, hasRemote: boolean): GitInfo {
  const lines = out.split('\n').filter(Boolean)
  const ab = lines.find(l => l.startsWith('# branch.ab '))
  return {
    isDirty: lines.some(l => !l.startsWith('#')),
    hasRemote,
    ahead: ab ? Number(ab.split(' ')[2]) : null,
  }
}

async function refresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const run = (argv: string[]) =>
    $.process.run(argv, { cwd }).catch(() => ({ exitCode: 1, stdout: '' }))
  const [status, remotes] = await Promise.all([
    run(['git', 'status', '--porcelain=v2', '--branch']),
    run(['git', 'remote']),
  ])
  const info =
    status.exitCode === 0
      ? parseStatus(status.stdout, remotes.stdout.trim() !== '')
      : null
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

    const { Box, Button } = $.ui.resolve(e)
    // No upstream yet means the branch has never been pushed.
    const needsPush = info.isDirty || info.ahead !== 0

    return (
      <Box flexGrow={1} justifyContent="flex-end" columnGap={2}>
        <Button
          key="commit"
          label="Commit"
          dimColor={!info.isDirty}
          onPress={() =>
            info.isDirty
              ? void $.prompt.submit({ text: COMMIT })
              : $.ui.toast('Nothing to commit')
          }
        />
        {info.hasRemote && (
          <Button
            key="push"
            label={info.isDirty ? 'Commit & push' : 'Push'}
            dimColor={!needsPush}
            onPress={() =>
              needsPush
                ? void $.prompt.submit({ text: info.isDirty ? COMMIT_PUSH : PUSH })
                : $.ui.toast('Remote is up to date')
            }
          />
        )}
      </Box>
    )
  })
}
