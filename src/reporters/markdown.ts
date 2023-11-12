'use strict';
/**
 * @module Markdown
 */
/**
 * Module dependencies.
 */

import Base = require('./base');
import utils = require('../utils');
import Runner = require('../runner');
const constants = Runner.constants;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_SUITE_BEGIN = constants.EVENT_SUITE_BEGIN;
var EVENT_SUITE_END = constants.EVENT_SUITE_END;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;

/**
 * Constants
 */

var SUITE_PREFIX = '$';

/**
 * Expose `Markdown`.
 */

// exports = module.exports = Markdown;

import type Test = require('../test');

import type Suite = require('../suite');

type IndexedObject = object & { [key: string]: any };

interface Markdown extends Base { }

interface MarkdownConstructor {
  new (runner: Runner, options: Runner.RunnerOptions): Markdown;
  (this: Markdown, runner: Runner, options: Runner.RunnerOptions): Markdown;
  readonly prototype: Markdown;
  description: string;
}


/**
 * Constructs a new `Markdown` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
const Markdown = function Markdown(runner, options) {
  Base.call(this, runner, options);

  var level = 0;
  var buf = '';

  function title(str: string) {
    return Array(level).join('#') + ' ' + str;
  }

  function mapTOC(suite: Suite, obj: IndexedObject) {
    var ret = obj;
    var key = SUITE_PREFIX + suite.title;

    obj = obj[key] = obj[key] || {suite};
    suite.suites.forEach(function (suite) {
      mapTOC(suite, obj);
    });

    return ret;
  }

  function stringifyTOC(obj: IndexedObject, level: number) {
    ++level;
    var buf = '';
    var link;
    for (var key in obj) {
      if (key === 'suite') {
        continue;
      }
      if (key !== SUITE_PREFIX) {
        link = ' - [' + key.substring(1) + ']';
        link += '(#' + utils.slug(obj[key].suite.fullTitle()) + ')\n';
        buf += Array(level).join('  ') + link;
      }
      buf += stringifyTOC(obj[key], level);
    }
    return buf;
  }

  function generateTOC(suite: Suite) {
    var obj = mapTOC(suite, {});
    return stringifyTOC(obj, 0);
  }

  generateTOC(runner.suite);

  runner.on(EVENT_SUITE_BEGIN, function (suite) {
    ++level;
    var slug = utils.slug(suite.fullTitle());
    buf += '<a name="' + slug + '"></a>' + '\n';
    buf += title(suite.title) + '\n';
  });

  runner.on(EVENT_SUITE_END, function () {
    --level;
  });

  runner.on(EVENT_TEST_PASS, function (test: Test) {
    var code = utils.clean(test.body);
    buf += test.title + '.\n';
    buf += '\n```js\n';
    buf += code + '\n';
    buf += '```\n\n';
  });

  runner.once(EVENT_RUN_END, function () {
    process.stdout.write('# TOC\n');
    process.stdout.write(generateTOC(runner.suite));
    process.stdout.write(buf);
  });
} as MarkdownConstructor;

Markdown.description = 'GitHub Flavored Markdown';

export = Markdown;