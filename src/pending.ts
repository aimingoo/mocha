'use strict';

/**
 @module Pending
*/

// module.exports = Pending;

interface Pending {
  message: string;
}

interface PendingConstructor {
  new(message: string): Pending;
  (this: Pending, message: string): Pending;
}

/**
 * Initialize a new `Pending` error with the given message.
 *
 * @param {string} message
 */
const Pending = function Pending( message) {
  this.message = message;
} as PendingConstructor;

export = Pending;