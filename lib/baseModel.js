// baseModel.js:

"use strict";

class BaseModel {
  #tenant;
  #db;
  #name;

  constructor(tenant) {
    if (!tenant) {
      throw new Error(`"tenant" parameter is missing`);
    }

    if (!tenant.db) {
      throw new Error(
        `Tenant "${
          tenant.site_title || tenant.domain
        }" is missing "db" connection`
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
    throw new Error("find() not implemented");
  }

  async findOne(query = {}) {
    throw new Error("findOne() not implemented");
  }

  async findById(id) {
    throw new Error("findById() not implemented");
  }

  async create(data) {
    throw new Error("create() not implemented");
  }

  async updateById(id, updates) {
    throw new Error("updateById() not implemented");
  }

  async deleteById(id) {
    throw new Error("deleteById() not implemented");
  }
}

module.exports = BaseModel;
