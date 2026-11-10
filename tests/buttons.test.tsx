import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'john-claude-mods',
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

const SYNCED = '# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +0 -0\n'

// Each case: git status / remote / diff output, untracked file contents, exit code, what to expect.
const CASES = [
  { name: 'not a repo', status: '', remote: '', diff: '', files: {}, code: 128, commit: null, push: null },
  {
    name: 'one modified file, synced remote',
    status: SYNCED + '1 .M N... 100644 100644 100644 a b f.txt\n',
    remote: 'origin\n',
    diff: '11\t3\tf.txt\n',
    files: {},
    code: 0,
    commit: { text: 'Commit (1)', dim: false },
    lines: '+11 -3',
    push: { text: 'Commit & push', dim: false },
  },
  {
    name: 'staged, modified, untracked and binary',
    status: SYNCED + '1 M. N... 100644 100644 100644 a b a.txt\n1 .M N... 100644 100644 100644 a b b.txt\n? c.txt\n? d.png\n',
    remote: 'origin\n',
    diff: '2\t1\ta.txt\n3\t0\tb.txt\n-\t-\tlogo.png\n',
    files: { 'c.txt': 'one\ntwo\nthree', 'd.png': 'PNG\0\0' },
    code: 0,
    commit: { text: 'Commit (4)', dim: false },
    lines: '+8 -1',
    push: { text: 'Commit & push', dim: false },
  },
  {
    name: 'clean, ahead of remote',
    status: '# branch.oid abc\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -0\n',
    remote: 'origin\n',
    diff: '',
    files: {},
    code: 0,
    commit: null,
    push: { text: 'Push', dim: false },
  },
  {
    name: 'clean, synced remote',
    status: SYNCED,
    remote: 'origin\n',
    diff: '',
    files: {},
    code: 0,
    commit: null,
    push: null,
  },
  {
    name: 'clean, branch never pushed',
    status: '# branch.oid abc\n# branch.head feature\n',
    remote: 'origin\n',
    diff: '',
    files: {},
    code: 0,
    commit: null,
    push: { text: 'Push', dim: false },
  },
  {
    name: 'clean, no remote: nothing to do',
    status: '# branch.oid abc\n# branch.head main\n',
    remote: '',
    diff: '',
    files: {},
    code: 0,
    commit: null,
    push: null,
  },
  {
    name: 'first commit, new file, no remote',
    status: '# branch.oid (initial)\n# branch.head main\n? new.txt\n',
    remote: '',
    diff: '',
    files: { 'new.txt': 'a\nb\n' },
    code: 0,
    commit: { text: 'Commit (1)', dim: false },
    lines: '+2 -0',
    push: null,
  },
] as const

for (const c of CASES) {
  test(c.name, async ($, on) => {
    const out = (stdout: string) => ({
      value: { exitCode: c.code, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    on('session.cwd', () => ({ value: '/repo' }))
    on('process.run', (_, e) => {
      if (e.argv[1] === 'diff') {
        // before the first commit the diff must be against the empty tree
        expect(e.argv[2]).toBe(c.status.includes('(initial)') ? '4b825dc642cb6eb9a060e54bf8d69288fbee4904' : 'HEAD')
        return out(c.diff)
      }
      return out(e.argv[1] === 'status' ? c.status : c.remote)
    })
    on('fs.read', (_, e) => {
      const text = (c.files as Record<string, string>)[e.path.split(/[\\/]/).pop()!]
      return text === undefined ? { deny: 'missing' } : { value: text }
    })
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

    expect(commit ? { text: commit.text, dim: !!commit.props.dimColor } : null).toEqual(c.commit)
    expect(push ? { text: push.text, dim: !!push.props.dimColor } : null).toEqual(c.push)

    // line counts sit beside the button: "+a" green, "-r" red
    const lines = 'lines' in c ? c.lines : undefined
    const added = await ui.find({ type: 'Text', text: /^\+\d+$/ })
    const removed = await ui.find({ type: 'Text', text: /^-\d+$/ })
    expect(added && removed ? `${added.text} ${removed.text}` : undefined).toBe(lines)
    if (lines) {
      expect(added?.props.color).toBe('#2da44e')
      expect(removed?.props.color).toBe('#cf222e')
    }
    await ui.unmount()
  })
}
