# Github extract task ids action [![Tests](https://github.com/Tjitse-E/github-extract-task-ids-action/actions/workflows/tests.yml/badge.svg)](https://github.com/Tjitse-E/github-extract-task-ids-action/actions/workflows/tests.yml)
Extract task ids from commit messages, branch and pull request title

Works on the followign events:
```yml
on:
    pull_request:
        types: [ opened, synchronize, closed ]
    pull_request_review:
        types: [ submitted, edited, dismissed ]
```
