'use strict';
/**
 * @module JSONStream
 */
/**
 * Module dependencies.
 */

import Base = require('./base');
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_RUN_END = constants.EVENT_RUN_END;

/**
 * Expose `JSONStream`.
 */

// exports = module.exports = JSONStream;

import type Test = require('../test');
import type Errors = require('../errors');

type CleanlyTest = Required<Pick<Test, "title" | "file" | "duration" | "speed">> & {
  fullTitle: string,
  currentRetry: number,
  stack?: string | null;
  err?: string;
}

interface JSONStream extends Base { }

interface JSONStreamConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): JSONStream;
  (this: JSONStream, runner: Runner, options: Runner.RunnerOptions): JSONStream;
  readonly prototype: JSONStream;
  description: string;
}

/**
 * Constructs a new `JSONStream` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const JSONStream = function JSONStream(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var total = runner.total;

  runner.once(EVENT_RUN_BEGIN, function () {
    writeEvent(['start', {total}]);
  });

  runner.on(EVENT_TEST_PASS, function (test: Test) {
    writeEvent(['pass', clean(test)]);
  });

  runner.on(EVENT_TEST_FAIL, function (_test: Test, err: Errors.MochaError) {
    const test = clean(_test);
    test.err = err.message;
    test.stack = err.stack || null;
    writeEvent(['fail', test]);
  });

  runner.once(EVENT_RUN_END, function () {
    writeEvent(['end', self.stats]);
  });
} as JSONStreamConstructor;

/**
 * Mocha event to be written to the output stream.
 * @typedef {Array} JSONStream~MochaEvent
 */

/**
 * Writes Mocha event to reporter output stream.
 *
 * @private
 * @param {JSONStream~MochaEvent} event - Mocha event to be output.
 */
function writeEvent(event: any) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

/**
 * Returns an object literal representation of `test`
 * free of cyclic properties, etc.
 *
 * @private
 * @param {Test} test - Instance used as data source.
 * @return {Object} object containing pared-down test instance data
 */

function clean(test: Test): CleanlyTest {
  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    file: test.file || "",
    duration: test.duration || 0,
    currentRetry: test.currentRetry(),
    speed: test.speed
  };
}

JSONStream.description = 'newline delimited JSON events';

export = JSONStream;