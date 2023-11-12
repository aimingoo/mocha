'use strict';
/**
 * @module TAP
 */
/**
 * Module dependencies.
 */

var util = require('util');
import Base = require('./base');
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;
var EVENT_TEST_END = constants.EVENT_TEST_END;
import Utils = require('../utils');
const inherits = Utils.inherits;
var sprintf = util.format;

/**
 * Expose `TAP`.
 */

// exports = module.exports = TAP;

import type Stats = require('../stats-collector');
import type Test = require('../test');

interface TAPProducer {
  writeVersion(): void;
  writePlan(ntests: number): void;
  writePass(n: number, test: Test): void;
  writePending(n: number, test: Test): void;
  writeFail(n: number, test: Test, err: Error): void;
  writeEpilogue(stats: Stats): void;
}

interface TAPProducerConstructor {
  new (): TAPProducer;
  (this: TAPProducer): TAPProducer;
  readonly prototype: TAPProducer;
}

interface TAP extends Base {
  _producer: TAPProducer;
}

interface TAPConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): TAP;
  (this: TAP, runner: Runner, options: Runner.RunnerOptions): TAP;
  readonly prototype: TAP;
  description: string;
}


/**
 * Constructs a new `TAP` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const TAP = function TAP(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var n = 1;

  var tapVersion = '12';
  if (options && options.reporterOptions) {
    if (options.reporterOptions.tapVersion) {
      tapVersion = options.reporterOptions.tapVersion.toString();
    }
  }

  this._producer = createProducer(tapVersion);

  runner.once(EVENT_RUN_BEGIN, function () {
    self._producer.writeVersion();
  });

  runner.on(EVENT_TEST_END, function () {
    ++n;
  });

  runner.on(EVENT_TEST_PENDING, function (test: Test) {
    self._producer.writePending(n, test);
  });

  runner.on(EVENT_TEST_PASS, function (test: Test) {
    self._producer.writePass(n, test);
  });

  runner.on(EVENT_TEST_FAIL, function (test: Test, err) {
    self._producer.writeFail(n, test, err);
  });

  runner.once(EVENT_RUN_END, function () {
    self._producer.writeEpilogue(runner.stats);
  });
} as TAPConstructor;

/**
 * Inherit from `Base.prototype`.
 */
inherits(TAP, Base);

/**
 * Returns a TAP-safe title of `test`.
 *
 * @private
 * @param {Test} test - Test instance.
 * @return {String} title with any hash character removed
 */
function title(test: Test) {
  return test.fullTitle().replace(/#/g, '');
}

/**
 * Writes newline-terminated formatted string to reporter output stream.
 *
 * @private
 * @param {string} format - `printf`-like format string
 * @param {...*} [varArgs] - Format string arguments
 */
function println(format: string, ...varArgs: any[]) { // NOTE: 显式声明`any[]`会避免TS6133和TS7019错误（声明剩余参数而不使用时，不会报错）
  var vargs = Array.from(arguments);
  vargs[0] = format + '\n';
  process.stdout.write(sprintf.apply(null, vargs));
}

/**
 * Returns a `tapVersion`-appropriate TAP producer instance, if possible.
 *
 * @private
 * @param {string} tapVersion - Version of TAP specification to produce.
 * @returns {TAPProducer} specification-appropriate instance
 * @throws {Error} if specification version has no associated producer.
 */
function createProducer(tapVersion: string) {
  var producers:any = {
    12: new TAP12Producer(),
    13: new TAP13Producer()
  };
  var producer = producers[tapVersion];  // TODO: 内部使用，所以直接使用了"producers: any"

  if (!producer) {
    throw new Error(
      'invalid or unsupported TAP version: ' + JSON.stringify(tapVersion)
    );
  }

  return producer;
}

/**
 * @summary
 * Constructs a new TAPProducer.
 *
 * @description
 * <em>Only</em> to be used as an abstract base class.
 *
 * @private
 * @constructor
 */
const TAPProducer = function TAPProducer() {} as TAPProducerConstructor;

/**
 * Writes the TAP version to reporter output stream.
 *
 * @abstract
 */
TAPProducer.prototype.writeVersion = function () {};

/**
 * Writes the plan to reporter output stream.
 *
 * @abstract
 * @param {number} ntests - Number of tests that are planned to run.
 */
TAPProducer.prototype.writePlan = function (ntests) {
  println('%d..%d', 1, ntests);
};

/**
 * Writes that test passed to reporter output stream.
 *
 * @abstract
 * @param {number} n - Index of test that passed.
 * @param {Test} test - Instance containing test information.
 */
TAPProducer.prototype.writePass = function (n, test) {
  println('ok %d %s', n, title(test));
};

/**
 * Writes that test was skipped to reporter output stream.
 *
 * @abstract
 * @param {number} n - Index of test that was skipped.
 * @param {Test} test - Instance containing test information.
 */
TAPProducer.prototype.writePending = function (n, test) {
  println('ok %d %s # SKIP -', n, title(test));
};

/**
 * Writes that test failed to reporter output stream.
 *
 * @abstract
 * @param {number} n - Index of test that failed.
 * @param {Test} test - Instance containing test information.
 * @param {Error} err - Reason the test failed.
 */
TAPProducer.prototype.writeFail = function (n, test, err) {
  println('not ok %d %s', n, title(test));
};

/**
 * Writes the summary epilogue to reporter output stream.
 *
 * @abstract
 * @param {Object} stats - Object containing run statistics.
 */
TAPProducer.prototype.writeEpilogue = function (stats) {
  // :TBD: Why is this not counting pending tests?
  println('# tests ' + (stats.passes + stats.failures));
  println('# pass ' + stats.passes);
  // :TBD: Why are we not showing pending results?
  println('# fail ' + stats.failures);
  this.writePlan(stats.passes + stats.failures + stats.pending);
};

/**
 * @summary
 * Constructs a new TAP12Producer.
 *
 * @description
 * Produces output conforming to the TAP12 specification.
 *
 * @private
 * @constructor
 * @extends TAPProducer
 * @see {@link https://testanything.org/tap-specification.html|Specification}
 */
const TAP12Producer = function TAP12Producer() {
  /**
   * Writes that test failed to reporter output stream, with error formatting.
   * @override
   */
  this.writeFail = function (n, test, err) {
    TAPProducer.prototype.writeFail.call(this, n, test, err);
    if (err.message) {
      println(err.message.replace(/^/gm, '  '));
    }
    if (err.stack) {
      println(err.stack.replace(/^/gm, '  '));
    }
  };
} as TAPProducerConstructor;

/**
 * Inherit from `TAPProducer.prototype`.
 */
inherits(TAP12Producer, TAPProducer);

/**
 * @summary
 * Constructs a new TAP13Producer.
 *
 * @description
 * Produces output conforming to the TAP13 specification.
 *
 * @private
 * @constructor
 * @extends TAPProducer
 * @see {@link https://testanything.org/tap-version-13-specification.html|Specification}
 */
const TAP13Producer = function TAP13Producer() {
  /**
   * Writes the TAP version to reporter output stream.
   * @override
   */
  this.writeVersion = function () {
    println('TAP version 13');
  };

  /**
   * Writes that test failed to reporter output stream, with error formatting.
   * @override
   */
  this.writeFail = function (n, test, err) {
    TAPProducer.prototype.writeFail.call(this, n, test, err);
    var emitYamlBlock = err.message != null || err.stack != null;
    if (emitYamlBlock) {
      println(indent(1) + '---');
      if (err.message) {
        println(indent(2) + 'message: |-');
        println(err.message.replace(/^/gm, indent(3)));
      }
      if (err.stack) {
        println(indent(2) + 'stack: |-');
        println(err.stack.replace(/^/gm, indent(3)));
      }
      println(indent(1) + '...');
    }
  };

  function indent(level: number) {
    return Array(level + 1).join('  ');
  }
} as TAPProducerConstructor;

/**
 * Inherit from `TAPProducer.prototype`.
 */
inherits(TAP13Producer, TAPProducer);

TAP.description = 'TAP-compatible output';

export = TAP;