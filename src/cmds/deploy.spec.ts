import inquirer from 'inquirer';
import {
	ErrorMessage,
	getErrorMessage,
	getQuestion,
	getStatusMessage,
	Question,
	StatusMessage,
} from '../utils/messages';
import * as utils from '../utils/utils';
import { handler, resetState, UsersVariables } from './deploy';

jest.mock('fs');
jest.mock('inquirer');

const mockedUtils = utils as jest.Mocked<typeof utils>;

const branch = {
	CURRENT: 'feature_test',
	SOURCE: 'release_test',
	TARGET: 'master_test',
	DEVELOPMENT: 'develop_test',
	RELEASE_BRANCH: 'release/release_branch_name',
	DEVELOPMENT_MERGE: 'merge-test/develop_test',
};
const REMOTE = 'test';
const version = {
	SOURCE: '1.5.0',
	TARGET: '1.4.5',
	USE: '1.4.6',
	NEXT: '1.5.0',
	INVALID: '1.4.6-SNAPSHOT',
};
const TAG = `v${version.USE}`;
const TEST_CWD = 'test/directory';

describe('deploy', () => {
	const initPrerequisites = (): void => {
		mockedUtils.isGitInstalled = jest.fn().mockReturnValue(true);
		mockedUtils.isWorkingDirectoryClean = jest.fn().mockReturnValue(true);
	};

	const loggedOutput: string[] = [];
	beforeEach(() => {
		setupSuccessfulExecution();
		const stdoutSpy = jest.spyOn(process.stdout, 'write');
		stdoutSpy.mockImplementation((...inputs) => {
			loggedOutput.push(...(inputs as string[]));
			return true;
		});
		mockedUtils.getFileNameSaveCwd = jest.fn().mockReturnValue(TEST_CWD);
		const consoleLogSpy = jest.spyOn(global.console, 'log');
		consoleLogSpy.mockImplementation((...inputs) => {
			loggedOutput.push(...(inputs as string[]));
			return true;
		});
	});

	afterEach(() => {
		loggedOutput.length = 0;
		require('fs').__clearData();
		resetState();
	});

	const setupSuccessfulVariableInput = (shouldAppendResumeAnswer: boolean = false): void => {
		initPrerequisites();
		(inquirer as any).prompt = jest.fn();
		if (shouldAppendResumeAnswer) {
			(inquirer as any).prompt.mockReturnValueOnce({ answer: false });
		}
		(inquirer as any).prompt
			.mockReturnValueOnce({ answer: REMOTE })
			.mockReturnValueOnce({ answer: branch.SOURCE })
			.mockReturnValueOnce({ answer: branch.TARGET })
			.mockReturnValueOnce({ answer: branch.DEVELOPMENT })
			.mockReturnValueOnce({ answer: version.USE })
			.mockReturnValueOnce({ answer: version.NEXT });
		mockedUtils.createDevelopmentMergeBranchName = jest.fn().mockReturnValue(branch.DEVELOPMENT_MERGE);
		mockedUtils.createReleaseBranchName = jest.fn().mockReturnValue(branch.RELEASE_BRANCH);
		mockedUtils.createReleaseTag = jest.fn().mockReturnValue(TAG);
		mockedUtils.createTag = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.doesRemoteExist = jest.fn().mockReturnValue(true);
		mockedUtils.doesTagExist = jest.fn().mockReturnValue(Promise.resolve(false));
		mockedUtils.doMergeConflictsExistOnCurrentBranch = jest.fn().mockReturnValue(Promise.resolve(false));
		mockedUtils.getCurrentBranch = jest.fn().mockReturnValue(Promise.resolve(branch.CURRENT));
		mockedUtils.getPackageJsonVersion = jest.fn().mockReturnValue(version.SOURCE);
		mockedUtils.isBranchCleanWhenUpdatedFromRemote = jest.fn().mockReturnValue(true);
	};

	const setupSuccessfulExecution = () => {
		mockedUtils.checkoutBranch = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.commitToBranch = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.createAndCheckoutBranch = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.createDevelopmentMergeBranchName = jest.fn().mockReturnValue(branch.DEVELOPMENT_MERGE);
		mockedUtils.createReleaseBranchName = jest.fn().mockReturnValue(branch.RELEASE_BRANCH);
		mockedUtils.createReleaseTag = jest.fn().mockReturnValue(TAG);
		mockedUtils.createTag = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.deleteLocalBranch = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.deleteRemoteBranch = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.doesRemoteExist = jest.fn().mockReturnValue(true);
		mockedUtils.doesTagExist = jest.fn().mockReturnValue(Promise.resolve(false));
		mockedUtils.doMergeConflictsExistOnCurrentBranch = jest.fn().mockReturnValue(Promise.resolve(false));
		mockedUtils.getCurrentBranch = jest.fn().mockReturnValue(Promise.resolve(branch.CURRENT));
		mockedUtils.getPackageJsonVersion = jest.fn().mockReturnValue(version.SOURCE);
		mockedUtils.isBranchCleanWhenUpdatedFromRemote = jest.fn().mockReturnValue(true);
		mockedUtils.isGitInstalled = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.isWorkingDirectoryClean = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.mergeBranch = jest.fn().mockReturnValue(Promise.resolve());
		mockedUtils.pullBranchFromRemote = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.pushToRemote = jest.fn().mockReturnValue(Promise.resolve(true));
		mockedUtils.touch = jest.fn();
		mockedUtils.updatePackageJsonVersion = jest.fn();
	};

	const configureToOnlyRunVariableInput = (): void => {
		mockedUtils.createAndCheckoutBranch = jest.fn().mockReturnValue(Promise.resolve(false));
	};

	const confirmTestExitedAfterRunVariableInput = (): void => {
		expect(loggedOutput[loggedOutput.length - 1]).toBe(
			getErrorMessage(ErrorMessage.CouldNotCreateBranch, branch.RELEASE_BRANCH),
		);
	};

	describe('checkPrerequisites', () => {
		it('fails if git is not installed', async () => {
			mockedUtils.isGitInstalled = jest.fn().mockReturnValue(false);
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(loggedOutput[loggedOutput.length - 1]).toBe(getErrorMessage(ErrorMessage.GitNotInstalled));
			}
		});

		it('fails if working directory is not clean', async () => {
			mockedUtils.isGitInstalled = jest.fn().mockReturnValue(true);
			mockedUtils.isWorkingDirectoryClean = jest.fn().mockReturnValue(false);
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(loggedOutput[loggedOutput.length - 1]).toBe(getErrorMessage(ErrorMessage.WorkspaceNotClean));
			}
		});
	});
	describe('getVariables', () => {
		it('if no file exists from a previous run, no continuation prompt is given', async () => {
			setupSuccessfulVariableInput();
			configureToOnlyRunVariableInput();
			const continuePrompt = getQuestion(Question.ContinuePreviousProcess);
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				confirmTestExitedAfterRunVariableInput();
				expect(loggedOutput.some((loggedValue) => loggedValue === continuePrompt)).toBe(false);
			}
		});
		it('if a file exists from a previous run, the user should be able to skip the input process', async () => {
			setupSuccessfulVariableInput();
			configureToOnlyRunVariableInput();
			const resumingMessage = getStatusMessage(StatusMessage.Resuming);
			try {
				await handler({});
			} catch {}
			confirmTestExitedAfterRunVariableInput();
			loggedOutput.length = 0;
			(inquirer as any).prompt.mockReturnValueOnce({ answer: true });
			try {
				await handler({});
			} catch {}
			confirmTestExitedAfterRunVariableInput();
			expect(loggedOutput.some((loggedValue) => loggedValue === resumingMessage)).toBe(true);
		});
		it('if a file exists from a previous run and the user chooses not to continue, the process should reset', async () => {
			setupSuccessfulVariableInput();
			configureToOnlyRunVariableInput();
			const resumingMessage = getStatusMessage(StatusMessage.Resuming);
			try {
				await handler({});
			} catch {}
			confirmTestExitedAfterRunVariableInput();
			loggedOutput.length = 0;
			setupSuccessfulVariableInput(true);
			try {
				await handler({});
			} catch {}
			confirmTestExitedAfterRunVariableInput(); //check
			expect(loggedOutput.some((loggedValue) => loggedValue === resumingMessage)).toBe(false);
		});
		it('a connection break errors out the process', async () => {
			setupSuccessfulVariableInput();
			// Any connection break will simply cause this method to return false
			mockedUtils.doesRemoteExist = jest.fn().mockReturnValue(Promise.resolve(false));
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(loggedOutput[loggedOutput.length - 1]).toBe(getErrorMessage(ErrorMessage.RemoteDoesNotExist, REMOTE));
			}
		});
		it('if the same source and target branches are selected, a rejected promise is returned', async () => {
			(inquirer as any).prompt = jest
				.fn()
				.mockReturnValueOnce({ answer: REMOTE })
				.mockReturnValueOnce({ answer: branch.SOURCE })
				.mockReturnValueOnce({ answer: branch.SOURCE });
			mockedUtils.doesRemoteExist = jest.fn().mockReturnValue(true);
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('if the same target and development branches are selected, a rejected promise is returned', async () => {
			(inquirer as any).prompt = jest
				.fn()
				.mockReturnValueOnce({ answer: REMOTE })
				.mockReturnValueOnce({ answer: branch.SOURCE })
				.mockReturnValueOnce({ answer: branch.TARGET })
				.mockReturnValueOnce({ answer: branch.TARGET });
			mockedUtils.doesRemoteExist = jest.fn().mockReturnValue(true);
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('asks the continuously until a valid package version is entered', async () => {
			setupSuccessfulVariableInput();
			configureToOnlyRunVariableInput();
			(inquirer as any).prompt = jest
				.fn()
				.mockReturnValueOnce({ answer: REMOTE })
				.mockReturnValueOnce({ answer: branch.SOURCE })
				.mockReturnValueOnce({ answer: branch.TARGET })
				.mockReturnValueOnce({ answer: branch.DEVELOPMENT })
				.mockReturnValueOnce({ answer: version.INVALID })
				.mockReturnValueOnce({ answer: version.INVALID })
				.mockReturnValueOnce({ answer: version.INVALID })
				.mockReturnValueOnce({ answer: version.USE })
				.mockReturnValueOnce({ answer: version.NEXT });
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				confirmTestExitedAfterRunVariableInput();
				const wrongPackageMessage = getErrorMessage(ErrorMessage.VersionFormatWrong, version.INVALID);
				expect(loggedOutput.filter((loggedValue) => loggedValue === wrongPackageMessage)).toHaveLength(3);
			}
		});
		it('asks the user for all inputs and saves them', async () => {
			setupSuccessfulVariableInput();
			configureToOnlyRunVariableInput();
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				const fileData = Object.values(require('fs').__getMockFileData() as { [fileName: string]: string });
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
		it('runs successfully', async () => {
			setupSuccessfulVariableInput();
			try {
				await handler({});
				expect(loggedOutput[loggedOutput.length - 1]).toBe(getStatusMessage(StatusMessage.Finished));
			} catch {
				expect(true).toBe(false);
			}
		});
		it(`doesn't try to update version numbers if there isn't a change`, async () => {
			setupSuccessfulVariableInput();
			const targetUpdateLog = getStatusMessage(StatusMessage.BranchPackageVersionUpdate, version.TARGET, version.USE);
			try {
				await handler({});
				expect(loggedOutput.some((loggedValue) => loggedValue === targetUpdateLog)).toBe(false);
			} catch {
				expect(true).toBe(false);
			}
		});
		it(`exits the process if there are merge conflicts when merging to target from source and allows a user to resume upon re-run`, async () => {});
		it(`exits the process if the user doesn't have rights to push to target branch`, async () => {});
		it(`exits the process if the user can't push tags to the target branch`, async () => {});
		it(`exits the process if there are merge conflicts when merging from target to development and allows a user to resume upon re-run`, async () => {});
		it(`pushes the development merge to remote if the user doesn't have access to push to development`, async () => {});
	});
});
