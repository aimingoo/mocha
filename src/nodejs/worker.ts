/**
 * A worker process.  Consumes {@link module:reporters/parallel-buffered} reporter.
 * @module worker
 * @private
 */

'use strict';

import Errors = require('../errors');
const {
  createInvalidArgumentTypeError,
  createInvalidArgumentValueError
} = Errors;
const workerpool = require('workerpool');
import Mocha = require('../mocha');
import runHelpers = require('../cli/run-helpers');
const {handleRequires, validateLegacyPlugin} = runHelpers;
import Debugger = require('debug');
const debug = Debugger.debug(`mocha:parallel:worker:${process.pid}`);
const isDebugEnabled = Debugger.enabled(`mocha:parallel:worker:${process.pid}`);
import Serializer = require('./serializer');
import WatchRun = require("../cli/watch-run");

const {serialize} = Serializer;
const {setInterval, clearInterval} = global;

let rootHooks: any[] | undefined;

type CommandLineOptions = WatchRun.CommandLineOptions;

if (workerpool.isMainThread) {
  throw new Error(
    'This script is intended to be run as a worker (by the `workerpool` package).'
  );
}

/**
 * Initializes some stuff on the first call to {@link run}.
 *
 * Handles `--require` and `--ui`.  Does _not_ handle `--reporter`,
 * as only the `Buffered` reporter is used.
 *
 * **This function only runs once per worker**; it overwrites itself with a no-op
 * before returning.
 *
 * @param {Options} argv - Command-line options
 */
let bootstrap = async (argv: CommandLineOptions) => {
  // globalSetup and globalTeardown do not run in workers
  const plugins: any = await handleRequires(argv.require, {
    ignoredPlugins: ['mochaGlobalSetup', 'mochaGlobalTeardown']
  });
  validateLegacyPlugin(argv as any, 'ui', Mocha.interfaces);

  rootHooks = plugins.rootHooks;
  (bootstrap as any) = () => {}; // rewrite to empty entry
  debug('bootstrap(): finished with args: %O', argv);
};

/**
 * Runs a single test file in a worker thread.
 * @param {string} filepath - Filepath of test file
 * @param {string} [serializedOptions] - **Serialized** options. This string will be eval'd!
 * @see https://npm.im/serialize-javascript
 * @returns {Promise<{failures: number, events: BufferedEvent[]}>} - Test
 * failure count and list of events.
 */
async function run(filepath: string, serializedOptions: string = '{}') {
  if (!filepath) {
    throw createInvalidArgumentTypeError(
      'Expected a non-empty "filepath" argument',
      'file',
      'string'
    );
  }

  debug('run(): running test file %s', filepath);

  if (typeof serializedOptions !== 'string') {
    throw createInvalidArgumentTypeError(
      'run() expects second parameter to be a string which was serialized by the `serialize-javascript` module',
      'serializedOptions',
      'string'
    );
  }
  let argv;
  try {
    // eslint-disable-next-line no-eval
    argv = eval('(' + serializedOptions + ')');
  } catch (err) {
    throw createInvalidArgumentValueError(
      'run() was unable to deserialize the options',
      'serializedOptions',
      serializedOptions
    );
  }

  const opts = Object.assign({ui: 'bdd'}, argv, {
    // if this was true, it would cause infinite recursion.
    parallel: false,
    // this doesn't work in parallel mode
    forbidOnly: true,
    // it's useful for a Mocha instance to know if it's running in a worker process.
    isWorker: true
  });

  await bootstrap(opts);

  opts.rootHooks = rootHooks;

  const mocha = new Mocha(opts).addFile(filepath);

  try {
    await mocha.loadFilesAsync();
  } catch (err) {
    debug('run(): could not load file %s: %s', filepath, err);
    throw err;
  }

  return new Promise((resolve, reject) => {
    let debugInterval: NodeJS.Timer;
    /* istanbul ignore next */
    if (isDebugEnabled) {
      debugInterval = setInterval(() => {
        debug('run(): still running %s...', filepath);
      }, 5000).unref();
    }
    mocha.run((result: {failures?: number}) => { // @see TestDoneCB in mocha.ts
      // Runner adds these; if we don't remove them, we'll get a leak.
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');

      try {
        const serialized = serialize(result);
        debug(
          'run(): completed run with %d test failures; returning to main process',
          typeof result.failures === 'number' ? result.failures : 0
        );
        resolve(serialized);
      } catch (err) {
        // TODO: figure out exactly what the sad path looks like here.
        // rejection should only happen if an error is "unrecoverable"
        debug('run(): serialization failed; rejecting: %O', err);
        reject(err);
      } finally {
        clearInterval(debugInterval);
      }
    });
  });
}

// this registers the `run` function.
workerpool.worker({run});

debug('started worker process');

// for testing
// exports.run = run;
const Worker = { run };
export = Worker;