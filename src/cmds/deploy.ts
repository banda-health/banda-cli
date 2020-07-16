import chalk from 'chalk';
import { execGitCmd } from 'run-git-command';
import { commandConfig } from 'run-git-command/types';
import { Argv } from 'yargs';

const config: commandConfig = {
	logProcess: false,
};

function logRed(message: string): void {
	console.log(chalk.red(message));
}

async function checkPrerequisites(): Promise<void> {
	// Check if git is installed
	try {
		await execGitCmd(['--version'], config);
	} catch {
		// Git is not installed
		logRed('Git is not installed. Please install before continuing.');
		return Promise.reject();
	}
	// Ensure working directory is clean
	try {
		await execGitCmd(['status --porcelain'], config);
	} catch {
		// Uncommitted changes
		logRed('Working directory is not clean. Please stash or commit changes before continuing.');
		return Promise.reject();
	}
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
export const handler = async (argv) => {
	try {
		await checkPrerequisites();
	} catch {}
	if (argv.verbose) console.info(`start server on :${argv.port}`);
	// serve(argv.port);
};
