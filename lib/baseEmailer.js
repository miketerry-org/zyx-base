// baseEmailer.js:

"use strict";

// load all necessary modules
const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");

/**
 * Represents a single email address with optional display name.
 */
class Address {
  #email;
  #name;

  /**
   * @param {string} email - The email address.
   * @param {string} [name] - Optional display name.
   */
  constructor(email, name = undefined) {
    this.#email = email;
    this.#name = name;
  }

  get email() {
    return this.#email;
  }

  set email(value) {
    this.#email = value;
  }

  get name() {
    return this.#name;
  }

  set name(value) {
    this.#name = value;
  }

  /**
   * Returns formatted string: "Name <email>" or just "email"
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
   * @param {string} email
   * @param {string} [name]
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
class BaseEmailer {
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

  constructor() {
    this.reset();
  }

  /**
   * Resets message-specific properties (not config).
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
  }

  /** @returns {Address} */
  get from() {
    if (!this.#from) {
      this.#from = new Address("", "");
    }
    return this.#from;
  }

  /** @param {Address} value */
  set from(value) {
    this.#from = value;
  }

  /** @returns {Addresses} */
  get toList() {
    if (!this.#toList) {
      this.#toList = new Addresses();
    }
    return this.#toList;
  }

  /** @returns {Addresses} */
  get ccList() {
    if (!this.#ccList) {
      this.#ccList = new Addresses();
    }
    return this.#ccList;
  }

  /** @returns {Addresses} */
  get bccList() {
    if (!this.#bccList) {
      this.#bccList = new Addresses();
    }
    return this.#bccList;
  }

  /** @returns {string} */
  get subject() {
    return this.#subject || "";
  }

  /** @param {string} value */
  set subject(value) {
    this.#subject = value;
  }

  /** @returns {string} */
  get htmlBody() {
    return this.#htmlBody || "";
  }

  /** @param {string} value */
  set htmlBody(value) {
    this.#htmlBody = value;
  }

  /** @returns {string} */
  get htmlTemplate() {
    return this.#htmlTemplate || "";
  }

  /** @param {string} value */
  set htmlTemplate(value) {
    this.#htmlTemplate = value;
  }

  /** @returns {string} */
  get textBody() {
    return this.#textBody || "";
  }

  /** @param {string} value */
  set textBody(value) {
    this.#textBody = value;
  }

  /** @returns {string} */
  get textTemplate() {
    return this.#textTemplate || "";
  }

  /** @param {string} value */
  set textTemplate(value) {
    this.#textTemplate = value;
  }

  /** @returns {Array<object>} */
  get fileList() {
    if (!this.#fileList) {
      this.#fileList = [];
    }
    return this.#fileList;
  }

  /**
   * Method to be overridden by subclass (NodeEmailer, SendGridEmailer, etc.)
   * @param {object} data - Template context data
   * @returns {Promise<void>}
   */
  async send(data) {
    throw new Error(
      `The "${this.constructor.name}.send" method must be implemented.`
    );
  }

  /**
   * Builds and renders the full message content (subject, text, html, etc.).
   * @param {object} [data={}] - Data context for template rendering.
   * @returns {Promise<object>} - Fully rendered message object.
   */
  async buildMessageObject(data = {}) {
    const text = this.textTemplate
      ? await this.#renderTemplateFile(this.textTemplate, data)
      : await this.#renderTemplateString(this.textBody, data);

    const html = this.htmlTemplate
      ? await this.#renderTemplateFile(this.htmlTemplate, data)
      : await this.#renderTemplateString(this.htmlBody, data);

    return {
      from: this.from.toString(),
      to: this.toList.toArray(),
      cc: this.ccList.length() ? this.ccList.toArray() : undefined,
      bcc: this.bccList.length() ? this.bccList.toArray() : undefined,
      subject: this.subject,
      text,
      html,
      attachments: this.fileList,
    };
  }

  /**
   * Reads and renders a Handlebars template file with provided data.
   * @param {string} filePath - Path to the template file.
   * @param {object} data - Data to inject into the template.
   * @returns {Promise<string>} - Rendered result.
   */
  async #renderTemplateFile(filePath, data = {}) {
    try {
      const absPath = path.resolve(filePath);
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
   * Compiles and renders a Handlebars string using provided data.
   * @param {string} source - Raw Handlebars text.
   * @param {object} data - Context for rendering.
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

module.exports = {
  Address,
  Addresses,
  BaseEmailer,
};
