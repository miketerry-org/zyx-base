// emailMessage.js:

"use strict";

// load all necessary modules
const fs = require("fs");
const Handlebars = require("handlebars");

/**
 * EmailMessage provides a fluent interface to build an email message
 * that can be sent through a BaseEmailer instance.
 */
class EmailMessage {
  constructor(emailer) {
    this._emailer = emailer;
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

  from(email, name = "") {
    this._message.from = { email, name };
    return this;
  }

  to(email, name = "") {
    this._message.to.push({ email, name });
    return this;
  }

  cc(email, name = "") {
    this._message.cc.push({ email, name });
    return this;
  }

  bcc(email, name = "") {
    this._message.bcc.push({ email, name });
    return this;
  }

  replyTo(email, name = "") {
    this._message.replyTo = { email, name };
    return this;
  }

  subject(text) {
    this._message.subject = text;
    return this;
  }

  textBody(template, data = undefined, fromFile = false) {
    let content = template;
    if (fromFile) {
      try {
        content = fs.readFileSync(template, "utf-8");
      } catch (err) {
        throw new Error(
          `Failed to read text template file "${template}": ${err.message}`
        );
      }
    }
    this._message.text = data ? Handlebars.compile(content)(data) : content;
    return this;
  }

  htmlBody(template, data = undefined, fromFile = false) {
    let content = template;
    if (fromFile) {
      try {
        content = fs.readFileSync(template, "utf-8");
      } catch (err) {
        throw new Error(
          `Failed to read HTML template file "${template}": ${err.message}`
        );
      }
    }
    this._message.html = data ? Handlebars.compile(content)(data) : content;
    return this;
  }

  headers(headersObj) {
    this._message.headers = { ...this._message.headers, ...headersObj };
    return this;
  }

  file(path, filename = null) {
    this._message.attachments.push({ path, filename });
    return this;
  }

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
