import { execGitCmd } from 'run-git-command';

it('if run-git-command is mocked', async () => {
	require('run-git-command').__setMockResponse({ boom: Promise.resolve() });
	try {
		await execGitCmd(['boom']);
		expect(true).toBe(true);
	} catch {
		expect(true).toBe(false);
	}
});
