/**
 * Token Service - JWT Token Management
 * 
 * This service handles token-related operations including:
 * - Token generation and verification
 * - Token blacklisting
 * - Refresh token rotation
 */

const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');
const jwt = require('jsonwebtoken');

// Initialize Prisma client
const prisma = new PrismaClient().$extends(withAccelerate());

/**
 * Generate JWT access token
 * @param {Object} user - User object containing id and role
 * @returns {string} Signed JWT access token
 */
function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '60m' }
    );
}

/**
 * Generate JWT refresh token with rotation
 * @param {Object} user - User object containing id and role
 * @returns {string} Signed JWT refresh token
 */
function generateRefreshToken(user) {
    const refreshToken = jwt.sign(
        { 
            userId: user.id, 
            role: user.role,
            version: Date.now() // Add version for token rotation
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    // Store refresh token in database for validation
    storeRefreshToken(user.id, refreshToken).catch(console.error);

    return refreshToken;
}

/**
 * Store refresh token in database
 * @param {number} userId - User ID
 * @param {string} token - Refresh token
 */
async function storeRefreshToken(userId, token) {
    try {
        // Delete any existing refresh tokens for this user
        await prisma.refreshToken.deleteMany({
            where: { userId }
        });

        // Store new refresh token
        await prisma.refreshToken.create({
            data: {
                token,
                userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });
    } catch (error) {
        console.error('Failed to store refresh token:', error);
        throw new Error('Failed to store refresh token');
    }
}

/**
 * Verify and validate refresh token
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token payload if valid
 * @throws {Error} If token is invalid or expired
 */
async function verifyRefreshToken(token) {
    try {
        // First verify the token signature
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

        // Check if token exists in database and is not blacklisted
        const storedToken = await prisma.refreshToken.findFirst({
            where: {
                userId: decoded.userId,
                token: token,
                blacklisted: false
            }
        });

        if (!storedToken) {
            throw new Error('Token not found or blacklisted');
        }

        // Check if token has expired in database
        if (storedToken.expiresAt < new Date()) {
            await blacklistToken(token);
            throw new Error('Token has expired');
        }

        return decoded;
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        if (error.name === 'TokenExpiredError') {
            await blacklistToken(token);
            throw new Error('Token has expired');
        }
        throw error;
    }
}

/**
 * Blacklist a refresh token
 * @param {string} token - Token to blacklist
 */
async function blacklistToken(token) {
    try {
        await prisma.refreshToken.update({
            where: { token },
            data: { blacklisted: true }
        });
    } catch (error) {
        console.error('Failed to blacklist token:', error);
    }
}

/**
 * Remove expired refresh tokens from database
 * This should be run periodically (e.g., daily)
 */
async function cleanupExpiredTokens() {
    try {
        await prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { blacklisted: true }
                ]
            }
        });
    } catch (error) {
        console.error('Failed to cleanup expired tokens:', error);
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    blacklistToken,
    cleanupExpiredTokens
};
