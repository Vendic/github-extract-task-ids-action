# Github extract task ids action [![Tests](https://github.com/Tjitse-E/github-extract-task-ids-action/actions/workflows/tests.yml/badge.svg)](https://github.com/Tjitse-E/github-extract-task-ids-action/actions/workflows/tests.yml)
Extract task ids from commit messages, branch and pull request title

Works on the following events:
```yml
on:
    pull_request:
        types: [ opened, synchronize, closed ]
    pull_request_review:
        types: [ submitted, edited, dismissed ]
```

Could be used to extract task ID's from Jira, Clickup or other project management tools. These can then be used for later processing. For example, changing the stataus in the external project management tool.

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
