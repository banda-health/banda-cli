import inquirer from 'inquirer';
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

describe('deploy', () => {
	const commandReturns: { [joinedCommand: string]: Promise<any> } = {
		'--version': Promise.resolve(),
		'status --porcelain': Promise.resolve(),
		'branch --show-current': Promise.resolve(branch.CURRENT),
		'fetch --all --tags --force': Promise.resolve(),
		'commit -am "updating app version"': Promise.resolve(),
	};
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
	commandReturns[`merge ${branch.SOURCE}`] = Promise.resolve();
	commandReturns[`merge ${branch.RELEASE_BRANCH}`] = Promise.resolve();
	commandReturns[`merge ${branch.TARGET}`] = Promise.resolve();
	commandReturns[`merge ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`branch -d ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();
	commandReturns[`branch -D ${branch.DEVELOPMENT_MERGE}`] = Promise.resolve();

	const setGitCommands = (commandsAndTheirReturns = commandReturns) => {
		require('run-git-command').__setMockResponse(commandsAndTheirReturns);
	};

	beforeEach(() => {
		setGitCommands();
		const spy = jest.spyOn(process.stdout, 'write');
		spy.mockImplementation((...values) => {
			console.log(...values);
			return true;
		});
	});

	const setupSuccessfulVariableInput = (): void => {
		(inquirer as any).prompt = jest
			.fn()
			.mockReturnValueOnce({ answer: REMOTE })
			.mockReturnValueOnce({ answer: branch.SOURCE })
			.mockReturnValueOnce({ answer: branch.TARGET })
			.mockReturnValueOnce({ answer: branch.DEVELOPMENT })
			.mockReturnValueOnce({ answer: version.USE })
			.mockReturnValueOnce({ answer: version.NEXT });
		mockedUtils.checkIfRemoteExists = jest.fn().mockReturnValue(true);
		mockedUtils.checkForMergeConflictsOnCurrentBranch = jest.fn().mockReturnValue(Promise.resolve());
		mockedUtils.getPackageJsonVersion = jest.fn().mockReturnValue(version.SOURCE);
		mockedUtils.createReleaseBranchName = jest.fn().mockReturnValue(branch.RELEASE_BRANCH);
		mockedUtils.createDevelopmentMergeBranchName = jest.fn().mockReturnValue(branch.DEVELOPMENT_MERGE);
		mockedUtils.createReleaseTag = jest.fn().mockReturnValue(TAG);
		mockedUtils.updatePackageJsonVersion = jest.fn();
	};

	describe('checkPrerequisites', () => {
		it('fails if git is not installed', async () => {
			setGitCommands({ '--version': Promise.reject() });
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});

		it('fails if working directory is not clean', async () => {
			setGitCommands({ ...commandReturns, 'status --porcelain': Promise.reject() });
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
			setGitCommands({ ...commandReturns, 'status --porcelain': Promise.resolve('here are some modified files') });
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
	});
	describe('getVariables', () => {
		it('if no file exists from a previous run, the first prompt should be an input', async () => {});
		it('a connection break errors out the process', async () => {});
		it('if the same source and target branches are selected, a rejected promise is returned', async () => {
			(inquirer as any).prompt = jest
				.fn()
				.mockReturnValueOnce({ answer: REMOTE })
				.mockReturnValueOnce({ answer: branch.SOURCE })
				.mockReturnValueOnce({ answer: branch.SOURCE });
			mockedUtils.checkIfRemoteExists = jest.fn().mockReturnValue(true);
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
			mockedUtils.checkIfRemoteExists = jest.fn().mockReturnValue(true);
			try {
				await handler({});
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('asks the user for all inputs and saves them', async () => {
			const newCommandReturns = { ...commandReturns };
			newCommandReturns[`checkout -b ${branch.RELEASE_BRANCH}`] = Promise.reject('early return for testing');
			setGitCommands(newCommandReturns);
			setupSuccessfulVariableInput();
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
	});
});
