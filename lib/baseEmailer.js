// baseEmailer.js:

"use strict";

// load all necessary modules
const fs = require("fs");
const Handlebars = require("handlebars");
const EmailMessage = require("./emailMessage");

/**
 * BaseEmailer is an abstract base class that defines the structure and flow for sending emails.
 * Concrete implementations like NodeEmailer or SendGridEmailer should extend this class.
 */
class BaseEmailer {
  constructor() {
    /** @type {Object} */
    this._config = {};
  }

  /**
   * Initialize the emailer with configuration values.
   * @param {Object} config - Configuration options specific to the concrete implementation.
   * @returns {Promise<void>}
   */
  async initialize(config) {
    this._config = config;
  }

  /**
   * Create a new EmailMessage instance bound to this emailer.
   * @returns {EmailMessage}
   */
  createMessage() {
    return new EmailMessage(this);
  }

  /**
   * Send an email message. Subclasses should override this method.
   * This base implementation logs the message if showDetails is true.
   * @param {EmailMessage} message - The email message to send.
   * @param {boolean} [showDetails=false] - Whether to log the full message object.
   * @returns {Promise<{ success: boolean, message: object, info?: string }>}
   */
  async send(message, showDetails = false) {
    if (showDetails) {
      console.log("====== EMAIL MESSAGE ======");
      console.dir(message._message, { depth: null, colors: true });
    }

    return {
      success: false,
      message: message._message,
      info: "Send not implemented in BaseEmailer",
    };
  }
}

module.exports = BaseEmailer;
