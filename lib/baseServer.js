// baseServer.js

"use strict";

// Load required modules
const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const fileupload = require("express-fileupload");
const system = require("zyx-system");

/**
 * BaseServer provides a secure, extensible foundation for building
 * multi-tenant Express.js applications.
 */
class BaseServer {
  #expressConfig;
  #tenantConfigs;
  #express;
  #tenants;
  #routes;
  #closeStack;

  constructor(serverConfig, tenantConfigs) {
    // initialize class fields
    this.#expressConfig = serverConfig;
    this.#tenantConfigs = tenantConfigs;
    this.#routes = [];
    this.#closeStack = [];

    // call method to perform individual initialization of express server features
    this.initExpress();
    this.initTenants();
  }

  async service(name, createFunc, closeFunc, apply) {
    apply = apply?.trim().toLowerCase();
    if (!["server", "tenants", "both"].includes(apply)) {
      throw new Error(
        `"apply" parameter must be "server", "tenants" or "both" but was "${apply}"`
      );
    }

    if (typeof createFunc !== "function") {
      throw new Error(
        `"createFunc" must be a function but got ${typeof createFunc}`
      );
    }

    const doCreate = async (owner, config) => {
      if (owner[name]) {
        const label = owner === this ? "server" : `Tenant "${config.domain}"`;
        throw new Error(`${label} already has property "${name}"`);
      }

      const instance = await createFunc(config);
      if (typeof closeFunc === "function") {
        this.#closeStack.unshift({ instance, closeFunc });
      }
      owner[name] = instance;
    };

    if (apply === "server" || apply === "both") {
      await doCreate(this, this.#expressConfig);
    }

    if (apply === "tenants" || apply === "both") {
      await Promise.all(this.#tenants.map(t => doCreate(t, t.config)));
    }
  }

  async model(name, modelClass) {
    if (typeof modelClass !== "function") {
      throw new Error(
        `Model "${name}" must be a class or constructor function`
      );
    }

    for (const tenant of this.#tenants) {
      if (tenant.models[name]) {
        throw new Error(
          `Duplicate model "${name}" for tenant "${tenant.domain}"`
        );
      }

      const instance = new modelClass(tenant);
      tenant.models[name] = instance;

      if (typeof instance.close === "function") {
        this.#closeStack.unshift({ instance, closeFunc: instance.close });
      }
    }
  }

  router(leadPath, routerInstance) {
    const expressRouter = express.Router();
    const routes = routerInstance.getRoutes();

    for (const { method, path, handler } of routes) {
      const lowerMethod = method.toLowerCase();

      if (typeof expressRouter[lowerMethod] !== "function") {
        throw new Error(`Unsupported HTTP method "${method}"`);
      }

      expressRouter[lowerMethod](path, handler);

      this.#routes.push({
        method,
        path: leadPath + path,
        handler,
      });
    }

    this.#express.use(leadPath, expressRouter);
  }

  middleware(handlerFunc) {
    this.#express.use(handlerFunc);
  }

  listen(port, callback) {
    const parsedPort = Number(port);

    // Allow port 0 (magic value) OR ports between 1000 and 65000
    const isValidPort =
      Number.isInteger(parsedPort) &&
      (parsedPort === 0 || (parsedPort >= 1000 && parsedPort <= 65000));

    if (!isValidPort) {
      throw new Error(
        `"PORT" is "${port}" but must be 0 or an integer between 1000 and 65000`
      );
    }

    this.#express.listen(parsedPort, () => {
      callback(parsedPort);
    });
  }

  get express() {
    return this.#express;
  }

  get expressConfig() {
    return this.#expressConfig;
  }

  get tenants() {
    return this.#tenants;
  }

  get routes() {
    return this.#routes;
  }

  initExpress() {
    this.#express = express();
    this.initPoweredBy();
    this.initCompression();
    this.initSecurity();
    this.initCookieParser();
    this.initDevelopmentLogging();
    this.initFileUpload();
    this.initStaticFiles();
    this.initSession();
    this.initRateLimit();
    this.initRequestLogger();
    this.initViewEngine();
    this.initSendJSONHelper();
    this.initShutdown();
  }

  initPoweredBy() {
    // Disable 'X-Powered-By' Header
    this.#express.disable("x-powered-by");
  }

  initCompression() {
    this.#express.use(compression());
  }
  initTenants() {
    this.#tenants = this.#tenantConfigs.map(config => ({
      id: config.id,
      node: config.node,
      domain: config.domain.toLowerCase().trim(),
      config,
      models: {},
    }));

    this.#express.use((req, res, next) => {
      const hostname = req.hostname.toLowerCase().trim();
      const tenant = this.#tenants.find(t => t.domain === hostname);
      if (!tenant) {
        return this.send404Error(hostname, res);
      }

      req.tenant = tenant;
      req.routes = this.routes;

      // dynamically assign all config properties starting with "site_" to res.locals
      res.locals = {};
      for (const [key, value] of Object.entries(tenant.config)) {
        if (key.startsWith("site_")) {
          res.locals[key] = value;
        }
      }
      console.log("res.locals", res.locals);

      tenant.metrics ??= {
        totalRequests: 0,
        totalErrors: 0,
        startTime: tenant.metrics?.startTime ?? new Date(),
        routes: {},
      };

      const metrics = tenant.metrics;
      const routeKey = `${req.method} ${req.path}`;
      const routeStats = (metrics.routes[routeKey] ??= {
        count: 0,
        totalTimeMs: 0,
      });

      const start = performance.now();

      res.on("finish", () => {
        const duration = performance.now() - start;
        metrics.totalRequests++;
        routeStats.count++;
        routeStats.totalTimeMs += duration;

        if (res.statusCode >= 400) {
          metrics.totalErrors++;
        }
      });

      next();
    });
  }

  initSecurity() {
    this.#express.set("trust proxy", 1);
    const limit = this.#expressConfig.body_limit || "10kb";
    this.#express.use(express.json({ limit }));
    this.#express.use(express.urlencoded({ extended: true, limit }));
    this.#express.use(helmet());
    this.#express.use(hpp());
    this.#express.use(cors({}));
  }

  initCookieParser() {
    this.#express.use(cookieParser());
  }

  initDevelopmentLogging() {
    if (system.isDevelopment) {
      this.#express.use(morgan("dev"));
    }
  }

  initFileUpload() {
    this.#express.use(fileupload());
  }

  initStaticFiles() {
    this.#express.use(
      express.static(this.#expressConfig.static_path, {
        maxAge: "1y",
        etag: true,
      })
    );
  }

  initSession() {
    const sessionOptions = {
      secret: this.#expressConfig.session_secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: !system.isDevelopment,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 2,
      },
    };
    this.#express.use(session(sessionOptions));
  }

  initRateLimit() {
    const limiter = rateLimit({
      windowMs: this.#expressConfig.rate_limit_minutes * 60 * 1000,
      max: this.#expressConfig.rate_limit_requests,
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.#express.use(limiter);
  }

  initRequestLogger() {
    this.#express.use((req, res, next) => {
      console.info("[request]");
      console.info(`${req.method} ${req.url}`);
      next();
    });
  }

  initViewEngine() {
    // overridden by ddescendant to implement  desired view engine
  }

  initSendJSONHelper() {
    this.#express.use((req, res, next) => {
      res.sendJSON = (code, data = {}, errors = []) => {
        const ok = code >= 200 && code <= 299;
        return res.status(code).json({ ok, data, errors });
      };
      next();
    });
  }

  initShutdown() {
    const shutdown = async () => {
      console.log("BaseServer: Shutdown initiated...");

      for (const { instance, closeFunc } of this.#closeStack) {
        try {
          console.log(
            `BaseServer: Closing service ${
              instance.constructor.name || "[anonymous]"
            }`
          );
          await closeFunc.call(instance);
        } catch (err) {
          console.warn(
            `BaseServer: Error while closing ${
              instance.constructor.name || "[anonymous]"
            }:`,
            err
          );
        }
      }

      console.log("BaseServer: Shutdown complete. Exiting.");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    process.on("unhandledRejection", reason => {
      console.error("BaseServer: Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", err => {
      console.error("BaseServer: Uncaught Exception:", err);
    });
  }

  send404Error(hostname, res) {
    res.status(404).json({
      error: "Tenant not found",
      domain: hostname,
    });
  }

  init404Error() {
    this.notImplemented("init404Error");
  }

  initErrorHandler() {
    // this.notImplemented("initErrorHandler");
  }

  notImplemented(methodName) {
    throw new Error(
      `The "${methodName}" method must be overridden by a descendant class`
    );
  }
}

module.exports = BaseServer;
