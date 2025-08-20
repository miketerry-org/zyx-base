// baseService.js:

"use strict";

// Load required base class
const Base = require("./base");

/**
 * Abstract base class for services that require a connection (e.g., databases, loggers, APIs).
 * Inherits configuration logic from Base and adds support for connection lifecycle and identity.
 *
 * Subclasses must implement the `connect()` and `disconnect()` methods.
 *
 * @extends Base
 */
class BaseService extends Base {
  #tenant;
  #connection;

  /**
   * Creates a new service instance.
   *
   * @param {object} [tenant] - Optional tenant object with shape { config: object, ... }.
   */
  constructor(tenant = undefined) {
    // Always pass a config object to the base class
    super(tenant?.config ?? {});
    this.#tenant = tenant;
    this.#connection = undefined;
  }

  /**
   * Returns the tenant object associated with this service.
   *
   * @returns {object|undefined} The tenant object, if defined.
   */
  get tenant() {
    return this.#tenant;
  }

  /**
   * Abstract method to establish a connection for the service.
   * Subclasses must override this method.
   *
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented in subclass.
   */
  async connect() {
    this.requireOverride("connect");
  }

  /**
   * Abstract method to disconnect or clean up the service.
   * Subclasses must override this method.
   *
   * @abstract
   * @returns {Promise<void>}
   * @throws {Error} If not implemented in subclass.
   */
  async disconnect() {
    this.requireOverride("disconnect");
  }

  /**
   * Gets the active connection object associated with this service.
   *
   * @returns {*} The current connection instance.
   */
  get connection() {
    return this.#connection;
  }

  /**
   * Sets the active connection object for this service.
   *
   * @param {*} value - The connection object (e.g., DB connection, client instance).
   */
  setConnection(value) {
    this.#connection = value;
  }
}

module.exports = BaseService;
