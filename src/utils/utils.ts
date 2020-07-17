import chalk from 'chalk';
import fs from 'fs';
import { execGitCmd } from 'run-git-command';
import { gitConfig } from './constants';

/**
 * Check if a remote exists, with an optional second argument to check for a branch on remote
 */
export async function checkIfRemoteExists(remote: string, branch?: string): Promise<string> {
	// If no branch provided, just check the remote
	if (!branch) {
		process.stdout.write(`Checking to make sure remote '${remote}' exists...`);
		// Confirm that this remote exists
		try {
			await execGitCmd(['ls-remote', remote], gitConfig);
			console.log(chalk.green('confirmed'));
		} catch {
			console.log();
			return Promise.reject(`Remote '${remote}' does not exist. Exiting.`);
		}
	} else {
		process.stdout.write(`Checking to make sure branch '${branch}' exists on remote '${remote}'...`);
		// Confirm that this branch exists on remote
		const branches = (await execGitCmd(['ls-remote', '--heads', remote, branch], gitConfig)) as string;
		if (!branches) {
			console.log();
			return Promise.reject(`Branch '${branch}' does not exist. Exiting.`);
		}
		console.log(chalk.green('confirmed'));
	}
	return Promise.resolve('');
}

export async function checkForMergeConflictsOnCurrentBranch(): Promise<void> {
	const filesWithMergeConflicts = (await execGitCmd(['ls-files', '-u'], gitConfig)) as string;
	if (filesWithMergeConflicts) {
		return Promise.reject();
	}
	return Promise.resolve();
}

function getPackageJsonFilePath(): string {
	return `${process.cwd()}/package.json`;
}

export async function getPackageJsonVersion(): Promise<string> {
	return new Promise((resolve, reject) => {
		fs.readFile(getPackageJsonFilePath(), 'utf8', (err, data) => {
			if (err) {
				reject(err);
				return;
			}
			resolve(data.match(/"version":\s?"(\d+\.\d+\.\d+)"/)[1]);
		});
	});
}

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

export function getFileNameSaveCwd(): string {
	return process.cwd().replace(/[\\\/:]/g, '_');
}

export function touch(fileName: string): void {
	const time = new Date();
	try {
		fs.utimesSync(fileName, time, time);
	} catch (err) {
		fs.closeSync(fs.openSync(fileName, 'w'));
	}
}
