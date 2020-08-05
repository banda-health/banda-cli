import fs from 'fs';
import path from 'path';
import process from 'process';
import {
	checkoutBranch,
	createAndCheckoutBranch,
	doesRemoteExist,
	doesTagExist,
	doMergeConflictsExistOnCurrentBranch,
	getCurrentBranch,
	getRepositoryVersion,
	getSuggestedNextRepositoryVersion,
	isBranchCleanWhenUpdatedFromRemote,
	isGitInstalled,
	isWorkingDirectoryClean,
	updateRepositoryVersion,
} from './utils';

describe('utils', () => {
	const setGitCommands = (commandsAndTheirReturns: { [joinedCommand: string]: Promise<any> }) => {
		require('run-git-command').__setMockResponse(commandsAndTheirReturns);
	};

	describe('isGitInstalled', () => {
		it('returns false if Git not installed', async () => {
			setGitCommands({
				'--version': Promise.reject(),
			});
			await expect(isGitInstalled()).resolves.toBe(false);
		});

		it('returns true if Git is installed', async () => {
			setGitCommands({
				'--version': Promise.resolve(),
			});
			await expect(isGitInstalled()).resolves.toBe(true);
		});
	});
	describe('isWorkingDirectoryClean', () => {
		it('returns false if a list of files are returned', async () => {
			setGitCommands({
				'status --porcelain': Promise.reject(),
			});
			await expect(isWorkingDirectoryClean()).resolves.toBe(false);
		});
		it('returns false if an error is thrown in the file check', async () => {
			setGitCommands({
				'status --porcelain': Promise.resolve('here are some modified files...'),
			});
			await expect(isWorkingDirectoryClean()).resolves.toBe(false);
		});

		it('returns true if no files are returned', async () => {
			setGitCommands({
				'status --porcelain': Promise.resolve(''),
			});
			await expect(isWorkingDirectoryClean()).resolves.toBe(true);
		});
	});
	describe('getCurrentBranch', () => {
		it('returns the current branch if the user is on one', async () => {
			setGitCommands({
				'branch --show-current': Promise.resolve(' develop '),
			});
			await expect(getCurrentBranch()).resolves.toBe('develop');
		});
		it('returns an empty string if the command fails', async () => {
			setGitCommands({
				'branch --show-current': Promise.reject(),
			});
			await expect(getCurrentBranch()).resolves.toBe('');
		});
	});
	describe('checkoutBranch', () => {
		it('returns true if it was successful', async () => {
			setGitCommands({
				'checkout develop': Promise.resolve('Checked out develop'),
			});
			await expect(checkoutBranch('develop')).resolves.toBe(true);
		});
		it('returns false if it failed', async () => {
			setGitCommands({
				'checkout develop': Promise.reject(),
			});
			await expect(checkoutBranch('develop')).resolves.toBe(false);
		});
	});
	describe('isBranchCleanWhenUpdatedFromRemote', () => {
		it(`returns the true if pull doesn't error and no merge conflicts exist on the console`, async () => {
			setGitCommands({
				'pull remote branch': Promise.resolve(),
				'ls-files -u': Promise.resolve(''),
			});
			await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(true);
		});
		it('returns false if the pull errors because of conflicts, or if there are dirty files reported after the merge', async () => {
			setGitCommands({
				'pull remote branch': Promise.reject(),
			});
			await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(false);
			setGitCommands({
				'pull remote branch': Promise.resolve(),
				'ls-files -u': Promise.resolve('here are modified files...'),
			});
			await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(false);
			setGitCommands({
				'pull remote branch': Promise.resolve(),
				'ls-files -u': Promise.reject(),
			});
			await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(false);
		});
	});
	describe('doesTagExist', () => {
		it(`returns the false if pull doesn't error and no tags are found`, async () => {
			setGitCommands({
				'fetch --all --tags --force': Promise.resolve(),
				'tag -l tag': Promise.resolve(''),
			});
			await expect(doesTagExist('tag')).resolves.toBe(false);
		});
		it(`returns true if the pull errors or if there is a tag that's found`, async () => {
			setGitCommands({
				'fetch --all --tags --force': Promise.reject(),
			});
			await expect(doesTagExist('tag')).resolves.toBe(true);
			setGitCommands({
				'fetch --all --tags --force': Promise.resolve(),
				'tag -l tag': Promise.resolve('tag'),
			});
			await expect(doesTagExist('tag')).resolves.toBe(true);
			setGitCommands({
				'fetch --all --tags --force': Promise.resolve(),
				'tag -l tag': Promise.reject(),
			});
			await expect(doesTagExist('tag')).resolves.toBe(true);
		});
	});
	describe('checkIfRemoteExists', () => {
		const commandReturns = {
			'ls-remote test': Promise.reject(),
			'ls-remote origin': Promise.resolve(),
			'ls-remote --heads origin test': Promise.resolve(''),
			'ls-remote --heads origin develop': Promise.resolve('heres your branch!'),
		};

		beforeEach(() => {
			setGitCommands(commandReturns);
		});

		it('returns a rejected promise if no remote found, even if branch passed in', async () => {
			try {
				await doesRemoteExist('test');
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
			try {
				await doesRemoteExist('test', 'test');
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});

		it('returns a resolved promise if remote found', async () => {
			try {
				await doesRemoteExist('origin');
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});

		it('returns a rejected promise if no branch found on remote', async () => {
			try {
				await doesRemoteExist('origin', 'test');
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});

		it('returns a resolved promise if branch found on remote', async () => {
			try {
				await doesRemoteExist('origin', 'develop');
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});
	describe('checkForMergeConflictsOnCurrentBranch', () => {
		it('returns a rejected promise if merge conflicts are found', async () => {
			require('run-git-command').__setMockResponse({
				'ls-files -u': Promise.resolve('found some merge conflicts...'),
			});
			try {
				await doMergeConflictsExistOnCurrentBranch();
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('returns a resolved promise if no merge conflicts are found', async () => {
			require('run-git-command').__setMockResponse({
				'ls-files -u': Promise.resolve(''),
			});
			try {
				await doMergeConflictsExistOnCurrentBranch();
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});
	describe('getRepositoryVersion', () => {
		it('returns a rejected promise when no file found', async () => {
			try {
				await getRepositoryVersion();
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('returns a rejected promise when no version found in file', async () => {
			const spy = jest.spyOn(process, 'cwd');
			spy.mockReturnValue(path.join(__dirname, '../../__mocks__'));
			try {
				await getRepositoryVersion();
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('returns a resolved promise when version found in file', async () => {
			const spy = jest.spyOn(process, 'cwd');
			spy.mockReturnValue(path.join(__dirname, '../../'));
			await getRepositoryVersion();
		});
	});
	describe('updateRepositoryVersion', () => {
		const mocksDirectory = path.join(__dirname, '../../__mocks__');
		const renamedMockPackageJsonFile = path.join(mocksDirectory, '/package-test.json');
		const mockPackageJsonFile = path.join(mocksDirectory, '/package.json');
		const originalPackageJsonFile = path.join(__dirname, '../../package.json');

		beforeAll(() => {
			// Rename mocks package.json
			fs.renameSync(mockPackageJsonFile, renamedMockPackageJsonFile);
		});

		afterAll(() => {
			// Undo rename
			fs.renameSync(renamedMockPackageJsonFile, mockPackageJsonFile);
		});

		beforeEach(() => {
			const spy = jest.spyOn(process, 'cwd');
			spy.mockReturnValue(mocksDirectory);
			// Copy this repo's package.json
			fs.copyFileSync(originalPackageJsonFile, mockPackageJsonFile);
		});

		afterEach(() => {
			// Delete this repo's package.json
			try {
				fs.unlinkSync(mockPackageJsonFile);
			} catch {}
		});

		it('correctly updates the package.json version', async () => {
			const currentPackageJsonVersion = await getRepositoryVersion();
			await updateRepositoryVersion(currentPackageJsonVersion, '50.50.50');
			await expect(getRepositoryVersion()).resolves.toBe('50.50.50');
		});

		it('correctly updates the version.conf version', async () => {
			fs.unlinkSync(mockPackageJsonFile);
			
			const currentPackageJsonVersion = await getRepositoryVersion();
			await updateRepositoryVersion(currentPackageJsonVersion, '50.50.50');
			await expect(getRepositoryVersion()).resolves.toBe('50.50.50');
		});
	});
	describe('getSuggestedNextRepositoryVersion', () => {
		it('returns the next minor version', () => {
			expect(getSuggestedNextRepositoryVersion('1.4.0')).toBe('1.5.0');
			expect(getSuggestedNextRepositoryVersion('1.4.1')).toBe('1.5.0');
			expect(getSuggestedNextRepositoryVersion('10.20.30')).toBe('10.21.0');
			expect(getSuggestedNextRepositoryVersion('')).toBe('1.0.0');
		});
	});
	describe('createAndCheckoutBranch', () => {
		it('returns true if the branch was created regardless of whether it exists or not', async () => {
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
		});
		it(`if either the source or the new branch can't be checked out, the test fails`, async () => {
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.resolve(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.reject(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.resolve(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.resolve(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
			setGitCommands({
				'checkout old': Promise.resolve(),
				'checkout new': Promise.reject(),
				'branch -D new': Promise.reject(),
				'checkout -b new': Promise.reject(),
			});
			await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		});
	});
});
