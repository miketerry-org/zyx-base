// baseLog.js:

"use strict";

/**
 * @module BaseLog
 *
 * BaseLog provides a foundational logging service using Node.js's console methods.
 *
 * It is designed to be extended or overridden by subclasses to implement custom logging
 * strategies, such as file logging, external APIs, or cloud-based log aggregators.
 */

const BaseService = require("./baseService");

/**
 * BaseLog is a minimal service wrapping console methods.
 *
 * @class
 * @extends BaseService
 */
class BaseLog extends BaseService {
  /**
   * Logs a message only if the expression is false.
   * Useful for verifying assumptions in runtime logic.
   *
   * @param {boolean} expression - The condition to assert.
   * @param {...any} args - Values to log if the assertion fails.
   */
  assert(expression, ...args) {
    console.assert(expression, ...args);
  }

  /**
   * Clears the console output (if supported by the environment).
   */
  clear() {
    console.clear();
  }

  /**
   * Logs debugging information.
   *
   * @param {...any} args - Values to log.
   */
  debug(...args) {
    console.debug(...args);
  }

  /**
   * Logs error messages to stderr.
   *
   * @param {...any} args - Values to log.
   */
  error(...args) {
    console.error(...args);
  }

  /**
   * Logs informational messages.
   *
   * @param {...any} args - Values to log.
   */
  info(...args) {
    console.info(...args);
  }

  /**
   * Logs general output messages.
   *
   * @param {...any} args - Values to log.
   */
  log(...args) {
    console.log(...args);
  }

  /**
   * Displays tabular data in a formatted table.
   *
   * @param {...any} args - Tabular data to display.
   */
  table(...args) {
    console.table(...args);
  }

  // ─── Time-based logging ──────────────────────────────────────────────────────

  /**
   * Starts a new timer with the specified label.
   *
   * @param {string} label - Label to identify the timer.
   */
  time(label) {
    console.time(label);
  }

  /**
   * Stops the specified timer and logs the elapsed time.
   *
   * @param {string} label - Label of the timer to end.
   */
  timeEnd(label) {
    console.timeEnd(label);
  }

  /**
   * Logs the current duration of a timer without stopping it.
   *
   * @param {string} label - Label of the timer.
   * @param {...any} args - Additional context to log.
   */
  timeLog(label, ...args) {
    console.timeLog(label, ...args);
  }

  /**
   * Adds a timestamp to the performance timeline (No-op in Node.js).
   *
   * @param {string} [label] - Optional label for the timestamp.
   */
  timeStamp(label) {
    // No-op in most Node.js environments, included for API consistency.
    console.timeStamp?.(label);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Prints a stack trace from the current point in the code.
   *
   * @param {...any} args - Optional context to include in the trace.
   */
  trace(...args) {
    console.trace(...args);
  }

  /**
   * Logs warning messages.
   *
   * @param {...any} args - Values to log.
   */
  warn(...args) {
    console.warn(...args);
  }
}

module.exports = BaseLog;
