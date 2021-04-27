import chalk from 'chalk';

const undefinedValue = {
	BRANCH: 'branch_undefined',
	REMOTE: 'remote_undefined',
	VERSION: 'version_undefined',
	TAG: 'tag_undefined',
};

export enum ErrorMessage {
	GitNotInstalled,
	CurrentDirectoryNotGitRepo,
	WorkspaceNotClean,
	RemoteDoesNotExist,
	BranchDoesNotExist,
	TargetAndSourceBranchesMustDiffer,
	DevelopmentAndTargetBranchesMustDiffer,
	MergeConflictsOnPullToFix,
	MergeConflictsOnPull,
	MergeConflictsOnMerge,
	VersionFormatWrong,
	TagExists,
	CouldNotCheckOutBranch,
	CouldNotCreateBranch,
	FixReleaseBranchMergeConflicts,
	CannotPushBranch,
	CannotPushBranchToFinish,
	HaveSomeoneMerge,
	CannotPushTags,
	ErrorOnPull,
	NoVersionFound,
}

export const getErrorMessage = (errorMessage: ErrorMessage, ...additionalMessageParameters: string[]): string => {
	switch (errorMessage) {
		case ErrorMessage.GitNotInstalled:
			return 'Git is not installed. Please install before continuing.';
		case ErrorMessage.CurrentDirectoryNotGitRepo:
			return 'The current directory is not a Git repository.';
		case ErrorMessage.WorkspaceNotClean:
			return 'Working directory is not clean. Please stash or commit changes before continuing.';
		case ErrorMessage.RemoteDoesNotExist:
			return `Remote '${additionalMessageParameters[0] || undefinedValue.REMOTE}' does not exist. Exiting.`;
		case ErrorMessage.BranchDoesNotExist:
			return `Branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' does not exist. Exiting.`;
		case ErrorMessage.TargetAndSourceBranchesMustDiffer:
			return 'Target branch must be different than source branch.';
		case ErrorMessage.DevelopmentAndTargetBranchesMustDiffer:
			return 'Development branch must be different then target branch.';
		case ErrorMessage.MergeConflictsOnPullToFix:
			return `There were merge conflicts when pulling from remote on branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}'. Please fix and restart the process.`;
		case ErrorMessage.MergeConflictsOnPull:
			return 'There were merge conflicts when pulling from remote. Please fix and resume the process.';
		case ErrorMessage.MergeConflictsOnMerge:
			return 'There were merge conflicts when merging. Please fix and resume the process.';
		case ErrorMessage.VersionFormatWrong:
			return chalk.red(
				`Version '${
					additionalMessageParameters[0] || undefinedValue.VERSION
				}' is not in the correct format of #.#.#. Please enter again.`,
			);
		case ErrorMessage.TagExists:
			return `Tag ${
				additionalMessageParameters[0] || undefinedValue.TAG
			} already exists. Delete it or select a new app version before continuing.`;
		case ErrorMessage.CouldNotCheckOutBranch:
			return `There was an error checking out branch ${additionalMessageParameters[0] || undefinedValue.BRANCH}.`;
		case ErrorMessage.CouldNotCreateBranch:
			return `There was an error creating the branch ${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}. Exiting.`;
		case ErrorMessage.FixReleaseBranchMergeConflicts:
			return `There are merge conflicts between the source and release branches. Please fix the conflicts, commit them to branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}', and resume the process.`;
		case ErrorMessage.CannotPushBranch:
			return chalk.red(
				`You do not have permission to write to '${
					additionalMessageParameters[0] || undefinedValue.BRANCH
				}'. Pushing '${additionalMessageParameters[1] || undefinedValue.BRANCH}' to remote.`,
			);
		case ErrorMessage.CannotPushBranchToFinish:
			return chalk.red(
				`You do not have permission to write to '${
					additionalMessageParameters[0] || undefinedValue.BRANCH
				}'. Pushing '${additionalMessageParameters[1] || undefinedValue.BRANCH}' to remote.`,
			);
		case ErrorMessage.HaveSomeoneMerge:
			return `Please have someone merge '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}' for you, then continue this process.`;
		case ErrorMessage.CannotPushTags:
			return 'You do not have permission to push tags. Get permission, then resume this process.';
		case ErrorMessage.ErrorOnPull:
			return `There was an error when pulling branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'.`;
		case ErrorMessage.NoVersionFound:
			return 'No version found.';
		default:
			return 'No error message defined...';
	}
};

export enum StatusMessage {
	Resuming,
	CheckRemote,
	Confirmed,
	CheckBranch,
	AlreadyConfirmedBranchExists,
	FetchingTargetBranch,
	FetchingBranchFromRemote,
	FetchingSourceBranch,
	FetchingDevelopmentBranch,
	Done,
	Finished,
	SourceAndTargetVersion,
	CheckingTagUniqueness,
	Merge,
	ReleaseBranchPackageVersionUpdate,
	BranchPackageVersionUpdate,
	NoPackageUpdateNeeded,
	PushingToRemote,
	AssumingBranchMerged,
	CreatingTag,
	PushingTagToRemote,
	CreatingReleaseBranch,
	CreatingTemporaryMergeBranch,
	RemovingTemporaryMergeBranch,
	RemovingTemporaryMergeBranchLocally,
	MergeOnRemoteToFinish,
}

/**
 * Get a status message to display to the user
 * @param statusMessage StatusMessage enum
 * @param additionalMessageParameters An array of optional message parameters for message variables
 */
export const getStatusMessage = (statusMessage: StatusMessage, ...additionalMessageParameters: string[]): string => {
	switch (statusMessage) {
		case StatusMessage.Resuming:
			return 'Resuming...';
		case StatusMessage.CheckRemote:
			return `Checking to make sure remote '${additionalMessageParameters[0] || undefinedValue.REMOTE}' exists...`;
		case StatusMessage.Confirmed:
			return chalk.green('confirmed');
		case StatusMessage.CheckBranch:
			return `Checking to make sure branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}' exists on remote '${additionalMessageParameters[1] || undefinedValue.REMOTE}'...`;
		case StatusMessage.AlreadyConfirmedBranchExists:
			return `Already confirmed that branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' exists.`;
		case StatusMessage.FetchingTargetBranch:
			return `Fetching target branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'...`;
		case StatusMessage.FetchingBranchFromRemote:
			return `Fetching '${additionalMessageParameters[0] || undefinedValue.BRANCH}' from remote...`;
		case StatusMessage.FetchingSourceBranch:
			return `Fetching source branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'...`;
		case StatusMessage.FetchingDevelopmentBranch:
			return `Fetching development branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'...`;
		case StatusMessage.Done:
			return chalk.green('done');
		case StatusMessage.Finished:
			return chalk.green('Finished!');
		case StatusMessage.SourceAndTargetVersion:
			return `Source version: ${additionalMessageParameters[0] || undefinedValue.VERSION}, Target version: ${
				additionalMessageParameters[1] || undefinedValue.VERSION
			}`;
		case StatusMessage.CheckingTagUniqueness:
			return 'Checking tag uniqueness...';
		case StatusMessage.Merge:
			return `Merging '${additionalMessageParameters[0] || undefinedValue.BRANCH}' -> '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case StatusMessage.ReleaseBranchPackageVersionUpdate:
			return `Updating and committing the new package version '${
				additionalMessageParameters[0] || undefinedValue.VERSION
			}' in release branch '${additionalMessageParameters[1] || undefinedValue.BRANCH}'...`;
		case StatusMessage.BranchPackageVersionUpdate:
			return `Updating and committing the new package version '${
				additionalMessageParameters[0] || undefinedValue.VERSION
			}' in branch '${additionalMessageParameters[1] || undefinedValue.BRANCH}'...`;
		case StatusMessage.NoPackageUpdateNeeded:
			return 'No need to update package version. Skipping.';
		case StatusMessage.PushingToRemote:
			return `Pushing '${additionalMessageParameters[0] || undefinedValue.BRANCH}' to remote...`;
		case StatusMessage.AssumingBranchMerged:
			return `Assuming '${additionalMessageParameters[0] || undefinedValue.BRANCH}' has been merged to '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case StatusMessage.CreatingTag:
			return `Creating release tag '${additionalMessageParameters[0] || undefinedValue.TAG}' in target '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case StatusMessage.CreatingReleaseBranch:
			return `Creating release branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' off target '${
				additionalMessageParameters[1] || undefinedValue.BRANCH
			}'`;
		case StatusMessage.PushingTagToRemote:
			return `Pushing tag '${additionalMessageParameters[0] || undefinedValue.TAG}' to remote...`;
		case StatusMessage.CreatingTemporaryMergeBranch:
			return `Creating temporary merge branch '${
				additionalMessageParameters[0] || undefinedValue.BRANCH
			}' off development branch '${additionalMessageParameters[1] || undefinedValue.BRANCH}'...`;
		case StatusMessage.RemovingTemporaryMergeBranch:
			return `Removing temporary merge branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}'.`;
		case StatusMessage.RemovingTemporaryMergeBranchLocally:
			return `Removing temporary merge branch '${additionalMessageParameters[0] || undefinedValue.BRANCH}' locally.`;
		case StatusMessage.MergeOnRemoteToFinish:
			return chalk.yellow(
				`Please have someone merge '${
					additionalMessageParameters[0] || undefinedValue.BRANCH
				}' for you to finish this process.`,
			);
		default:
			return 'No status message defined...';
	}
};

export enum Question {
	ContinuePreviousProcess,
	GitRemoteToUse,
	SourceBranchToUse,
	TargetBranchToUse,
	DevelopmentBranchToUse,
	VersionNumberToUse,
	NextVersionToUse,
}

export const getQuestion = (question: Question, ...additionalQuestionParameters: string[]): string => {
	switch (question) {
		case Question.ContinuePreviousProcess:
			return 'The previous process did not complete - continue it?';
		case Question.GitRemoteToUse:
			return 'Git Remote to use:';
		case Question.SourceBranchToUse:
			return 'Source branch to use:';
		case Question.TargetBranchToUse:
			return 'Target branch to use:';
		case Question.DevelopmentBranchToUse:
			return 'Development branch to use:';
		case Question.VersionNumberToUse:
			return 'Version number for this release:';
		case Question.NextVersionToUse:
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
