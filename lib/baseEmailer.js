// baseEmailer.js:

"use strict";

/**
 * @module baseEmailer
 */

const fs = require("fs").promises;
const path = require("path");
const handlebars = require("handlebars");
const BaseService = require("./baseService");

/**
 * Represents a single email address with optional display name.
 */
class Address {
  #email;
  #name;

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

  toString() {
    return this.#name ? `${this.#name} <${this.#email}>` : this.#email;
  }
}

/**
 * Represents a collection of email addresses.
 */
class Addresses {
  #list = [];

  add(email, name = undefined) {
    if (!email || typeof email !== "string") {
      throw new Error("Email must be a non-empty string.");
    }
    this.#list.push(new Address(email, name));
  }

  length() {
    return this.#list.length;
  }

  reset() {
    this.#list = [];
  }

  toString() {
    return this.#list.map(addr => addr.toString()).join(", ");
  }

  toArray() {
    return this.#list.map(addr =>
      addr.name ? { name: addr.name, address: addr.email } : addr.email
    );
  }
}

/**
 * Abstract base class for emailers with support for message composition and Handlebars templates.
 * Subclasses must implement transport creation and sending logic.
 *
 * @extends BaseService
 */
class BaseEmailer extends BaseService {
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

  constructor(tenant = undefined) {
    super(tenant);
    this.reset();
  }

  get Transport() {
    if (!this.#transport) {
      throw new Error(`Transport not initialized. Call "connect()" first.`);
    }
    return this.#transport;
  }

  set transport(value) {
    if (typeof value !== "object") {
      throw new Error(`Transport must be a valid object`);
    }
    this.#transport = value;
  }

  /**
   * Resets all message-related fields to defaults.
   */
  reset() {
    this.#from = undefined;
    this.#toList = new Addresses();
    this.#ccList = new Addresses();
    this.#bccList = new Addresses();
    this.#subject = undefined;
    this.#textBody = undefined;
    this.#textTemplate = undefined;
    this.#htmlBody = undefined;
    this.#htmlTemplate = undefined;
    this.#fileList = [];
    return this;
  }

  from(value) {
    this.#from = value;
    return this;
  }

  to(email, name = "") {
    this.#toList = this.#addToList(this.#toList, email, name);
    return this;
  }

  cc(email, name = "") {
    this.#ccList = this.#addToList(this.#ccList, email, name);
    return this;
  }

  bcc(email, name = "") {
    this.#bccList = this.#addToList(this.#bccList, email, name);
    return this;
  }

  subject(value) {
    this.#subject = value;
    return this;
  }

  htmlBody(value) {
    this.#htmlBody = value;
    return this;
  }

  htmlTemplate(value) {
    this.#htmlTemplate = value;
    return this;
  }

  textBody(value) {
    this.#textBody = value;
    return this;
  }

  textTemplate(value) {
    this.#textTemplate = value;
    return this;
  }

  addFile(value) {
    this.#fileList.push(value);
    return this;
  }

  /**
   * Abstract method to send the email.
   * Subclasses must implement the actual delivery logic.
   *
   * @abstract
   * @param {object} [data={}] - Data to inject into templates.
   * @returns {Promise<void>}
   */
  async send(data = {}) {
    this.requireOverride("send");
  }

  /**
   * Builds the message object using configured values and optional template rendering.
   * @param {object} [data={}] - Optional data for handlebars templates.
   * @returns {Promise<object>} Resolved message object.
   */
  async buildMessageObject(data = {}) {
    if (!this.#from || this.#from.toString().trim() === "") {
      throw new Error(`Email message must have a sender.`);
    }

    if (!this.#toList || this.#toList.length() === 0) {
      throw new Error(`Email message must have at least one recipient.`);
    }

    if (!this.#subject || this.#subject.toString().trim() === "") {
      throw new Error(`Email message must have a subject.`);
    }

    const text = this.#textTemplate
      ? await this.#renderTemplateFile(this.#textTemplate, data)
      : await this.#renderTemplateString(this.#textBody, data);

    const html = this.#htmlTemplate
      ? await this.#renderTemplateFile(this.#htmlTemplate, data)
      : await this.#renderTemplateString(this.#htmlBody, data);

    if (text.trim() === "" && html.trim() === "") {
      throw new Error(`Email must have either a text or HTML body.`);
    }

    return {
      from: this.#from.toString(),
      to: this.#toList.toArray(),
      cc: this.#ccList.length() ? this.#ccList.toArray() : undefined,
      bcc: this.#bccList.length() ? this.#bccList.toArray() : undefined,
      subject: this.#subject.trim(),
      text,
      html,
      attachments: this.#fileList.length ? this.#fileList : undefined,
    };
  }

  #addToList(list, email, name = "") {
    if (!list) list = new Addresses();
    list.add(email, name);
    return list;
  }

  async #renderTemplateFile(filePath, data = {}) {
    try {
      const basePath = this.config?.emails_path || "";
      const absPath = path.resolve(path.join(basePath, filePath));
      const content = await fs.readFile(absPath, "utf-8");
      const template = handlebars.compile(content);
      return template(data);
    } catch (err) {
      throw new Error(
        `Failed to render template "${filePath}": ${err.message}`
      );
    }
  }

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
