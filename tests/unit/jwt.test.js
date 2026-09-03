'use strict';

require('dotenv').config();
const { signToken, verifyToken } = require('../../src/utils/jwt');

describe('JWT Utility', () => {
  it('should sign and successfully verify a payload', () => {
    const payload = { id: '6a9910000000000000000099', role: 'customer' };
    const token = signToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.exp).toBeDefined();
  });

  it('should throw an error for an invalid/tampered token', () => {
    expect(() => {
      verifyToken('tampered.token.string');
    }).toThrow();
  });
});
