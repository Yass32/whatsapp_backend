const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient().$extends(withAccelerate())

function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '60m' }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
}

const registerNewUser = async (userData) => {
    const {name, surname, password, email, number, role, department, company} = userData;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
            name,
            surname,
            password: hashedPassword,
            email,
            number,
            role,
            department,
            company,
            createdAt: new Date(),
            updatedAt: new Date()
            }
        })
        return newUser;
    } catch (error) {
        throw new Error('Failed to register user');
    }
}


const loginUser = async (userData) => {
    const {email, password} = userData;
    try {
        const user = await prisma.user.findUnique({
            where: {email}
        })
        if (!user) {
            throw new Error('User not found');
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            throw new Error('Invalid password');
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        return { accessToken, refreshToken };
    } catch (error) {
        throw new Error('Failed to login user');
    }
}


const getUser = async (userId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(userId) }
        });
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        throw new Error('Failed to fetch user');
    }

}

const getAllUsers = async () => {
    try {
        const users = await prisma.user.findMany();
        return users;
    } catch (error) {
        throw new Error('Failed to get all users');
    }
}

const updateUser = async (userId, requestBody) => {
    const {name, surname, email, password, number} = requestBody;
    try {
        let updatedData = { name, surname, email, number };
        if (password) {
            updatedData.password = await bcrypt.hash(password, 10);
        }
        const user = await prisma.user.update({
            where: { id: Number(userId) },
            data: updatedData
        });
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        throw new Error('Failed to update user information');
    }
}

const deleteUser = async (userId) => {
    try {
        const user = await prisma.user.delete({
            where: { id : Number(userId)}
        })
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        throw new Error('Failed to delete user');
    }
}


module.exports = {
    registerNewUser,
    loginUser,
    getUser,
    getAllUsers,
    updateUser,
    deleteUser,
    generateAccessToken,
    generateRefreshToken,
}
