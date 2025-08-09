// middlewares.js:

"use strict";

/**
 * Middleware to measure and log the size of outbound HTTP responses.
 *
 * - Measures and logs total size of headers and response body (before encryption).
 *
 * @function responseSizeLogger
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function responseLogger(req, res, next) {
  // Accumulate total number of bytes written to response body
  let responseBodySize = 0;

  // Store original write and end methods
  const originalWrite = res.write;
  const originalEnd = res.end;

  // Intercept and wrap res.write() to measure body chunk sizes
  res.write = function (chunk, encoding, callback) {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        responseBodySize += chunk.length;
      } else {
        responseBodySize += Buffer.byteLength(chunk, encoding);
      }
    }
    return originalWrite.call(res, chunk, encoding, callback);
  };

  // Intercept and wrap res.end() to finalize measurement and log result
  res.end = function (chunk, encoding, callback) {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        responseBodySize += chunk.length;
      } else {
        responseBodySize += Buffer.byteLength(chunk, encoding);
      }
    }

    // Convert response headers to a string
    const headers = res.getHeaders();
    const headerString = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");

    // Measure size of headers
    const headersSize = Buffer.byteLength(headerString, "utf8");

    // Calculate total payload size
    const totalSize = headersSize + responseBodySize;

    // Log detailed size breakdown
    console.log(
      `[RESPONSE] Size: Headers=${headersSize} bytes, Body=${responseBodySize} bytes, Total=${totalSize} bytes`
    );

    return originalEnd.call(res, chunk, encoding, callback);
  };

  // Continue to next middleware
  next();
}

/**
 * Middleware that logs incoming HTTP requests and their duration.
 *
 * Logs the HTTP method, URL, and total response time in milliseconds.
 *
 * @function requestLogger
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requestLogger(req, res, next) {
  // Record high-resolution start time
  const start = process.hrtime.bigint();

  console.info("[request]");
  console.info(`${req.method} ${req.url}`);

  // Hook into response finish event
  res.on("finish", () => {
    // Calculate elapsed time in milliseconds
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    console.info(
      `[response] Status: ${res.statusCode} - Duration: ${durationMs.toFixed(
        2
      )} ms`
    );
  });

  // Continue to next middleware
  next();
}

/**
 * Middleware that adds a standardized JSON response helper to the response object.
 *
 * Adds `res.sendJSON(code, data, errors)` to simplify and standardize API responses.
 * The helper constructs a consistent response shape:
 * {
 *   ok: boolean,     // true if status code is 2xx
 *   data: object,    // optional response data
 *   errors: array    // optional array of error messages
 * }
 *
 * @function sendJSONHelper
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function sendJSONHelper(req, res, next) {
  res.sendJSON = (code, data = {}, errors = []) => {
    const ok = code >= 200 && code <= 299;
    return res.status(code).json({ ok, data, errors });
  };
  next();
}

// Export middlewares
module.exports = {
  requestLogger,
  responseLogger,
  sendJSONHelper,
};
