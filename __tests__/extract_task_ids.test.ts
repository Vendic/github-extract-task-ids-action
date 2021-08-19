import * as github from '@actions/github'
import * as core from '@actions/core'
import run from '../extract_task_ids'
import path from "path";
import * as fs from "fs";
import {WebhookPayload} from "@actions/github/lib/interfaces";
import nock from "nock";

describe('Test pull request opened', () => {
    it('extracts 4 task ids', async () => {
        // Mocks
        const infoMock = jest.spyOn(core, 'info')
        const setOutputMock = jest.spyOn(core, 'setOutput')
        const apiOutputPath = path.join(__dirname, 'api_output.json')
        const payloadPath = path.join(__dirname, 'pull_request_context.json');
        const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
        github.context.payload = payload as WebhookPayload
        const apiOutput : JSON = JSON.parse(fs.readFileSync(apiOutputPath, 'utf-8'))
        nock('https://api.github.com')
            .persist()
            .get('/repos/foo/bar/pulls/2/commits')
            .reply(200, apiOutput)

        await run()

        // Assertions
        expect(infoMock).toHaveBeenCalledWith('Found task id ABC-100')
        expect(infoMock).toHaveBeenCalledWith('Found task id DEV-1234')
        expect(infoMock).toHaveBeenCalledWith('Found task id ABC-123')
        expect(infoMock).toHaveBeenCalledWith('Found task id ABC-999')
        expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'ABC-100\nDEV-1234\nABC-123\nABC-999')
    })
})

describe('Test pull request review submitted', () => {
    it('extracts 4 task ids', async () => {
        // Mocks
        const infoMock = jest.spyOn(core, 'info')
        const setOutputMock = jest.spyOn(core, 'setOutput')
        const apiOutputPath = path.join(__dirname, 'api_output.json')
        const payloadPath = path.join(__dirname, 'pull_request_review_context.json');
        const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'))
        github.context.payload = payload as WebhookPayload
        const apiOutput : JSON = JSON.parse(fs.readFileSync(apiOutputPath, 'utf-8'))
        nock('https://api.github.com')
            .persist()
            .get('/repos/foo/bar/pulls/2/commits')
            .reply(200, apiOutput)

        await run()

        // Assertions
        expect(infoMock).toHaveBeenCalledWith('Found task id ABC-100')
        expect(infoMock).toHaveBeenCalledWith('Found task id DEV-1234')
        expect(infoMock).toHaveBeenCalledWith('Found task id ABC-123')
        expect(infoMock).toHaveBeenCalledWith('Found task id ABC-999')
        expect(setOutputMock).toHaveBeenCalledWith('task_ids', 'ABC-100\nDEV-1234\nABC-123\nABC-999')
    })
})




beforeEach(() => {
    jest.resetModules()
    process.env['INPUT_TOKEN'] = 'xyz'
    process.env['GITHUB_REPOSITORY'] = 'foo/bar';
    process.env['INPUT_TASK_ID_PATTERN'] = '[A-Z]{2,5}-[0-9]{1,4}'
})

afterEach(() => {
    delete process.env['GITHUB_REPOSITORY']
    delete process.env['INPUT_TOKEN']
    delete process.env['INPUT_TASK_ID_PATTERN']
})
