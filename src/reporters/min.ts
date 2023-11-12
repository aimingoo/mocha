'use strict';
/**
 * @module Min
 */
/**
 * Module dependencies.
 */

import Base = require('./base');
import Utils = require('../utils');
var inherits = Utils.inherits;
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;

/**
 * Expose `Min`.
 */

// exports = module.exports = Min;


interface Min extends Base { }

interface MinConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): Min;
  (this: Min, runner: Runner, options: Runner.RunnerOptions): Min;
  readonly prototype: Min;
  description: string;
}


/**
 * Constructs a new `Min` reporter instance.
 *
 * @description
 * This minimal test reporter is best used with '--watch'.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const Min = function Min(runner, options) {
  Base.call(this, runner, options);

  runner.on(EVENT_RUN_BEGIN, function () {
    // clear screen
    process.stdout.write('\u001b[2J');
    // set cursor position
    process.stdout.write('\u001b[1;3H');
  });

  runner.once(EVENT_RUN_END, this.epilogue.bind(this));
} as MinConstructor;

/**
 * Inherit from `Base.prototype`.
 */
inherits(Min, Base);

Min.description = 'essentially just a summary';

export = Min;
