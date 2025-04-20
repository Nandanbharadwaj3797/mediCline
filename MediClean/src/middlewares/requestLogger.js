export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request
  console.log({
    timestamp: new Date().toISOString(),
    type: 'REQUEST',
    method: req.method,
    path: req.path,
    query: req.query,
    body: process.env.NODE_ENV === 'development' ? req.body : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    // Log response
    console.log({
      timestamp: new Date().toISOString(),
      type: 'RESPONSE',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.id
    });

    return res.send(data);
  };

  next();
}; 