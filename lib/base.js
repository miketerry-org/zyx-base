// base.js:

"use strict";

/**
 * @module base
 */

/**
 * Represents an abstract base class that cannot be instantiated directly.
 * Subclasses must implement required methods.
 */
class Base {
  #config = undefined;

  constructor(config = undefined) {
    if (new.target === Base) {
      throw new Error(
        `${this.constructor.name} is an abstract class and cannot be instantiated directly.`
      );
    }

    // remember the configuration object
    this.#config = config;

    // allow overridden method to verify the configuration values
    this.verifyConfig(config);
  }

  /**
   * Throws an error indicating a method must be overridden by a subclass.
   * Call this inside abstract methods.
   *
   * @param {string} methodName - The name of the method to override.
   * @throws {Error}
   */
  requireOverride(methodName) {
    throw new Error(
      `"${this.constructor.name}.${methodName}()" must be implemented by subclass.`
    );
  }

  verifyConfig(config) {
    // override this to implement configuration validation
  }

  get config() {
    return this.#config;
  }
}

module.exports = Base;
