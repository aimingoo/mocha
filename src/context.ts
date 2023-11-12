'use strict';

import Runnable from "./runnable";
import Test from "./test";

/**
 * @module Context
 */
/**
 * Expose `Context`.
 */

// module.exports = Context;
type EmptyContext = { };

interface callabled_runnable {
  runnable(): Runnable;
  runnable(runnable: Runnable): this;
}

namespace Context {
  // NOTE: 使用ctx.test、ctx.currentTest是不安全的
  //  - 因为它可能被一个ctx.runnable(x)置入了错误的类型（例如x可能是一个hook）
  //  - BaseContext是一个抽象接口
  export interface BaseContext extends EmptyContext {
    test?: Test;
    currentTest?: Test;
    runnable?: callabled_runnable["runnable"];  // try in Runnable.prototype.run() only
  }
}

// 在外部的界面中声明时应该使用BaseContext，因为它可以与空白对象兼容
// 在外部对象的成员中，应该使用Context，以确保所有成员可用
interface Context extends Required<Context.BaseContext> {
  _runnable: Runnable;
  // runnable(): Runnable;
  // runnable(runnable: Runnable): this;
  timeout(): number;
  timeout(ms: number|string): this;
  slow(): number;
  slow(ms: number|string): this;
  skip(): void;
  retries(): number;
  retries(n?: number | string): this;
}

interface ContextConstructor {
  new(): Context;
  (): Context;
  readonly prototype: Context;
}

/**
 * Initialize a new `Context`.
 *
 * @private
 */
const Context = function Context() { } as ContextConstructor;

/**
 * Set or get the context `Runnable` to `runnable`.
 *
 * @private
 * @param {Runnable} runnable
 * @return {Context} context
 */
Context.prototype.runnable = function (this:Context, runnable) {
  if (!arguments.length) {
    return this._runnable;
  }
  // @ts-expect-error TODO: 这里存在一个隐藏的BUG，但涉及到较多的修改
  this.test = this._runnable = runnable;
  return this;
} as Context["runnable"];

/**
 * Set or get test timeout `ms`.
 *
 * @private
 * @param {number} ms
 * @return {Context} self
 */
Context.prototype.timeout = function (this:Context, ms) {
  if (!arguments.length) {
    return this.runnable().timeout();
  }
  this.runnable().timeout(ms);
  return this;
} as Context["timeout"];

/**
 * Set or get test slowness threshold `ms`.
 *
 * @private
 * @param {number} ms
 * @return {Context} self
 */
Context.prototype.slow = function (this:Context, ms) {
  if (!arguments.length) {
    return this.runnable().slow();
  }
  this.runnable().slow(ms);
  return this;
} as Context["slow"];

/**
 * Mark a test as skipped.
 *
 * @private
 * @throws Pending
 */
Context.prototype.skip = function () {
  this.runnable().skip();
};

/**
 * Set or get a number of allowed retries on failed tests
 *
 * @private
 * @param {number} n
 * @return {Context} self
 */
Context.prototype.retries = function (this:Context, n) {
  if (!arguments.length) {
    return this.runnable().retries();
  }
  this.runnable().retries(Number(n));
  return this;
} as Context["retries"];

export = Context;