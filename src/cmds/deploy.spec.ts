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
import { handler, UsersVariables } from './deploy';

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
};
const TAG = `v${version.USE}`;
const TEST_CWD = 'test/directory';

describe('deploy', () => {
	const commandReturns: { [joinedCommand: string]: Promise<any> } = {};
	commandReturns[`checkout ${branch.TARGET}`] = Promise.resolve();
	commandReturns[`checkout ${branch.SOURCE}`] = Promise.resolve();
	commandReturns[`checkout -b ${branch.RELEASE_BRANCH}`] = Promise.resolve();
	commandReturns[`checkout -b ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`checkout ${branch.RELEASE_BRANCH}`] = Promise.resolve();
	commandReturns[`checkout ${branch.DEVELOPMENT}`] = Promise.resolve();
	commandReturns[`checkout ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`checkout ${branch.CURRENT}`] = Promise.resolve();
	commandReturns[`pull ${REMOTE} ${branch.TARGET}`] = Promise.resolve();
	commandReturns[`pull ${REMOTE} ${branch.SOURCE}`] = Promise.resolve();
	commandReturns[`pull ${REMOTE} ${branch.DEVELOPMENT}`] = Promise.resolve();
	commandReturns[`push ${REMOTE} ${branch.TARGET}`] = Promise.resolve();
	commandReturns[`push ${REMOTE} ${branch.DEVELOPMENT}`] = Promise.resolve();
	commandReturns[`push ${REMOTE} ${TAG}`] = Promise.resolve();
	commandReturns[`push -u ${REMOTE} ${branch.RELEASE_BRANCH}`] = Promise.resolve();
	commandReturns[`push -u ${REMOTE} ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`push ${REMOTE} -d ${branch.RELEASE_BRANCH}`] = Promise.resolve();
	commandReturns[`tag -l ${TAG}`] = Promise.resolve();
	commandReturns[`tag -a ${TAG} -m "Merging branch '${branch.RELEASE_BRANCH}'"`] = Promise.resolve();
	commandReturns[`merge --no-ff ${branch.SOURCE}`] = Promise.resolve();
	commandReturns[`merge --no-ff ${branch.RELEASE_BRANCH}`] = Promise.resolve();
	commandReturns[`merge --no-ff ${branch.TARGET}`] = Promise.resolve();
	commandReturns[`merge --no-ff ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`branch -d ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`branch -D ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();

	const setGitCommands = (commandsAndTheirReturns = commandReturns) => {
		require('run-git-command').__setMockResponse(commandsAndTheirReturns);
	};

	const initPrerequisites = (): void => {
		mockedUtils.isGitInstalled = jest.fn().mockReturnValue(true);
		mockedUtils.isWorkingDirectoryClean = jest.fn().mockReturnValue(true);
	};

	const loggedOutput: string[] = [];
	beforeEach(() => {
		initPrerequisites();
		setGitCommands();
		const stdoutSpy = jest.spyOn(process.stdout, 'write');
		stdoutSpy.mockImplementation((...inputs) => {
			loggedOutput.push(...(inputs as string[]));
			return true;
		});
		const cwdSpy = jest.spyOn(process, 'cwd');
		cwdSpy.mockImplementation(() => TEST_CWD);
		const consoleLogSpy = jest.spyOn(global.console, 'log');
		consoleLogSpy.mockImplementation((...inputs) => {
			loggedOutput.push(...(inputs as string[]));
			return true;
		});
	});

	afterEach(() => {
		loggedOutput.length = 0;
	});

	const setupSuccessfulVariableInput = (shouldAppendResumeAnswer: boolean = false): void => {
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
		mockedUtils.doesRemoteExist = jest.fn().mockReturnValue(true);
		mockedUtils.doMergeConflictsExistOnCurrentBranch = jest.fn().mockReturnValue(Promise.resolve());
		mockedUtils.isBranchCleanWhenUpdatedFromRemote = jest.fn().mockReturnValue(true);
		mockedUtils.getPackageJsonVersion = jest.fn().mockReturnValue(version.SOURCE);
		mockedUtils.createReleaseBranchName = jest.fn().mockReturnValue(branch.RELEASE_BRANCH);
		mockedUtils.createDevelopmentMergeBranchName = jest.fn().mockReturnValue(branch.DEVELOPMENT_MERGE);
		mockedUtils.createReleaseTag = jest.fn().mockReturnValue(TAG);
		mockedUtils.updatePackageJsonVersion = jest.fn();
		mockedUtils.doesTagExist = jest.fn().mockReturnValue(Promise.resolve(false));
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
			confirmTestExitedAfterRunVariableInput();//check
			expect(loggedOutput.some((loggedValue) => loggedValue === resumingMessage)).toBe(false);
		});
		it('a connection break errors out the process', async () => {});
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
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
		it(`doesn't try to update version numbers if there isn't a change`, async () => {});
		it(`exits the process if there are merge conflicts when merging to target from source and allows a user to resume upon re-run`, async () => {});
		it(`exits the process if the user doesn't have rights to push to target branch`, async () => {});
		it(`exits the process if the user can't push tags to the target branch`, async () => {});
		it(`exits the process if there are merge conflicts when merging from target to development and allows a user to resume upon re-run`, async () => {});
		it(`pushes the development merge to remote if the user doesn't have access to push to development`, async () => {});
	});
});
