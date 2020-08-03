import fs from 'fs';
import { execGitCmd } from 'run-git-command';
import { gitConfig, semverRegex } from './constants';

/**
 * @async
 * Check if Git is installed
 */
export async function isGitInstalled(): Promise<boolean> {
	try {
		await execGitCmd(['--version'], gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Ensure there are no staged or pending changes in the current working directory
 */
export async function isWorkingDirectoryClean(): Promise<boolean> {
	try {
		const listOfModifiedFiles = (await execGitCmd(['status', '--porcelain'], gitConfig)) as string;
		return !listOfModifiedFiles;
	} catch {}
	return false;
}

/**
 * @async
 * Get the current branch the user is on, if any
 */
export async function getCurrentBranch(): Promise<string> {
	try {
		return ((await execGitCmd(['branch', '--show-current'], gitConfig)) as string).trim();
	} catch {}
	return '';
}

/**
 * @async
 * Checkout the specified branch
 * @param branch Branch to checkout
 */
export async function checkoutBranch(branch: string): Promise<boolean> {
	try {
		await execGitCmd(['checkout', branch], gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Pull latest from the remote and determine if there are merge conflicts
 * @param remote The remote to use when pulling.
 * @param branch The remote branch to pull from
 */
export async function isBranchCleanWhenUpdatedFromRemote(remote: string, branch: string): Promise<boolean> {
	try {
		// If there are merge conflicts, this command should fail
		pullBranchFromRemote(remote, branch);
		return !(await doMergeConflictsExistOnCurrentBranch());
	} catch {}
	return false;
}

/**
 * @async
 * Check if a remote exists, with an optional second argument to check for a branch on remote
 */
export async function doesRemoteExist(remote: string, branch?: string): Promise<boolean> {
	// If no branch provided, just check the remote
	if (!branch) {
		try {
			await execGitCmd(['ls-remote', remote], gitConfig);
			return true;
		} catch {}
	} else {
		try {
			const branches = (await execGitCmd(['ls-remote', '--heads', remote, branch], gitConfig)) as string;
			return !!branches;
		} catch {}
	}
	return false;
}

/**
 * @async
 * Fetch all tags from all remotes and see if the specified tag exists
 * @param tag The tag to check
 */
export async function doesTagExist(tag: string): Promise<boolean> {
	try {
		await execGitCmd(['fetch', '--all', '--tags', '--force'], gitConfig);
		return !!((await execGitCmd(['tag', '-l', tag], gitConfig)) as string);
	} catch {}
	return true;
}

/**
 * Take a semVer package number and suggest the next minor version number
 * @param currentVersion A current semVer package number of the format #.#.#
 * @example
 * 1.4.0 -> 1.5.0
 * 1.5.9 -> 1.6.0
 */
export function getSuggestedNextPackageVersion(currentVersion: string): string {
	if (!semverRegex.test(currentVersion)) {
		return '1.0.0';
	}
	let suggestedNextPackageVersion = currentVersion.replace(/\.\d+\.\d+$/, '');
	// Next, increment the minor package version, and set the patch version to 0
	suggestedNextPackageVersion += `.${parseInt(currentVersion.replace(/^\d+\./, ''), 10) + 1}.0`;
	return suggestedNextPackageVersion;
}

/**
 * @async
 * Check if there are any files with merge conflicts
 */
export async function doMergeConflictsExistOnCurrentBranch(): Promise<boolean> {
	try {
		// This command will return a list of files that have merge conflicts
		return !!((await execGitCmd(['ls-files', '-u'], gitConfig)) as string);
	} catch {}
	return true;
}

function getPackageJsonFilePath(): string {
	return `${process.cwd()}/package.json`;
}

/**
 * @async
 * Gets the version number from the package.json stored in the current directory (if it exists)
 */
export async function getPackageJsonVersion(): Promise<string> {
	return new Promise((resolve, reject) => {
		fs.readFile(getPackageJsonFilePath(), 'utf8', (err, data) => {
			if (err) {
				reject(err);
				return;
			}
			const match = data.match(/"version":\s?"(\d+\.\d+\.\d+)"/);
			if (!match || !match.length) {
				reject('No version found.');
				return;
			}
			resolve(match[1]);
		});
	});
}

/**
 * @async
 * Update the version number in the package.json file stored in the current directory (it if exists)
 * @param currentVersion The current version to search for
 * @param versionToUse The new version to update the file with
 */
export async function updatePackageJsonVersion(currentVersion: string, versionToUse: string): Promise<void> {
	return new Promise((resolve, reject) => {
		fs.readFile(getPackageJsonFilePath(), 'utf8', (err, data) => {
			if (err) {
				reject(err);
				return;
			}
			const versionRegex = new RegExp(`"version":\\s?"${currentVersion.replace(/\./g, '\\.')}"`);
			const result = data.replace(versionRegex, `"version": "${versionToUse}"`);
			fs.writeFile(getPackageJsonFilePath(), result, 'utf8', (err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	});
}

/**
 * Get a "unique" filename to save progress files based on the current working directory (CWD)
 */
export function getFileNameSaveCwd(): string {
	return process.cwd().replace(/[\\\/:]/g, '_');
}

/**
 * Replicates the Linux CLI `touch` command
 * @param fileName The file to touch
 */
export function touch(fileName: string): void {
	const time = new Date();
	try {
		fs.utimesSync(fileName, time, time);
	} catch (err) {
		fs.closeSync(fs.openSync(fileName, 'w'));
	}
}

export function createReleaseTag(versionNumber: string): string {
	return `v${versionNumber}`;
}

export function createReleaseBranchName(tag: string): string {
	return `release/${tag}`;
}

export function createDevelopmentMergeBranchName(targetBranch: string, developmentBranch: string): string {
	return `merge-banda/${targetBranch}-to-${developmentBranch}`;
}

/**
 * @async
 * Create a new branch and check it out
 * @param branch The branch to create
 * @param sourceBranch The branch name to create a branch off of
 * @param [deleteExisting=true] Whether to delete the branch if it already exists (default true)
 */
export async function createAndCheckoutBranch(
	branch: string,
	sourceBranch: string,
	deleteExisting: boolean = true,
): Promise<boolean> {
	try {
		if (!(await checkoutBranch(sourceBranch))) {
			return false;
		}
		if (deleteExisting) {
			await deleteLocalBranch(branch);
		}
		try {
			// If the branch already exists, this command will throw an error (but we don't care)
			await execGitCmd(['checkout', '-b', branch], gitConfig);
		} catch {}
		if (!(await checkoutBranch(branch))) {
			return false;
		}
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Merges a specified branch into whichever branch the user is currently on
 * @param branchToMerge The branch to merge into the current
 */
export async function mergeBranch(branchToMerge: string): Promise<void> {
	try {
		await execGitCmd(['merge', '--no-ff', branchToMerge], gitConfig);
	} catch (e) {
		return Promise.reject(e);
	}
}

/**
 * @async
 * Performs a commit of the currently pending changes
 * @param message The commit message
 */
export async function commitToBranch(message: string): Promise<boolean> {
	try {
		await execGitCmd(['commit', '-am', `"${message}"`], gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Push a branch to remote, setting the upstream if specified
 * @param remote Remote to push to
 * @param branchOrTag Branch to push to
 * @param [doSetUpstream=false] If the remote branch doesn't exist, then set the upstream (default false)
 */
export async function pushToRemote(
	remote: string,
	branchOrTag: string,
	doSetUpstream: boolean = false,
): Promise<boolean> {
	const commands = ['push', remote, branchOrTag];
	if (doSetUpstream) {
		commands.splice(1, 0, '-u');
	}
	try {
		await execGitCmd(commands, gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Delete a branch from the remote
 * @param remote Remote to push to
 * @param branch Branch to delete
 */
export async function deleteRemoteBranch(remote: string, branch: string): Promise<boolean> {
	try {
		await execGitCmd(['push', remote, '-d', branch], gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Delete a branch from local
 * @param branch Branch to delete
 * @param [forceDelete=true] Whether to force the delete (default true)
 */
export async function deleteLocalBranch(branch: string, forceDelete: boolean = true): Promise<boolean> {
	try {
		await execGitCmd(['branch', forceDelete ? '-D' : '-d', branch], gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Pull a remote branch to local
 * @param remote Remote to pull from
 * @param branch Branch to pull
 */
export async function pullBranchFromRemote(remote: string, branch: string): Promise<boolean> {
	try {
		// This will fail if there's a merge conflict or a connection interruption
		await execGitCmd(['pull', remote, branch], gitConfig);
		return true;
	} catch {}
	return false;
}

/**
 * @async
 * Create a tag on the current branch
 * @param tag The tag to use
 * @param message A message to accompany the tag commit
 */
export async function createTag(tag: string, message: string): Promise<boolean> {
	try {
		await execGitCmd(['tag', '-a', tag, '-m', `"${message}"`], gitConfig);
		return true;
	} catch {}
	return false;
}
