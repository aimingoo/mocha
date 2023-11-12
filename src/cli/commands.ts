'use strict';

/**
 * Exports Yargs commands
 * @see https://github.com/yargs/yargs/blob/main/docs/advanced.md
 * @private
 * @module
 */

export type Command = {
    command: string;
    description: string;
    builder: (yargs: any) => any;
    handler: (argv: any) => void;
};

export import init = require('./init');

// default command
export import run = require('./run');
