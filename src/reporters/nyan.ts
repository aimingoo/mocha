'use strict';
/**
 * @module Nyan
 */
/**
 * Module dependencies.
 */

import Base = require('./base');
import Runner = require('../runner');
const constants = Runner.constants;
import Utils = require('../utils');
var inherits = Utils.inherits;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;

/**
 * Expose `Dot`.
 */

// exports = module.exports = NyanCat;

interface NyanCat extends Base {
  colorIndex: number;
  numberOfLines: number;
  rainbowColors: number[];
  scoreboardWidth: number;
  tick: boolean;
  nyanCatWidth: number;
  trajectoryWidthMax: number;
  trajectories: [string[], string[], string[], string[]]; // TODO: 这是一个讨论“定长数组”的好地方。@see https://juejin.cn/post/6844903781633622023
  draw(): void;
  drawScoreboard(): void;
  appendRainbow(): void;
  drawRainbow(): void;
  drawNyanCat(): void;
  face(): string;
  cursorUp(n: number): void;
  cursorDown(n: number): void;
  rainbowify(str: string): string;
  generateColors(): number[];
}

interface MinConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): NyanCat;
  (this: NyanCat, runner: Runner, options: Runner.RunnerOptions): NyanCat;
  readonly prototype: NyanCat;
  description: string;
}

/**
 * Constructs a new `Nyan` reporter instance.
 *
 * @public
 * @class Nyan
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const NyanCat = function NyanCat(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var width = (Base.window.width * 0.75) | 0;
  var nyanCatWidth = (this.nyanCatWidth = 11);

  this.colorIndex = 0;
  this.numberOfLines = 4;
  this.rainbowColors = self.generateColors();
  this.scoreboardWidth = 5;
  this.tick = Boolean(0);
  this.trajectories = [[], [], [], []];
  this.trajectoryWidthMax = width - nyanCatWidth;

  runner.on(EVENT_RUN_BEGIN, function () {
    Base.cursor.hide();
    self.draw();
  });

  runner.on(EVENT_TEST_PENDING, function () {
    self.draw();
  });

  runner.on(EVENT_TEST_PASS, function () {
    self.draw();
  });

  runner.on(EVENT_TEST_FAIL, function () {
    self.draw();
  });

  runner.once(EVENT_RUN_END, function () {
    Base.cursor.show();
    for (var i = 0; i < self.numberOfLines; i++) {
      write('\n');
    }
    self.epilogue();
  });
} as MinConstructor;

/**
 * Inherit from `Base.prototype`.
 */
inherits(NyanCat, Base);

/**
 * Draw the nyan cat
 *
 * @private
 */

NyanCat.prototype.draw = function () {
  this.appendRainbow();
  this.drawScoreboard();
  this.drawRainbow();
  this.drawNyanCat();
  this.tick = !this.tick;
};

/**
 * Draw the "scoreboard" showing the number
 * of passes, failures and pending tests.
 *
 * @private
 */

NyanCat.prototype.drawScoreboard = function () {
  var stats = this.stats;

  function draw(type: string, n: number) {
    write(' ');
    write(Base.color(type, String(n)));
    write('\n');
  }

  draw('green', stats.passes);
  draw('fail', stats.failures);
  draw('pending', stats.pending);
  write('\n');

  this.cursorUp(this.numberOfLines);
};

/**
 * Append the rainbow.
 *
 * @private
 */

NyanCat.prototype.appendRainbow = function () {
  var segment = this.tick ? '_' : '-';
  var rainbowified = this.rainbowify(segment);

  for (var index = 0; index < this.numberOfLines; index++) {
    var trajectory = this.trajectories[index];
    if (trajectory.length >= this.trajectoryWidthMax) {
      trajectory.shift();
    }
    trajectory.push(rainbowified);
  }
};

/**
 * Draw the rainbow.
 *
 * @private
 */

NyanCat.prototype.drawRainbow = function () {
  var self = this;

  this.trajectories.forEach(function (line) {
    write('\u001b[' + self.scoreboardWidth + 'C');
    write(line.join(''));
    write('\n');
  });

  this.cursorUp(this.numberOfLines);
};

/**
 * Draw the nyan cat
 *
 * @private
 */
NyanCat.prototype.drawNyanCat = function () {
  var self = this;
  var startWidth = this.scoreboardWidth + this.trajectories[0].length;
  var dist = '\u001b[' + startWidth + 'C';
  var padding = '';

  write(dist);
  write('_,------,');
  write('\n');

  write(dist);
  padding = self.tick ? '  ' : '   ';
  write('_|' + padding + '/\\_/\\ ');
  write('\n');

  write(dist);
  padding = self.tick ? '_' : '__';
  var tail = self.tick ? '~' : '^';
  write(tail + '|' + padding + this.face() + ' ');
  write('\n');

  write(dist);
  padding = self.tick ? ' ' : '  ';
  write(padding + '""  "" ');
  write('\n');

  this.cursorUp(this.numberOfLines);
};

/**
 * Draw nyan cat face.
 *
 * @private
 * @return {string}
 */

NyanCat.prototype.face = function () {
  var stats = this.stats;
  if (stats.failures) {
    return '( x .x)';
  } else if (stats.pending) {
    return '( o .o)';
  } else if (stats.passes) {
    return '( ^ .^)';
  }
  return '( - .-)';
};

/**
 * Move cursor up `n`.
 *
 * @private
 * @param {number} n
 */

NyanCat.prototype.cursorUp = function (n) {
  write('\u001b[' + n + 'A');
};

/**
 * Move cursor down `n`.
 *
 * @private
 * @param {number} n
 */

NyanCat.prototype.cursorDown = function (n) {
  write('\u001b[' + n + 'B');
};

/**
 * Generate rainbow colors.
 *
 * @private
 * @return {Array}
 */
NyanCat.prototype.generateColors = function () {
  var colors: number[] = [];

  for (var i = 0; i < 6 * 7; i++) {
    var pi3 = Math.floor(Math.PI / 3);
    var n = i * (1.0 / 6);
    var r = Math.floor(3 * Math.sin(n) + 3);
    var g = Math.floor(3 * Math.sin(n + 2 * pi3) + 3);
    var b = Math.floor(3 * Math.sin(n + 4 * pi3) + 3);
    colors.push(36 * r + 6 * g + b + 16);
  }

  return colors;
};

/**
 * Apply rainbow to the given `str`.
 *
 * @private
 * @param {string} str
 * @return {string}
 */
NyanCat.prototype.rainbowify = function (str) {
  if (!Base.useColors) {
    return str;
  }
  var color = this.rainbowColors[this.colorIndex % this.rainbowColors.length];
  this.colorIndex += 1;
  return '\u001b[38;5;' + color + 'm' + str + '\u001b[0m';
};

/**
 * Stdout helper.
 *
 * @param {string} string A message to write to stdout.
 */
function write(string: string) {
  process.stdout.write(string);
}

NyanCat.description = '"nyan cat"';

export = NyanCat;