'use strict';

/**
 @module interfaces/common
*/

import Suite = require('../suite');
import errors = require('../errors');
import Mocha = require('../mocha');
var createMissingArgumentError = errors.createMissingArgumentError;
var createUnsupportedError = errors.createUnsupportedError;
var createForbiddenExclusivityError = errors.createForbiddenExclusivityError;

import Runnable = require('../runnable');
import Test = require('../test');
type CallbackFunc = Runnable.CallbackFunc;
type SuiteContext = Mocha.SuiteContext;

type CommonOptions = {
  title: string;
  fn?: Function | false;
  pending?: boolean;
  file?: string;
  isOnly?: boolean;
}

type ModuleCallMethod = (opts: CommonOptions) => Suite;
type HookCallMethod = (name: string, fn?: CallbackFunc) => void;
interface SuiteFunction<T = Suite> {
  (...args: Parameters<HookCallMethod>): T;
  only: HookCallMethod;
  skip: HookCallMethod;
}

/**
 * Functions common to more than one interface.
 *
 * @private
 * @param {Suite[]} suites
 * @param {Context} context
 * @param {Mocha} mocha
 * @return {Object} An object containing common functions.
 */
const Common = function (suites: Suite[], context: SuiteContext, mocha: Mocha) {
  /**
   * Check if the suite should be tested.
   *
   * @private
   * @param {Suite} suite - suite to check
   * @returns {boolean}
   */
  function shouldBeTested(suite: Suite) {
    return (
      !mocha.options.grep ||
      (mocha.options.grep &&
        mocha.options.grep.test(suite.fullTitle()) &&
        !mocha.options.invert)
    );
  }

  return {
    /**
     * This is only present if flag --delay is passed into Mocha. It triggers
     * root suite execution.
     *
     * @param {Suite} suite The root suite.
     * @return {Function} A function which runs the root suite
     */
    runWithSuite: function runWithSuite(suite: Suite) {
      return function run() {
        suite.run();
      };
    },

    /**
     * Execute before running tests.
     *
     * @param {string} name
     * @param {Function} fn
     */
    before: function (name: string, fn: CallbackFunc) {
      suites[0].beforeAll(name, fn);
    },

    /**
     * Execute after running tests.
     *
     * @param {string} name
     * @param {Function} fn
     */
    after: function (name: string, fn: CallbackFunc) {
      suites[0].afterAll(name, fn);
    },

    /**
     * Execute before each test case.
     *
     * @param {string} name
     * @param {Function} fn
     */
    beforeEach: function (name: string, fn: CallbackFunc) {
      suites[0].beforeEach(name, fn);
    },

    /**
     * Execute after each test case.
     *
     * @param {string} name
     * @param {Function} fn
     */
    afterEach: function (name: string, fn: CallbackFunc) {
      suites[0].afterEach(name, fn);
    },

    suite: {
      /**
       * Create an exclusive Suite; convenience function
       * See docstring for create() below.
       *
       * @param {Object} opts
       * @returns {Suite}
       */
      only: function only(opts: CommonOptions) {
        if (mocha.options.forbidOnly) {
          throw createForbiddenExclusivityError(mocha);
        }
        opts.isOnly = true;
        return this.create(opts);
      },

      /**
       * Create a Suite, but skip it; convenience function
       * See docstring for create() below.
       *
       * @param {Object} opts
       * @returns {Suite}
       */
      skip: function skip(opts: CommonOptions) {
        opts.pending = true;
        return this.create(opts);
      },

      /**
       * Creates a suite.
       *
       * @param {Object} opts Options
       * @param {string} opts.title Title of Suite
       * @param {Function} [opts.fn] Suite Function (not always applicable)
       * @param {boolean} [opts.pending] Is Suite pending?
       * @param {string} [opts.file] Filepath where this Suite resides
       * @param {boolean} [opts.isOnly] Is Suite exclusive?
       * @returns {Suite}
       */
      create: function create(opts: CommonOptions) {
        var suite = Suite.create(suites[0], opts.title);
        suite.pending = Boolean(opts.pending);
        suite.file = opts.file;
        suites.unshift(suite);
        if (opts.isOnly) {
          suite.markOnly();
        }
        if (
          suite.pending &&
          mocha.options.forbidPending &&
          shouldBeTested(suite)
        ) {
          throw createUnsupportedError('Pending test forbidden');
        }
        if (typeof opts.fn === 'function') {
          opts.fn.call(suite);
          suites.shift();
        } else if (typeof opts.fn === 'undefined' && !suite.pending) {
          throw createMissingArgumentError(
            'Suite "' +
              suite.fullTitle() +
              '" was defined but no callback was supplied. ' +
              'Supply a callback or explicitly skip the suite.',
            'callback',
            'function'
          );
        } else if (!opts.fn && suite.pending) {
          suites.shift();
        }

        return suite;
      }
    },

    test: {
      /**
       * Exclusive test-case.
       *
       * @param {Object} mocha
       * @param {Function} test
       * @returns {*}
       */
      only: function (mocha: Mocha, test: Test) {
        if (mocha.options.forbidOnly) {
          throw createForbiddenExclusivityError(mocha);
        }
        test.markOnly();
        return test;
      },

      /**
       * Pending test case.
       *
       * @param {string} title
       */
      skip: function (title: string) {
        context.test(title);
      }
    }
  };
};

namespace Common {
  export type ModuleContext = {
    teardown: HookCallMethod;
    suiteTeardown: HookCallMethod;
    after: HookCallMethod;
    before: HookCallMethod;
    beforeEach: HookCallMethod;
    afterEach: HookCallMethod;
    setup: HookCallMethod;
    suiteSetup: HookCallMethod;
    suite: SuiteFunction;
    test: SuiteFunction<Test>;
    it?: SuiteFunction<Test>;
    specify?: SuiteFunction<Test>;
    describe?: SuiteFunction;
    context?: SuiteFunction;
    xdescribe?: HookCallMethod;
    xcontext?: HookCallMethod;
    xspecify?: HookCallMethod;
    xit?: HookCallMethod;
    run: false | (() => void) | ((...args: any[]) => Suite);  // TODO: recheck!
  };

  export interface CommonFuncions {
    runWithSuite(suite: Suite): () => void;
    before: HookCallMethod;
    after: HookCallMethod;
    beforeEach: HookCallMethod;
    afterEach: HookCallMethod;
    suite: {
      create: ModuleCallMethod;
      only: ModuleCallMethod;
      skip: ModuleCallMethod;
    };
    test: {
      only(mocha: Mocha, test: Test): Test | never;
      skip(title: string): void;
    }
  }
}

export = Common;