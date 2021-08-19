# Github extract task ids action
Extract task ids from commit messages, branch and pull request title

Works on the followign events:
```yml
on:
    pull_request:
        types: [ opened, synchronize, closed ]
    pull_request_review:
        types: [ submitted, edited, dismissed ]
```
