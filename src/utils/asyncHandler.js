/**
 * asyncHandler — Eliminates try/catch boilerplate from async controllers.
 *
 * Wraps any async Express route handler and automatically forwards any
 * rejected promise to the next(err) error middleware chain.
 *
 * Usage:
 *   router.get('/example', asyncHandler(async (req, res) => {
 *     const data = await someService.getData();
 *     res.json({ success: true, data });
 *   }));
 *
 * @param {Function} fn - Async route handler (req, res, next) => Promise
 * @returns {Function}  - Express-compatible middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
