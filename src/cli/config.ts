'use strict';

/**
 * Responsible for loading / finding Mocha's "rc" files.
 *
 * @private
 * @module
 */

const fs = require('fs');
const path = require('path');
import Debugger = require('debug');
const debug = Debugger('mocha:cli:config');
const findUp = require('find-up');
const {createUnparsableFileError} = require('../errors');
const utils = require('../utils');

const Config = exports = {} as ConfigSingleton;
/**
 * These are the valid config files, in order of precedence;
 * e.g., if `.mocharc.js` is present, then `.mocharc.yaml` and the rest
 * will be ignored.
 * The user should still be able to explicitly specify a file.
 * @private
 */
Config.CONFIG_FILES = [
  '.mocharc.cjs',
  '.mocharc.js',
  '.mocharc.yaml',
  '.mocharc.yml',
  '.mocharc.jsonc',
  '.mocharc.json'
];

/**
 * Parsers for various config filetypes. Each accepts a filepath and
 * returns an object (but could throw)
 */
const parsers = (Config.parsers = {
  yaml: (filepath: string): any => require('js-yaml').load(fs.readFileSync(filepath, 'utf8')),
  js: (filepath: string): any => {
    let cwdFilepath;
    try {
      debug('parsers: load cwd-relative path: "%s"', path.resolve(filepath));
      cwdFilepath = require.resolve(path.resolve(filepath)); // evtl. throws
      return require(cwdFilepath);
    } catch (err) {
      if (cwdFilepath) throw err;

      debug('parsers: retry load as module-relative path: "%s"', filepath);
      return require(filepath);
    }
  },
  json: (filepath: string): any =>
    JSON.parse(
      require('strip-json-comments')(fs.readFileSync(filepath, 'utf8'))
    )
});

/**
 * Loads and parses, based on file extension, a config file.
 * "JSON" files may have comments.
 *
 * @private
 * @param {string} filepath - Config file path to load
 * @returns {Object} Parsed config object
 */
Config.loadConfig = filepath => {
  let config = {};
  debug('loadConfig: trying to parse config at %s', filepath);

  const ext = path.extname(filepath);
  try {
    if (ext === '.yml' || ext === '.yaml') {
      config = parsers.yaml(filepath);
    } else if (ext === '.js' || ext === '.cjs') {
      config = parsers.js(filepath);
    } else {
      config = parsers.json(filepath);
    }
  } catch (err) {
    throw createUnparsableFileError(
      `Unable to read/parse ${filepath}: ${err}`,
      filepath
    );
  }
  return config;
};

/**
 * Find ("find up") config file starting at `cwd`
 *
 * @param {string} [cwd] - Current working directory
 * @returns {string|null} Filepath to config, if found
 */
Config.findConfig = (cwd = utils.cwd()) => {
  const filepath = findUp.sync(exports.CONFIG_FILES, {cwd});
  if (filepath) {
    debug('findConfig: found config file %s', filepath);
  }
  return filepath;
};


type ParserType = "yaml" | "js" | "json";
interface ConfigSingleton {
  CONFIG_FILES: string[];
  findConfig(cwd?: string): string | null;
  loadConfig(filepath: string): object;
  parsers: {[key in ParserType]: (filepath: string) => any};
}

export = Config;