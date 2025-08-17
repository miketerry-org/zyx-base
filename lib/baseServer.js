// baseServer.js:

"use strict";

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
const Base = require("./base");
const middlewares = require("./middlewares");

/**
 * BaseServer provides a secure, extensible foundation for building
 * multi-tenant Express.js applications.
 * @extends Base
 */
class BaseServer extends Base {
  #expressConfig;
  #tenantConfigs;
  #express;
  #tenants;
  #routes;
  #closeStack;
  #domainTenantMap;

  /**
   * Creates a new BaseServer instance.
   * @param {Object} serverConfig - Server configuration options.
   * @param {Array<Object>} tenantConfigs - Array of tenant configuration objects.
   */
  constructor(serverConfig, tenantConfigs) {
    super();

    this.#expressConfig = serverConfig;
    this.#tenantConfigs = tenantConfigs;
    this.#routes = [];
    this.#closeStack = [];

    this.initExpress();
    // Removed duplicate call to this.initTenants();
  }

  /**
   * Initialize the Express app and middleware stack.
   * @private
   */
  initExpress() {
    this.#express = express();

    this.initPoweredBy();
    this.initSecurity();
    this.initCompression();
    this.initCookieParser();
    this.initSession();
    this.initRateLimit();
    this.initTenants(); // Only call once here after express is initialized

    this.initRequestLogger();
    this.initResponseLogger();
    this.initDevelopmentLogging();

    this.initFileUpload();
    this.initStaticFiles();
    this.initSendJSONHelper();
    this.initViewEngine();
    this.initShutdown();
  }

  /**
   * Registers a service on the server or tenants.
   * @param {string} name - Name of the service.
   * @param {function(Object): Promise<any>} createFunc - Async factory function to create service.
   * @param {function} [closeFunc] - Optional close function to cleanup the service.
   * @param {"server"|"tenants"|"both"} apply - Where to apply the service.
   * @returns {Promise<void>}
   * @throws Will throw if `apply` is invalid or if createFunc is not a function.
   */
  async service(name, createFunc, closeFunc, apply) {
    apply = apply?.trim().toLowerCase();
    if (!["server", "tenants", "both"].includes(apply)) {
      throw new Error(
        `"apply" must be "server", "tenants" or "both", but got "${apply}"`
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

      if (typeof instance.connect === "function") {
        await instance.connect();
      }
    };

    if (apply === "server" || apply === "both") {
      await doCreate(this, this.#expressConfig);
    }

    if (apply === "tenants" || apply === "both") {
      await Promise.all(this.#tenants.map(t => doCreate(t, t.config)));
    }
  }

  /**
   * Registers a model class for each tenant.
   * @param {string} name - Model name.
   * @param {Function} modelClass - Constructor function or class for the model.
   * @throws Will throw if modelClass is not a function or if duplicate model name is found.
   */
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

  /**
   * Adds a router to the Express app.
   * @param {string} leadPath - Base path for the router.
   * @param {Function} routerClass - Router class with getRoutes method.
   * @throws Will throw if routerClass is not a function or if unsupported HTTP method is used.
   */
  router(leadPath, routerClass) {
    if (typeof routerClass !== "function") {
      throw new Error(`Router must be a class or constructor function`);
    }

    const routerInstance = new routerClass();
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

  /**
   * Adds a middleware function to the Express app.
   * @param {function} handlerFunc - Middleware function (req, res, next).
   */
  middleware(handlerFunc) {
    this.#express.use(handlerFunc);
  }

  /**
   * Starts the Express server listening on the specified port.
   * @param {number|string} port - Port number or 0 for dynamic port.
   * @param {function(number)} callback - Callback with the bound port number.
   * @throws Will throw if the port is invalid.
   */
  listen(port, callback) {
    const parsedPort = Number(port);
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

  /**
   * Gets the Express app instance.
   * @returns {import("express").Express}
   */
  get express() {
    return this.#express;
  }

  /**
   * Gets the server configuration.
   * @returns {Object}
   */
  get expressConfig() {
    return this.#expressConfig;
  }

  /**
   * Gets the tenants array.
   * @returns {Array<Object>}
   */
  get tenants() {
    return this.#tenants;
  }

  /**
   * Gets the registered routes.
   * @returns {Array<Object>} Routes with method, path, and handler.
   */
  get routes() {
    return this.#routes;
  }

  /**
   * Disables the 'X-Powered-By' header for security.
   * @private
   */
  initPoweredBy() {
    this.#express.disable("x-powered-by");
  }

  /**
   * Enables gzip compression middleware.
   * @private
   */
  initCompression() {
    this.#express.use(compression());
  }

  /**
   * Initializes security-related middleware such as helmet, hpp, CORS, and body parsers.
   * @private
   */
  initSecurity() {
    this.#express.set("trust proxy", 1);
    const limit = this.#expressConfig.body_limit || "10kb";
    this.#express.use(express.json({ limit }));
    this.#express.use(express.urlencoded({ extended: true, limit }));
    this.#express.use(helmet());
    this.#express.use(hpp());
    this.#express.use(cors({}));
  }

  /**
   * Enables cookie parsing middleware.
   * @private
   */
  initCookieParser() {
    this.#express.use(cookieParser());
  }

  /**
   * Sets up session middleware with secure cookie settings.
   * @private
   */
  initSession() {
    const sessionOptions = {
      secret: this.#expressConfig.session_secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: !system.isDevelopment,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 2, // 2 hours
      },
    };
    this.#express.use(session(sessionOptions));
  }

  /**
   * Enables rate limiting middleware based on configuration.
   * @private
   */
  initRateLimit() {
    const limiter = rateLimit({
      windowMs: this.#expressConfig.rate_limit_minutes * 60 * 1000,
      max: this.#expressConfig.rate_limit_requests,
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.#express.use(limiter);
  }

  /**
   * Initializes tenants from configuration and attaches middleware
   * to identify tenant per request based on hostname.
   * @private
   */
  initTenants() {
    this.#tenants = this.#tenantConfigs.map(config => {
      const domains = config.domain
        .split(",")
        .map(d => d.toLowerCase().trim())
        .filter(Boolean);

      return {
        id: config.id,
        node: config.node,
        domains,
        config,
        models: {},
      };
    });

    this.#domainTenantMap = new Map();
    for (const tenant of this.#tenants) {
      for (const domain of tenant.domains) {
        this.#domainTenantMap.set(domain, tenant);
      }
    }

    this.#express.use((req, res, next) => {
      const hostname = req.hostname.toLowerCase().trim();
      const tenant = this.#domainTenantMap.get(hostname);

      if (!tenant) {
        return this.send404Error(hostname, res);
      }

      req.tenant = tenant;
      req.routes = this.routes;

      res.locals = {};
      for (const [key, value] of Object.entries(tenant.config)) {
        if (key.startsWith("site_")) {
          res.locals[key] = value;
        }
      }

      // Optionally comment out in production
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

  /**
   * Adds a middleware for logging requests.
   * @private
   */
  initRequestLogger() {
    this.#express.use(middlewares.requestLogger);
  }

  /**
   * Adds a middleware for logging responses.
   * @private
   */
  initResponseLogger() {
    this.#express.use(middlewares.responseLogger);
  }

  /**
   * Adds morgan request logger middleware in development mode.
   * @private
   */
  initDevelopmentLogging() {
    if (system.isDevelopment) {
      this.#express.use(morgan("dev"));
    }
  }

  /**
   * Enables file upload middleware.
   * @private
   */
  initFileUpload() {
    this.#express.use(
      fileupload({
        createParentPath: true,
        debug: system.isDevelopment,
      })
    );
  }

  /**
   * Serves static files from configured public directory.
   * @private
   */
  initStaticFiles() {
    if (this.#expressConfig.static_root) {
      this.#express.use(
        express.static(this.#expressConfig.static_root, {
          maxAge: 31536000000, // 1 year
          immutable: true,
        })
      );
    }
  }

  /**
   * Adds a helper middleware to send JSON responses consistently.
   * @private
   */
  initSendJSONHelper() {
    this.#express.use((req, res, next) => {
      res.sendJSON = data => {
        res.json(data);
      };
      next();
    });
  }

  /**
   * Sets the view engine if configured.
   * @private
   */
  initViewEngine() {
    if (this.#expressConfig.view_engine) {
      this.#express.set("view engine", this.#expressConfig.view_engine);
    }
  }

  /**
   * Sets up graceful shutdown handlers.
   * @private
   */
  initShutdown() {
    process.on("SIGINT", async () => {
      console.log("SIGINT received: shutting down...");
      await this.close();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      console.log("SIGTERM received: shutting down...");
      await this.close();
      process.exit(0);
    });
  }

  /**
   * Closes all services and models in reverse order of registration.
   * @returns {Promise<void>}
   */
  async close() {
    for (const { instance, closeFunc } of this.#closeStack) {
      try {
        await closeFunc.call(instance);
      } catch (err) {
        console.error("Error closing service/model:", err);
      }
    }
  }

  /**
   * Sends a 404 error response for unknown tenants.
   * @param {string} hostname - Hostname requested.
   * @param {import("express").Response} res - Express response object.
   * @private
   */
  send404Error(hostname, res) {
    res.status(404).send(`Tenant not found for hostname: ${hostname}`);
  }
}

module.exports = BaseServer;
