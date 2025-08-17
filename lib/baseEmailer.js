// baseEmailer.js:

"use strict";

/**
 * @module baseEmailer
 */

// load all necessary modules
const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");
const Base = require("./base");

/**
 * Represents a single email address with optional display name.
 */
class Address {
  #email;
  #name;

  /**
   * Creates an Address instance.
   * @param {string} email - The email address.
   * @param {string} [name] - Optional display name.
   */
  constructor(email, name = undefined) {
    this.#email = email;
    this.#name = name;
  }

  /** @type {string} */
  get email() {
    return this.#email;
  }

  /** @param {string} value */
  set email(value) {
    this.#email = value;
  }

  /** @type {string | undefined} */
  get name() {
    return this.#name;
  }

  /** @param {string | undefined} value */
  set name(value) {
    this.#name = value;
  }

  /**
   * Returns formatted string: "Name <email>" or just "email".
   * @returns {string}
   */
  toString() {
    return this.#name ? `${this.#name} <${this.#email}>` : this.#email;
  }
}

/**
 * Represents a collection of email addresses.
 */
class Addresses {
  #list;

  constructor() {
    this.#list = [];
  }

  /**
   * Adds an address to the list.
   * @param {string} email - Email address.
   * @param {string} [name] - Display name.
   */
  add(email, name = undefined) {
    this.#list.push(new Address(email, name));
  }

  /**
   * Gets the number of addresses.
   * @returns {number}
   */
  length() {
    return this.#list.length;
  }

  /**
   * Clears the address list.
   */
  reset() {
    this.#list = [];
  }

  /**
   * Returns a comma-separated string of formatted addresses.
   * @returns {string}
   */
  toString() {
    return this.#list.map(addr => addr.toString()).join(", ");
  }

  /**
   * Converts to an array suitable for nodemailer/sendgrid formats.
   * @returns {(string | { name: string, address: string })[]}
   */
  toArray() {
    return this.#list.map(addr =>
      addr.name ? { name: addr.name, address: addr.email } : addr.email
    );
  }
}

/**
 * Base class for emailers. Includes support for Handlebars templates.
 */
class BaseEmailer extends Base {
  #config;
  #transport;
  #from;
  #toList;
  #ccList;
  #bccList;
  #subject;
  #textBody;
  #textTemplate;
  #htmlBody;
  #htmlTemplate;
  #fileList;

  /**
   * @param {object} config - Configuration object for the emailer.
   */
  constructor(config) {
    super();

    if (typeof config !== "object") {
      throw new Error(
        `"${this.constructor.name}" must be passed a configuration object!`
      );
    }
    this.#config = config;
    this.verifyConfig();
    this.reset();
  }

  /** @type {object} */
  get config() {
    return this.#config;
  }

  /** @type {object} */
  get Transport() {
    if (!this.#transport) {
      throw new Error(
        `The "createTransport" method must be called and it must assign the "transport" property.`
      );
    }
    return this.#transport;
  }

  /** @param {object} value */
  set transport(value) {
    if (typeof value !== "object") {
      throw new Error(`Must assign a valid email transport object!`);
    }
    this.#transport = value;
  }

  /**
   * Abstract method. Should be overridden to create and assign a transport.
   * @returns {Promise<void>}
   */
  async createTransport() {
    this.requireOverride("createTransport");
  }

  /**
   * Override in child classes to validate config.
   */
  verifyConfig() {
    this.requireOverride("verifyConfig");
  }

  /**
   * Resets message-specific fields.
   * @returns {BaseEmailer}
   */
  reset() {
    this.#from = undefined;
    this.#toList = undefined;
    this.#ccList = undefined;
    this.#bccList = undefined;
    this.#subject = undefined;
    this.#textBody = undefined;
    this.#textTemplate = undefined;
    this.#htmlBody = undefined;
    this.#htmlTemplate = undefined;
    this.#fileList = undefined;
    return this;
  }

  /**
   * Sets the sender address.
   * @param {Address} value
   * @returns {BaseEmailer}
   */
  from(value) {
    this.#from = value;
    return this;
  }

  /** @private */
  #addToList(list, email, name = "") {
    if (!list) {
      list = new Addresses();
    }
    list.add(email, name);
    return list;
  }

  /**
   * Adds a recipient to the "To" list.
   * @param {string} email
   * @param {string} [name]
   * @returns {BaseEmailer}
   */
  to(email, name = "") {
    this.#toList = this.#addToList(this.#toList, email, name);
    return this;
  }

  /**
   * Adds a recipient to the "Cc" list.
   * @param {string} email
   * @param {string} [name]
   * @returns {BaseEmailer}
   */
  cc(email, name = "") {
    this.#ccList = this.#addToList(this.#ccList, email, name);
    return this;
  }

  /**
   * Adds a recipient to the "Bcc" list.
   * @param {string} email
   * @param {string} [name]
   * @returns {BaseEmailer}
   */
  bcc(email, name = "") {
    this.#bccList = this.#addToList(this.#bccList, email, name);
    return this;
  }

  /**
   * Sets the email subject.
   * @param {string} value
   * @returns {BaseEmailer}
   */
  subject(value) {
    this.#subject = value;
    return this;
  }

  /**
   * Sets raw HTML body.
   * @param {string} value
   * @returns {BaseEmailer}
   */
  htmlBody(value) {
    this.#htmlBody = value;
    return this;
  }

  /**
   * Sets HTML template path.
   * @param {string} value
   * @returns {BaseEmailer}
   */
  htmlTemplate(value) {
    this.#htmlTemplate = value;
    return this;
  }

  /**
   * Sets plain text body.
   * @param {string} value
   * @returns {BaseEmailer}
   */
  textBody(value) {
    this.#textBody = value;
    return this;
  }

  /**
   * Sets plain text template path.
   * @param {string} value
   * @returns {BaseEmailer}
   */
  textTemplate(value) {
    this.#textTemplate = value;
    return this;
  }

  /**
   * Adds an attachment to the email.
   * @param {object} value - The file/attachment object.
   * @returns {BaseEmailer}
   */
  addFile(value) {
    if (!this.#fileList) {
      this.#fileList = [];
    }
    this.#fileList.push(value);
    return this;
  }

  /**
   * Abstract method to send the email.
   * @param {object} data - Template context data.
   * @returns {Promise<void>}
   */
  async send(data = {}) {
    this.requireOverride("send");
  }

  /**
   * Builds and renders the message object with all parts.
   * @param {object} [data={}] - Template rendering context.
   * @returns {Promise<object>} - Email message object.
   */
  async buildMessageObject(data = {}) {
    if (!this.#from || this.#from.toString().trim() === "") {
      throw new Error(`Email message must have a sender!`);
    }

    if (!this.#toList || this.#toList.length() === 0) {
      throw new Error(`Email message must have one or more recipients.`);
    }

    if (!this.#subject || this.#subject.toString().trim() === "") {
      throw new Error(`Email message must have a subject`);
    }

    const text = this.#textTemplate
      ? await this.#renderTemplateFile(this.#textTemplate, data)
      : await this.#renderTemplateString(this.#textBody, data);

    const html = this.#htmlTemplate
      ? await this.#renderTemplateFile(this.#htmlTemplate, data)
      : await this.#renderTemplateString(this.#htmlBody, data);

    if (text.trim() === "" && html.trim() === "") {
      throw new Error(`Email message must have either a text or html body!`);
    }

    const msg = {
      from: this.#from.toString(),
      to: this.#toList.toArray(),
      cc: this.#ccList?.length() ? this.#ccList.toArray() : undefined,
      bcc: this.#bccList?.length() ? this.#bccList.toArray() : undefined,
      subject: this.#subject.trim(),
      text,
      html,
      attachments: this.#fileList,
    };

    return msg;
  }

  /**
   * Renders a Handlebars template from file with provided context.
   * @private
   * @param {string} filePath - Template file path.
   * @param {object} data - Template data context.
   * @returns {Promise<string>}
   */
  async #renderTemplateFile(filePath, data = {}) {
    try {
      const fullPath = this.#config?.Emails_path
        ? path.join(this.#config.Emails_path, filePath)
        : filePath;
      const absPath = path.resolve(fullPath);
      const templateContent = await fs.readFile(absPath, "utf-8");
      const template = handlebars.compile(templateContent);
      return template(data);
    } catch (err) {
      throw new Error(
        `Failed to render template "${filePath}": ${err.message}`
      );
    }
  }

  /**
   * Compiles and renders a Handlebars inline string.
   * @private
   * @param {string} source - Template source string.
   * @param {object} data - Context data.
   * @returns {Promise<string>}
   */
  async #renderTemplateString(source, data = {}) {
    try {
      const template = handlebars.compile(source || "");
      return template(data);
    } catch (err) {
      throw new Error(
        `Failed to render inline template string: ${err.message}`
      );
    }
  }
}

module.exports = BaseEmailer;
