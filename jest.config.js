module.exports = {
	testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	transformIgnorePatterns: ['node_modules/(?!(run-git-command)/)'],
	watchPathIgnorePatterns: ['/__dummy__/.*'],
};
