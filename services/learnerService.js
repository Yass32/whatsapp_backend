const { PrismaClient } = require('../generated/prisma');
const { withAccelerate } = require('@prisma/extension-accelerate'); 
const bcrypt = require('bcrypt');

const prisma = new PrismaClient().$extends(withAccelerate())


const createLearner = async (learnerData) => {
    const {name, surname, email, number, department, company} = learnerData;
    try {
        const newLearner = await prisma.learner.createMany({
            data: {
                name,
                surname,
                email,
                number,
                department,
                company,
            }
        })
        return newLearner;
      } catch (error) {
        console.error("Learner creation error:", error); 
        throw new Error('Failed to register learner');
    }
}


const getLearner = async (userId) => {
    try {
        const learner = await prisma.learner.findUnique({
            where: { id: Number(userId) }
        });
        if (!learner) {
            throw new Error('learner not found');
        }
        return learner;
    } catch (error) {
        throw new Error('Failed to fetch learner');
    }

}

const getAllLearners = async () => {
    try {
        const users = await prisma.learner.findMany();
        return users;
    } catch (error) {
        throw new Error('Failed to get all learners');
    }
}

const updateLearner = async (userId, requestBody) => {
    const { email, number} = requestBody;
    try {
        let updatedData = { email, number };
        const learner = await prisma.learner.update({
            where: { id: Number(userId) },
            data: updatedData
        });
        if (!learner) {
            throw new Error('learner not found');
        }
        return learner;
    } catch (error) {
        throw new Error('Failed to update learner information');
    }
}

const deleteLearner = async (userId) => {
    try {
        const learner = await prisma.learner.delete({
            where: { id : Number(userId)}
        })
        if (!learner) {
            throw new Error('learner not found');
        }
        return learner;
    } catch (error) {
        throw new Error('Failed to delete learner');
    }
} 

const deleteAllLearners = async () => {
      try {
          const learner = await prisma.learner.deleteMany({})
          if (!learner) {
            throw new Error('learners not found');
          }
          return learner;
      } catch (error) {
          throw new Error('Failed to delete learners');
      }
  }


module.exports = {
    createLearner,
    getLearner,
    getAllLearners,
    updateLearner,
    deleteLearner,
    deleteAllLearners
}
