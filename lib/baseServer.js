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
const middlewares = require("./middlewares");

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
  #domainTenantMap;

  constructor(serverConfig, tenantConfigs) {
    this.#expressConfig = serverConfig;
    this.#tenantConfigs = tenantConfigs;
    this.#routes = [];
    this.#closeStack = [];

    this.initExpress();
    this.initTenants();
  }

  initExpress() {
    this.#express = express();

    this.initPoweredBy(); // Disable X-Powered-By header
    this.initSecurity(); // Body parsers, helmet, hpp, CORS
    this.initCompression(); // Gzip compression after parsing
    this.initCookieParser(); // Parse cookies before sessions
    this.initSession(); // Setup sessions
    this.initRateLimit(); // Throttle abusive clients
    this.initTenants(); // Assign tenant from hostname

    this.initRequestLogger(); // Log method/path and start time
    this.initResponseLogger(); // Track response size/timing
    this.initDevelopmentLogging(); // Log more verbosely in dev mode

    this.initFileUpload(); // Enable multipart file uploads
    this.initStaticFiles(); // Serve public assets
    this.initSendJSONHelper(); // Add res.sendJSON helper
    this.initViewEngine(); // Placeholder: override for rendering
    this.initShutdown(); // Graceful shutdown & error traps
  }

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

  middleware(handlerFunc) {
    this.#express.use(handlerFunc);
  }

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

  initPoweredBy() {
    this.#express.disable("x-powered-by");
  }

  initCompression() {
    this.#express.use(compression()); // Gzip by default
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

  initRateLimit() {
    const limiter = rateLimit({
      windowMs: this.#expressConfig.rate_limit_minutes * 60 * 1000,
      max: this.#expressConfig.rate_limit_requests,
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.#express.use(limiter);
  }

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

    // define middleware used to setup tenant for each request
    this.#express.use((req, res, next) => {
      // Normalize and extract hostname
      const hostname = req.hostname.toLowerCase().trim();

      // Lookup tenant by hostname
      const tenant = this.#domainTenantMap.get(hostname);

      // If tenant not found, send 404 error
      if (!tenant) {
        return this.send404Error(hostname, res);
      }

      // Attach tenant object and shared routes to request
      req.tenant = tenant;
      req.routes = this.routes;

      // Initialize res.locals and copy tenant config values starting with "site_"
      res.locals = {};
      for (const [key, value] of Object.entries(tenant.config)) {
        if (key.startsWith("site_")) {
          res.locals[key] = value;
        }
      }

      // Optional: Log res.locals for debugging
      console.log("res.locals", res.locals);

      // Initialize tenant-wide metrics if missing
      tenant.metrics ??= {
        totalRequests: 0,
        totalErrors: 0,
        startTime: tenant.metrics?.startTime ?? new Date(),
        routes: {},
      };

      const metrics = tenant.metrics;

      // Create a route key for the current method + path
      const routeKey = `${req.method} ${req.path}`;

      // Initialize route-specific metrics if missing
      const routeStats = (metrics.routes[routeKey] ??= {
        count: 0,
        totalTimeMs: 0,
      });

      // Start timer to measure request duration
      const start = performance.now();

      // Track when response is finished
      res.on("finish", () => {
        // Calculate request duration
        const duration = performance.now() - start;

        // Increment total and per-route request counters
        metrics.totalRequests++;
        routeStats.count++;
        routeStats.totalTimeMs += duration;

        // Count errors based on status code
        if (res.statusCode >= 400) {
          metrics.totalErrors++;
        }
      });

      // Continue to next middleware
      next();
    });
  }

  initRequestLogger() {
    this.#express.use(middlewares.requestLogger);
  }

  initResponseLogger() {
    this.#express.use(middlewares.responseLogger);
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

  initSendJSONHelper() {
    this.#express.use(middlewares.sendJSONHelper);
  }

  initViewEngine() {
    // To be overridden by child class
  }

  initShutdown() {
    const shutdown = async () => {
      console.log("BaseServer: Shutdown initiated...");

      for (const { instance, closeFunc } of this.#closeStack) {
        try {
          console.log(
            `BaseServer: Closing ${instance.constructor.name || "[anonymous]"}`
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
