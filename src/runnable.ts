'use strict';

import Pending = require('./pending');
var debug = require('debug')('mocha:runnable');
var milliseconds = require('ms') as (ms: any)=>number;
import utils = require('./utils');
import Errors = require('./errors');
const {
  createInvalidExceptionError,
  createMultipleDoneError,
  createTimeoutError
} = Errors; // require('./errors');

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 * @private
 */
var Date = global.Date;
var setTimeout = global.setTimeout;
var clearTimeout = global.clearTimeout;
var toString = Object.prototype.toString;

import events = require('events');
import Context = require('./context');
import Suite = require('./suite');

type Done = Runnable.Done;
type Func = Runnable.Func;
type AsyncFunc = Runnable.AsyncFunc;
type RunnableState = RunnableConstants[keyof RunnableConstants];

interface RunnableConstants {
  STATE_FAILED: 'failed',
  STATE_PASSED: 'passed',
  STATE_PENDING: 'pending'
}

interface RunnablePrototype extends events.EventEmitter {
  _currentRetry: number;
  _allowedGlobals: string[];
  _timeout: number;
  _slow: number;
  _retries: number;
  get id(): string;
  title: string;
  originalTitle: string;
  fn?: Func | AsyncFunc;
  body: string;
  async: false | number;
  sync: boolean;  // TODO: 如何限制必须是!async ?
  asyncOnly: boolean;
  timedOut: boolean;
  pending: boolean;

  parent?: Suite;
  duration?: number;
  file?: string;
  callback?: Done;
  timer?: NodeJS.Timeout;
  ctx: Context.BaseContext; // NOTE: recheck! 不是可选属性，这与index.d.ts不一致
  allowUncaught?: boolean;
  state?: RunnableState;  // NOTE: `?:`支持delete运算
  err?: Errors.MochaError;
}

interface Runnable extends RunnablePrototype {
  reset(): void;
  timeout(): number;
  timeout(ms: number|string): this;
  slow(): number;
  slow(ms: number|string): this;
  skip(): void;
  isPending(): boolean;
  isFailed(): boolean;
  isPassed(): boolean;
  retries(): number;
  retries(n: number): void;
  currentRetry(n?: number): number | void;
  fullTitle(): string;
  titlePath(): string[];
  clearTimeout(): void;
  resetTimeout(): void;
  globals(globals?: string[]): string[] | void;
  run(fn: Done): void;
  _timeoutError(ms: number): Errors.MochaError;
}

interface RunnableConstructor {
  new (title: string, fn?: Func | AsyncFunc): Runnable;
  (this: Runnable, title: string, fn?: Func | AsyncFunc): Runnable;
  readonly prototype: Runnable;
  toValueOrError<T>(value:T): T | Errors.InvalidExceptionError;  // TODO: 确认一下这个方法的作用，似乎有些设计上的不合理
  constants: RunnableConstants;
}

// module.exports = Runnable;

/**
 * Initialize a new `Runnable` with the given `title` and callback `fn`.
 *
 * @class
 * @extends external:EventEmitter
 * @public
 * @param {String} title
 * @param {Function} fn
 */
const Runnable = function Runnable(title, fn) {
  this.title = title;
  this.fn = fn;
  this.body = (fn || '').toString();
  this.async = !!fn && fn.length;
  this.sync = !this.async;
  this._timeout = 2000;
  this._slow = 75;
  this._retries = -1;
  utils.assignNewMochaID(this);
  Object.defineProperty(this, 'id', {
    get() {
      return utils.getMochaID(this);
    }
  });
  this.reset();
} as RunnableConstructor;

/**
 * Inherit from `EventEmitter.prototype`.
 */
utils.inherits(Runnable, events.EventEmitter);

/**
 * Resets the state initially or for a next run.
 */
Runnable.prototype.reset = function () {
  this.timedOut = false;
  this._currentRetry = 0;
  this.pending = false;
  delete this.state;
  delete this.err;
};

/**
 * Get current timeout value in msecs.
 *
 * @private
 * @returns {number} current timeout threshold value
 */
/**
 * @summary
 * Set timeout threshold value (msecs).
 *
 * @description
 * A string argument can use shorthand (e.g., "2s") and will be converted.
 * The value will be clamped to range [<code>0</code>, <code>2^<sup>31</sup>-1</code>].
 * If clamped value matches either range endpoint, timeouts will be disabled.
 *
 * @private
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout#Maximum_delay_value}
 * @param {number|string} ms - Timeout threshold value.
 * @returns {Runnable} this
 * @chainable
 */
Runnable.prototype.timeout = function (this: Runnable, ms) {
  if (ms === undefined) { // if (!arguments.length) {
    return this._timeout;
  }
  if (typeof ms === 'string') {
    ms = milliseconds(ms);
  }

  // Clamp to range
  var INT_MAX = Math.pow(2, 31) - 1;
  var range = [0, INT_MAX];
  ms = utils.clamp(ms, range);

  // see #1652 for reasoning
  if (ms === range[0] || ms === range[1]) {
    this._timeout = 0;
  } else {
    this._timeout = ms;
  }
  debug('timeout %d', this._timeout);

  if (this.timer) {
    this.resetTimeout();
  }
  return this;
} as Runnable["timeout"];

/**
 * Set or get slow `ms`.
 *
 * @private
 * @param {number|string} ms
 * @return {Runnable|number} ms or Runnable instance.
 */
Runnable.prototype.slow = function (this: Runnable, ms) {
  if (ms === undefined) { // if (!arguments.length) {
    return this._slow;
  }
  if (typeof ms === 'string') {
    ms = milliseconds(ms);
  }
  debug('slow %d', ms);
  this._slow = ms;
  return this;
} as Runnable["slow"];

/**
 * Halt and mark as pending.
 *
 * @memberof Mocha.Runnable
 * @public
 */
Runnable.prototype.skip = function () {
  this.pending = true;
  throw new Pending('sync skip; aborting execution');
};

/**
 * Check if this runnable or its parent suite is marked as pending.
 *
 * @private
 */
Runnable.prototype.isPending = function () {
  return this.pending || Boolean(this.parent && this.parent.isPending());
};

/**
 * Return `true` if this Runnable has failed.
 * @return {boolean}
 * @private
 */
Runnable.prototype.isFailed = function () {
  return !this.isPending() && this.state === constants.STATE_FAILED;
};

/**
 * Return `true` if this Runnable has passed.
 * @return {boolean}
 * @private
 */
Runnable.prototype.isPassed = function () {
  return !this.isPending() && this.state === constants.STATE_PASSED;
};

/**
 * Set or get number of retries.
 *
 * @private
 */
Runnable.prototype.retries = function (this: Runnable, n) {
  if (n === undefined) { // if (!arguments.length) {
    return this._retries;
  }
  this._retries = n;
} as Runnable["retries"];

/**
 * Set or get current retry
 *
 * @private
 */
Runnable.prototype.currentRetry = function (n) {
  if (n === undefined) { // if (!arguments.length) {
    return this._currentRetry;
  }
  this._currentRetry = n;
};

/**
 * Return the full title generated by recursively concatenating the parent's
 * full title.
 *
 * @memberof Mocha.Runnable
 * @public
 * @return {string}
 */
Runnable.prototype.fullTitle = function () {
  return this.titlePath().join(' ');
};

/**
 * Return the title path generated by concatenating the parent's title path with the title.
 *
 * @memberof Mocha.Runnable
 * @public
 * @return {string[]}
 */
Runnable.prototype.titlePath = function () {
  return (this.parent?.titlePath() || []).concat([this.title]);
};

/**
 * Clear the timeout.
 *
 * @private
 */
Runnable.prototype.clearTimeout = function () {
  clearTimeout(this.timer);
};

/**
 * Reset the timeout.
 *
 * @private
 */
Runnable.prototype.resetTimeout = function () {
  var self = this;
  var ms = this.timeout();

  if (ms === 0) {
    return;
  }
  this.clearTimeout();
  this.timer = setTimeout(function () {
    if (self.timeout() === 0) {
      return;
    }
    self.callback?.(self._timeoutError(ms));
    self.timedOut = true;
  }, ms);
};

/**
 * Set or get a list of whitelisted globals for this test run.
 *
 * @private
 * @param {string[]} globals
 */
Runnable.prototype.globals = function (globals) {
  if (globals === undefined) { // if (!arguments.length) {
    return this._allowedGlobals;
  }
  this._allowedGlobals = globals;
};

/**
 * Run the test and invoke `fn(err)`.
 *
 * @param {Function} fn
 * @private
 */
Runnable.prototype.run = function (fn) {
  var self = this;
  var start = Number(new Date());
  var ctx = this.ctx;
  var finished: boolean;
  var errorWasHandled = false;

  if (this.isPending()) return fn();

  // Sometimes the ctx exists, but it is not runnable
  if (ctx && ctx.runnable) {
    ctx.runnable(this);
  }

  // called multiple times
  function multiple(err?: Error) {
    if (errorWasHandled) {
      return;
    }
    errorWasHandled = true;
    self.emit('error', createMultipleDoneError(self, err));
  }

  // finished
  function done(err?: Error) {
    var ms = self.timeout();
    if (self.timedOut) {
      return;
    }

    if (finished) {
      return multiple(err);
    }

    self.clearTimeout();
    self.duration = Number(new Date()) - start;
    finished = true;
    if (!err && self.duration > ms && ms > 0) {
      err = self._timeoutError(ms);
    }
    fn(err);
  }

  // for .resetTimeout() and Runner#uncaught()
  this.callback = done;

  if (this.fn && typeof this.fn.call !== 'function') {
    done(
      new Errors.TypeError(
        'A runnable must be passed a function as its second argument.'
      )
    );
    return;
  }

  // explicit async with `done` argument
  if (this.async) {
    this.resetTimeout();

    // allows skip() to be used in an explicit async context
    this.skip = function asyncSkip() {
      this.pending = true;
      done();
      // halt execution, the uncaught handler will ignore the failure.
      throw new Pending('async skip; aborting execution');
    };

    try {
      callFnAsync(this.fn!);  // checked
    } catch (err) {
      // handles async runnables which actually run synchronously
      errorWasHandled = true;
      if (err instanceof Pending) {
        return; // done() is already called in this.skip()
      } else if (this.allowUncaught) {
        throw err;
      }
      done(Runnable.toValueOrError(<any>err));
    }
    return;
  }

  // sync or promise-returning
  try {
    callFn(this.fn!);
  } catch (err) {
    errorWasHandled = true;
    if (err instanceof Pending) {
      return done();
    } else if (this.allowUncaught) {
      throw err;
    }
    done(Runnable.toValueOrError(<any>err));
  }

  function callFn(fn: Function) {  // call normal or async function
    var result = fn.call(ctx);
    if (result && typeof result.then === 'function') {
      self.resetTimeout();
      result.then(
        function () {
          done();
          // Return null so libraries like bluebird do not warn about
          // subsequently constructed Promises.
          return null;
        },
        function (reason: Error) {
          done(reason || new Errors.Error('Promise rejected with no or falsy reason'));
        }
      );
    } else {
      if (self.asyncOnly) {
        return done(
          new Errors.Error(
            '--async-only option in use without declaring `done()` or returning a promise'
          )
        );
      }

      done();
    }
  }

  function callFnAsync(fn: Function) {  // TODO: need recheck!
    var result = fn.call(ctx, function (err?: any) {
      if (err instanceof Error || toString.call(err) === '[object Error]') {
        return done(err);
      }
      if (err) {
        if (Object.prototype.toString.call(err) === '[object Object]') {
          return done(
            new Errors.Error('done() invoked with non-Error: ' + JSON.stringify(err))
          );
        }
        return done(new Errors.Error('done() invoked with non-Error: ' + err));
      }
      if (result && utils.isPromise(result)) {
        return done(
          new Errors.Error(
            'Resolution method is overspecified. Specify a callback *or* return a Promise; not both.'
          )
        );
      }

      done();
    });
  }
};

/**
 * Instantiates a "timeout" error
 *
 * @param {number} ms - Timeout (in milliseconds)
 * @returns {Error} a "timeout" error
 * @private
 */
Runnable.prototype._timeoutError = function (ms) {
  let msg = `Timeout of ${ms}ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves.`;
  if (this.file) {
    msg += ' (' + this.file + ')';
  }
  return createTimeoutError(msg, ms, this.file||"");
};

var constants = <RunnableConstants>utils.defineConstants(
  /**
   * {@link Runnable}-related constants.
   * @public
   * @memberof Runnable
   * @readonly
   * @static
   * @alias constants
   * @enum {string}
   */
  {
    /**
     * Value of `state` prop when a `Runnable` has failed
     */
    STATE_FAILED: 'failed',
    /**
     * Value of `state` prop when a `Runnable` has passed
     */
    STATE_PASSED: 'passed',
    /**
     * Value of `state` prop when a `Runnable` has been skipped by user
     */
    STATE_PENDING: 'pending'
  }
);

/**
 * Given `value`, return identity if truthy, otherwise create an "invalid exception" error and return that.
 * @param {*} [value] - Value to return, if present
 * @returns {*|Error} `value`, otherwise an `Error`
 * @private
 */
Runnable.toValueOrError = function (value) {
  return (
    value ||
    createInvalidExceptionError(
      'Runnable failed with falsy or undefined exception. Please throw an Error instead.',
      value
    )
  );
};

Runnable.constants = constants;

namespace Runnable {
  export type Done = (err?: any) => void;
  // export type Func = (this: Context, done: Done) => void;
  // export type AsyncFunc = (this: Context) => PromiseLike<any>;
  export type Func = (done: Done) => void;
  export type AsyncFunc = () => PromiseLike<any>;
  export type Callback = Func | AsyncFunc;
  export type CallbackFunc = {
    (fn: Callback): void;
    (name: string, fn?: Callback): void;
  }
  export interface HookCallMethod<T> {
    (this: T, title: string | CallbackFunc, fn?: CallbackFunc): T;
  }
  export type RunnableState = RunnableConstants[keyof RunnableConstants];
}

export = Runnable;