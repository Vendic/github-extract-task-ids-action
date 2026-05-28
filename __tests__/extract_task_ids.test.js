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

const expectFoundTaskIds = (infoMock, setOutputMock) => {
    expect(infoMock).toHaveBeenCalledWith('Found task id ABCDEFGH-14')
    expect(infoMock).toHaveBeenCalledWith('Found task id ABC-100')
    expect(infoMock).toHaveBeenCalledWith('Found task id DEV-1234')
    expect(infoMock).toHaveBeenCalledWith('Found task id XYZ-123')
    expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'ABCDEFGH-14\nABC-100\nDEV-1234\nXYZ-123\nREF-1234\nREF-12345')
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

test('Extract 4 task ids with manual pull_number input', async () => {
    process.env['INPUT_PULL_NUMBER'] = '2'

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expectFoundTaskIds(infoMock, setOutputMock)
})

test('Extract 4 task ids after PR opened', async () => {
    github.context.payload = readFixture('pull_request_context.json')

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expectFoundTaskIds(infoMock, setOutputMock)
})

test('Extract 4 task ids after PR review submitted', async () => {
    github.context.payload = readFixture('pull_request_review_context.json')

    const infoMock = jest.spyOn(core, 'info')
    const setOutputMock = jest.spyOn(core, 'setOutput')

    await run()

    expectFoundTaskIds(infoMock, setOutputMock)
})
