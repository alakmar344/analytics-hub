'use strict';

const mongoose = require('mongoose');

/**
 * Schema for a single tracked analytics event.
 *
 * Fields:
 *  - hashedIp   : SHA-256 HMAC of the visitor's IP (privacy-safe identifier)
 *  - event      : event name  (e.g. "pageview", "click", "custom")
 *  - page       : URL / path the event occurred on
 *  - referrer   : referring URL (optional)
 *  - userAgent  : browser / device user-agent string
 *  - meta       : arbitrary key-value pairs sent by the client (optional)
 *  - timestamp  : when the event was received by the server
 */
const eventSchema = new mongoose.Schema(
  {
    hashedIp: { type: String, required: true, index: true },
    event:    { type: String, required: true, index: true },
    page:     { type: String, required: true },
    referrer: { type: String, default: '' },
    userAgent:{ type: String, default: '' },
    meta:     { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp:{ type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Event', eventSchema);
