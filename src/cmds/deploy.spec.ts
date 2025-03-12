import chalk from 'chalk';
import { readFileSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import {
	errorMessage,
	getErrorMessage,
	getQuestion,
	getStatusMessage,
	question,
	statusMessage,
} from '../utils/messages';
import {
	createAndCheckoutBranch,
	doesRemoteExist,
	doMergeConflictsExistOnCurrentBranch,
	getFileNameSaveCwd,
	isCurrentDirectoryGitRepo,
	isGitInstalled,
	isWorkingDirectoryClean,
	mergeBranch,
	pullBranchFromRemote,
	pushToRemote,
} from '../utils/utils';
import { handler, resetState, UsersVariables } from './deploy';

let mockFileData: { [fileName: string]: string } = vi.hoisted(() => ({}));
let mockFileList: string[] = vi.hoisted(() => []);
vi.mock(import('fs'), () => ({
	existsSync: vi.fn((path) => {
		return mockFileList.includes(path);
	}),
	mkdirSync: vi.fn(),
	readFileSync: vi.fn((path) => {
		return mockFileData[path] || '';
	}) as unknown as typeof readFileSync,
	unlinkSync: vi.fn((path) => {
		mockFileList.filter((mockedFile) => mockedFile !== path);
	}),
	writeFileSync: vi.fn((path, data) => {
		mockFileData[path] = data;
		mockFileList.push(path);
	}),
}));
vi.mock('inquirer');
vi.mock(import('../utils/utils.js'), () => ({
	checkoutBranch: vi.fn(() => Promise.resolve(true)),
	commitToBranch: vi.fn(() => Promise.resolve(true)),
	createAndCheckoutBranch: vi.fn(() => Promise.resolve(true)),
	createDevelopmentMergeBranchName: vi.fn(() => branch.DEVELOPMENT_MERGE),
	createReleaseBranchName: vi.fn(() => branch.RELEASE_BRANCH),
	createReleaseTag: vi.fn(() => TAG),
	createTag: vi.fn(() => Promise.resolve(true)),
	deleteLocalBranch: vi.fn(() => Promise.resolve(true)),
	deleteRemoteBranch: vi.fn(() => Promise.resolve(true)),
	doesRemoteExist: vi.fn(() => Promise.resolve(true)),
	doesTagExist: vi.fn(() => Promise.resolve(false)),
	doMergeConflictsExistOnCurrentBranch: vi.fn(() => Promise.resolve(false)),
	getCurrentBranch: vi.fn(() => Promise.resolve(branch.CURRENT)),
	getFileNameSaveCwd: vi.fn(() => ''),
	getRepositoryVersion: vi.fn(() => Promise.resolve(version.SOURCE)),
	isBranchCleanWhenUpdatedFromRemote: vi.fn(() => Promise.resolve(true)),
	isCurrentDirectoryGitRepo: vi.fn(() => Promise.resolve(true)),
	isGitInstalled: vi.fn(() => Promise.resolve(true)),
	isWorkingDirectoryClean: vi.fn(() => Promise.resolve(true)),
	mergeBranch: vi.fn(() => Promise.resolve()),
	pullBranchFromRemote: vi.fn(() => Promise.resolve(true)),
	pushToRemote: vi.fn(() => Promise.resolve(true)),
	touch: vi.fn((fileName: string) => {
		writeFileSync(fileName, '');
	}),
	updateRepositoryVersion: vi.fn(),
}));
vi.mock('run-git-command');

const branch = vi.hoisted(
	() =>
		({
			CURRENT: 'feature_test',
			SOURCE: 'release_test',
			TARGET: 'master_test',
			DEVELOPMENT: 'develop_test',
			RELEASE_BRANCH: 'release/release_branch_name',
			DEVELOPMENT_MERGE: 'merge-test/develop_test',
		}) as const,
);
const REMOTE = 'test';
const version = vi.hoisted(
	() =>
		({
			SOURCE: '1.5.0',
			TARGET: '1.4.5',
			USE: '1.4.6',
			NEXT: '1.5.0',
			INVALID: '1.4.6-SNAPSHOT',
		}) as const,
);
const TAG = vi.hoisted(() => `v${version.USE}`);

const initPrerequisites = (): void => {
	vi.mocked(isGitInstalled).mockResolvedValue(true);
	vi.mocked(isWorkingDirectoryClean).mockResolvedValue(true);
};

let loggedOutput: string[] = [];
beforeEach(() => {
	const stdoutSpy = vi.spyOn(process.stdout, 'write');
	stdoutSpy.mockImplementation((...inputs) => {
		loggedOutput.push(...(inputs as string[]));
		return true;
	});
	vi.mocked(getFileNameSaveCwd).mockReturnValue('test/directory');
	const consoleLogSpy = vi.spyOn(global.console, 'log');
	consoleLogSpy.mockImplementation((...inputs) => {
		loggedOutput.push(...(inputs as string[]));
		return true;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	resetState();
	loggedOutput = [];
	mockFileData = {};
	mockFileList = [];
});

const setupSuccessfulVariableInput = (shouldAppendResumeAnswer: boolean = false): void => {
	initPrerequisites();
	if (shouldAppendResumeAnswer) {
		vi.mocked(inquirer.prompt).mockResolvedValueOnce({ answer: false });
	}
	vi.mocked(inquirer.prompt)
		.mockResolvedValueOnce({ answer: REMOTE })
		.mockResolvedValueOnce({ answer: branch.SOURCE })
		.mockResolvedValueOnce({ answer: branch.TARGET })
		.mockResolvedValueOnce({ answer: branch.DEVELOPMENT })
		.mockResolvedValueOnce({ answer: version.USE })
		.mockResolvedValueOnce({ answer: version.NEXT });
};

const configureToOnlyRunVariableInput = (): void => {
	vi.mocked(createAndCheckoutBranch).mockResolvedValue(false);
};

const confirmTestExitedAfterRunVariableInput = (): void => {
	expect(loggedOutput[loggedOutput.length - 1]).toBe(
		chalk.red(getErrorMessage(errorMessage.CouldNotCreateBranch, branch.RELEASE_BRANCH)),
	);
};

const confirmProcessExecutedSuccessfully = () => {
	expect(loggedOutput[loggedOutput.length - 1]).toBe(getStatusMessage(statusMessage.Finished));
};

const addContinuationResponse = () => {
	vi.mocked(inquirer.prompt).mockResolvedValueOnce({ answer: true });
};

describe('checkPrerequisites', () => {
	it('fails if git is not installed', async () => {
		vi.mocked(isGitInstalled).mockResolvedValue(false);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(chalk.red(getErrorMessage(errorMessage.GitNotInstalled)));
		}
	});
	it('stops if current directory is not a git repository', async () => {
		vi.mocked(isCurrentDirectoryGitRepo).mockResolvedValue(false);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(
				chalk.red(getErrorMessage(errorMessage.CurrentDirectoryNotGitRepo)),
			);
		}
	});
	it('fails if working directory is not clean', async () => {
		vi.mocked(isGitInstalled).mockResolvedValue(true);
		vi.mocked(isWorkingDirectoryClean).mockResolvedValue(false);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(chalk.red(getErrorMessage(errorMessage.WorkspaceNotClean)));
		}
	});
});
describe('getVariables', () => {
	it('if no file exists from a previous run, no continuation prompt is given', async () => {
		setupSuccessfulVariableInput();
		configureToOnlyRunVariableInput();
		const continuePrompt = getQuestion(question.ContinuePreviousProcess);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			confirmTestExitedAfterRunVariableInput();
			expect(loggedOutput.some((loggedValue) => loggedValue === continuePrompt)).toBe(false);
		}
	});
	it('if a file exists from a previous run, the user should be able to skip the input process', async () => {
		setupSuccessfulVariableInput();
		configureToOnlyRunVariableInput();
		const resumingMessage = getStatusMessage(statusMessage.Resuming);
		try {
			await handler();
		} catch {}
		confirmTestExitedAfterRunVariableInput();
		loggedOutput.length = 0;
		addContinuationResponse();
		try {
			await handler();
		} catch {}
		confirmTestExitedAfterRunVariableInput();
		expect(loggedOutput.some((loggedValue) => loggedValue === resumingMessage)).toBe(true);
	});
	it('if a file exists from a previous run and the user chooses not to continue, the process should reset', async () => {
		setupSuccessfulVariableInput();
		configureToOnlyRunVariableInput();
		const resumingMessage = getStatusMessage(statusMessage.Resuming);
		try {
			await handler();
		} catch {}
		confirmTestExitedAfterRunVariableInput();
		loggedOutput.length = 0;
		setupSuccessfulVariableInput(true);
		try {
			await handler();
		} catch {}
		confirmTestExitedAfterRunVariableInput();
		expect(loggedOutput.some((loggedValue) => loggedValue === resumingMessage)).toBe(false);
	});
	it('a connection break errors out the process', async () => {
		setupSuccessfulVariableInput();
		// Any connection break will simply cause this method to return false
		vi.mocked(doesRemoteExist).mockResolvedValue(false);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(
				chalk.red(getErrorMessage(errorMessage.RemoteDoesNotExist, REMOTE)),
			);
		}
	});
	it('if the same source and target branches are selected, a rejected promise is returned', async () => {
		vi.mocked(inquirer.prompt)
			.mockResolvedValueOnce({ answer: REMOTE })
			.mockResolvedValueOnce({ answer: branch.SOURCE })
			.mockResolvedValueOnce({ answer: branch.SOURCE });
		vi.mocked(doesRemoteExist).mockResolvedValue(true);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(true).toBe(true);
		}
	});
	it('if the same target and development branches are selected, a rejected promise is returned', async () => {
		vi.mocked(inquirer.prompt)
			.mockResolvedValueOnce({ answer: REMOTE })
			.mockResolvedValueOnce({ answer: branch.SOURCE })
			.mockResolvedValueOnce({ answer: branch.TARGET })
			.mockResolvedValueOnce({ answer: branch.TARGET });
		vi.mocked(doesRemoteExist).mockResolvedValue(true);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(true).toBe(true);
		}
	});
	it('asks continuously until a valid package version is entered', async () => {
		setupSuccessfulVariableInput();
		configureToOnlyRunVariableInput();
		vi.mocked(inquirer.prompt).mockRestore();
		vi.mocked(inquirer.prompt)
			.mockResolvedValueOnce({ answer: REMOTE })
			.mockResolvedValueOnce({ answer: branch.SOURCE })
			.mockResolvedValueOnce({ answer: branch.TARGET })
			.mockResolvedValueOnce({ answer: branch.DEVELOPMENT })
			.mockResolvedValueOnce({ answer: version.INVALID })
			.mockResolvedValueOnce({ answer: version.INVALID })
			.mockResolvedValueOnce({ answer: version.INVALID })
			.mockResolvedValueOnce({ answer: version.USE })
			.mockResolvedValueOnce({ answer: version.NEXT });
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			confirmTestExitedAfterRunVariableInput();
			const wrongPackageMessage = getErrorMessage(errorMessage.VersionFormatWrong, version.INVALID);
			expect(loggedOutput.filter((loggedValue) => loggedValue === wrongPackageMessage)).toHaveLength(3);
		}
	});
	it('asks the user for all inputs and saves them', async () => {
		setupSuccessfulVariableInput();
		configureToOnlyRunVariableInput();
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			const fileData = Object.values(mockFileData);
			expect(fileData).toHaveLength(1);
			const userData = JSON.parse(fileData[0]) as UsersVariables;
			expect(userData.developmentBranch).toBe(branch.DEVELOPMENT);
			expect(userData.nextPackageVersion).toBe(version.NEXT);
			expect(userData.packageVersion).toBe(version.USE);
			expect(userData.remote).toBe(REMOTE);
			expect(userData.sourceBranch).toBe(branch.SOURCE);
			expect(userData.tag).toBe(TAG);
			expect(userData.targetBranch).toBe(branch.TARGET);
		}
	});
});
describe('run', () => {
	beforeEach(() => {
		setupSuccessfulVariableInput();
	});

	const ensureSkippedMessagesAreNotDisplayedOnResume = (...messagesThatShouldBeSkipped: string[]) => {
		expect(loggedOutput.some((loggedValue) => messagesThatShouldBeSkipped.includes(loggedValue))).toBe(false);
	};

	const resetWithContinuation = () => {
		loggedOutput.length = 0;
		vi.clearAllMocks();
		addContinuationResponse();
	};

	it('runs successfully', async () => {
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		confirmProcessExecutedSuccessfully();
	});
	it(`doesn't try to update version numbers if there isn't a change`, async () => {
		const targetUpdateLog = getStatusMessage(statusMessage.BranchPackageVersionUpdate, version.TARGET, version.USE);
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		expect(loggedOutput.some((loggedValue) => loggedValue === targetUpdateLog)).toBe(false);
	});
	it(`exits the process if there are merge conflicts when merging to target from source and allows a user to resume upon re-run`, async () => {
		vi.mocked(mergeBranch).mockReturnValue(Promise.reject());
		vi.mocked(doMergeConflictsExistOnCurrentBranch).mockResolvedValue(true);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(
				chalk.red(getErrorMessage(errorMessage.FixReleaseBranchMergeConflicts, branch.RELEASE_BRANCH)),
			);
		}
		resetWithContinuation();
		vi.mocked(mergeBranch).mockReset();
		vi.mocked(doMergeConflictsExistOnCurrentBranch).mockReset();
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		confirmProcessExecutedSuccessfully();
		ensureSkippedMessagesAreNotDisplayedOnResume(
			getStatusMessage(statusMessage.CreatingReleaseBranch, branch.RELEASE_BRANCH, branch.TARGET),
		);
	});
	it(`exits the process if the user doesn't have rights to push to target branch`, async () => {
		vi.mocked(pushToRemote).mockResolvedValue(false);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(
				chalk.red(getErrorMessage(errorMessage.HaveSomeoneMerge, branch.RELEASE_BRANCH)),
			);
		}
		resetWithContinuation();
		vi.mocked(pushToRemote).mockReset();
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		confirmProcessExecutedSuccessfully();
		ensureSkippedMessagesAreNotDisplayedOnResume(
			getStatusMessage(statusMessage.CreatingReleaseBranch, branch.RELEASE_BRANCH, branch.TARGET),
			getStatusMessage(statusMessage.PushingToRemote, branch.TARGET),
		);
	});
	it(`exits the process if the user can't push tags to the target branch`, async () => {
		vi.mocked(pushToRemote).mockResolvedValue(false).mockResolvedValueOnce(true);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(chalk.red(getErrorMessage(errorMessage.CannotPushTags)));
		}
		resetWithContinuation();
		vi.mocked(pushToRemote).mockReset();
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		confirmProcessExecutedSuccessfully();
		ensureSkippedMessagesAreNotDisplayedOnResume(
			getStatusMessage(statusMessage.CreatingReleaseBranch, branch.RELEASE_BRANCH, branch.TARGET),
			getStatusMessage(statusMessage.PushingToRemote, branch.TARGET),
			getStatusMessage(statusMessage.CreatingTag, TAG, branch.TARGET),
		);
	});
	it(`exits the process if there are merge conflicts when pulling from remote on development branch and allows a user to resume upon re-run`, async () => {
		vi.mocked(pullBranchFromRemote).mockResolvedValue(false).mockResolvedValueOnce(true);
		vi.mocked(doMergeConflictsExistOnCurrentBranch).mockResolvedValue(true);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(chalk.red(getErrorMessage(errorMessage.MergeConflictsOnPull)));
		}
		resetWithContinuation();
		vi.mocked(pullBranchFromRemote).mockReset();
		vi.mocked(doMergeConflictsExistOnCurrentBranch).mockReset();
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		confirmProcessExecutedSuccessfully();
		ensureSkippedMessagesAreNotDisplayedOnResume(
			getStatusMessage(statusMessage.CreatingReleaseBranch, branch.RELEASE_BRANCH, branch.TARGET),
			getStatusMessage(statusMessage.PushingToRemote, branch.TARGET),
			getStatusMessage(statusMessage.CreatingTag, TAG, branch.TARGET),
			getStatusMessage(statusMessage.PushingTagToRemote, TAG),
		);
	});
	it(`exits the process if there are merge conflicts when merging from target to development and allows a user to resume upon re-run`, async () => {
		vi.mocked(mergeBranch)
			.mockReturnValue(Promise.reject())
			.mockReturnValueOnce(Promise.resolve())
			.mockReturnValueOnce(Promise.resolve());
		vi.mocked(doMergeConflictsExistOnCurrentBranch).mockResolvedValue(true);
		try {
			await handler();
			expect(true).toBe(false);
		} catch {
			expect(loggedOutput[loggedOutput.length - 1]).toBe(
				chalk.red(getErrorMessage(errorMessage.MergeConflictsOnMerge)),
			);
		}
		resetWithContinuation();
		vi.mocked(mergeBranch).mockReset();
		vi.mocked(doMergeConflictsExistOnCurrentBranch).mockReset();
		try {
			await handler();
		} catch {
			expect(true).toBe(false);
		}
		confirmProcessExecutedSuccessfully();
		ensureSkippedMessagesAreNotDisplayedOnResume(
			getStatusMessage(statusMessage.CreatingReleaseBranch, branch.RELEASE_BRANCH, branch.TARGET),
			getStatusMessage(statusMessage.PushingToRemote, branch.TARGET),
			getStatusMessage(statusMessage.CreatingTag, TAG, branch.TARGET),
			getStatusMessage(statusMessage.CreatingTemporaryMergeBranch, branch.DEVELOPMENT_MERGE, branch.DEVELOPMENT),
		);
	});
	it(`pushes the development merge to remote if the user doesn't have access to push to development`, async () => {
		vi.mocked(pushToRemote).mockResolvedValue(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true);
		await handler();
		expect(loggedOutput[loggedOutput.length - 2]).toBe(
			getStatusMessage(statusMessage.MergeOnRemoteToFinish, branch.DEVELOPMENT_MERGE),
		);
	});
});
