"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.builder = exports.desc = exports.command = void 0;
exports.command = 'deploy [targetBranch]';
exports.desc = 'Manage set of tracked repos';
exports.builder = function (yargs) {
    yargs
        .positional('targetBranch', {
        describe: 'The branch to deploy code to',
        type: 'string',
        default: 'master',
    })
        .option('sourceBranch', {
        alias: 's',
        type: 'string',
        description: 'The branch containing the code to be deployed',
    })
        .option('developmentBranch', {
        alias: 'w',
        type: 'string',
        description: 'The branch to update after completing deployment',
        default: 'development',
    })
        .option('appVersion', {
        alias: 'v',
        type: 'string',
        description: 'Specify the version number to deploy',
    })
        .option('nextAppVersion', {
        alias: 'n',
        type: 'string',
        description: 'Specify the version number to update the development branch to',
    });
};
exports.handler = function (argv) {
    if (argv.verbose)
        console.info("start server on :" + argv.port);
    // serve(argv.port);
};
