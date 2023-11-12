'use strict';
/**
 * @module Landing
 */
/**
 * Module dependencies.
 */

import Base = require('./base');
import Utils = require('../utils');
const inherits = Utils.inherits;
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_TEST_END = constants.EVENT_TEST_END;
import Runnable = require('../runnable');
var STATE_FAILED = Runnable.constants.STATE_FAILED;

var cursor = Base.cursor;
var color = Base.color;

/**
 * Expose `Landing`.
 */

// exports = module.exports = Landing;

import type Test = require('../test');

interface Landing extends Base { }

interface LandingConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): Landing;
  (this: Landing, runner: Runner, options: Runner.RunnerOptions): Landing;
  readonly prototype: Landing;
  description: string;
}

declare module "./base" {
  interface Colors {
    plane: 0;
    ['plane crash']: 31;
    runway: 90;
  }
}

/**
 * Airplane color.
 */

Base.colors.plane = 0;

/**
 * Airplane crash color.
 */

Base.colors['plane crash'] = 31;

/**
 * Runway color.
 */

Base.colors.runway = 90;

/**
 * Constructs a new `Landing` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const Landing = function Landing(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var width = (Base.window.width * 0.75) | 0;
  var stream = process.stdout;

  var plane = color('plane', '✈');
  var crashed = -1;
  var n = 0;
  var total = 0;

  function runway() {
    var buf = Array(width).join('-');
    return '  ' + color('runway', buf);
  }

  runner.on(EVENT_RUN_BEGIN, function () {
    stream.write('\n\n\n  ');
    cursor.hide();
  });

  runner.on(EVENT_TEST_END, function (test: Test) {
    // check if the plane crashed
    var col = crashed === -1 ? ((width * ++n) / ++total) | 0 : crashed;
    // show the crash
    if (test.state === STATE_FAILED) {
      plane = color('plane crash', '✈');
      crashed = col;
    }

    // render landing strip
    stream.write('\u001b[' + (width + 1) + 'D\u001b[2A');
    stream.write(runway());
    stream.write('\n  ');
    stream.write(color('runway', Array(col).join('⋅')));
    stream.write(plane);
    stream.write(color('runway', Array(width - col).join('⋅') + '\n'));
    stream.write(runway());
    stream.write('\u001b[0m');
  });

  runner.once(EVENT_RUN_END, function () {
    cursor.show();
    process.stdout.write('\n');
    self.epilogue();
  });

  // if cursor is hidden when we ctrl-C, then it will remain hidden unless...
  process.once('SIGINT', function () {
    cursor.show();
    process.nextTick(function () {
      process.kill(process.pid, 'SIGINT');
    });
  });
} as LandingConstructor;

/**
 * Inherit from `Base.prototype`.
 */
inherits(Landing, Base);

Landing.description = 'Unicode landing strip';

export = Landing;