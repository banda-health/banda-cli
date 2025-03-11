#!/usr/bin/env node

import { Command } from 'commander';
import { makeDeployCommand } from './cmds/deploy';

const program = new Command();

program.addCommand(makeDeployCommand());

program.parse(process.argv);
