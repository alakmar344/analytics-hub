'use strict';

/**
 * Tests for the IP-hashing middleware.
 * No MongoDB connection needed – tests pure logic.
 */

process.env.IP_HASH_SECRET = 'test_secret_for_hashing';

const hashIp = require('../server/middleware/hashIp');

function makeReq(overrides = {}) {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };
}

describe('hashIp middleware', () => {
  it('attaches hashedIp to req', () => {
    const req  = makeReq();
    const next = jest.fn();
    hashIp(req, {}, next);
    expect(req.hashedIp).toBeDefined();
    expect(typeof req.hashedIp).toBe('string');
    expect(req.hashedIp).toHaveLength(64); // SHA-256 hex = 64 chars
    expect(next).toHaveBeenCalled();
  });

  it('produces the same hash for the same IP', () => {
    const req1 = makeReq();
    const req2 = makeReq();
    hashIp(req1, {}, jest.fn());
    hashIp(req2, {}, jest.fn());
    expect(req1.hashedIp).toBe(req2.hashedIp);
  });

  it('produces different hashes for different IPs', () => {
    const req1 = makeReq({ socket: { remoteAddress: '1.2.3.4' } });
    const req2 = makeReq({ socket: { remoteAddress: '9.8.7.6' } });
    hashIp(req1, {}, jest.fn());
    hashIp(req2, {}, jest.fn());
    expect(req1.hashedIp).not.toBe(req2.hashedIp);
  });

  it('prefers x-forwarded-for header over socket IP', () => {
    const reqForwarded = makeReq({
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      socket: { remoteAddress: '10.0.0.1' },
    });
    const reqDirect = makeReq({
      socket: { remoteAddress: '203.0.113.5' },
    });
    hashIp(reqForwarded, {}, jest.fn());
    hashIp(reqDirect,   {}, jest.fn());
    // Both should hash the same "real" IP (203.0.113.5)
    expect(reqForwarded.hashedIp).toBe(reqDirect.hashedIp);
  });

  it('falls back to 0.0.0.0 when no IP is available', () => {
    const req = { headers: {}, socket: {} };
    hashIp(req, {}, jest.fn());
    expect(req.hashedIp).toHaveLength(64);
  });
});
