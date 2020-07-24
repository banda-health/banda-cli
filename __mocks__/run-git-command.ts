import { commandConfig } from 'run-git-command/types';
const runGitCommand: any = jest.genMockFromModule('run-git-command');

let mockCommands: { [joinedCommand: string]: Promise<{}> } = Object.create(null);
/**
 * This is a custom function that our tests can use during setup to specify
 * what the result of the "mock" git command should return when this API
 * is used
 * @param newMockResponses The joined commands and a Promise object to return the response
 */
function __setMockResponse(newMockResponses: { [joinedCommand: string]: Promise<{}> }) {
	mockCommands = { ...newMockResponses };
}

/**
 * A custom version of `execGitCmd` that returns a promise of a specified type
 * specified via __setMockResponse
 * @param args The array of commands for git to execute
 * @param cmdConfig The config (not used)
 */
async function execGitCmd(args: string[], cmdConfig?: commandConfig): Promise<{}> {
	return mockCommands[args.join(' ')] || Promise.reject('no mock value defined');
}

runGitCommand.__setMockResponse = __setMockResponse;
runGitCommand.execGitCmd = execGitCmd;

module.exports = runGitCommand;
