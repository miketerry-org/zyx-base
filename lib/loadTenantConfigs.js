// loadTenantConfigs.js:

"use strict";

// load all necessary modules
const system = require("zyx-system");
const { loadEnvFiles } = require("zyx-env");
const Schema = require("zyx-schema");

// destructure all needed schema types
const { booleanType, integerType, stringType } = Schema.types;

function loadTenantConfigs() {
  return loadEnvFiles(
    // the folder and file mask for tenant configuration files
    "_tenants/*.secret",

    // the encryption key for cnfiguration files
    process.env.ENCRYPT_KEY,

    //instanciate schema used to validate each tenant configuration
    new Schema({
      id: integerType({ min: 1, max: 1000000, required: true }),
      node: integerType({ min: 1, max: 1000, required: true }),
      domain: stringType({ min: 1, max: 255, required: true }),
      db_url: stringType({ min: 1, max: 255, required: true }),
      log_collection_name: stringType({ min: 1, required: true }),
      log_expiration_days: integerType({ min: 1, max: 365, required: false }),
      log_capped: booleanType({ required: false }),
      log_max_size: integerType({ min: 0, max: 1000, required: false }),
      log_max_docs: integerType({ min: 0, max: 1000000, required: false }),
      site_title: stringType({ min: 1, max: 255, required: true }),
      site_slogan: stringType({ min: 1, max: 255, required: true }),
      site_owner: stringType({ min: 1, max: 255, required: true }),
      site_author: stringType({ min: 1, max: 255, required: true }),
      site_copyright: integerType({ min: 2025, max: 2100, requited: true }),
      site_support_email: stringType({ min: 1, max: 255, required: true }),
      site_support_url: stringType({ min: 1, max: 255, required: true }),
      smtp_host: stringType({ min: 1, max: 255, required: true }),
      smtp_port: integerType({ min: 1, max: 65000, required: true }),
      smtp_secure: booleanType({ required: true }),
      smtp_username: stringType({ min: 1, max: 255, required: true }),
      smtp_password: stringType({ min: 1, max: 255, required: true }),
    }),

    // use verbose logging if not in production mode
    { verbose: system.isDebugging }
  );
}

module.exports = loadTenantConfigs;
