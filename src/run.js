const core = require('@actions/core')
const github = require('@actions/github')

async function run() {
    try {
        core.debug('Starting task id extraction.')
        const token = core.getInput('token')
        const input_pattern = core.getInput('task_id_pattern')
        const task_id_pattern = new RegExp(input_pattern)
        const octokit = github.getOctokit(token)
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        const pull_number_input = core.getInput('pull_number')
        // Check if pull_number_input is numeric, if not, use the pull_number from the context.
        const pull_number = pull_number_input.match(/^[0-9]+$/)
            ? pull_number_input
            : github.context.payload.number ?? github.context.payload.event.pull_request.number

        if (pull_number === undefined) {
            core.setFailed('Cannot find pull request, no pull request number provided.')
            return
        }

        let pull_request
        try {
            const pull_request_response = await octokit.rest.pulls.get({
                owner: owner,
                repo: repo,
                pull_number: parseInt(pull_number),
            })
            pull_request = pull_request_response.data
        } catch (error) {
            core.setFailed(`Failed to get pull request: ${error}`)
            return
        }

        const branch = pull_request.head.ref
        const pr_title = pull_request.title
        const body = pull_request.body

        const result = await octokit.rest.pulls.listCommits({
            owner: owner,
            repo: repo,
            pull_number: parseInt(pull_number),
        })
        core.debug(`Got ${result.data.length} commits from Github.`)
        core.debug(`Testing with regex "${input_pattern}"`)

        // Get all of the commit messages and the branch names in one list.
        const pile_of_possible_task_ids = []
        for (const commit of result.data) {
            pile_of_possible_task_ids.push(commit.commit.message)
        }

        if (typeof body === 'string') {
            pile_of_possible_task_ids.push(body)
        }
        pile_of_possible_task_ids.push(branch)
        pile_of_possible_task_ids.push(pr_title)

        // Extract the task ids using the input pattern
        const task_ids = []
        for (const possible_task_id of pile_of_possible_task_ids) {
            core.debug(`Testing:  ${possible_task_id}`)
            if (task_id_pattern.test(possible_task_id)) {
                const matches = possible_task_id.match(task_id_pattern)
                const task_id = matches[0]
                core.info(`Found task id ${task_id}`)
                task_ids.push(task_id)
            }
        }

        const uniqueTaskIds = task_ids.filter((n, i) => task_ids.indexOf(n) === i)

        core.setOutput('task_ids', uniqueTaskIds.join('\n'))
    } catch (error) {
        core.setFailed(`Action failed: ${error}`)
    }
}

module.exports = run
