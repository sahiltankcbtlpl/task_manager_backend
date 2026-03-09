const Project = require('../models/Project');

/**
 * Validates if a user is a member of a project.
 * @param {string} projectId - The ID of the project
 * @param {string} userId - The ID of the user
 * @returns {Promise<boolean>} - True if the user is a member, false otherwise
 */
const isUserProjectMember = async (projectId, userId) => {
    try {
        const project = await Project.findById(projectId).select('members').lean();
        if (!project) return false;

        const isMember = project.members.some(
            (memberId) => memberId.toString() === userId.toString()
        );

        return isMember;
    } catch (error) {
        console.error('Error validating project membership:', error);
        return false;
    }
};

module.exports = {
    isUserProjectMember,
};
