import * as core from '@actions/core'
import * as github from '@actions/github'

const run = async (): Promise<void> => {
    try {
        core.debug('Starting task id extraction.')
        const token = core.getInput('token')
        const task_id_pattern : RegExp = new RegExp(core.getInput('task_id_pattern'))
        const octokit = github.getOctokit(token)
        // @ts-ignore
        const branch = github.context.payload.pull_request.head.ref
        const pull_number = github.context.payload.number
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        let result = await octokit.rest.pulls.listCommits({
            owner: owner,
            repo: repo,
            pull_number: pull_number
        })
        core.debug(`Got ${result.data.length} commits from Github.`)
        core.debug(`Testing with regex "${task_id_pattern}"`)

        // Get all of the commit messages and the branch names in one list.
        let pile_of_possible_task_ids : string[] = []
        for (const commit of result.data) {
            pile_of_possible_task_ids.push(commit.commit.message)
        }
        pile_of_possible_task_ids.push(branch)

        // Extract the task ids using the input pattern
        let task_ids : string[] = []
        for (const possible_task_id of pile_of_possible_task_ids) {
            core.debug(`Testing:  ${possible_task_id}`)
            if (task_id_pattern.test(possible_task_id)) {
                let matches = possible_task_id.match(task_id_pattern)
                // @ts-ignore
                let task_id = matches[0]
                core.debug(`Pushing ${task_id} to the list`)
                task_ids.push(task_id)
            }
        }

        const unique_task_ids : string[] = [ ... new Set(task_ids) ]
        for (const unique_task_id of unique_task_ids) {
            core.info(`Found task id ${unique_task_id}`)
        }

        core.setOutput('task_ids', JSON.stringify(unique_task_ids))
    } catch (error) {
        core.setFailed(`Action failed: ${error}`)
    }
}

run()

export default run
