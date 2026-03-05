'use strict';

const crypto = require('crypto');

/**
 * Express middleware that reads the visitor's IP address,
 * hashes it with HMAC-SHA256 using IP_HASH_SECRET, and
 * attaches the result to req.hashedIp.
 *
 * The raw IP is never stored – only the hash is persisted.
 */
function hashIp(req, _res, next) {
  // Support proxies / load balancers forwarding the real IP
  const rawIp =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '0.0.0.0';

  const secret = process.env.IP_HASH_SECRET || 'default_secret';
  req.hashedIp = crypto
    .createHmac('sha256', secret)
    .update(rawIp)
    .digest('hex');

  next();
}

module.exports = hashIp;
