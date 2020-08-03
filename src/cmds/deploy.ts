import chalk from 'chalk';
import fs from 'fs';
import { prompt } from 'inquirer';
import { Argv } from 'yargs';
import { semverRegex } from '../utils/constants';
import {
	commitMessage,
	ErrorMessage,
	getErrorMessage,
	getQuestion,
	getStatusMessage,
	Question,
	StatusMessage,
} from '../utils/messages';
import {
	checkoutBranch,
	commitToBranch,
	createAndCheckoutBranch,
	createDevelopmentMergeBranchName,
	createReleaseBranchName,
	createReleaseTag,
	createTag,
	deleteLocalBranch,
	deleteRemoteBranch,
	doesRemoteExist,
	doesTagExist,
	doMergeConflictsExistOnCurrentBranch,
	getCurrentBranch,
	getFileNameSaveCwd,
	getPackageJsonVersion,
	isBranchCleanWhenUpdatedFromRemote,
	isGitInstalled,
	isWorkingDirectoryClean,
	mergeBranch,
	pullBranchFromRemote,
	pushToRemote,
	touch,
	updatePackageJsonVersion,
} from '../utils/utils';

export interface UsersVariables {
	remote: string;
	sourceBranch: string;
	targetBranch: string;
	developmentBranch: string;
	packageVersion: string;
	nextPackageVersion: string;
	tag: string;
}

// Script user-input variables
let remote: string;
let sourceBranch: string;
let targetBranch: string;
let developmentBranch: string;
let packageVersion: string;
let nextPackageVersion: string;
// This variable isn't directly user-input, but it's calculated off packageVersion
let tag: string;

// Other script variables
const defaultRemote: string = 'origin';
const defaultSourceBranch: string = 'develop';
const defaultTargetBranch: string = 'master';
const defaultDevelopmentBranch: string = 'develop';
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
const QUESTION_ANSWER_PROPERTY = 'answer';

/**
 * Ensure the following prerequisites exist on the user's machine
 * 		1. Git is installed
 * 		2. The user's working directory in Git is clean
 */
async function checkPrerequisites(): Promise<string> {
	// Check if git is installed
	if (!(await isGitInstalled())) {
		return Promise.reject(getErrorMessage(ErrorMessage.GitNotInstalled));
	}
	// Ensure working directory is clean
	if (!(await isWorkingDirectoryClean())) {
		return Promise.reject(getErrorMessage(ErrorMessage.WorkspaceNotClean));
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
 * If a user is re-starting a release, make sure these files are eliminated so the script doesn't skip an execution
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
 * Determines whether the previous process can be continued or not
 */
function canThePreviousProcessBeContinued() {
	return fs.existsSync(progressFile.variableSaveFile);
}

/**
 * Log a status message to the appropriate location
 * @param logMessage StatusMessage or a string to log
 * @param withNewLine Whether a newLine should be inserted at the end of the log (default true)
 * @param additionalMessageParameters Any additional parameters to log
 */
function logStatus(
	logMessage: StatusMessage | string,
	withNewLine: boolean = true,
	...additionalMessageParameters: string[]
) {
	const logMethod = withNewLine ? console.log : process.stdout.write;
	if (typeof logMessage === 'string') {
		logMethod(logMessage);
		return;
	}
	logMethod(getStatusMessage(logMessage, ...additionalMessageParameters));
}

/**
 * Log an error message to the appropriate location
 * @param logType ErrorMessage
 * @param additionalMessageParameters Any additional parameters to log
 */
function logError(logType: ErrorMessage, ...additionalMessageParameters: string[]) {
	console.log(getErrorMessage(logType, ...additionalMessageParameters));
}

/**
 * @async
 * Handle display and checking of a remote, with an optional second argument to check for a branch on remote
 */
async function checkIfRemoteExists(remote: string, branch?: string): Promise<string> {
	// If no branch provided, just check the remote
	if (!branch) {
		logStatus(StatusMessage.CheckRemote, false, remote);
		if (await doesRemoteExist(remote)) {
			logStatus(StatusMessage.Confirmed);
		} else {
			return Promise.reject(getErrorMessage(ErrorMessage.RemoteDoesNotExist, remote));
		}
	} else {
		logStatus(StatusMessage.CheckBranch, false, branch, remote);
		// Confirm that this branch exists on remote
		if (doesRemoteExist(remote, branch)) {
			logStatus(StatusMessage.Confirmed);
		} else {
			return Promise.reject(getErrorMessage(ErrorMessage.BranchDoesNotExist, branch));
		}
	}
	return Promise.resolve('');
}

/**
 * This function gets the following information from a user:
 * - Remote to use
 * - The source branch
 * - The target branch
 * - The development branch (for a merge after target has been updated)
 * - The version to use for the release (defaults to what's in the source branch and will be used for tagging)
 * - The version to set for the development branch
 * The function confirms the remotes and entered branches already exist on the remote and errors out, if they don't.
 * The function also enforces a semver convention. If everything succeeds, the variables are saved to a conf file.
 */
async function getVariables(): Promise<string> {
	// Ask the user if they want to continue from the previous execution
	if (canThePreviousProcessBeContinued()) {
		const userWantsToContinuePreviousProcess = (
			await prompt([
				{
					type: 'confirm',
					name: QUESTION_ANSWER_PROPERTY,
					message: getQuestion(Question.ContinuePreviousProcess),
					default: true,
				},
			])
		)[QUESTION_ANSWER_PROPERTY] as boolean;
		if (userWantsToContinuePreviousProcess) {
			logStatus(StatusMessage.Resuming);
			loadUsersVariables();
			return Promise.resolve('');
		}
		resetDeploy();
	}

	// Confirm Git remote to use (default origin)
	remote = (
		await prompt([
			{
				type: 'input',
				name: QUESTION_ANSWER_PROPERTY,
				message: getQuestion(Question.GitRemoteToUse),
				default: defaultRemote,
			},
		])
	)[QUESTION_ANSWER_PROPERTY];
	await checkIfRemoteExists(remote);

	// Get the source branch to suggest
	initialBranch = await getCurrentBranch();
	let sourceBranchToSuggest =
		initialBranch === defaultTargetBranch || !initialBranch ? defaultSourceBranch : initialBranch;
	// Confirm source branch (default the branch they're on, unless it's master)
	sourceBranch = (
		await prompt([
			{
				type: 'input',
				name: QUESTION_ANSWER_PROPERTY,
				message: getQuestion(Question.SourceBranchToUse),
				default: sourceBranchToSuggest,
			},
		])
	)[QUESTION_ANSWER_PROPERTY];
	await checkIfRemoteExists(remote, sourceBranch);

	// Confirm target branch (default master)
	targetBranch = (
		await prompt([
			{
				type: 'input',
				name: QUESTION_ANSWER_PROPERTY,
				message: getQuestion(Question.TargetBranchToUse),
				default: defaultTargetBranch,
			},
		])
	)[QUESTION_ANSWER_PROPERTY];
	if (targetBranch === sourceBranch) {
		return Promise.reject(getErrorMessage(ErrorMessage.TargetAndSourceBranchesMustDiffer));
	}
	await checkIfRemoteExists(remote, targetBranch);

	// Confirm development branch
	developmentBranch = (
		await prompt([
			{
				type: 'input',
				name: QUESTION_ANSWER_PROPERTY,
				message: getQuestion(Question.DevelopmentBranchToUse),
				default: defaultDevelopmentBranch,
			},
		])
	)[QUESTION_ANSWER_PROPERTY];
	if (developmentBranch === targetBranch) {
		return Promise.reject(getErrorMessage(ErrorMessage.DevelopmentAndTargetBranchesMustDiffer));
	}

	// Only check if this branch exists if we haven't already checked for it
	if (developmentBranch === sourceBranch) {
		logStatus(StatusMessage.AlreadyConfirmedBranchExists, true, developmentBranch);
	} else {
		await checkIfRemoteExists(remote, developmentBranch);
	}

	// Check out the target branch so we can get that version
	logStatus(StatusMessage.FetchingTargetBranch, false, targetBranch);
	if (!(await checkoutBranch(targetBranch))) {
		return Promise.reject(getErrorMessage(ErrorMessage.CouldNotCheckOutBranch, targetBranch));
	}
	// See if we get any merge conflicts
	if (!isBranchCleanWhenUpdatedFromRemote(remote, targetBranch)) {
		return Promise.reject(getErrorMessage(ErrorMessage.MergeConflictsOnPullToFix, targetBranch));
	}
	logStatus(StatusMessage.Done);

	// Get the current app version
	const targetPackageVersion = await getPackageJsonVersion();

	// Check out the source branch so we can get that version
	logStatus(StatusMessage.FetchingSourceBranch, false, sourceBranch);
	if (!(await checkoutBranch(sourceBranch))) {
		return Promise.reject(getErrorMessage(ErrorMessage.CouldNotCheckOutBranch, sourceBranch));
	}
	// Make sure no merge conflicts exist
	if (!isBranchCleanWhenUpdatedFromRemote(remote, sourceBranch)) {
		return Promise.reject(getErrorMessage(ErrorMessage.MergeConflictsOnPullToFix, sourceBranch));
	}
	logStatus(StatusMessage.Done);

	// Get the current app version
	const sourcePackageVersion = await getPackageJsonVersion();

	// Ask the user what version they want to use
	logStatus(StatusMessage.SourceAndTargetVersion, true, sourcePackageVersion, targetPackageVersion);
	const packageQuestion = {
		type: 'input',
		name: QUESTION_ANSWER_PROPERTY,
		message: getQuestion(Question.VersionNumberToUse),
		default: sourcePackageVersion,
	};
	while (!packageVersion || !semverRegex.test(packageVersion)) {
		if (packageVersion) {
			logError(ErrorMessage.VersionFormatWrong, packageVersion);
		}
		packageVersion = (await prompt([packageQuestion]))[QUESTION_ANSWER_PROPERTY];
	}

	tag = createReleaseTag(packageVersion);
	logStatus(StatusMessage.CheckingTagUniqueness, false);
	if (await doesTagExist(tag)) {
		return Promise.reject(getErrorMessage(ErrorMessage.TagExists, tag));
	}
	logStatus(StatusMessage.Confirmed);

	// Get the next version to suggest
	// First, get the major version
	let suggestedNextPackageVersion = packageVersion.replace(/\.\d+\.\d+$/, '');
	// Next, increment the minor package version, and set the patch version to 0
	suggestedNextPackageVersion += `.${parseInt(packageVersion.replace(/^\d+\./, ''), 10) + 1}.0`;
	const nextPackageQuestion = {
		type: 'input',
		name: QUESTION_ANSWER_PROPERTY,
		message: getQuestion(Question.NextVersionToUse, developmentBranch),
		default: suggestedNextPackageVersion,
	};
	// Have a loop to make sure the version gets entered in the correct format
	while (!nextPackageVersion || !semverRegex.test(nextPackageVersion)) {
		if (nextPackageVersion) {
			logError(ErrorMessage.VersionFormatWrong, nextPackageVersion);
		}
		nextPackageVersion = (await prompt([nextPackageQuestion]))[QUESTION_ANSWER_PROPERTY];
	}

	// If we've made it here, we can save these variables to a file in case the process fails and needs to be restarted
	saveUsersVariables();

	return Promise.resolve('');
}

/**
 * This function does all the work, which includes the following:
 * 1. Check out target and create a release branch to do work.
 * 1. Merge source to release branch.
 * 	1. If merge conflicts exist, have the user fix them and then resume the process.
 * 	2. Exit execution.
 * 3. Update the app version, if necessary.
 * 4. Merge the release branch to the target.
 * 5. Push the target to remote.
 * 	1. If an error occurs (probably because they don't have write access), push the release branch to remote.
 * 	2. Tell the user to have someone merge the pushed release branch, then resume this process.
 * 	3. Exit execution.
 * 6. Create a tag on the target branch.
 * 7. Push the tag.
 * 	1. If an error occurs (probably because the user doesn't have tag write access), tell them to get permission and resume this process.
 * 	2. Exit execution.
 * 8. Check out development branch.
 * 9. Get latest changes from remote on development branch.
 * 	1. If merge conflicts exist, have the user fix them and then resume the process.
 * 	2. Exit execution.
 * 10. Create a merge branch off the development branch.
 * 11. Merge changes from target branch.
 * 	1. If merge conflicts exist, have the user fix them and then resume the process.
 * 	2. Exit execution.
 * 12. Update the app version with the next version the user entered.
 * 13. Merge the temporary merge branch back into the development branch.
 * 14. Push the changes.
 * 	1. If an error occurs (probably because they don't have write access), push the temporary merge branch to remote.
 * 	2. Tell the user to have someone merge the pushed branch, but don't error out of the process
 */
async function run(): Promise<string> {
	// Branch to release branch (branch release-{tag})
	const releaseBranch = createReleaseBranchName(tag);
	const developmentMergeBranch = createDevelopmentMergeBranchName(targetBranch, developmentBranch);

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
						logStatus(StatusMessage.CreatingReleaseBranch, true, releaseBranch, targetBranch);
						if (!(await createAndCheckoutBranch(releaseBranch, targetBranch))) {
							return Promise.reject(getErrorMessage(ErrorMessage.CouldNotCreateBranch, releaseBranch));
						}

						// Merge source to release branch
						logStatus(StatusMessage.Merge, true, sourceBranch, releaseBranch);
						try {
							await mergeBranch(sourceBranch);
						} catch (e) {
							// There was an error, most likely a merge conflict
							// Confirm the merge conflict
							if (await doMergeConflictsExistOnCurrentBranch()) {
								// Yep, there was a merge conflict
								touch(progressFile.sourceMergeLockFile);
								return Promise.reject(getErrorMessage(ErrorMessage.FixReleaseBranchMergeConflicts, releaseBranch));
							}
							// Otherwise, an error occurred that wasn't related to merging
							return Promise.reject(e);
						}
					} else {
						// Remove the lock file since it's not needed anymore
						try {
							fs.unlinkSync(progressFile.sourceMergeLockFile);
						} catch {}
					}

					// Update version number in appropriate file, if necessary
					if (!(await checkoutBranch(releaseBranch))) {
						// TODO: do anything here?
						// return Promise.reject(getErrorMessage(ErrorMessage.CouldNotCheckOutBranch, releaseBranch));
					}
					const currentPackageVersion = await getPackageJsonVersion();
					if (currentPackageVersion !== packageVersion) {
						logStatus(StatusMessage.ReleaseBranchPackageVersionUpdate, false, packageVersion, releaseBranch);
						await updatePackageJsonVersion(currentPackageVersion, packageVersion);

						// Commit changes to release branch
						if (!(await commitToBranch(commitMessage.UPDATE_APP_VERSION))) {
							// TODO: do anything here?
						}
						logStatus(StatusMessage.Done);
					} else {
						logStatus(StatusMessage.NoPackageUpdateNeeded);
					}

					// Merge release to target
					logStatus(StatusMessage.Merge, true, releaseBranch, targetBranch);
					if (!(await checkoutBranch(targetBranch))) {
						// TODO: do anything here?
					}
					try {
						await mergeBranch(releaseBranch);
					} catch {}

					// Push the new target branch
					logStatus(StatusMessage.PushingToRemote, false, targetBranch);
					if (!(await pushToRemote(remote, targetBranch))) {
						// If there was an error with the previous command, it (probably) means they don't have permission to write to this branch
						// Since they can't push to the target branch, push the release and say they need to have someone else merge it
						logStatus('');
						logError(ErrorMessage.CannotPushBranch, targetBranch, releaseBranch);
						if (!(await checkoutBranch(releaseBranch))) {
							// TODO: do anything here?
						}
						logStatus(StatusMessage.PushingToRemote, false, releaseBranch);
						if (!(await pushToRemote(remote, releaseBranch, true))) {
							// TODO: do anything here?
						}
						logStatus(StatusMessage.Done);
						touch(progressFile.targetMergeLockFile);
						return Promise.reject(getErrorMessage(ErrorMessage.HaveSomeoneMerge, releaseBranch));
					}
					logStatus(StatusMessage.Done);
				} else {
					// We're assuming the release branch has been merged...
					logStatus(StatusMessage.AssumingBranchMerged, true, releaseBranch, targetBranch);
					// Remove the lock file since it's not needed anymore
					try {
						fs.unlinkSync(progressFile.targetMergeLockFile);
					} catch {}
					// Delete remote release branch
					if (!(await deleteRemoteBranch(remote, releaseBranch))) {
						// TODO: do anything here?
					}
				}

				// Remove the local release branch (one would only be at the remote if we failed previously)
				await deleteLocalBranch(releaseBranch);

				// Create tag at merged commit
				logStatus(StatusMessage.FetchingBranchFromRemote, false, targetBranch);
				await checkoutBranch(targetBranch);
				await pullBranchFromRemote(remote, targetBranch);
				logStatus(StatusMessage.Done);
				logStatus(StatusMessage.CreatingTag, true, tag, targetBranch);
				await createTag(tag, `Merging branch '${releaseBranch}'`);
			} else {
				try {
					fs.unlinkSync(progressFile.taggingLockFile);
				} catch {}
			}

			await checkoutBranch(targetBranch);
			// Push tag
			logStatus(StatusMessage.PushingTagToRemote, false, tag);
			if (!(await pushToRemote(remote, tag))) {
				// If there was an error, we have to wait again
				touch(progressFile.taggingLockFile);
				return Promise.reject(getErrorMessage(ErrorMessage.CannotPushTags));
			}
			logStatus(StatusMessage.Done);
		} else {
			try {
				fs.unlinkSync(progressFile.developmentPullMergeLockFile);
			} catch {}
		}

		// Checkout development branch
		logStatus(StatusMessage.FetchingDevelopmentBranch, false, developmentBranch);
		await checkoutBranch(developmentBranch);
		// See if we get any merge conflicts
		if (!(await pullBranchFromRemote(remote, developmentBranch))) {
			// See if there were any merge conflicts
			if (await doMergeConflictsExistOnCurrentBranch()) {
				// Yep, there were merge conflicts
				touch(progressFile.developmentPullMergeLockFile);
				return Promise.reject(getErrorMessage(ErrorMessage.MergeConflictsOnPull));
			}
			// Otherwise, an error occurred when pulling
			touch(progressFile.developmentPullMergeLockFile);
			return Promise.reject(getErrorMessage(ErrorMessage.ErrorOnPull, developmentBranch));
		}
		logStatus(StatusMessage.Done);

		// Merge target branch to development branch
		logStatus(StatusMessage.CreatingTemporaryMergeBranch, false, developmentMergeBranch, developmentBranch);
		await createAndCheckoutBranch(developmentMergeBranch, developmentBranch);
		logStatus(StatusMessage.Done);
	} else {
		try {
			fs.unlinkSync(progressFile.developmentMergeLockFile);
		} catch {}
	}

	// Make sure there aren't any merge conflicts
	await checkoutBranch(developmentMergeBranch);
	logStatus(StatusMessage.Merge, true, targetBranch, developmentMergeBranch);
	try {
		await mergeBranch(targetBranch);
	} catch (e) {
		// See if there were any merge conflicts
		if (await doMergeConflictsExistOnCurrentBranch()) {
			// Yep, there were merge conflicts
			touch(progressFile.developmentMergeLockFile);
			return Promise.reject(getErrorMessage(ErrorMessage.MergeConflictsOnMerge));
		}
		touch(progressFile.developmentMergeLockFile);
		return Promise.reject(e);
	}

	// Update version number in appropriate file, if necessary
	const currentPackageVersion = await getPackageJsonVersion();
	if (currentPackageVersion !== nextPackageVersion) {
		logStatus(StatusMessage.BranchPackageVersionUpdate, false, nextPackageVersion, developmentMergeBranch);
		await updatePackageJsonVersion(currentPackageVersion, nextPackageVersion);

		// Commit changes to development merge branch
		await commitToBranch(commitMessage.UPDATE_APP_VERSION);
		logStatus(StatusMessage.Done);
	} else {
		logStatus(StatusMessage.NoPackageUpdateNeeded);
	}

	// Merge to development branch and push
	logStatus(StatusMessage.Merge, true, developmentMergeBranch, developmentBranch);
	await checkoutBranch(developmentBranch);
	try {
		await mergeBranch(developmentMergeBranch);
	} catch {}

	logStatus(StatusMessage.PushingToRemote, false, developmentBranch);
	try {
		await pushToRemote(remote, developmentBranch, false);
		logStatus(StatusMessage.Done);
		logStatus(StatusMessage.RemovingTemporaryMergeBranch, true, developmentMergeBranch);
		await deleteLocalBranch(developmentMergeBranch, false);
	} catch {
		// If there was an error with the previous command, it (probably) means they don't have permission to write to this branch
		// Since they can't push to the target branch, push the release and say they need to have someone else merge it
		logError(ErrorMessage.CannotPushBranchToFinish, developmentBranch, developmentMergeBranch);
		await checkoutBranch(developmentMergeBranch);
		logStatus(StatusMessage.PushingToRemote, false, developmentMergeBranch);
		await pushToRemote(remote, developmentMergeBranch, true);
		logStatus(StatusMessage.Done);
		logStatus(StatusMessage.RemovingTemporaryMergeBranchLocally, true, developmentMergeBranch);
		await deleteLocalBranch(developmentMergeBranch);
		logStatus(StatusMessage.MergeOnRemoteToFinish, true, developmentMergeBranch);
	}
	return Promise.resolve('');
}

/**
 * Wrap everything up from this run
 */
async function finish() {
	// Clean up all the files
	resetDeploy();

	// Check out original branch user was on
	await checkoutBranch(initialBranch || developmentBranch);

	logStatus(StatusMessage.Finished);
}

async function main(argv): Promise<void> {
	try {
		await checkPrerequisites();
		await getVariables();
		await run();
		await finish();
	} catch (e) {
		logStatus('');
		logStatus(chalk.red(e));
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
