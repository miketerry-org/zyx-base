"use strict";

/**
 * @module base
 */

/**
 * Represents an abstract base class that cannot be instantiated directly.
 * Subclasses must implement required methods.
 */
class Base {
  constructor() {
    if (new.target === Base) {
      throw new Error(
        `${this.constructor.name} is an abstract class and cannot be instantiated directly.`
      );
    }
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
}

module.exports = Base;
