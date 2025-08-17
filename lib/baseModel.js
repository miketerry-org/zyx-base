// baseModel.js:

"use strict";

// load all necessary modules
const Base = require("./base");

class BaseModel extends Base {
  #tenant;
  #db;
  #name;

  constructor(tenant) {
    super();

    if (!tenant) {
      throw new Error(`"tenant" parameter is missing`);
    }

    if (!tenant.db) {
      throw new Error(
        `Tenant "${
          tenant.site_title || tenant.domain
        }" is missing "database" connection`
      );
    }

    this.#tenant = tenant;
    this.#db = tenant.db;

    // Default name derived from class name: remove "Model" suffix and lowercase
    const className = this.constructor.name;
    const baseName = className.endsWith("Model")
      ? className.slice(0, -5)
      : className;
    this.#name = baseName.toLowerCase();
  }

  get tenant() {
    return this.#tenant;
  }

  get db() {
    return this.#db;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("Model name must be a non-empty string");
    }
    this.#name = value.trim();
  }

  // Abstract interface
  async find(query = {}, projection = {}) {
    this.requireOverride("find");
  }

  async findOne(query = {}) {
    this.requireOverride("findOne");
  }

  async findById(id) {
    this.requireOverride("findById");
  }

  async create(data) {
    this.requireOverride("create");
  }

  async updateById(id, updates) {
    this.requireOverride("updateById");
  }

  async deleteById(id) {
    this.requireOverride("deleteById");
  }
}

module.exports = BaseModel;
