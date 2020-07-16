import { Argv } from 'yargs';

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
		});
};
export const handler = (argv) => {
	if (argv.verbose) console.info(`start server on :${argv.port}`);
	// serve(argv.port);
};
