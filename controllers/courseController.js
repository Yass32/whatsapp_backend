const courseService = require('../services/courseService');
const createCourse = async (request, response) => {
    const {courseData, lessonsData, enrollmentsData, numbers} = request.body;
    try {
        const createdCourse = await courseService.createCourse(courseData, lessonsData, enrollmentsData, numbers);
        response.status(200).json(createdCourse);
    } catch (error) {
        response.status(500).json({error: error.message});
    }
}

module.exports = {
    createCourse
}