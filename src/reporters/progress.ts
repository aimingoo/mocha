'use strict';
/**
 * @module Progress
 */
/**
 * Module dependencies.
 */

import Base = require('./base');
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_TEST_END = constants.EVENT_TEST_END;
var EVENT_RUN_END = constants.EVENT_RUN_END;
import Utils = require('../utils');
var inherits = Utils.inherits;
var color = Base.color;
var cursor = Base.cursor;

/**
 * Expose `Progress`.
 */

// exports = module.exports = Progress;

interface Progress extends Base { }

interface Options extends Runner.RunnerOptions {
  open?: string;
  complete?: string;
  incomplete?: string;
  close?: string;
  verbose?: boolean;
}

type ProgressOptions = Runner.RunnerOptions & Options;
type RunningProgressOptions = Runner.RunnerOptions & Required<Options>;

interface ProgressConstructor {
  new (runner: Runner, options: ProgressOptions): Progress;
  (this: Progress, runner: Runner, options: ProgressOptions): Progress;
  readonly prototype: Progress;
  description: string;
}


/**
 * General progress bar color.
 */

declare module "./base" {
  interface Colors {
    progress: 90
  }
}

Base.colors.progress = 90;

/**
 * Constructs a new `Progress` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const Progress = function Progress(runner, opts) {
  Base.call(this, runner, opts);

  var self = this;
  var width = (Base.window.width * 0.5) | 0;
  var total = runner.total;
  var complete = 0;
  var lastN = -1;

  // default chars
  var options = (opts || {}) as RunningProgressOptions;  // NOTE: 下面会补齐必选值
  var reporterOptions = options.reporterOptions || {};

  options.open = reporterOptions.open || '[';
  options.complete = reporterOptions.complete || '▬';
  options.incomplete = reporterOptions.incomplete || Base.symbols.dot;
  options.close = reporterOptions.close || ']';
  options.verbose = reporterOptions.verbose || false;

  // tests started
  runner.on(EVENT_RUN_BEGIN, function () {
    process.stdout.write('\n');
    cursor.hide();
  });

  // tests complete
  runner.on(EVENT_TEST_END, function () {
    complete++;

    var percent = complete / total;
    var n = (width * percent) | 0;
    var i = width - n;

    if (n === lastN && !options.verbose) {
      // Don't re-render the line if it hasn't changed
      return;
    }
    lastN = n;

    cursor.CR();
    process.stdout.write('\u001b[J');
    process.stdout.write(color('progress', '  ' + options.open));
    process.stdout.write(Array(n).join(options.complete));
    process.stdout.write(Array(i).join(options.incomplete));
    process.stdout.write(color('progress', options.close));
    if (options.verbose) {
      process.stdout.write(color('progress', ' ' + complete + ' of ' + total));
    }
  });

  // tests are complete, output some stats
  // and the failures if any
  runner.once(EVENT_RUN_END, function () {
    cursor.show();
    process.stdout.write('\n');
    self.epilogue();
  });
} as ProgressConstructor;

/**
 * Inherit from `Base.prototype`.
 */
inherits(Progress, Base);

Progress.description = 'a progress bar';

export = Progress;