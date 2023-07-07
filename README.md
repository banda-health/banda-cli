# banda-cli
A CLI to help with all your Banda needs.

# Install
```
$ npm install -g banda-cli
```

# Usage
```
$ banda deploy
```

The CLI comes with a command to help with deployments. It's meant to be used to aid in creating a release. It does the following things:

1. Creates a release branch
1. Updates the version number, if specified
1. Merges the branch
1. Creates a tag
1. Merges the updates back to a development branch
1. Updates the new version number, if specified

# Version Files
The CLI automatically looks for versions in one of two files in the current working-directory (CWD):

- package.json
- VERSION.conf

The CLI can be modified to make these options configurable, but they're not now.

Formats for the versions must be in the following formats:

| package.json       | VERSION.conf  |
|--------------------|---------------|
| "version": "#.#.#" | VERSION=#.#.# |

# Development
To install locally, clone the repo. Then,

```
npm install
npm run build
npm link
```

Afterwards, you can run `banda [command]` in any directory.

## Tests
Unit tests are included. To run them, run:
```
npm test
```

# Possible Updates
- Update the CLI to take arguments for all the prompts
- Configure the CLI through a config file(s)
- Add other commands that the team needs