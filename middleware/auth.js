const jwt = require('jsonwebtoken');

const authenticateJWT = (request, response, next) => {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
            if (error) {
                return response.status(403).json({ message: 'Invalid token' });
            }
            request.user = user; // userId and role from your token
            next();
        });
    } else {
        response.status(401).json({ message: 'Authorization header missing' });
    }
};

const authorizeAdmin = (request, response, next) => {
    if (request.user && request.user.role === 'admin') {
        next();
    } else {
        response.status(403).json({ message: 'Access denied: Admins only' });
    }
};

module.exports = { authorizeAdmin, authenticateJWT };