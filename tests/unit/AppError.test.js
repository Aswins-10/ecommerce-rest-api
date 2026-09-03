'use strict';

const AppError = require('../../src/utils/AppError');

describe('AppError Utility', () => {
  it('should create an operational error with statusCode and fail status for 4xx', () => {
    const error = new AppError('Resource not found', 404);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.status).toBe('fail');
    expect(error.isOperational).toBe(true);
    expect(error.stack).toBeDefined();
  });

  it('should create an error with status error for 5xx', () => {
    const error = new AppError('Database connection died', 500);

    expect(error.statusCode).toBe(500);
    expect(error.status).toBe('error');
    expect(error.isOperational).toBe(true);
  });
});
