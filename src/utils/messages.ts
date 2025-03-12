import chalk from 'chalk';

const undefinedValue = {
	BRANCH: 'branch_undefined',
	REMOTE: 'remote_undefined',
	VERSION: 'version_undefined',
	TAG: 'tag_undefined',
} as const;

export const errorMessage = {
	BranchDoesNotExist: 'BranchDoesNotExist',
	CannotPushBranch: 'CannotPushBranch',
	CannotPushBranchToFinish: 'CannotPushBranchToFinish',
	CannotPushTags: 'CannotPushTags',
	CouldNotCheckOutBranch: 'CouldNotCheckOutBranch',
	CouldNotCreateBranch: 'CouldNotCreateBranch',
	CurrentDirectoryNotGitRepo: 'CurrentDirectoryNotGitRepo',
	DevelopmentAndTargetBranchesMustDiffer: 'DevelopmentAndTargetBranchesMustDiffer',
	ErrorOnPull: 'ErrorOnPull',
	FixReleaseBranchMergeConflicts: 'FixReleaseBranchMergeConflicts',
	GitNotInstalled: 'GitNotInstalled',
	HaveSomeoneMerge: 'HaveSomeoneMerge',
	MergeConflictsOnMerge: 'MergeConflictsOnMerge',
	MergeConflictsOnPull: 'MergeConflictsOnPull',
	MergeConflictsOnPullToFix: 'MergeConflictsOnPullToFix',
	NoVersionFound: 'NoVersionFound',
	RemoteDoesNotExist: 'RemoteDoesNotExist',
	TagExists: 'TagExists',
	TargetAndSourceBranchesMustDiffer: 'TargetAndSourceBranchesMustDiffer',
	VersionFormatWrong: 'VersionFormatWrong',
	WorkspaceNotClean: 'WorkspaceNotClean',
} as const;

export const getErrorMessage = (
	errorMessageValue: keyof typeof errorMessage,
	...additionalMessageParameters: string[]
): string => {
	switch (errorMessageValue) {
		case errorMessage.GitNotInstalled:
			return 'Git is not installed. Please install before continuing.';
		case errorMessage.CurrentDirectoryNotGitRepo:
			return 'The current directory is not a Git repository.';
		case errorMessage.WorkspaceNotClean:
			return 'Working directory is not clean. Please stash or commit changes before continuing.';
		case errorMessage.RemoteDoesNotExist:
			return `Remote '${additionalMessageParameters[0] || undefinedValue.REMOTE}' does not exist. Exiting.`;
		case errorMessage.BranchDoesNotExist:
			return `Branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' does not exist. Exiting.`;
		case errorMessage.TargetAndSourceBranchesMustDiffer:
			return 'Target branch must be different than source branch.';
		case errorMessage.DevelopmentAndTargetBranchesMustDiffer:
			return 'Development branch must be different then target branch.';
		case errorMessage.MergeConflictsOnPullToFix:
			return `There were merge conflicts when pulling from remote on branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}'. Please fix and restart the process.`;
		case errorMessage.MergeConflictsOnPull:
			return 'There were merge conflicts when pulling from remote. Please fix and resume the process.';
		case errorMessage.MergeConflictsOnMerge:
			return 'There were merge conflicts when merging. Please fix and resume the process.';
		case errorMessage.VersionFormatWrong:
			return chalk.red(
				`Version '${
					additionalMessageParameters[0] || undefinedValue.VERSION
				}' is not in the correct format of #.#.#. Please enter again.`,
			);
		case errorMessage.TagExists:
			return `Tag ${
				additionalMessageParameters[0] || undefinedValue.TAG
			} already exists. Delete it or select a new app version before continuing.`;
		case errorMessage.CouldNotCheckOutBranch:
			return `There was an error checking out branch ${additionalMessageParameters[0] || undefinedValue.BRANCH}.`;
		case errorMessage.CouldNotCreateBranch:
			return `There was an error creating the branch ${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}. Exiting.`;
		case errorMessage.FixReleaseBranchMergeConflicts:
			return `There are merge conflicts between the source and release branches. Please fix the conflicts, commit them to branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}', and resume the process.`;
		case errorMessage.CannotPushBranch:
			return chalk.red(
				`You do not have permission to write to '${
					additionalMessageParameters[0] || undefinedValue.BRANCH
				}'. Pushing '${additionalMessageParameters[1] || undefinedValue.BRANCH}' to remote.`,
			);
		case errorMessage.CannotPushBranchToFinish:
			return chalk.red(
				`You do not have permission to write to '${
					additionalMessageParameters[0] || undefinedValue.BRANCH
				}'. Pushing '${additionalMessageParameters[1] || undefinedValue.BRANCH}' to remote.`,
			);
		case errorMessage.HaveSomeoneMerge:
			return `Please have someone merge '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}' for you, then continue this process.`;
		case errorMessage.CannotPushTags:
			return 'You do not have permission to push tags. Get permission, then resume this process.';
		case errorMessage.ErrorOnPull:
			return `There was an error when pulling branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'.`;
		case errorMessage.NoVersionFound:
			return 'No version found.';
		default:
			return 'No error message defined...';
	}
};

export const statusMessage = {
	AlreadyConfirmedBranchExists: 'AlreadyConfirmedBranchExists',
	AssumingBranchMerged: 'AssumingBranchMerged',
	BranchPackageVersionUpdate: 'BranchPackageVersionUpdate',
	CheckBranch: 'CheckBranch',
	CheckingTagUniqueness: 'CheckingTagUniqueness',
	CheckRemote: 'CheckRemote',
	Confirmed: 'Confirmed',
	CreatingReleaseBranch: 'CreatingReleaseBranch',
	CreatingTag: 'CreatingTag',
	CreatingTemporaryMergeBranch: 'CreatingTemporaryMergeBranch',
	Done: 'Done',
	FetchingBranchFromRemote: 'FetchingBranchFromRemote',
	FetchingDevelopmentBranch: 'FetchingDevelopmentBranch',
	FetchingSourceBranch: 'FetchingSourceBranch',
	FetchingTargetBranch: 'FetchingTargetBranch',
	Finished: 'Finished',
	Merge: 'Merge',
	MergeOnRemoteToFinish: 'MergeOnRemoteToFinish',
	NoPackageUpdateNeeded: 'NoPackageUpdateNeeded',
	PushingTagToRemote: 'PushingTagToRemote',
	PushingToRemote: 'PushingToRemote',
	ReleaseBranchPackageVersionUpdate: 'ReleaseBranchPackageVersionUpdate',
	RemovingTemporaryMergeBranch: 'RemovingTemporaryMergeBranch',
	RemovingTemporaryMergeBranchLocally: 'RemovingTemporaryMergeBranchLocally',
	Resuming: 'Resuming',
	SourceAndTargetVersion: 'SourceAndTargetVersion',
} as const;

/**
 * Get a status message to display to the user
 * @param statusMessageToUse StatusMessage enum
 * @param additionalMessageParameters An array of optional message parameters for message variables
 */
export const getStatusMessage = (
	statusMessageToUse: keyof typeof statusMessage,
	...additionalMessageParameters: string[]
): string => {
	switch (statusMessageToUse) {
		case statusMessage.Resuming:
			return 'Resuming...';
		case statusMessage.CheckRemote:
			return `Checking to make sure remote '${additionalMessageParameters[0] || undefinedValue.REMOTE}' exists...`;
		case statusMessage.Confirmed:
			return chalk.green('confirmed');
		case statusMessage.CheckBranch:
			return `Checking to make sure branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}' exists on remote '${additionalMessageParameters[1] || undefinedValue.REMOTE}'...`;
		case statusMessage.AlreadyConfirmedBranchExists:
			return `Already confirmed that branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' exists.`;
		case statusMessage.FetchingTargetBranch:
			return `Fetching target branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'...`;
		case statusMessage.FetchingBranchFromRemote:
			return `Fetching '${additionalMessageParameters[0] || undefinedValue.BRANCH}' from remote...`;
		case statusMessage.FetchingSourceBranch:
			return `Fetching source branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'...`;
		case statusMessage.FetchingDevelopmentBranch:
			return `Fetching development branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'...`;
		case statusMessage.Done:
			return chalk.green('done');
		case statusMessage.Finished:
			return chalk.green('Finished!');
		case statusMessage.SourceAndTargetVersion:
			return `Source version: ${additionalMessageParameters[0] || undefinedValue.VERSION}, Target version: ${
				additionalMessageParameters[1] || undefinedValue.VERSION
			}`;
		case statusMessage.CheckingTagUniqueness:
			return 'Checking tag uniqueness...';
		case statusMessage.Merge:
			return `Merging '${additionalMessageParameters[0] || undefinedValue.BRANCH}' -> '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case statusMessage.ReleaseBranchPackageVersionUpdate:
			return `Updating and committing the new package version '${
				additionalMessageParameters[0] || undefinedValue.VERSION
			}' in release branch '${additionalMessageParameters[1] || undefinedValue.BRANCH}'...`;
		case statusMessage.BranchPackageVersionUpdate:
			return `Updating and committing the new package version '${
				additionalMessageParameters[0] || undefinedValue.VERSION
			}' in branch '${additionalMessageParameters[1] || undefinedValue.BRANCH}'...`;
		case statusMessage.NoPackageUpdateNeeded:
			return 'No need to update package version. Skipping.';
		case statusMessage.PushingToRemote:
			return `Pushing '${additionalMessageParameters[0] || undefinedValue.BRANCH}' to remote...`;
		case statusMessage.AssumingBranchMerged:
			return `Assuming '${additionalMessageParameters[0] || undefinedValue.BRANCH}' has been merged to '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case statusMessage.CreatingTag:
			return `Creating release tag '${additionalMessageParameters[0] || undefinedValue.TAG}' in target '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case statusMessage.CreatingReleaseBranch:
			return `Creating release branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' off target '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case statusMessage.PushingTagToRemote:
			return `Pushing tag '${additionalMessageParameters[0] || undefinedValue.TAG}' to remote...`;
		case statusMessage.CreatingTemporaryMergeBranch:
			return `Creating temporary merge branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}' off development branch '${additionalMessageParameters[1] || undefinedValue.BRANCH}'...`;
		case statusMessage.RemovingTemporaryMergeBranch:
			return `Removing temporary merge branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'.`;
		case statusMessage.RemovingTemporaryMergeBranchLocally:
			return `Removing temporary merge branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' locally.`;
		case statusMessage.MergeOnRemoteToFinish:
			return chalk.yellow(
				`Please have someone merge '${
					additionalMessageParameters[0] || undefinedValue.BRANCH
				}' for you to finish this process.`,
			);
		default:
			return 'No status message defined...';
	}
};

export const question = {
	ContinuePreviousProcess: 'ContinuePreviousProcess',
	DevelopmentBranchToUse: 'DevelopmentBranchToUse',
	GitRemoteToUse: 'GitRemoteToUse',
	NextVersionToUse: 'NextVersionToUse',
	SourceBranchToUse: 'SourceBranchToUse',
	TargetBranchToUse: 'TargetBranchToUse',
	VersionNumberToUse: 'VersionNumberToUse',
} as const;

export const getQuestion = (
	questionToUse: keyof typeof question,
	...additionalQuestionParameters: string[]
): string => {
	switch (questionToUse) {
		case question.ContinuePreviousProcess:
			return 'The previous process did not complete - continue it?';
		case question.GitRemoteToUse:
			return 'Git Remote to use:';
		case question.SourceBranchToUse:
			return 'Source branch to use:';
		case question.TargetBranchToUse:
			return 'Target branch to use:';
		case question.DevelopmentBranchToUse:
			return 'Development branch to use:';
		case question.VersionNumberToUse:
			return 'Version number for this release:';
		case question.NextVersionToUse:
			return `Next app version to use in development branch '${
				additionalQuestionParameters[0] || undefinedValue.BRANCH
			}':`;
		default:
			return 'No question defined...';
	}
};

export const commitMessage = {
	UPDATE_APP_VERSION: 'chore: update app version',
};
