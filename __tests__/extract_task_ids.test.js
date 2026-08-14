const fs = require('fs')
const path = require('path')

const mockPullsGet = jest.fn()
const mockListCommits = jest.fn()

jest.mock('@actions/github', () => ({
    getOctokit: () => ({
        rest: {
            pulls: {
                get: mockPullsGet,
                listCommits: mockListCommits,
            },
        },
    }),
    context: {
        repo: { owner: 'foo', repo: 'bar' },
        payload: {},
    },
}))

const core = require('@actions/core')
const github = require('@actions/github')
const run = require('../src/run')

const readFixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf-8'))
const prResponse = readFixture('pull_request_api_response.json')
const commitsResponse = readFixture('api_output.json')

// The fixture pull request carries an id in its branch (REF-1234) and one in its
// title (REF-12345). Its body mentions XYZ-123 as loose prose and its commits
// mention three more ids, none of which describe what the pull request delivers.
const expectFoundTaskIds = (infoMock, setOutputMock) => {
    expect(infoMock).toHaveBeenCalledWith('Found task id REF-1234')
    expect(infoMock).toHaveBeenCalledWith('Found task id REF-12345')
    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'REF-1234\nREF-12345')
}

beforeEach(() => {
    process.env['INPUT_TOKEN'] = 'xyz'
    process.env['GITHUB_REPOSITORY'] = 'foo/bar'
    process.env['INPUT_TASK_ID_PATTERN'] = '[A-Z]{2,}-[0-9]{1,5}'

    mockPullsGet.mockReset().mockResolvedValue({ data: prResponse })
    mockListCommits.mockReset().mockResolvedValue({ data: commitsResponse })
    github.context.repo = { owner: 'foo', repo: 'bar' }
    github.context.payload = {}
})

afterEach(() => {
    jest.restoreAllMocks()
    delete process.env['GITHUB_REPOSITORY']
    delete process.env['INPUT_TOKEN']
    delete process.env['INPUT_TASK_ID_PATTERN']
    delete process.env['INPUT_PULL_NUMBER']
})

test('Extract task ids with manual pull_number input', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expectFoundTaskIds(infoMock, setOutputMock)
})

test('Extract task ids after PR opened', async () => {
    github.context.payload = readFixture('pull_request_context.json')

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expectFoundTaskIds(infoMock, setOutputMock)
})

test('Extract task ids after PR review submitted', async () => {
    github.context.payload = readFixture('pull_request_review_context.json')

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expectFoundTaskIds(infoMock, setOutputMock)
})

test('Extracts multiple task ids from a single string (global matching)', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    mockPullsGet.mockResolvedValue({
        data: { head: { ref: 'main' }, title: 'PIPE-1 and PIPE-2 done', body: '' },
    })

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expect(infoMock).toHaveBeenCalledWith('Found task id PIPE-1')
    expect(infoMock).toHaveBeenCalledWith('Found task id PIPE-2')
    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'PIPE-1\nPIPE-2')
})

test('Ignores task ids that are only mentioned in a commit message', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    mockPullsGet.mockResolvedValue({
        data: { head: { ref: 'feature/PIPE-1-do-the-thing' }, title: 'PIPE-1 Do the thing', body: '' },
    })
    mockListCommits.mockResolvedValue({
        data: [{ commit: { message: 'PIPE-1 Do the thing\n\nThe PIPE-2 patch still applies, it touches another file.' } }],
    })

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expect(infoMock).not.toHaveBeenCalledWith('Found task id PIPE-2')
    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'PIPE-1')
    expect(mockListCommits).not.toHaveBeenCalled()
})

test('Extracts task ids from changelog links in the pull request body', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    mockPullsGet.mockResolvedValue({
        data: {
            head: { ref: 'development' },
            title: 'Release 2.224.0',
            body: '## Changelog\r\n### Changed\r\n- [PIPE-1](https://example.com/task/PIPE-1) Something changed.\r\n### Fixed\r\n- [PIPE-2](https://example.com/task/PIPE-2): Something fixed.\r\n',
        },
    })

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expect(infoMock).toHaveBeenCalledWith('Found task id PIPE-1')
    expect(infoMock).toHaveBeenCalledWith('Found task id PIPE-2')
    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'PIPE-1\nPIPE-2')
})

test('Ignores task ids in the body that are not a changelog link', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    mockPullsGet.mockResolvedValue({
        data: {
            head: { ref: 'feature/PIPE-1-do-the-thing' },
            title: 'PIPE-1 Do the thing',
            body: 'Sibling pull requests:\r\n- owner/other-repo#202 (`PIPE-2`)\r\n- see also PIPE-3\r\n- [the PIPE-4 preview](https://example.com/preview)\r\n',
        },
    })

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'PIPE-1')
    expect(infoMock).not.toHaveBeenCalledWith('Found task id PIPE-2')
    expect(infoMock).not.toHaveBeenCalledWith('Found task id PIPE-3')
    expect(infoMock).not.toHaveBeenCalledWith('Found task id PIPE-4')
})

test('Warns when the pull request declares no task id at all', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    mockPullsGet.mockResolvedValue({
        data: { head: { ref: 'chore/tidy-up' }, title: 'Tidy up the config', body: 'Nothing to see here.' },
    })

    const warningMock = jest.spyOn(core, 'warning')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expect(warningMock).toHaveBeenCalledWith(
        'No task ids found in the branch name, the pull request title or the changelog links in the body.'
    )
    expect(setOutputMock).toHaveBeenCalledWith('task_ids', '')
})

test('Handles a pull request without a body', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    mockPullsGet.mockResolvedValue({
        data: { head: { ref: 'feature/PIPE-1-do-the-thing' }, title: 'PIPE-1 Do the thing', body: null },
    })

    const setOutputMock = jest.spyOn(core, 'setOutput')
    const setFailedMock = jest.spyOn(core, 'setFailed')

    await run()

    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'PIPE-1')
    expect(setFailedMock).not.toHaveBeenCalled()
})
