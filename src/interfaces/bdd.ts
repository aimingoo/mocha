'use strict';

import Test = require('../test');
import Suite = require('../suite');
var EVENT_FILE_PRE_REQUIRE =
  Suite.constants.EVENT_FILE_PRE_REQUIRE;

import Common = require('./common');
import Mocha = require('../mocha');
type ModuleContext = Common.ModuleContext;
  
/**
 * BDD-style interface:
 *
 *      describe('Array', function() {
 *        describe('#indexOf()', function() {
 *          it('should return -1 when not present', function() {
 *            // ...
 *          });
 *
 *          it('should return the index when present', function() {
 *            // ...
 *          });
 *        });
 *      });
 *
 * @param {Suite} suite Root suite.
 */
const bddInterface = function bddInterface(suite: Suite) {
    var suites = [suite];

  suite.on(EVENT_FILE_PRE_REQUIRE, function (context: Required<ModuleContext>, file: string, mocha: Mocha) {
    var common = require('./common')(suites, context, mocha) as Common.CommonFuncions;

    context.before = common.before;
    context.after = common.after;
    context.beforeEach = common.beforeEach;
    context.afterEach = common.afterEach;
    context.run = mocha.options.delay && common.runWithSuite(suite);
    /**
     * Describe a "suite" with the given `title`
     * and callback `fn` containing nested suites
     * and/or tests.
     */

    context.describe = context.context = function (title, fn) {
      return common.suite.create({
        title,
        file,
        fn
      });
    } as ModuleContext["suite"]; // "suite" is Required

    /**
     * Pending describe.
     */

    context.xdescribe =
      context.xcontext =
      context.describe.skip =
        function (title, fn) {
          return common.suite.skip({
            title,
            file,
            fn
          });
        };

    /**
     * Exclusive suite.
     */

    context.describe.only = function (title, fn) {
      return common.suite.only({
        title,
        file,
        fn
      });
    };

    /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */

    context.it = context.specify = function (title, fn) {
      var suite = suites[0];
      var test = suite.isPending() ? new Test(title) : new Test(title, fn);
      test.file = file;
      suite.addTest(test);
      return test;
    } as ModuleContext["test"]; // "test" is Required

    /**
     * Exclusive test-case.
     */

    context.it.only = function (title, fn) {
      return common.test.only(mocha, context.it(title, fn));
    };

    /**
     * Pending test case.
     */

    context.xit =
      context.xspecify =
      context.it.skip =
        function (title) {
          return context.it(title);
        };
  });
};

bddInterface.description = 'BDD or RSpec style [default]';

export = bddInterface;
