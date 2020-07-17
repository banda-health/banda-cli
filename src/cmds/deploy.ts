import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import { execGitCmd } from 'run-git-command';
import { Argv } from 'yargs';
import { gitConfig } from '../utils/constants';
import { checkForMergeConflictsOnCurrentBranch, checkIfRemoteExists, getPackageJsonVersion, getFileNameSaveCwd } from '../utils/utils';
import path from 'path';
import { finished } from 'stream';

type UsersVariables = {
	remote: string;
	sourceBranch: string;
	targetBranch: string;
	developmentBranch: string;
	packageVersion: string;
	nextPackageVersion: string;
	tag: string;
};

// Script user-input variables
let remote: string;
let sourceBranch: string;
let targetBranch: string;
let developmentBranch: string;
let packageVersion: string;
let nextPackageVersion: string;
// This variable isn't directly user-input, but it's calculated off $packageVersion
let tag: string;

// Other script variables
const defaultRemote: string = 'origin';
const defaultSourceBranch: string = 'develop';
const defaultTargetBranch: string = 'master';
const defaultDevelopmentBranch: string = 'develop';
const semverRegex = /^\d+\.\d+\.\d+$/;
let initialBranch: string;
const progressFileDir = '/../../progress-files';
const progressFile = {
	get variableSaveFile() {
		return `${__dirname}${progressFileDir}/${getFileNameSaveCwd()}-deploy.conf`;
	},
	get sourceMergeLockFile() {
		return `${__dirname}${progressFileDir}/${getFileNameSaveCwd()}-deploy_source-merge.lock`;
	},
	get targetMergeLockFile() {
		return `${__dirname}${progressFileDir}/${getFileNameSaveCwd()}-target-merge.lock`;
	},
	get taggingLockFile() {
		return `${__dirname}${progressFileDir}/${getFileNameSaveCwd()}-tagging.lock`;
	},
	get developmentPullMergeLockFile() {
		return `${__dirname}${progressFileDir}/${getFileNameSaveCwd()}-development-pull-merge.lock`;
	},
	get developmentMergeLockFile() {
		return `${__dirname}${progressFileDir}/${getFileNameSaveCwd()}-development-merge.lock`;
	},
};

/**
 * Ensure the following prerequisites exist on the user's machine
 * 		1. Git is installed
 * 		2. The user's working directory in Git is clean
 */
async function checkPrerequisites(): Promise<string> {
	// Check if git is installed
	try {
		await execGitCmd(['--version'], gitConfig);
	} catch {
		// Git is not installed
		return Promise.reject('Git is not installed. Please install before continuing.');
	}
	// Ensure working directory is clean
	try {
		const data = (await execGitCmd(['status', '--porcelain'], gitConfig)) as string;
		if (data) {
			return Promise.reject('Working directory is not clean. Please stash or commit changes before continuing.');
		}
	} catch {
		// Uncommitted changes
		return Promise.reject('There was an error checking workspace cleanliness.');
	}
	return Promise.resolve('');
}

/**
 * Save the variables a user entered so they can be used if a run is interrupted and needs to be resumed
 */
function saveUsersVariables(): void {
	fs.writeFileSync(
		progressFile.variableSaveFile,
		JSON.stringify({
			remote,
			sourceBranch,
			targetBranch,
			developmentBranch,
			packageVersion,
			nextPackageVersion,
			tag,
		}),
		'utf8',
	);
}

/**
 * Load the variables saved on the previous run-through
 */
function loadUsersVariables(): void {
	const usersVariables = JSON.parse(fs.readFileSync(progressFile.variableSaveFile, 'utf8')) as UsersVariables;
	remote = usersVariables.remote;
	sourceBranch = usersVariables.sourceBranch;
	targetBranch = usersVariables.targetBranch;
	developmentBranch = usersVariables.developmentBranch;
	packageVersion = usersVariables.packageVersion;
	nextPackageVersion = usersVariables.nextPackageVersion;
}

/**
 * If a user is re-starting a release, make sure these files are eliminated so the script doesn't skip an exeuction
 */
function resetDeploy(): void {
	try {
		fs.unlinkSync(progressFile.variableSaveFile);
	} catch {
		// File doesn't exit
	}
	try {
		fs.unlinkSync(progressFile.sourceMergeLockFile);
	} catch {
		// File doesn't exit
	}
	try {
		fs.unlinkSync(progressFile.targetMergeLockFile);
	} catch {
		// File doesn't exit
	}
	try {
		fs.unlinkSync(progressFile.taggingLockFile);
	} catch {
		// File doesn't exit
	}
	try {
		fs.unlinkSync(progressFile.developmentPullMergeLockFile);
	} catch {
		// File doesn't exit
	}
	try {
		fs.unlinkSync(progressFile.developmentMergeLockFile);
	} catch {
		// File doesn't exit
	}
}

/**
 * This function gets the following information from a user:
 * 		- remote to use
 * 		- the source branch
 * 		- the target branch
 * 		- the development branch (for a merge after target has been updated)
 * 		- the version to use for the release (defaults to what's in the source branch and will be used for tagging)
 * 		- the version to set for the development branch
 * The function confirms the remotes and entered branches already exist on the remote and errors out, if they don't.
 * The function also enforces a semver convention. If everything succeeds, the variables are saved to a conf file.
 */
async function getVariables(): Promise<void> {
	// If variables are already in the conf file, it means the script didn't complete
	// Ask the user if they want to continue from the previous execution
	if (fs.existsSync(progressFile.variableSaveFile)) {
		const shouldContinue = (
			await inquirer.prompt([
				{
					type: 'confirm',
					name: 'answer',
					message: 'The previous process did not complete - continue it?',
					default: true,
				},
			])
		)['answer'];
		if (shouldContinue) {
			console.log('Resuming...');
			loadUsersVariables();
			return Promise.resolve();
		}
		resetDeploy();
	}

	// Confirm Git remote to use (default origin)
	remote = (
		await inquirer.prompt([
			{
				type: 'input',
				name: 'answer',
				message: 'Git Remote to use:',
				default: defaultRemote,
			},
		])
	)['answer'];
	await checkIfRemoteExists(remote);

	// Get the source branch to suggest
	initialBranch = ((await execGitCmd(['branch', '--show-current'], gitConfig)) as string).trim();
	let sourceBranchToSuggest = initialBranch === defaultTargetBranch ? defaultSourceBranch : initialBranch;
	// Confirm source branch (default the branch they're on, unless it's master)
	sourceBranch = (
		await inquirer.prompt([
			{
				type: 'input',
				name: 'answer',
				message: 'Source branch to use:',
				default: sourceBranchToSuggest,
			},
		])
	)['answer'];
	await checkIfRemoteExists(remote, sourceBranch);

	// Confirm target branch (default master)
	targetBranch = (
		await inquirer.prompt([
			{
				type: 'input',
				name: 'answer',
				message: 'Target branch to use:',
				default: defaultTargetBranch,
			},
		])
	)['answer'];
	if (targetBranch === sourceBranch) {
		return Promise.reject('Target branch must be different than source branch.');
	}
	await checkIfRemoteExists(remote, targetBranch);

	// Confirm development branch
	developmentBranch = (
		await inquirer.prompt([
			{
				type: 'input',
				name: 'answer',
				message: 'Development branch to use:',
				default: defaultDevelopmentBranch,
			},
		])
	)['answer'];
	if (developmentBranch === targetBranch) {
		return Promise.reject('Development branch must be different then target branch.');
	}

	// Only check if this branch exists if we haven't already checked for it
	if (developmentBranch === sourceBranch) {
		console.log(`Already confirmed that branch '${developmentBranch}' exists.`);
	} else {
		await checkIfRemoteExists(remote, developmentBranch);
	}

	// Check out the target branch so we can get that version
	process.stdout.write(`Fetching target branch '${targetBranch}'...`);
	await execGitCmd(['checkout', targetBranch], gitConfig);
	await execGitCmd(['pull', remote, targetBranch], gitConfig);
	try {
		await checkForMergeConflictsOnCurrentBranch();
		console.log(chalk.green('done'));
	} catch {
		console.log();
		return Promise.reject(
			`There were merge conflicts when pulling from remote on branch '${targetBranch}'. Please fix and restart the process.`,
		);
	}

	// Get the current app version
	const targetPackageVersion = getPackageJsonVersion();

	// Check out the source branch so we can get that version
	process.stdout.write(`Fetching source branch '${sourceBranch}'...`);
	await execGitCmd(['checkout', sourceBranch], gitConfig);
	await execGitCmd(['pull', remote, sourceBranch], gitConfig);
	// Make sure no merge conflicts exist
	try {
		await checkForMergeConflictsOnCurrentBranch();
		console.log(chalk.green('done'));
	} catch {
		console.log();
		return Promise.reject(
			`There were merge conflicts when pulling from remote on branch '${sourceBranch}'. Please fix and restart the process.`,
		);
	}

	// Get the current app version
	const sourcePackageVersion = getPackageJsonVersion();

	// Ask the user what version they want to use
	console.log(`Source version: ${sourcePackageVersion}, Target version: ${targetPackageVersion}`);
	const packageQuestion = {
		type: 'input',
		name: 'answer',
		message: 'Version number for this release:',
		default: sourcePackageVersion,
	};
	while (!packageVersion || !semverRegex.test(packageVersion)) {
		if (packageVersion) {
			console.log(chalk.red(`Version '${packageVersion}' is not in the correct format of #.#.#. Please enter again.`));
		}
		packageVersion = (await inquirer.prompt([packageQuestion]))['answer'];
	}

	tag = `v${packageVersion}-kevin-test`;
	process.stdout.write('Checking tag uniqueness...');
	await execGitCmd(['fetch', '--all', '--tags', '--force'], gitConfig);
	// Check if the tag exists and, if it does, abort
	const foundTag = (await execGitCmd(['tag', '-l', tag], gitConfig)) as string;
	if (foundTag) {
		console.log();
		return Promise.reject(`Tag ${tag} already exists. Delete it or select a new app version before continuing.`);
	}
	console.log(chalk.green('confirmed'));

	// Get the next version to suggest
	// First, get the major version
	let suggestedNextPackageVersion = packageVersion.replace(/\.\d+\.\d+$/, '');
	// Next, increment the minor package version, and set the patch version to 0
	suggestedNextPackageVersion += `.${parseInt(packageVersion.replace(/^\d+\./, ''), 10) + 1}.0`;
	const nextPackageQuestion = {
		type: 'input',
		name: 'answer',
		message: `Next app verion to use in development branch '${developmentBranch}':`,
		default: suggestedNextPackageVersion,
	};
	// Have a loop to make sure the version gets entered in the correct format
	while (!nextPackageVersion || !semverRegex.test(nextPackageVersion)) {
		if (nextPackageVersion) {
			console.log(
				chalk.red(`Version '${nextPackageVersion}' is not in the correct format of #.#.#. Please enter again.`),
			);
		}
		nextPackageVersion = (await inquirer.prompt([nextPackageQuestion]))['answer'];
	}

	// If we've made it here, we can save these variables to a file in case the process fails and needs to be restarted
	saveUsersVariables();
}

/**
 * Wrap everything up from this run
 */
function finish() {
	// Clean up all the files
	// resetDeploy();

	// Check out original branch user was on
	execGitCmd(['checkout', initialBranch], gitConfig);

	console.log(chalk.green('Finished!'));
}

async function main(argv): Promise<void> {
	try {
		await checkPrerequisites();
		await getVariables();
		console.log(
			JSON.stringify({
				remote,
				sourceBranch,
				targetBranch,
				developmentBranch,
				packageVersion,
				nextPackageVersion,
				tag,
			}),
		);
		finish();
	} catch (e) {
		console.log(chalk.red(e));
	}
	if (argv.verbose) console.info(`start server on :${argv.port}`);
	// serve(argv.port);
}

export const command = 'deploy [targetBranch]';
export const desc = 'Manage set of tracked repos';
export const builder = (yargs: Argv<{}>): void => {
	yargs
		.positional('targetBranch', {
			describe: 'The branch to deploy code to',
			type: 'string',
			default: 'master',
		})
		.option('sourceBranch', {
			alias: 's',
			type: 'string',
			description: 'The branch containing the code to be deployed',
		})
		.option('developmentBranch', {
			alias: 'w',
			type: 'string',
			description: 'The branch to update after completing deployment',
			default: 'development',
		})
		.option('appVersion', {
			alias: 'v',
			type: 'string',
			description: 'Specify the version number to deploy',
		})
		.option('nextAppVersion', {
			alias: 'n',
			type: 'string',
			description: 'Specify the version number to update the development branch to',
		})
		.option('versionFile', {
			alias: 'f',
			type: 'string',
			description: 'The file where the version number is tracked',
		});
};
export const handler = main;
