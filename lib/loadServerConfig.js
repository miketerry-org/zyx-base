// loadServerConfig.js:

"use strict";

// load all necessary modules
const system = require("zyx-system");
const { loadEnvFile } = require("zyx-env");
const Schema = require("zyx-schema");

// destructure all needed schema types
const { booleanType, integerType, stringType } = Schema.types;

function loadServerConfig() {
  // attempt to load the encrypted server configuration file
  return loadEnvFile(
    // server configuration is in root of project
    "_server.secret",

    // encryption key must be in process environment variables
    process.env.ENCRYPT_KEY,

    // instanciate,define and pass schema for server configuration
    new Schema({
      db_url: stringType({ min: 1, required: true }),
      log_collection_name: stringType({ min: 1, required: true }),
      log_expiration_days: integerType({ min: 1, max: 365, required: false }),
      log_capped: booleanType({ required: false }),
      log_max_size: integerType({ min: 0, max: 1000, required: false }),
      log_max_docs: integerType({ min: 0, max: 1000000, required: false }),
      rate_limit_minutes: integerType({ min: 0, max: 1440, required: false }),
      rate_limit_requests: integerType({
        min: 0,
        max: 100000,
        required: false,
      }),
      body_limit: stringType({ required: true }),
      static_path: stringType({ min: 1, max: 255, required: true }),
      session_secret: stringType({ min: 1, max: 255, required: true }),
      views_path: stringType({ min: 1, max: 255, required: true }),
      views_default_layout: stringType({ min: 1, max: 255, required: true }),
      views_layouts_path: stringType({ min: 1, max: 255, required: true }),
      views_partials_path: stringType({ min: 1, max: 255, required: true }),
      emails_path: stringType({ min: 1, max: 255, required: true }),
    }),

    // use verbose   logging if in debugging mode
    { verbose: system.isDebugging }
  );
}

module.exports = loadServerConfig;
