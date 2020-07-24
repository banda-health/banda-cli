import process from 'process';
import path from 'path';
import { checkForMergeConflictsOnCurrentBranch, checkIfRemoteExists, getPackageJsonVersion } from './utils';

describe('utils', () => {
	describe('checkIfRemoteExists', () => {
		const commandReturns = {
			'ls-remote test': Promise.reject(),
			'ls-remote origin': Promise.resolve(),
			'ls-remote --heads origin test': Promise.resolve(''),
			'ls-remote --heads origin develop': Promise.resolve('heres your branch!'),
		};

		beforeEach(() => {
			require('run-git-command').__setMockResponse(commandReturns);
		});

		it('returns a rejected promise if no remote found, even if branch passed in', async () => {
			try {
				await checkIfRemoteExists('test');
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
			try {
				await checkIfRemoteExists('test', 'test');
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});

		it('returns a resolved promise if remote found', async () => {
			try {
				await checkIfRemoteExists('origin');
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});

		it('returns a rejected promise if no branch found on remote', async () => {
			try {
				await checkIfRemoteExists('origin', 'test');
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});

		it('returns a resolved promise if branch found on remote', async () => {
			try {
				await checkIfRemoteExists('origin', 'develop');
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
				await checkForMergeConflictsOnCurrentBranch();
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
				await checkForMergeConflictsOnCurrentBranch();
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});
	describe('getPackageJsonVersion', () => {
		it('returns a rejected promise when no file found', async () => {
			try {
				await getPackageJsonVersion();
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('returns a rejected promise when no version found in file', async () => {
			const spy = jest.spyOn(process, 'cwd');
			spy.mockReturnValue(path.join(__dirname, '../../__mocks__'));
			try {
				await getPackageJsonVersion();
				expect(true).toBe(false);
			} catch {
				expect(true).toBe(true);
			}
		});
		it('returns a resolved promise when version found in file', async () => {
			const spy = jest.spyOn(process, 'cwd');
			spy.mockReturnValue(path.join(__dirname, '../../'));
			try {
				await getPackageJsonVersion();
				expect(true).toBe(true);
			} catch {
				expect(true).toBe(false);
			}
		});
	});
});
