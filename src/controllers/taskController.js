const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
const { sendTaskAssignmentEmail } = require('../services/email.service');
const User = require('../models/User'); // Import User model

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Manage Tasks)
const createTask = async (req, res) => {
    try {
        let { name, description, taskStatus, status, assignee } = req.body;

        // If no taskStatus provided, find the first active status
        if (!taskStatus) {
            const defaultStatus = await TaskStatus.findOne({ status: 'active' });
            if (!defaultStatus) {
                res.status(400);
                throw new Error('No active task status found. Please create one first.');
            }
            taskStatus = defaultStatus._id;
        }

        const taskData = {
            name,
            description,
            taskStatus,
            status,
            assignee
        };

        if (req.file) {
            taskData.attachment = {
                filename: req.file.filename,
                path: req.file.path,
                mimetype: req.file.mimetype,
                size: req.file.size
            };
        }

        const task = await Task.create(taskData);

        // Populate everything for immediate feedback
        const populatedTask = await task.populate([
            { path: 'taskStatus', select: 'name status' },
            { path: 'status', select: 'name value' }, // Permission
            { path: 'assignee', select: 'name email' }
        ]);

        // Send email notification to assignee
        if (assignee && populatedTask.assignee) {
            const assignedBy = req.user.name; // Assuming req.user is populated by auth middleware
            sendTaskAssignmentEmail(
                populatedTask.assignee.email,
                populatedTask.name,
                populatedTask.assignee.name,
                assignedBy
            );
        }

        res.status(201).json(populatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private (Manage Tasks/Read Tasks)
const getTasks = async (req, res) => {
    try {
        let query = {};

        const { status, assignee } = req.query;

        // If not Super Admin, show only assigned tasks
        if (req.user.role.name !== 'Super Admin') {
            query.assignee = req.user._id;
        } else if (assignee) {
            // Only Super Admin can filter by assignee
            query.assignee = assignee;
        }

        if (status) {
            query.taskStatus = status;
        }

        // console.log('getTasks query:', query); // DEBUG
        const tasks = await Task.find(query)
            .populate('taskStatus', 'name status')
            .populate('status', 'name value')
            .populate('assignee', 'name email');

        // console.log(`Found ${tasks.length} tasks for user ${req.user.name} (${req.user.role.name})`); // DEBUG
        if (tasks.length > 0) {
            // console.log('Sample task attachment:', tasks[0].attachment); // DEBUG
        }
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private (Manage Tasks/Read Tasks)
const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('taskStatus', 'name status')
            .populate('status', 'name value')
            .populate('assignee', 'name email');

        if (task) {
            res.json(task);
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private (Manage Tasks)
const updateTask = async (req, res) => {
    try {
        const { name, description, taskStatus, status, assignee } = req.body;
        const task = await Task.findById(req.params.id);

        if (task) {
            const oldAssignee = task.assignee;

            task.name = name || task.name;
            task.description = description || task.description;
            task.taskStatus = taskStatus || task.taskStatus;
            task.status = status || task.status;
            task.assignee = assignee || task.assignee;

            if (req.file) {
                task.attachment = {
                    filename: req.file.filename,
                    path: req.file.path,
                    mimetype: req.file.mimetype,
                    size: req.file.size
                };
            } else if (req.body.removeAttachment === 'true') {
                task.attachment = undefined; // Or null, depending on your schema preference. Mongoose unsets with undefined often.
            }

            const updatedTask = await task.save();
            const populatedTask = await updatedTask.populate([
                { path: 'taskStatus', select: 'name status' },
                { path: 'status', select: 'name value' },
                { path: 'assignee', select: 'name email' }
            ]);

            // Send email if assignee changed and is not the same as before
            // Also assigner should be Super Admin technically, but here any update by authorized user triggers it.
            // Requirement says "when superadmin assign task".
            // Since this route is protected, we can assume authorized user.
            if (assignee && assignee !== oldAssignee?.toString() && populatedTask.assignee) {
                const assignedBy = req.user.name;
                sendTaskAssignmentEmail(
                    populatedTask.assignee.email,
                    populatedTask.name,
                    populatedTask.assignee.name,
                    assignedBy
                );
            }

            res.json(populatedTask);
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Manage Tasks)
const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (task) {
            await task.deleteOne();
            res.json({ message: 'Task removed' });
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
};
