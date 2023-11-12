'use strict';

import Runnable = require("./runnable");
import Utils = require('./utils');
var errors = require('./errors');
var createInvalidArgumentTypeError = errors.createInvalidArgumentTypeError;
var isString = Utils.isString;

const {MOCHA_ID_PROP_NAME} = Utils.constants;

// module.exports = Test;

type Func = Runnable.Func;
type AsyncFunc = Runnable.AsyncFunc;

interface TestPrototype extends Runnable {
  _retriedTest: Test;
  _currentRetry: number;
  _slow: number;
  // [MOCHA_ID_PROP_NAME]: string; // in serialized only

  type: 'test';
  speed: 'slow' | 'medium' | 'fast';
  fn: any; // FIXME: any?
  // err?: Error | undefined; // inherited from Runnable, and added by reporters
  // NOTE: `err?...`与标准声明不同
}

interface Test extends TestPrototype {
  clone(): Test;
  reset(): void;
  serialize(): object;
  markOnly(): void;
  appendOnlyTest(t: Test): void;
  // for clone()
  retriedTest(): Test;
  retriedTest(test: Test): void;
  globals(globals?:string[]):string[];
  currentRetry(n?: number): number;
  retries(n?: number): number;
}

interface TestConstructor {
  new (title: string, fn?: Func | AsyncFunc): Test;
  (this: Test, title: string, fn?: Func | AsyncFunc): Test;
  readonly prototype: Test;
}

/**
 * Initialize a new `Test` with the given `title` and callback `fn`.
 *
 * @public
 * @class
 * @extends Runnable
 * @param {String} title - Test title (required)
 * @param {Function} [fn] - Test callback.  If omitted, the Test is considered "pending"
 */
const Test = function Test(title, fn) {
  if (!isString(title)) {
    throw createInvalidArgumentTypeError(
      'Test argument "title" should be a string. Received type "' +
        typeof title +
        '"',
      'title',
      'string'
    );
  }
  this.type = 'test';
  Runnable.call(this, title, fn);
  this.reset();
} as TestConstructor;

/**
 * Inherit from `Runnable.prototype`.
 */
Utils.inherits(Test, Runnable);

/**
 * Resets the state initially or for a next run.
 */
Test.prototype.reset = function () {
  Runnable.prototype.reset.call(this);
  this.pending = !this.fn;
  delete this.state;
};

/**
 * Set or get retried test
 *
 * @private
 */
Test.prototype.retriedTest = function (this: Test, test) {
  if (test === undefined) { // !arguments.length
    return this._retriedTest;
  }
  this._retriedTest = test;
} as Test["retriedTest"];

/**
 * Add test to the list of tests marked `only`.
 *
 * @private
 */
Test.prototype.markOnly = function () {
  this.parent?.appendOnlyTest(this);
};

Test.prototype.clone = function () {
  var test = new Test(this.title, this.fn);
  test.timeout(this.timeout());
  test.slow(this.slow());
  test.retries(this.retries());
  test.currentRetry(this.currentRetry());
  test.retriedTest(this.retriedTest() || this);
  test.globals(this.globals());
  test.parent = this.parent;
  test.file = this.file;
  test.ctx = this.ctx;
  return test;
};

/**
 * Returns an minimal object suitable for transmission over IPC.
 * Functions are represented by keys beginning with `$$`.
 * @private
 * @returns {Object}
 */
Test.prototype.serialize = function serialize() {
  return {
    $$currentRetry: this._currentRetry,
    $$fullTitle: this.fullTitle(),
    $$isPending: Boolean(this.pending),
    $$retriedTest: this._retriedTest || null,
    $$slow: this._slow,
    $$titlePath: this.titlePath(),
    body: this.body,
    duration: this.duration,
    err: this.err,
    parent: {
      $$fullTitle: this.parent?.fullTitle(),
      [MOCHA_ID_PROP_NAME]: this.parent?.id
    },
    speed: this.speed,
    state: this.state,
    title: this.title,
    type: this.type,
    file: this.file,
    [MOCHA_ID_PROP_NAME]: this.id
  };
};

// module.exports = Test;
export = Test;