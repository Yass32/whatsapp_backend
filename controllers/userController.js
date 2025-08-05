const userService = require('../services/userService');
const learnerService = require('../services/learnerService');

const registerUser = async (request, response) => {
    try {
        const newUser = await userService.registerNewUser(request.body);
        response.status(201).json(newUser);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const registerLearner = async (request, response) => {
    try {
        const newLearner = await learnerService.createLearner(request.body);
        response.status(201).json(newLearner);
    } catch (error) {
        response.status(500).json({ error: error.message });
    }
};

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const loginUser = async (request, response) => {
    try {
        const { accessToken, refreshToken } = await userService.loginUser(request.body);
        response
            .cookie('refreshToken', refreshToken, cookieOptions)
            .status(200)
            .json({ accessToken });
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const refreshToken = (request, response) => {
    const token = request.cookies.refreshToken;
    if (!token) return response.status(401).json({ message: 'No refresh token' });

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) return response.status(403).json({ message: 'Invalid refresh token' });
        // Issue new access token
        const accessToken = userService.generateAccessToken(user);
        response.json({ accessToken });
    });
};

const logout = (request, response) => {
    response.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    response.status(200).json({ message: 'Logged out successfully' });
};

const getUser = async (request, response) => {
    const userId = request.params.id;
    try {
        const user = await userService.getUser(userId);
        response.status(201).json(user);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const getLearner = async (request, response) => {
    const userId = request.params.id;
    try {
        const learner = await learnerService.getLearner(userId);
        response.status(201).json(learner);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const getAllUsers = async (request, response) => {
    try {
        const users = await userService.getAllUsers();
        response.status(200).json(users);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const getAllLearners = async (request, response) => {
    try {
        const learners = await learnerService.getAllLearners();
        response.status(200).json(learners);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const updateUser = async (request, response) => {
    const userId = request.params.id;
    const requestBody = request.body; 
    try {
        const updatedUser = await userService.updateUser(userId, requestBody);
        response.status(200).json(updatedUser);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const updateLearner = async (request, response) => {
    const userId = request.params.id;
    const requestBody = request.body; 
    try {
        const updatedLearner = await learnerService.updateLearner(userId, requestBody);
        response.status(200).json(updatedLearner);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const deleteUser = async (request, response) => {
    const userId = request.params.id;
    try {
        const deletedUser = await userService.deleteUser(userId);
        response.status(200).json(deletedUser);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const deleteLearner = async (request, response) => {
    const userId = request.params.id;
    try {
        const deletedLearner = await learnerService.deleteLearner(userId);
        response.status(200).json(deletedLearner);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const deleteAllLearners = async (request, response) => {
    try {
        const deletedLearners = await learnerService.deleteAllLearners();
        response.status(200).json(deletedLearners);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}




module.exports = {
    registerUser,
    loginUser,
    getUser,
    getLearner,
    getAllUsers,
    getAllLearners,
    updateUser,
    updateLearner,
    deleteUser,
    deleteLearner,
    deleteAllLearners,
    registerLearner,
    refreshToken,
    logout,
}