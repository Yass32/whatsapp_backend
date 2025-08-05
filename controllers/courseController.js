const courseService = require('../services/courseService');
const createCourse = async (request, response) => {
    const {numbers, courseData, lessonsData, scheduleTime, startDate, frequency} = request.body;
    try {
        const createdCourse = await courseService.createCourse(numbers, courseData, lessonsData, scheduleTime, startDate, frequency);
        response.status(200).json(createdCourse);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

const deleteAllCourses =  async (request, response) => {
    try {
      await courseService.deleteAllCourses();
      response.status(200).json({ message: 'All courses and related data deleted.' });
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
};

module.exports = {
    createCourse,
    deleteAllCourses
}