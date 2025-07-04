// BaseRouter.js:

"use strict";

class BaseRouter {
  constructor() {
    this._routes = [];
    this.define();
  }

  define() {
    throw new Error(`"define()" must be implemented in subclass`);
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
