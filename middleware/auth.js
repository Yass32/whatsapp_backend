const jwt = require('jsonwebtoken');

/**
 * Authentication middleware for protected routes
 * 
 * Verifies the JWT access token in the Authorization header.
 * Adds decoded user information to the request object.
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateJWT = (request, response, next) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return response.status(401).json({
            status: 'error',
            code: 'AUTH_HEADER_MISSING',
            message: 'Authorization header missing',
            action: 'Please include a valid Bearer token in the Authorization header.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user info to request object
        request.user = {
            userId: decoded.userId,
            role: decoded.role
        };
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return response.status(401).json({
                status: 'error',
                code: 'TOKEN_EXPIRED',
                message: 'Access token has expired',
                action: 'Please refresh your access token using the refresh token.'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return response.status(403).json({
                status: 'error',
                code: 'TOKEN_INVALID',
                message: 'Invalid access token',
                action: 'Please provide a valid access token.'
            });
        }

        return response.status(500).json({
            status: 'error',
            code: 'AUTH_ERROR',
            message: 'Authentication error',
            action: 'Please try again or contact support.'
        });
    }
};

/**
 * Authorization middleware for admin-only routes
 * 
 * Checks if the authenticated user has admin role.
 * Must be used after authenticateJWT middleware.
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @param {Function} next - Express next middleware function
 */
const authorizeAdmin = (request, response, next) => {
    if (!request.user) {
        return response.status(401).json({
            status: 'error',
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
            action: 'Please authenticate before accessing this resource.'
        });
    }

    if (request.user.role !== 'admin') {
        return response.status(403).json({
            status: 'error',
            code: 'ADMIN_REQUIRED',
            message: 'Access denied: Admins only',
            action: 'This resource requires admin privileges.'
        });
    }

    next();
};

/**
 * Rate limiting middleware for authentication attempts
 * 
 * Limits the number of authentication attempts from an IP address
 * to prevent brute force attacks.
 * 
 * @param {Object} request - Express request object
 * @param {Object} response - Express response object
 * @param {Function} next - Express next middleware function
 */
const rateLimitAuth = (request, response, next) => {
    // Get IP address from request
    const ip = request.ip || request.connection.remoteAddress;
    
    // Simple in-memory rate limiting
    // In production, use Redis or similar for distributed systems
    if (!global.authAttempts) {
        global.authAttempts = new Map();
    }

    const now = Date.now();
    const attempts = global.authAttempts.get(ip) || [];
    
    // Remove attempts older than 15 minutes
    const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
    
    if (recentAttempts.length >= 5) {
        return response.status(429).json({
            status: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts',
            action: 'Please try again in 15 minutes.'
        });
    }

    recentAttempts.push(now);
    global.authAttempts.set(ip, recentAttempts);
    
    next();
};

module.exports = { 
    authenticateJWT,   // Middleware to verify JWT tokens
    authorizeAdmin,    // Middleware to check admin role
    rateLimitAuth     // Middleware to prevent brute force attacks
};