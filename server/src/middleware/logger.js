/**
 * FixIt Now - Request Logging Middleware
 * Records incoming HTTP requests, response status, and duration in milliseconds.
 */

export function requestLogger(req, res, next) {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();

  // Capture response finish event
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const { method, originalUrl } = req;
    const { statusCode } = res;

    // Optional status indicator
    let indicator = '✓';
    if (statusCode >= 500) {
      indicator = '✕ [SERVER ERROR]';
    } else if (statusCode >= 400) {
      indicator = '! [CLIENT ERROR]';
    }

    console.log(
      `[${timestamp}] ${method} ${originalUrl} ${statusCode} - ${durationMs}ms ${indicator}`
    );
  });

  next();
}

export default requestLogger;
