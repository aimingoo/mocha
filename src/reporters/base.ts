'use strict';
/**
 * @module Base
 */
/**
 * Module dependencies.
 */

var diff = require('diff');
var milliseconds = require('ms');
import utils = require('../utils');
var supportsColor = require('supports-color');
var symbols = require('log-symbols');
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;

import type Test = require('../test');
import Errors = require('../errors');
import type Stats = require('../stats-collector');

const isBrowser = utils.isBrowser();

function getBrowserWindowSize() {
  if ('innerHeight' in global) {
    return [global.innerHeight, global.innerWidth];
  }
  // In a Web Worker, the DOM Window is not available.
  return [640, 480];
}

/**
 * Expose `Base`.
 */

// exports = module.exports = Base;

/**
 * Check if both stdio streams are associated with a tty.
 */

var isatty = isBrowser || (process.stdout.isTTY && process.stderr.isTTY);

/**
 * Save log references to avoid tests interfering (see GH-3604).
 */
var consoleLog = console.log;

/**
 * Enable coloring by default, except in the browser interface.
 */

exports.useColors =
  !isBrowser &&
  (supportsColor.stdout || process.env.MOCHA_COLORS !== undefined);

/**
 * Inline diffs instead of +/-
 */

exports.inlineDiffs = false;

/**
 * Truncate diffs longer than this value to avoid slow performance
 */
exports.maxDiffSize = 8192;

/**
 * Default color map.
 */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": ".*" }] */
const ExportedColors = exports.colors = {
  pass: 90,
  fail: 31,
  'bright pass': 92,
  'bright fail': 91,
  'bright yellow': 93,
  pending: 36,
  suite: 0,
  'error title': 0,
  'error message': 31,
  'error stack': 90,
  checkmark: 32,
  fast: 90,
  medium: 33,
  slow: 31,
  green: 32,
  light: 90,
  'diff gutter': 90,
  'diff added': 32,
  'diff removed': 31,
  'diff added inline': '30;42',
  'diff removed inline': '30;41'
} as const;

type ExportedColors = typeof ExportedColors;

/**
 * Default symbol map.
 */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": ".*" }] */
const ExportsSymbols = exports.symbols = {
  // ok: <unique symbol>symbols.success,  // TODO: recheck!
  // err: <unique symbol>symbols.error,
  ok: symbols.success,
  err: symbols.error,
  dot: '.',
  comma: ',',
  bang: '!'
} as const;

/**
 * Color `str` with the given `type`,
 * allowing colors to be disabled,
 * as well as user-defined color
 * schemes.
 *
 * @private
 * @param {string} type
 * @param {string} str
 * @return {string}
 */
var color = (exports.color = function (type: string, str: string): string {
  if (!exports.useColors) {
    return String(str);
  }
  return '\u001b[' + exports.colors[type] + 'm' + str + '\u001b[0m';
});

/**
 * Expose term window size, with some defaults for when stderr is not a tty.
 */

exports.window = {
  width: 75
};

if (isatty) {
  if (isBrowser) {
    exports.window.width = getBrowserWindowSize()[1];
  } else {
    // @ts-expect-error send one parameter.
    exports.window.width = process.stdout.getWindowSize(1)[0];
  }
}

/**
 * Expose some basic cursor interactions that are common among reporters.
 */

exports.cursor = {
  hide: function () {
    isatty && process.stdout.write('\u001b[?25l');
  },

  show: function () {
    isatty && process.stdout.write('\u001b[?25h');
  },

  deleteLine: function () {
    isatty && process.stdout.write('\u001b[2K');
  },

  beginningOfLine: function () {
    isatty && process.stdout.write('\u001b[0G');
  },

  CR: function () {
    if (isatty) {
      exports.cursor.deleteLine();
      exports.cursor.beginningOfLine();
    } else {
      process.stdout.write('\r');
    }
  }
};

var showDiff = (exports.showDiff = function (err: DifferentError) {
  return (
    err &&
    err.showDiff !== false &&
    sameType(err.actual, err.expected) &&
    err.expected !== undefined
  );
});

function stringifyDiffObjs(err: DifferentError) {
  if (!utils.isString(err.actual) || !utils.isString(err.expected)) {
    err.actual = utils.stringify(err.actual);
    err.expected = utils.stringify(err.expected);
  }
}

/**
 * Returns a diff between 2 strings with coloured ANSI output.
 *
 * @description
 * The diff will be either inline or unified dependent on the value
 * of `Base.inlineDiff`.
 *
 * @param {string} actual
 * @param {string} expected
 * @return {string} Diff
 */

var generateDiff = (exports.generateDiff = function (actual: string, expected: string): string {
  try {
    var maxLen = exports.maxDiffSize;
    var skipped = 0;
    if (maxLen > 0) {
      skipped = Math.max(actual.length - maxLen, expected.length - maxLen);
      actual = actual.slice(0, maxLen);
      expected = expected.slice(0, maxLen);
    }
    let result = exports.inlineDiffs
      ? inlineDiff(actual, expected)
      : unifiedDiff(actual, expected);
    if (skipped > 0) {
      result = `${result}\n      [mocha] output truncated to ${maxLen} characters, see "maxDiffSize" reporter-option\n`;
    }
    return result;
  } catch (err) {
    var msg =
      '\n      ' +
      color('diff added', '+ expected') +
      ' ' +
      color('diff removed', '- actual:  failed to generate Mocha diff') +
      '\n';
    return msg;
  }
});

/**
 * Outputs the given `failures` as a list.
 *
 * @public
 * @memberof Mocha.reporters.Base
 * @variation 1
 * @param {Object[]} failures - Each is Test instance with corresponding
 *     Error property
 */

exports.list = function (failures: Test[]) {
  var multipleErr: Errors.MochaError[], multipleTest: Test;
  Base.consoleLog();
  failures.forEach(function (test: Test, i) {
    // format
    var fmt =
      color('error title', '  %s) %s:\n') +
      color('error message', '     %s') +
      color('error stack', '\n%s\n');

    // msg
    var msg;
    var err: DifferentError;
    if (test.err && test.err.multiple) {
      if (multipleTest !== test) {
        multipleTest = test;
        multipleErr = [test.err].concat(test.err.multiple);
      }
      err = <DifferentError>multipleErr.shift();
    } else {
      err = <DifferentError>test.err;
    }
    var message;
    if (typeof err.inspect === 'function') {
      message = err.inspect() + '';
    } else if (err.message && typeof err.message.toString === 'function') {
      message = err.message + '';
    } else {
      message = '';
    }
    var stack = err.stack || message;
    var index = message ? stack.indexOf(message) : -1;

    if (index === -1) {
      msg = message;
    } else {
      index += message.length;
      msg = stack.slice(0, index);
      // remove msg from stack
      stack = stack.slice(index + 1);
    }

    // uncaught
    if (err.uncaught) {
      msg = 'Uncaught ' + msg;
    }
    // explicitly show diff
    if (!exports.hideDiff && showDiff(err)) {
      stringifyDiffObjs(err);
      fmt =
        color('error title', '  %s) %s:\n%s') + color('error stack', '\n%s\n');
      var match = message.match(/^([^:]+): expected/);
      msg = '\n      ' + color('error message', match ? match[1] : msg);

      msg += generateDiff(err.actual || '', err.expected || '');
    }

    // indent stack trace
    stack = stack.replace(/^/gm, '  ');

    // indented test title
    var testTitle = '';
    test.titlePath().forEach(function (str, index) {
      if (index !== 0) {
        testTitle += '\n     ';
      }
      for (var i = 0; i < index; i++) {
        testTitle += '  ';
      }
      testTitle += str;
    });

    Base.consoleLog(fmt, i + 1, testTitle, msg, stack);
  });
};

// alias
type Cursor = Base.Cursor;
type Different = Base.Different;
type DifferentError = Base.DifferentError;

interface Base {
  failures: Test[];
  options: Runner.RunnerOptions;
  runner: Runner;
  stats: Stats;
  epilogue(): void;
}

interface BaseConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): Base;
  (this: Base, runner: Runner, options: Runner.RunnerOptions): Base;
  readonly prototype: Base;

  abstract: boolean;
  useColors: boolean;
  inlineDiffs: boolean;
  hideDiff: boolean;
  maxDiffSize: number;
  colors: Base.Colors;
  symbols: typeof ExportsSymbols; // FIXME:
  window: any;
  cursor: Cursor;

  showDiff(err?: DifferentError): boolean; // FIXME:
  generateDiff(actual: string, expected: string): string;
  list(failures: Test[]): void;
  color(type: string, str: string): string;
  consoleLog(message?: any, ...optionalParams: any[]): void;
}

/**
 * Constructs a new `Base` reporter instance.
 *
 * @description
 * All other reporters generally inherit from this reporter.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const Base = function Base(runner, options) {
  var failures = (this.failures = []) as Test[];

  if (!runner) {
    throw new TypeError('Missing runner argument');
  }
  this.options = options || {};
  this.runner = runner;
  this.stats = runner.stats; // assigned so Reporters keep a closer reference

  var maxDiffSizeOpt =
    this.options.reporterOption && this.options.reporterOption.maxDiffSize;
  if (maxDiffSizeOpt !== undefined && !isNaN(Number(maxDiffSizeOpt))) {
    exports.maxDiffSize = Number(maxDiffSizeOpt);
  }

  runner.on(EVENT_TEST_PASS, function (test: Test) {
    const duration = test.duration || 0;
    if (duration > test.slow()) {
      test.speed = 'slow';
    } else if (duration > test.slow() / 2) {
      test.speed = 'medium';
    } else {
      test.speed = 'fast';
    }
  });

  runner.on(EVENT_TEST_FAIL, function (test: Test, err) {
    if (showDiff(err)) {
      stringifyDiffObjs(err);
    }
    // more than one error per test
    if (test.err && Errors.isMochaError(err)) {
      test.err.multiple = (test.err.multiple || []).concat(err);
    } else {
      test.err = err;
    }
    failures.push(test);
  });
} as BaseConstructor;
exports = Object.assign(Base, exports);  // rewrite exports and copy members

/**
 * Outputs common epilogue used by many of the bundled reporters.
 *
 * @public
 * @memberof Mocha.reporters
 */
Base.prototype.epilogue = function () {
  var stats = this.stats;
  var fmt;

  Base.consoleLog();

  // passes
  fmt =
    color('bright pass', ' ') +
    color('green', ' %d passing') +
    color('light', ' (%s)');

  Base.consoleLog(fmt, stats.passes || 0, milliseconds(stats.duration));

  // pending
  if (stats.pending) {
    fmt = color('pending', ' ') + color('pending', ' %d pending');

    Base.consoleLog(fmt, stats.pending);
  }

  // failures
  if (stats.failures) {
    fmt = color('fail', '  %d failing');

    Base.consoleLog(fmt, stats.failures);

    Base.list(this.failures);
    Base.consoleLog();
  }

  Base.consoleLog();
};

/**
 * Pads the given `str` to `len`.
 *
 * @private
 * @param {string} str
 * @param {number} len
 * @return {string}
 */
function pad(str: string | number, len: number): string {
  str = String(str);
  return Array(len - str.length + 1).join(' ') + str;
}

/**
 * Returns inline diff between 2 strings with coloured ANSI output.
 *
 * @private
 * @param {String} actual
 * @param {String} expected
 * @return {string} Diff
 */
function inlineDiff(actual: string, expected: string): string {
  var msg = errorDiff(actual, expected);

  // linenos
  var lines: string[] = msg.split('\n');
  if (lines.length > 4) {
    var width = String(lines.length).length;
    msg = lines
      .map(function (str, i) {
        return pad(++i, width) + ' |' + ' ' + str;
      })
      .join('\n');
  }

  // legend
  msg =
    '\n' +
    color('diff removed inline', 'actual') +
    ' ' +
    color('diff added inline', 'expected') +
    '\n\n' +
    msg +
    '\n';

  // indent
  msg = msg.replace(/^/gm, '      ');
  return msg;
}

/**
 * Returns unified diff between two strings with coloured ANSI output.
 *
 * @private
 * @param {String} actual
 * @param {String} expected
 * @return {string} The diff.
 */
function unifiedDiff(actual: string, expected: string): string {
  var indent = '      ';
  function cleanUp(line: string) {
    if (line[0] === '+') {
      return indent + colorLines('diff added', line);
    }
    if (line[0] === '-') {
      return indent + colorLines('diff removed', line);
    }
    if (line.match(/@@/)) {
      return '--';
    }
    if (line.match(/\\ No newline/)) {
      return null;
    }
    return indent + line;
  }
  function notBlank(line: string | null) {
    return typeof line !== 'undefined' && line !== null;
  }
  var msg = diff.createPatch('string', actual, expected);
  var lines: string[] = msg.split('\n').splice(5);
  return (
    '\n      ' +
    colorLines('diff added', '+ expected') +
    ' ' +
    colorLines('diff removed', '- actual') +
    '\n\n' +
    lines.map(cleanUp).filter(notBlank).join('\n')
  );
}

/**
 * Returns character diff for `err`.
 *
 * @private
 * @param {String} actual
 * @param {String} expected
 * @return {string} the diff
 */
function errorDiff(actual: string, expected: string): string {
  return diff
    .diffWordsWithSpace(actual, expected)
    .map(function (str: Different) {
      if (str.added) {
        return colorLines('diff added inline', str.value);
      }
      if (str.removed) {
        return colorLines('diff removed inline', str.value);
      }
      return str.value;
    })
    .join('');
}

/**
 * Colors lines for `str`, using the color `name`.
 *
 * @private
 * @param {string} name
 * @param {string} str
 * @return {string}
 */
function colorLines(name: string, str: string): string {
  return str
    .split('\n')
    .map(function (str: string) {
      return color(name, str);
    })
    .join('\n');
}

/**
 * Object#toString reference.
 */
var objToString = Object.prototype.toString;

/**
 * Checks that a / b have the same type.
 *
 * @private
 * @param {Object} a
 * @param {Object} b
 * @return {boolean}
 */
function sameType(a: any, b: any) {
  return objToString.call(a) === objToString.call(b);
}

Base.consoleLog = consoleLog;

Base.abstract = true;

namespace Base {

  export interface Cursor {
    hide(): void;
    show(): void;
    deleteLine(): void;
    beginningOfLine(): void;
    CR(): void;
  }

  export interface Different {
    added?: boolean;
    removed?: boolean;
    value: string;
  }

  export interface DifferentError extends Errors.MochaError {
    showDiff?: boolean;
    actual?: string;
    expected?: string;
  }

  export interface Colors extends ExportedColors { }

}

export = Base;