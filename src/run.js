const core = require('@actions/core')
const github = require('@actions/github')

/**
 * A task id is only trusted where it states what the pull request delivers: the
 * branch name, the pull request title, and the changelog links in the body
 * ("- [ABC-123](url) What changed.").
 *
 * Commit messages are deliberately not read. An id mentioned in passing in a
 * commit body ("the ABC-123 patch still applies, it touches another file") does
 * not describe the work being shipped, and acting on it drags unrelated tasks -
 * on other boards, and even in other projects - through the pull request
 * lifecycle. The same goes for loose mentions in the body, such as a list of
 * sibling pull requests.
 */
async function run() {
    try {
        core.debug('Starting task id extraction.')
        const token = core.getInput('token')
        const input_pattern = core.getInput('task_id_pattern')
        const task_id_pattern = new RegExp(input_pattern, 'g')
        // A changelog entry links the id: "- [ABC-123](https://example.com/task/ABC-123) What changed."
        // Only the link text counts, so a link that merely mentions an id in its
        // description does not qualify.
        const changelog_link_pattern = new RegExp(`\\[\\s*(?<task_id>${input_pattern})\\s*\\]\\(`, 'g')
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
        const body = typeof pull_request.body === 'string' ? pull_request.body : ''

        core.debug(`Testing with regex "${input_pattern}"`)

        const task_ids = []

        const collect = (source, matches) => {
            for (const match of matches) {
                core.debug(`Found ${match} in the ${source}.`)
                core.info(`Found task id ${match}`)
                task_ids.push(match)
            }
        }

        collect('branch name', branch.match(task_id_pattern) ?? [])
        collect('pull request title', pr_title.match(task_id_pattern) ?? [])
        collect(
            'changelog links',
            [...body.matchAll(changelog_link_pattern)].map((match) => match.groups.task_id)
        )

        const uniqueTaskIds = task_ids.filter((n, i) => task_ids.indexOf(n) === i)

        if (uniqueTaskIds.length === 0) {
            core.warning(
                'No task ids found in the branch name, the pull request title or the changelog links in the body.'
            )
        }

        core.setOutput('task_ids', uniqueTaskIds.join('\n'))
    } catch (error) {
        core.setFailed(`Action failed: ${error}`)
    }
}

module.exports = run
