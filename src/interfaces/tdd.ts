'use strict';

import Test = require('../test');
import Suite = require('../suite');
var EVENT_FILE_PRE_REQUIRE =
  Suite.constants.EVENT_FILE_PRE_REQUIRE;

import Common = require('./common');
import Mocha = require('../mocha');
type ModuleContext = Common.ModuleContext;

/**
 * TDD-style interface:
 *
 *      suite('Array', function() {
 *        suite('#indexOf()', function() {
 *          suiteSetup(function() {
 *
 *          });
 *
 *          test('should return -1 when not present', function() {
 *
 *          });
 *
 *          test('should return the index when present', function() {
 *
 *          });
 *
 *          suiteTeardown(function() {
 *
 *          });
 *        });
 *      });
 *
 * @param {Suite} suite Root suite.
 */
const tddInterface = function (suite: Suite) {
  var suites = [suite];

  suite.on(EVENT_FILE_PRE_REQUIRE, function (context: ModuleContext, file: string, mocha: Mocha) {
    var common = require('./common')(suites, context, mocha) as Common.CommonFuncions;

    context.setup = common.beforeEach;
    context.teardown = common.afterEach;
    context.suiteSetup = common.before;
    context.suiteTeardown = common.after;
    context.run = mocha.options.delay && common.runWithSuite(suite);

    /**
     * Describe a "suite" with the given `title` and callback `fn` containing
     * nested suites and/or tests.
     */
    context.suite = function (title, fn) {
      return common.suite.create({
        title,
        file,
        fn
      });
    } as ModuleContext["suite"];

    /**
     * Pending suite.
     */
    context.suite.skip = function (title, fn) {
      return common.suite.skip({
        title,
        file,
        fn
      });
    };

    /**
     * Exclusive test-case.
     */
    context.suite.only = function (title, fn) {
      return common.suite.only({
        title,
        file,
        fn
      });
    };

    /**
     * Describe a specification or test-case with the given `title` and
     * callback `fn` acting as a thunk.
     */
    context.test = function (title, fn) {
      var suite = suites[0];
      var test = suite.isPending() ? new Test(title) : new Test(title, fn);
      test.file = file;
      suite.addTest(test);
      return test;
    } as ModuleContext["test"];

    /**
     * Exclusive test-case.
     */

    context.test.only = function (title, fn) {
      return common.test.only(mocha, context.test(title, fn));
    };

    context.test.skip = common.test.skip;
  });
};

tddInterface.description =
  'traditional "suite"/"test" instead of BDD\'s "describe"/"it"';

export = tddInterface;