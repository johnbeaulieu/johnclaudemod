import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'quick-actions',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 5,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 5 },
    view: {},
  },
} as const

// Each case: git status output, git remote output, exit code, what to expect.
const CASES = [
  { name: 'not a repo', status: '', remote: '', code: 128, commit: null, push: null },
  {
    name: 'dirty, synced remote',
    status: '# branch.head main\n# branch.upstream origin/main\n# branch.ab +0 -0\n1 .M N... 100644 100644 100644 a b f.txt\n',
    remote: 'origin\n',
    code: 0,
    commit: { label: 'Commit', dim: false },
    push: { label: 'Commit & push', dim: false },
  },
  {
    name: 'clean, ahead of remote',
    status: '# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -0\n',
    remote: 'origin\n',
    code: 0,
    commit: { label: 'Commit', dim: true },
    push: { label: 'Push', dim: false },
  },
  {
    name: 'clean, synced remote',
    status: '# branch.head main\n# branch.upstream origin/main\n# branch.ab +0 -0\n',
    remote: 'origin\n',
    code: 0,
    commit: { label: 'Commit', dim: true },
    push: { label: 'Push', dim: true },
  },
  {
    name: 'clean, branch never pushed',
    status: '# branch.head feature\n',
    remote: 'origin\n',
    code: 0,
    commit: { label: 'Commit', dim: true },
    push: { label: 'Push', dim: false },
  },
  {
    name: 'dirty, no remote',
    status: '# branch.head main\n? new.txt\n',
    remote: '',
    code: 0,
    commit: { label: 'Commit', dim: false },
    push: null,
  },
] as const

for (const c of CASES) {
  test(c.name, async ($, on) => {
    on('session.cwd', () => ({ value: '/repo' }))
    on('process.run', (_, e) => ({
      value:
        e.argv[1] === 'status'
          ? { exitCode: c.code, stdout: c.status, stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
          : { exitCode: c.code, stdout: c.remote, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    on('clock.every', () => ({ value: undefined }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('turn.complete', () => ({ text: '' }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
    await $.turn.complete({
      answer: '',
      durationMs: 1,
      isAborted: false,
      turnId: 't1',
      reason: 'completed',
    } as never)

    const ui = await $.ui.mount(BAND)
    const commit = await ui.find({ type: 'Button', key: 'commit' })
    const push = await ui.find({ type: 'Button', key: 'push' })

    expect(commit ? { label: commit.props.label, dim: !!commit.props.dimColor } : null).toEqual(c.commit)
    expect(push ? { label: push.props.label, dim: !!push.props.dimColor } : null).toEqual(c.push)
    await ui.unmount()
  })
}
