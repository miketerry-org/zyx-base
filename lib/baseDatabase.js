// baseDatabase.js

"use strict";

const BaseService = require("./baseService");

/**
 * BaseDatabase is an abstract base class for multi-tenant databases.
 * Each tenant gets its own database connection and set of models.
 *
 * Extend this class for specific database implementations like Mongo, Postgres, etc.
 *
 * @extends BaseService
 */
class BaseDatabase extends BaseService {
  #models;

  /**
   * Constructs a new BaseDatabase instance.
   * @param {object} [tenant] - Optional tenant object with config and context.
   */
  constructor(tenant = undefined) {
    super(tenant);
    this.#models = {};
  }

  /**
   * Abstract method to connect to the database.
   * Must be implemented by subclasses.
   * @abstract
   * @returns {Promise<void>}
   */
  async connect() {
    this.requireOverride("connect");
  }

  /**
   * Abstract method to disconnect from the database.
   * Must be implemented by subclasses.
   * @abstract
   * @returns {Promise<void>}
   */
  async disconnect() {
    this.requireOverride("disconnect");
  }

  /**
   * Registers a model to this database instance.
   * @param {string} name - The model name (e.g., "user").
   * @param {Function} ModelClass - The model class constructor.
   * @throws {Error} If model already exists or ModelClass is invalid.
   */
  registerModel(name, ModelClass) {
    if (this.#models[name]) {
      throw new Error(
        `Model "${name}" is already registered in this database.`
      );
    }

    if (typeof ModelClass !== "function") {
      throw new Error(
        `ModelClass for "${name}" must be a constructor function.`
      );
    }

    const instance = new ModelClass(this); // Pass db instance into model
    this.#models[name] = instance;
  }

  /**
   * Returns a registered model instance.
   * @param {string} name - Name of the model.
   * @returns {*} The model instance.
   * @throws {Error} If model is not registered.
   */
  getModel(name) {
    const model = this.#models[name];
    if (!model) {
      throw new Error(`Model "${name}" not found in database.`);
    }
    return model;
  }

  /**
   * Gets the entire models object.
   * @returns {Object} A map of model names to model instances.
   */
  get models() {
    return this.#models;
  }
}

module.exports = BaseDatabase;
