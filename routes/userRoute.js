const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateJWT, authorizeAdmin } = require('../middleware/auth');


router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/getusers', userController.getAllUsers);
// If you want to get a single user by id:
router.get('/:id', userController.getUser);
// If you want to update a user:
router.put('/:id', userController.updateUser);
// If you want to delete a user:
router.delete('/:id', userController.deleteUser);

router.post('/refresh-token', userController.refreshToken);
router.post('/logout', userController.logout);

// Only admin can create learners
// router.post('/create-learner', authenticateJWT, authorizeAdmin, userController.registerLearner);

router.post('/create-learner', userController.registerLearner);

router.get('/get-all-learners', userController.getAllLearners);

router.get('/get-learner/:id', userController.getLearner);

router.put('/update-learner/:id', userController.updateLearner);

router.delete('/delete-learner/:id', userController.deleteLearner);

router.delete('/delete-all-learners', userController.deleteAllLearners);

module.exports = router;

