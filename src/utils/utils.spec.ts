import { copyFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import process, { cwd } from 'process';
import { execGitCmd } from 'run-git-command';
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

let mockCommands: { [joinedCommand: string]: Promise<unknown> } = vi.hoisted(() => ({}));
vi.mock(import('run-git-command'), () => ({
	execGitCmd: vi.fn((args: string[]) => {
		return mockCommands[args.join(' ')] || Promise.reject('no mock value defined');
	}) as typeof execGitCmd,
}));

afterEach(() => {
	vi.restoreAllMocks();
	mockCommands = {};
});

describe('isGitInstalled', () => {
	it('returns false if Git not installed', async () => {
		mockCommands = {
			'--version': Promise.reject(),
		};
		await expect(isGitInstalled()).resolves.toBe(false);
	});

	it('returns true if Git is installed', async () => {
		mockCommands = {
			'--version': Promise.resolve(),
		};
		await expect(isGitInstalled()).resolves.toBe(true);
	});
});

describe('isWorkingDirectoryClean', () => {
	it('returns false if a list of files are returned', async () => {
		mockCommands = {
			'status --porcelain': Promise.reject(),
		};
		await expect(isWorkingDirectoryClean()).resolves.toBe(false);
	});
	it('returns false if an error is thrown in the file check', async () => {
		mockCommands = {
			'status --porcelain': Promise.resolve('here are some modified files...'),
		};
		await expect(isWorkingDirectoryClean()).resolves.toBe(false);
	});
	it('returns true if no files are returned', async () => {
		mockCommands = {
			'status --porcelain': Promise.resolve(''),
		};
		await expect(isWorkingDirectoryClean()).resolves.toBe(true);
	});
});

describe('getCurrentBranch', () => {
	it('returns the current branch if the user is on one', async () => {
		mockCommands = {
			'branch --show-current': Promise.resolve(' develop '),
		};
		await expect(getCurrentBranch()).resolves.toBe('develop');
	});
	it('returns an empty string if the command fails', async () => {
		mockCommands = {
			'branch --show-current': Promise.reject(),
		};
		await expect(getCurrentBranch()).resolves.toBe('');
	});
});

describe('checkoutBranch', () => {
	it('returns true if it was successful', async () => {
		mockCommands = {
			'checkout develop': Promise.resolve('Checked out develop'),
		};
		await expect(checkoutBranch('develop')).resolves.toBe(true);
	});
	it('returns false if it failed', async () => {
		mockCommands = {
			'checkout develop': Promise.reject(),
		};
		await expect(checkoutBranch('develop')).resolves.toBe(false);
	});
});

describe('isBranchCleanWhenUpdatedFromRemote', () => {
	it(`returns the true if pull doesn't error and no merge conflicts exist on the console`, async () => {
		mockCommands = {
			'pull remote branch': Promise.resolve(),
			'ls-files -u': Promise.resolve(''),
		};
		await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(true);
	});
	it('returns false if the pull errors because of conflicts, or if there are dirty files reported after the merge', async () => {
		mockCommands = {
			'pull remote branch': Promise.reject(),
		};
		await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(false);
		mockCommands = {
			'pull remote branch': Promise.resolve(),
			'ls-files -u': Promise.resolve('here are modified files...'),
		};
		await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(false);
		mockCommands = {
			'pull remote branch': Promise.resolve(),
			'ls-files -u': Promise.reject(),
		};
		await expect(isBranchCleanWhenUpdatedFromRemote('remote', 'branch')).resolves.toBe(false);
	});
});

describe('doesTagExist', () => {
	it(`returns the false if pull doesn't error and no tags are found`, async () => {
		mockCommands = {
			'fetch --all --tags --force': Promise.resolve(),
			'tag -l tag': Promise.resolve(''),
		};
		await expect(doesTagExist('tag')).resolves.toBe(false);
	});
	it(`returns true if the pull errors or if there is a tag that's found`, async () => {
		mockCommands = {
			'fetch --all --tags --force': Promise.reject(),
		};
		await expect(doesTagExist('tag')).resolves.toBe(true);
		mockCommands = {
			'fetch --all --tags --force': Promise.resolve(),
			'tag -l tag': Promise.resolve('tag'),
		};
		await expect(doesTagExist('tag')).resolves.toBe(true);
		mockCommands = {
			'fetch --all --tags --force': Promise.resolve(),
			'tag -l tag': Promise.reject(),
		};
		await expect(doesTagExist('tag')).resolves.toBe(true);
	});
});

describe('checkIfRemoteExists', () => {
	it('returns a resolved false promise if no remote found, even if branch passed in', async () => {
		mockCommands = { 'ls-remote test': Promise.reject() };
		await expect(doesRemoteExist('test')).resolves.toBeFalsy();
		await expect(doesRemoteExist('test', 'test')).resolves.toBeFalsy();
	});

	it('returns a resolved promise if remote found', async () => {
		mockCommands = { 'ls-remote origin': Promise.resolve() };
		await expect(doesRemoteExist('origin')).resolves.toBeTruthy();
	});

	it('returns a rejected promise if no branch found on remote', async () => {
		mockCommands = {
			'ls-remote --heads origin test': Promise.resolve(''),
		};
		await expect(doesRemoteExist('origin', 'test')).resolves.toBeFalsy();
	});

	it('returns a resolved promise if branch found on remote', async () => {
		mockCommands = {
			'ls-remote --heads origin develop': Promise.resolve('heres your branch!'),
		};
		await expect(doesRemoteExist('origin', 'develop')).resolves.toBeTruthy();
	});
});
describe('checkForMergeConflictsOnCurrentBranch', () => {
	it('returns a resolved false promise if merge conflicts are found', async () => {
		mockCommands = {
			'ls-files -u': Promise.resolve('found some merge conflicts...'),
		};
		await expect(doMergeConflictsExistOnCurrentBranch()).resolves.toBeTruthy();
	});
	it('returns a resolved promise if no merge conflicts are found', async () => {
		mockCommands = {
			'ls-files -u': Promise.resolve(''),
		};
		await expect(doMergeConflictsExistOnCurrentBranch()).resolves.toBeFalsy();
	});
});
describe('getRepositoryVersion', () => {
	it('returns a rejected promise when no file found', async () => {
		const spy = vi.spyOn(process, 'cwd');
		spy.mockReturnValue(tmpdir());
		await expect(getRepositoryVersion()).rejects.toBeTruthy();
	});
	it('returns a rejected promise when no version found in file', async () => {
		const spy = vi.spyOn(process, 'cwd');
		spy.mockReturnValue(tmpdir());
		await expect(getRepositoryVersion()).rejects.toBeTruthy();
	});
	it('returns a resolved promise when version found in file', async () => {
		await expect(getRepositoryVersion()).resolves.toBeTruthy();
	});
});
describe('updateRepositoryVersion', () => {
	beforeEach(() => {
		// Copy the test files to the temp directory
		copyFileSync(join(cwd(), '/package.json'), join(tmpdir(), '/package.json'));
		copyFileSync(join(cwd(), '/__test__/VERSION.conf'), join(tmpdir(), '/VERSION.conf'));
		vi.spyOn(process, 'cwd').mockReturnValue(tmpdir());
	});

	afterEach(() => {
		// Delete tmp files
		try {
			unlinkSync(join(tmpdir(), '/package.json'));
		} catch {}
		try {
			unlinkSync(join(tmpdir(), '/VERSION.conf'));
		} catch {}
	});

	it('correctly updates the package.json version', async () => {
		const currentPackageJsonVersion = await getRepositoryVersion();
		await updateRepositoryVersion(currentPackageJsonVersion, '50.50.50');
		await expect(getRepositoryVersion()).resolves.toBe('50.50.50');
	});

	it('correctly updates the version.conf version', async () => {
		try {
			unlinkSync(join(tmpdir(), '/package.json'));
		} catch {}

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
		mockCommands = {
			'checkout old': Promise.resolve(),
			'checkout new': Promise.resolve(),
			'branch -D new': Promise.resolve(),
			'checkout -b new': Promise.resolve(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
		// mockCommands = ({
		// 	'checkout old': Promise.resolve(),
		// 	'checkout new': Promise.resolve(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.resolve(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
		mockCommands = {
			'checkout old': Promise.resolve(),
			'checkout new': Promise.resolve(),
			'branch -D new': Promise.resolve(),
			'checkout -b new': Promise.reject(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
		// mockCommands = ({
		// 	'checkout old': Promise.resolve(),
		// 	'checkout new': Promise.resolve(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.reject(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(true);
	});
	it(`if either the source or the new branch can't be checked out, the test fails`, async () => {
		mockCommands = {
			'checkout old': Promise.reject(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		// mockCommands = ({
		// 	'checkout old': Promise.reject(),
		// 	'checkout new': Promise.resolve(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.resolve(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		mockCommands = {
			'checkout old': Promise.reject(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		// mockCommands = ({
		// 	'checkout old': Promise.reject(),
		// 	'checkout new': Promise.resolve(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.reject(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		mockCommands = {
			'checkout old': Promise.reject(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		// mockCommands = ({
		// 	'checkout old': Promise.reject(),
		// 	'checkout new': Promise.reject(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.resolve(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		mockCommands = {
			'checkout old': Promise.reject(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		// mockCommands = ({
		// 	'checkout old': Promise.reject(),
		// 	'checkout new': Promise.reject(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.reject(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		mockCommands = {
			'checkout old': Promise.resolve(),
			'checkout new': Promise.reject(),
			'branch -D new': Promise.resolve(),
			'checkout -b new': Promise.resolve(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		// mockCommands = ({
		// 	'checkout old': Promise.resolve(),
		// 	'checkout new': Promise.reject(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.resolve(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		mockCommands = {
			'checkout old': Promise.resolve(),
			'checkout new': Promise.reject(),
			'branch -D new': Promise.resolve(),
			'checkout -b new': Promise.reject(),
		};
		await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
		// mockCommands = ({
		// 	'checkout old': Promise.resolve(),
		// 	'checkout new': Promise.reject(),
		// 	'branch -D new': Promise.reject(),
		// 	'checkout -b new': Promise.reject(),
		// });
		// await expect(createAndCheckoutBranch('new', 'old')).resolves.toBe(false);
	});
});
