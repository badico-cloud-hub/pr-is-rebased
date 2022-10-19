# Verify If Rebased
Action for verify if PR is rebased, and set labels to pr - (is-rebased/not-rebased)

## Usage
```
- uses: badico-cloud-hub/verify-if-rebased@v1
  with:
    # Default branch of repository
    # param default - (github.event.repository.default_branch)
    default-branch: ''
    
    # Branch of pull request
    # param default - (github.event.pull_request.head.ref )
    pull-request-branch: ''
    
    # Token with credentials for repository
    # is required
    gh-token: ''

    # React of push in default branch
    # param default: false
    reactive: ''
```