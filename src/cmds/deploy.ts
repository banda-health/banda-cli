import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import { execGitCmd } from 'run-git-command';
import { Argv } from 'yargs';
import { gitConfig } from '../utils/constants';
import {
	checkForMergeConflictsOnCurrentBranch,
	checkIfRemoteExists,
	getFileNameSaveCwd,
	getPackageJsonVersion,
	touch,
	updatePackageJsonVersion,
} from '../utils/utils';

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
	tag = usersVariables.tag;
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
async function getVariables(): Promise<string> {
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
			return Promise.resolve('');
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

	return Promise.resolve('');
}

/**
 * This function does all the work, which includes the following:
 * 		1. Check out target and create a release branch to do work.
 * 		2. Merge source to release branch.
 * 			a. If merge conflicts exist, have the user fix them and then resume the process.
 * 			b. Exit execution.
 * 		3. Update the app version, if necessary.
 * 		4. Merge the release branch to the target.
 * 		5. Push the target to remote.
 * 			a. If an error occurs (probably because they don't have write access), push the release branch to remote.
 * 			b. Tell the user to have someone merge the pushed release branch, then resume this process.
 * 			c. Exit execution.
 * 		6. Create a tag on the target branch.
 * 		7. Push the tag.
 * 			a. If an error occurs (probably because the user doesn't have tag write access), tell them to get permission and resume this process.
 * 			b. Exit execution.
 * 		8. Check out development branch.
 * 		9. Get latest changes from remote on development branch.
 * 			a. If merge conflicts exist, have the user fix them and then resume the process.
 * 			b. Exit execution.
 * 		10. Create a merge branch off the development branch.
 * 		11. Merge changes from target branch.
 * 			a. If merge conflicts exist, have the user fix them and then resume the process.
 * 			b. Exit execution.
 * 		12. Update the app version with the next version the user entered.
 * 		13. Merge the temporary merge branch back into the development branch.
 * 		14. Push the changes.
 * 			a. If an error occurs (probably because they don't have write access), push the temporary merge branch to remote.
 * 			b. Tell the user to have someone merge the pushed branch, but don't error out of the process
 */
async function run(): Promise<string> {
	// Branch to release branch (branch release-{tag})
	const releaseBranch = `release/${tag}`;
	const developmentMergeBranch = `merge-banda/${targetBranch}-to-${developmentBranch}`;

	const sourceMergeLockFileIsMissing = !fs.existsSync(progressFile.sourceMergeLockFile);
	const targetMergeLockFileIsMissing = !fs.existsSync(progressFile.targetMergeLockFile);
	const taggingLockFileIsMissing = !fs.existsSync(progressFile.taggingLockFile);
	const developmentPullMergeLockFileIsMissing = !fs.existsSync(progressFile.developmentPullMergeLockFile);
	const developmentMergeLockFileIsMissing = !fs.existsSync(progressFile.developmentMergeLockFile);

	// If the development merge lock file exists, skip this section
	if (developmentMergeLockFileIsMissing) {
		// If the development pull merge lock file exists, skip this section
		if (developmentPullMergeLockFileIsMissing) {
			// If the tagging lock file exists, skip this section
			if (taggingLockFileIsMissing) {
				// If the release to target lock file exists, skip this section
				if (targetMergeLockFileIsMissing) {
					// If the source to target lock file exists, skip this section to resume where the process left off
					if (sourceMergeLockFileIsMissing) {
						console.log(`Creating release branch '${releaseBranch}' off target '${targetBranch}'`);
						await execGitCmd(['checkout', targetBranch], gitConfig);
						// Delete any branch that might be there
						try {
							await execGitCmd(['branch', '-D', releaseBranch], gitConfig);
						} catch {}
						await execGitCmd(['checkout', '-b', releaseBranch], gitConfig);

						// Merge source to release branch
						console.log(`Merging '${sourceBranch}' -> '${releaseBranch}'`);
						await execGitCmd(['merge', sourceBranch], gitConfig);
					} else {
						// Remove the lock file since it's not needed anymore
						try {
							fs.unlinkSync(progressFile.sourceMergeLockFile);
						} catch {}
					}
					// Check if there are any files needing merging
					process.stdout.write(`Checking for any merge conflicts in '${releaseBranch}'...`);
					await execGitCmd(['checkout', releaseBranch], gitConfig);
					try {
						await checkForMergeConflictsOnCurrentBranch();
					} catch {
						console.log();
						touch(progressFile.sourceMergeLockFile);
						return Promise.reject(
							`There are merge conflicts between the source and release branches. Please fix the conflicts, commit them to branch '$releaseBranch', and resume the process.`,
						);
					}
					console.log(chalk.green('no merge conflicts'));

					// Update version number in appropriate file, if necessary
					const currentPackageVersion = getPackageJsonVersion();
					if (currentPackageVersion !== packageVersion) {
						process.stdout.write(
							`Updating and commiting the new package version '${packageVersion}' in release branch '${releaseBranch}'...`,
						);
						await updatePackageJsonVersion(currentPackageVersion, packageVersion);

						// Commit changes to release branch
						await execGitCmd(['commit', '-am', '"updating app version"'], gitConfig);
						console.log(chalk.green('done'));
					} else {
						console.log('No need to update package version. Skipping.');
					}

					// Merge release to target
					console.log(`Merging '${releaseBranch}' -> '${targetBranch}'`);
					await execGitCmd(['checkout', targetBranch], gitConfig);
					await execGitCmd(['merge', releaseBranch], gitConfig);

					// Push the new target branch
					process.stdout.write(`Pushing '${targetBranch}' to remote...`);
					try {
						await execGitCmd(['push', remote, targetBranch], gitConfig);
					} catch {
						// If there was an error with the previous command, it (probably) means they don't have permission to write to this branch
						// Since they can't push to the target branch, push the release and say they need to have someone else merge it
						console.log();
						console.log(
							chalk.red(
								`You do not have permission to write to '${targetBranch}'. Pushing '${releaseBranch}' to remote`,
							),
						);
						await execGitCmd(['checkout', releaseBranch], gitConfig);
						process.stdout.write(`Pushing '${releaseBranch}' to remote...`);
						await execGitCmd(['push', '-u', remote, releaseBranch], gitConfig);
						console.log(chalk.green('done'));
						touch(progressFile.targetMergeLockFile);
						return Promise.reject(`Please have someone merge '${releaseBranch} for you, then continue this process.`);
					}
					console.log(chalk.green('done'));
				} else {
					// We're assuming the release branch has been merged...
					console.log(`Assuming '${releaseBranch}' has been merged to '${targetBranch}'`);
					// Remove the lock file since it's not needed anymore
					try {
						fs.unlinkSync(progressFile.targetMergeLockFile);
					} catch {}
					// Delete remote release branch
					await execGitCmd(['push', remote, '-d', releaseBranch], gitConfig);
				}

				// Remove the local release branch
				try {
					await execGitCmd(['branch', '-D', releaseBranch], gitConfig);
				} catch {}

				// Create tag at merged commit
				process.stdout.write(`Fetching '${targetBranch}' from remote...`);
				await execGitCmd(['checkout', targetBranch], gitConfig);
				await execGitCmd(['pull', remote, targetBranch], gitConfig);
				console.log(chalk.green('done'));
				console.log(`Creating release tag '${tag}' in target '${targetBranch}'`);
				await execGitCmd(['tag', '-a', tag, '-m', `"Merging branch '${releaseBranch}'"`], gitConfig);
			} else {
				try {
					fs.unlinkSync(progressFile.taggingLockFile);
				} catch {}
			}

			await execGitCmd(['checkout', targetBranch], gitConfig);
			// Push tag
			process.stdout.write(`Pushing tag '${tag}' to remote...`);
			try {
				await execGitCmd(['push', remote, tag], gitConfig);
			} catch {
				// If there was an error, we have to wait again
				touch(progressFile.taggingLockFile);
				return Promise.reject('You do not have permission to push tags. Get permission, then resume this process.');
			}
			console.log(chalk.green('done'));
		} else {
			try {
				fs.unlinkSync(progressFile.developmentPullMergeLockFile);
			} catch {}
		}

		// Checkout development branch
		process.stdout.write(`Fetching development branch '${developmentBranch}'...`);
		await execGitCmd(['checkout', developmentBranch], gitConfig);
		await execGitCmd(['pull', remote, developmentBranch], gitConfig);
		try {
			await checkForMergeConflictsOnCurrentBranch();
		} catch {
			console.log();
			touch(progressFile.developmentPullMergeLockFile);
			return Promise.reject('There were merge conflicts when pulling from remote. Please fix and resume the process.');
		}
		console.log(chalk.green('done'));

		// Merge target branch to development branch
		process.stdout.write(
			`Creating temporary merge branch '${developmentMergeBranch}' off development branch '${developmentBranch}'...`,
		);
		try {
			await execGitCmd(['branch', '-D', developmentMergeBranch], gitConfig);
		} catch {}
		await execGitCmd(['checkout', '-b', developmentMergeBranch], gitConfig);
		console.log(chalk.green('done'));
		console.log(`Merging '${targetBranch}' -> '${developmentMergeBranch}'`);
		await execGitCmd(['merge', targetBranch], gitConfig);
	} else {
		try {
			fs.unlinkSync(progressFile.developmentMergeLockFile);
		} catch {}
	}

	// Make sure there aren't any merge conflicts
	await execGitCmd(['checkout', developmentMergeBranch], gitConfig);
	try {
		await checkForMergeConflictsOnCurrentBranch();
	} catch {
		touch(progressFile.developmentMergeLockFile);
		return Promise.reject('There were merge conflicts when merging. Please fix and resume the process.');
	}

	// Update version number in appropriate file, if necessary
	const currentPackageVersion = getPackageJsonVersion();
	if (currentPackageVersion !== nextPackageVersion) {
		process.stdout.write(
			`Updating and commiting the new package version '${nextPackageVersion}' in branch '${developmentMergeBranch}'...`,
		);
		await updatePackageJsonVersion(currentPackageVersion, nextPackageVersion);

		// Commit changes to development merge branch
		await execGitCmd(['commit', '-am', '"updating app version"'], gitConfig);
		console.log(chalk.green('done'));
	} else {
		console.log('No need to update package version. Skipping.');
	}

	// Merge to development branch and push
	console.log(`Merging '${developmentMergeBranch}' -> '${developmentBranch}'`);
	await execGitCmd(['checkout', developmentBranch], gitConfig);
	await execGitCmd(['merge', developmentMergeBranch], gitConfig);

	process.stdout.write(`Pushing '${developmentBranch}' to remote...`);
	try {
		await execGitCmd(['push', remote, developmentBranch], gitConfig);
		console.log(chalk.green('done'));
	} catch {
		// If there was an error with the previous command, it (probably) means they don't have permission to write to this branch
		// Since they can't push to the target branch, push the release and say they need to have someone else merge it
		console.log(
			chalk.red(
				`You do not have permission to write to '${developmentBranch}'. Pushing '${developmentMergeBranch}' to remote - please have someone merge it for you to finish this process.`,
			),
		);
		await execGitCmd(['checkout', developmentMergeBranch], gitConfig);
		process.stdout.write(`Pushing '${developmentMergeBranch}' to remote...`);
		await execGitCmd(['push', '-u', remote, developmentMergeBranch], gitConfig);
		console.log(chalk.green('done'));
		console.log(`Removing temporary merge branch '${developmentMergeBranch}' locally.`);
		await execGitCmd(['branch', '-D', developmentMergeBranch], gitConfig);
		console.log(chalk.yellow(`Please have someone merge '${developmentMergeBranch} for you to finish this process.`));
	}
	return Promise.resolve('');
}

/**
 * Wrap everything up from this run
 */
async function finish() {
	// Clean up all the files
	// resetDeploy();

	// Check out original branch user was on
	await execGitCmd(['checkout', initialBranch], gitConfig);

	console.log(chalk.green('Finished!'));
}

async function main(argv): Promise<void> {
	try {
		await checkPrerequisites();
		await getVariables();
		await run();
	} catch (e) {
		console.log(chalk.red(e));
	} finally {
		finish();
	}
	// if (argv.verbose) console.info(`start server on :${argv.port}`);
	// // serve(argv.port);
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
