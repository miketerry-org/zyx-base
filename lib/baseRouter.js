// BaseRouter.js:

"use strict";

// load all necessary modules
const Base = require("./base");

class BaseRouter extends Base {
  constructor() {
    super();

    this._routes = [];
    this.define();
  }

  define() {
    this.requireOverride("define");
  }

  route(method, path, handler) {
    this._routes.push({ method: method.toUpperCase(), path, handler });
  }

  get(path, handler) {
    this.route("GET", path, handler);
  }

  post(path, handler) {
    this.route("POST", path, handler);
  }

  put(path, handler) {
    this.route("PUT", path, handler);
  }

  patch(path, handler) {
    this.route("PATCH", path, handler);
  }

  delete(path, handler) {
    this.route("DELETE", path, handler);
  }

  getRoutes() {
    return this._routes;
  }
}

module.exports = BaseRouter;
