# Github extract task ids action
Extract task ids from the branch name, the pull request title and the changelog links in the pull request body.

Works on the following events:
```yml
on:
    pull_request:
        types: [ opened, synchronize, closed ]
    pull_request_review:
        types: [ submitted, edited, dismissed ]
```

Could be used to extract task ID's from Jira, Clickup or other project management tools. These can then be used for later processing. For example, changing the stataus in the external project management tool.

## Where task ids are read from

The action only reads a task id where the pull request states what it delivers:

| Source | Read? | Example |
| --- | --- | --- |
| Branch name | yes | `feature/ABC-123-do-the-thing` |
| Pull request title | yes | `ABC-123 Do the thing` |
| Changelog link in the body | yes | `- [ABC-123](https://example.com/task/ABC-123) What changed.` |
| Anything else in the body | no | ``- other/repo#12 (`ABC-123`)`` |
| Commit messages | no | `The ABC-123 patch still applies, it touches another file.` |

Only the link text of a markdown link counts as a changelog entry, so `[the ABC-123 preview](https://example.com)` is ignored: the id has to be what the link points at, not a word inside a sentence.

Commit messages are not read at all. A task id mentioned in passing in a commit body does not describe the work a pull request delivers, and acting on it drags unrelated tasks through the pull request lifecycle. Because task ids are unique across a whole workspace, that can reach tasks belonging to an entirely different project.

When no task id is found in any of the three sources, the action logs a warning and returns an empty `task_ids` output, so a workflow can still decide what to do (`if: ${{ steps.task_ids.outputs.task_ids }}`).

For example, setting all tasks back to 'in progress' after changes are requested:
```yml

    clickup_task_in_progress:
        name: Clickup task to in progress
        runs-on: self-hosted
        if: github.actor != 'dependabot[bot]' &&
            github.event_name == 'pull_request_review' &&
            github.event.review.state == 'changes_requested'
        steps:
            -   name: Extract task ids
                uses: Tjitse-E/github-extract-task-ids-action@master
                id: task_ids
                with:
                    token: ${{ secrets.GITHUB_TOKEN }}

            -   name: Get clickup team ID
                if: ${{ steps.task_ids.outputs.task_ids }}
                env:
                    clickup_token: ${{ secrets.CLICKUP_TOKEN }}
                run: |
                    TEAM_ID=$(curl --location --request GET 'https://api.clickup.com/api/v2/team' --header "Authorization: $clickup_token" --header 'Content-Type: application/json' | jq -r "(.teams | first).id")
                    echo "TEAM_ID=${TEAM_ID}" >> $GITHUB_ENV

            -   name: Set clickup task status
                uses: Tjitse-E/clickup-change-status@master
                if: ${{ steps.task_ids.outputs.task_ids }}
                with:
                    clickup_token: ${{ secrets.CLICKUP_TOKEN }}
                    clickup_team_id: ${{ env.TEAM_ID }}
                    clickup_custom_task_ids: ${{ steps.task_ids.outputs.task_ids }}
                    clickup_status: ${{ env.CCLICKUP_IN_PROGRESS_STATUS }}
```                    
