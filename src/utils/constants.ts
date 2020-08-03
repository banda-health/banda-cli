import { commandConfig } from 'run-git-command/types';

export const gitConfig: commandConfig = {
	logProcess: false,
};

export const semverRegex = /^\d+\.\d+\.\d+$/;
