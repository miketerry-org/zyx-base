// emailMessage.js:

"use strict";

const fs = require("fs").promises;
const Handlebars = require("handlebars");

/**
 * Provides a fluent interface to build and send email messages
 * through a BaseEmailer instance.
 */
class EmailMessage {
  /**
   * Constructs a new EmailMessage tied to an emailer implementation.
   * @param {{ send: function(EmailMessage, boolean): Promise<any> }} emailer - Instance with a send method.
   */
  constructor(emailer) {
    /** @private */
    this._emailer = emailer;

    /**
     * Internal message state.
     * @private
     * @type {{from: Object, to: Array, cc: Array, bcc: Array, replyTo: Object|null, subject: string, text: string, html: string, attachments: Array, headers: Object}}
     */
    this._message = {
      from: {},
      to: [],
      cc: [],
      bcc: [],
      replyTo: null,
      subject: "",
      text: "",
      html: "",
      attachments: [],
      headers: {},
    };
  }

  /**
   * Sets the "from" field of the email.
   * @param {string} email - Sender email address.
   * @param {string} [name=""] - Sender name.
   * @returns {EmailMessage} The current instance for chaining.
   */
  from(email, name = "") {
    this._message.from = { email, name };
    return this;
  }

  /**
   * Adds a recipient to the "to" list.
   * @param {string} email - Recipient email.
   * @param {string} [name=""] - Recipient name.
   * @returns {EmailMessage}
   */
  to(email, name = "") {
    this._message.to.push({ email, name });
    return this;
  }

  /**
   * Adds a recipient to the "cc" list.
   * @param {string} email - CC email.
   * @param {string} [name=""] - CC name.
   * @returns {EmailMessage}
   */
  cc(email, name = "") {
    this._message.cc.push({ email, name });
    return this;
  }

  /**
   * Adds a recipient to the "bcc" list.
   * @param {string} email - BCC email.
   * @param {string} [name=""] - BCC name.
   * @returns {EmailMessage}
   */
  bcc(email, name = "") {
    this._message.bcc.push({ email, name });
    return this;
  }

  /**
   * Sets the "reply-to" email.
   * @param {string} email - Reply-to email.
   * @param {string} [name=""] - Reply-to name.
   * @returns {EmailMessage}
   */
  replyTo(email, name = "") {
    this._message.replyTo = { email, name };
    return this;
  }

  /**
   * Sets the email subject line.
   * @param {string} text - Subject text.
   * @returns {EmailMessage}
   */
  subject(text) {
    this._message.subject = text;
    return this;
  }

  /**
   * Sets the plaintext body using a raw string and optional data.
   * @param {string} content - Raw plaintext content or template string.
   * @param {Object} [data] - Context object for Handlebars rendering.
   * @returns {EmailMessage}
   */
  textBody(content, data = undefined) {
    const tmpl = Handlebars.compile(content);
    this._message.text = data ? tmpl(data) : content;
    return this;
  }

  /**
   * Loads plaintext template from a file and renders it.
   * @param {string} path - Filesystem path to the plaintext template.
   * @param {Object} [data] - Context object for rendering.
   * @returns {Promise<EmailMessage>}
   * @throws {Error} If the file cannot be read.
   */
  async textTemplate(path, data = undefined) {
    let content;
    try {
      content = await fs.readFile(path, "utf-8");
    } catch (err) {
      throw new Error(`Failed reading text template "${path}": ${err.message}`);
    }
    return this.textBody(content, data);
  }

  /**
   * Sets the HTML body using a raw string and optional data.
   * @param {string} content - Raw HTML content or template string.
   * @param {Object} [data] - Context object for Handlebars rendering.
   * @returns {EmailMessage}
   */
  htmlBody(content, data = undefined) {
    const tmpl = Handlebars.compile(content);
    this._message.html = data ? tmpl(data) : content;
    return this;
  }

  /**
   * Loads an HTML template file and renders it.
   * @param {string} path - Filesystem path to the HTML template.
   * @param {Object} [data] - Context object for rendering.
   * @returns {Promise<EmailMessage>}
   * @throws {Error} If the file cannot be read.
   */
  async htmlTemplate(path, data = undefined) {
    let content;
    try {
      content = await fs.readFile(path, "utf-8");
    } catch (err) {
      throw new Error(`Failed reading HTML template "${path}": ${err.message}`);
    }
    return this.htmlBody(content, data);
  }

  /**
   * Merges additional headers into the email.
   * @param {Object.<string, string>} headersObj - Key/value pairs for email headers.
   * @returns {EmailMessage}
   */
  headers(headersObj) {
    this._message.headers = { ...this._message.headers, ...headersObj };
    return this;
  }

  /**
   * Adds a file attachment.
   * @param {string} path - Path to the attachment file.
   * @param {string|null} [filename=null] - Optional override filename.
   * @returns {EmailMessage}
   */
  file(path, filename = null) {
    this._message.attachments.push({ path, filename });
    return this;
  }

  /**
   * Sends the composed email via the attached emailer.
   * @param {boolean} [showDetails=false] - If true, passes debug flag to emailer.
   * @returns {Promise<any>} Result from the emailer's send method.
   * @throws {Error} If the emailer has no valid send method.
   */
  async send(showDetails = false) {
    if (!this._emailer?.send) {
      throw new Error(
        "Emailer is not properly configured or missing send method."
      );
    }
    return await this._emailer.send(this, showDetails);
  }
}

module.exports = EmailMessage;
