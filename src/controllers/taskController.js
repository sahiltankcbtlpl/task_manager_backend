const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
const Project = require('../models/Project');
const xlsx = require('xlsx');
const { sendTaskAssignmentEmail, sendMentionEmail } = require('../services/email.service');
const User = require('../models/User'); // Import User model
const Company = require('../models/Company');
const { isUserProjectMember } = require('../utils/projectHelper');
// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Manage Tasks)
const createTask = async (req, res) => {
    try {
        let { name, description, taskStatus, status, assignee, project, category } = req.body;

        if (!project) {
            res.status(400);
            throw new Error('Project is required');
        }

        const projectDoc = await Project.findById(project).select('company members');
        if (!projectDoc) {
            res.status(404);
            throw new Error('Project not found');
        }

        // Verify project belongs to the current company
        if (projectDoc.company.toString() !== req.companyId.toString()) {
            res.status(403);
            throw new Error('Project does not belong to this company');
        }

        const isMember = assignee ? projectDoc.members.some(id => id.toString() === assignee.toString()) : true;
        if (assignee && !isMember) {
            res.status(400);
            throw new Error('Assignee must be a member of the project');
        }

        // Check for duplicate title
        const existingTask = await Task.findOne({
            name: name,
            project,
            category
        }).collation({ locale: 'en', strength: 2 });

        if (existingTask) {
            res.status(400);
            throw new Error(`A ${category.toLowerCase()} with this title already exists in the project`);
        }

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
            project,
            company: req.companyId,
            name,
            description,
            taskStatus,
            status,
            assignee,
            category
        };

        if (req.files) {
            if (req.files.attachments) {
                taskData.attachments = req.files.attachments.map(file => ({
                    filename: file.filename,
                    path: file.path,
                    mimetype: file.mimetype,
                    size: file.size
                }));
            }
            if (req.files.videoAttachments) {
                taskData.videoAttachments = req.files.videoAttachments.map(file => ({
                    filename: file.filename,
                    path: file.path,
                    mimetype: file.mimetype,
                    size: file.size
                }));
            }
        }

        const task = await Task.create(taskData);

        // Populate everything for immediate feedback
        const populatedTask = await task.populate([
            { path: 'taskStatus', select: 'name status' },
            { path: 'status', select: 'name value' }, // Permission
            { path: 'assignee', select: 'name email' },
            { path: 'project', select: 'title' },
            { path: 'mentionedUsers', select: 'name email' }
        ]);

        // Parse mentions and send emails asynchronously
        if (description) {
            const projectDoc = await Project.findById(project).select('members').lean();
            const projectMembersList = await User.find({ _id: { $in: projectDoc.members } }).select('name email');
            const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionedUsersList = projectMembersList.filter(user => {
                const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                return regex.test(description);
            });

            if (mentionedUsersList.length > 0) {
                task.mentionedUsers = mentionedUsersList.map(u => u._id);
                await task.save();

                const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
                const loginLink = `${baseUrl}/login`;

                mentionedUsersList.forEach(user => {
                    sendMentionEmail(user.email, user.name, populatedTask.name, populatedTask.description, loginLink);
                });
            }
        }

        // Send email notification to assignee
        if (assignee && populatedTask.assignee) {
            const assignedBy = req.user.name; // Assuming req.user is populated by auth middleware

            // Collect all attachments to send in the email
            const emailAttachments = [
                ...(populatedTask.attachments || []),
                ...(populatedTask.videoAttachments || [])
            ];

            const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
            const loginLink = `${baseUrl}/login`;

            sendTaskAssignmentEmail(
                populatedTask.assignee.email,
                populatedTask.name,
                populatedTask.assignee.name,
                assignedBy,
                emailAttachments,
                loginLink,
                populatedTask.category
            );
        }

        // Emit real-time event
        req.app.get('io').emit('taskCreated', populatedTask);

        res.status(201).json(populatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const { applySearch } = require('../utils/searchHelper');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private (Manage Tasks/Read Tasks)
const getTasks = async (req, res) => {
    try {
        let query = { company: req.companyId };

        const { status, assignee, search, project, category } = req.query;

        // Permission based filtering
        const isSuperAdmin = req.user.role?.name === 'Super Admin';
        const isCompanyOwner = req.role === 'Company Owner';
        const isCompanyAdmin = req.role === 'Admin'; // In case Admin exists later
        const isCompanyManager = req.role === 'Project manager';

        if (!isSuperAdmin && !isCompanyOwner && !isCompanyAdmin && !isCompanyManager) {
            // Regular member: only see tasks assigned to them
            query.assignee = req.user._id;
        } else if (assignee) {
            // Admins/Managers can filter by assignee
            query.assignee = assignee;
        }

        if (status) {
            // If no project is selected, we want to find all tasks with the same status name
            // across all projects in the company.
            if (!project) {
                const selectedStatus = await TaskStatus.findById(status);
                if (selectedStatus) {
                    const allSimilarStatuses = await TaskStatus.find({ 
                        name: selectedStatus.name,
                        status: { $ne: 'deleted' }
                    });
                    query.taskStatus = { $in: allSimilarStatuses.map(s => s._id) };
                } else {
                    query.taskStatus = status;
                }
            } else {
                query.taskStatus = status;
            }
        }
        if (project) query.project = project;
        if (category) query.category = category;

        // Apply search if search parameter is provided
        query = applySearch(query, search, ['name', 'description']);

        const pageParams = req.query.page ? parseInt(req.query.page) : null;
        const limitParams = req.query.limit ? parseInt(req.query.limit) : null;

        // Use secondary sort by _id to guarantee stable pagination for identical timestamps
        let findQuery = Task.find(query).sort({ createdAt: -1, _id: 1 });

        if (pageParams && limitParams) {
            const skip = (pageParams - 1) * limitParams;
            findQuery = findQuery.skip(skip).limit(limitParams);
        }

        const tasks = await findQuery
            .populate('taskStatus', 'name status')
            .populate('status', 'name value')
            .populate('assignee', 'name email')
            .populate({
                path: 'project',
                select: 'title members',
                populate: {
                    path: 'members',
                    select: 'name email role'
                }
            })
            .populate('mentionedUsers', 'name email')
            .lean(); // Massive performance boost for read-only listing

        if (pageParams && limitParams) {
            const totalItems = await Task.countDocuments(query);
            return res.json({
                data: tasks,
                pagination: {
                    totalItems,
                    currentPage: pageParams,
                    totalPages: Math.ceil(totalItems / limitParams),
                    pageSize: limitParams
                }
            });
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
        const task = await Task.findOne({
            _id: req.params.id,
            company: req.companyId
        })
            .populate('taskStatus', 'name status')
            .populate('status', 'name value')
            .populate('assignee', 'name email')
            .populate('project', 'title')
            .populate('mentionedUsers', 'name email');

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
        const { name, description, taskStatus, status, assignee, project, category } = req.body;
        const task = await Task.findOne({
            _id: req.params.id,
            company: req.companyId
        });

        if (task) {
            const oldAssignee = task.assignee;
            const oldDescription = task.description;

            const currentProjectId = project || task.project;
            const isMember = await isUserProjectMember(currentProjectId, assignee);

            if (assignee && !isMember) {
                res.status(400);
                throw new Error('Assignee must be a member of the project');
            }

            // Verify new project belongs to the company
            if (project) {
                const projectDoc = await Project.findById(project).select('company');
                if (projectDoc && projectDoc.company.toString() !== req.companyId.toString()) {
                    res.status(403);
                    throw new Error('Project does not belong to this company');
                }
            }

            if (name && name.toLowerCase() !== task.name.toLowerCase()) {
                const existingTask = await Task.findOne({
                    name: { $regex: new RegExp(`^${name}$`, 'i') },
                    project: currentProjectId,
                    category: category || task.category
                });
                if (existingTask) {
                    res.status(400);
                    throw new Error(`A ${(category || task.category).toLowerCase()} with this title already exists in the project`);
                }
            }

            task.name = name ?? task.name;
            task.description = description ?? task.description;
            task.taskStatus = taskStatus ?? task.taskStatus;
            task.status = status ?? task.status;
            task.assignee = assignee ?? task.assignee;
            if (project) task.project = project;
            if (category) task.category = category;

            if (req.body.removedAttachments) {
                try {
                    const removedIds = JSON.parse(req.body.removedAttachments);
                    task.attachments = task.attachments.filter(att => !removedIds.includes(att._id.toString()));
                } catch (e) {
                    console.error('Failed to parse removedAttachments', e);
                }
            }

            if (req.body.removedVideoAttachments) {
                try {
                    const removedIds = JSON.parse(req.body.removedVideoAttachments);
                    task.videoAttachments = task.videoAttachments.filter(att => !removedIds.includes(att._id.toString()));
                } catch (e) {
                    console.error('Failed to parse removedVideoAttachments', e);
                }
            }

            if (req.files) {
                if (req.files.attachments) {
                    const newAtt = req.files.attachments.map(file => ({
                        filename: file.filename,
                        path: file.path,
                        mimetype: file.mimetype,
                        size: file.size
                    }));
                    task.attachments = [...(task.attachments || []), ...newAtt];
                }
                if (req.files.videoAttachments) {
                    const newVid = req.files.videoAttachments.map(file => ({
                        filename: file.filename,
                        path: file.path,
                        mimetype: file.mimetype,
                        size: file.size
                    }));
                    task.videoAttachments = [...(task.videoAttachments || []), ...newVid];
                }
            }

            // Legacy attachment removal support
            if (req.body.removeLegacyAttachment === 'true') {
                task.attachment = undefined;
            }

            const updatedTask = await task.save();

            // Send email to newly mentioned users in description
            if (description && description !== oldDescription) {
                const projectDoc = await Project.findById(currentProjectId).select('members').lean();
                const projectMembersList = await User.find({ _id: { $in: projectDoc.members } }).select('name email');
                const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const mentionedUsersList = projectMembersList.filter(user => {
                    const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                    return regex.test(description);
                });

                if (mentionedUsersList.length > 0) {
                    updatedTask.mentionedUsers = mentionedUsersList.map(u => u._id);
                    await updatedTask.save();

                    const oldMentionedUsers = oldDescription
                        ? projectMembersList.filter(user => {
                            const regex = new RegExp(`@${escapeRegex(user.name)}\\b`, 'i');
                            return regex.test(oldDescription);
                        })
                        : [];

                    const oldMentionedUsernames = oldMentionedUsers.map(u => u.name);

                    const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
                    const loginLink = `${baseUrl}/login`;

                    mentionedUsersList.forEach(user => {
                        if (!oldMentionedUsernames.includes(user.name)) {
                            sendMentionEmail(user.email, user.name, updatedTask.name, updatedTask.description, loginLink);
                        }
                    });
                }
            }

            const populatedTask = await updatedTask.populate([
                { path: 'taskStatus', select: 'name status' },
                { path: 'status', select: 'name value' },
                { path: 'assignee', select: 'name email' },
                { path: 'project', select: 'title' },
                { path: 'mentionedUsers', select: 'name email' }
            ]);

            // Send email if assignee changed and is not the same as before
            // Also assigner should be Super Admin technically, but here any update by authorized user triggers it.
            // Requirement says "when superadmin assign task".
            // Since this route is protected, we can assume authorized user.
            if (assignee && assignee !== oldAssignee?.toString() && populatedTask.assignee) {
                const assignedBy = req.user.name;

                // Collect all attachments to send in the email
                const emailAttachments = [
                    ...(populatedTask.attachments || []),
                    ...(populatedTask.videoAttachments || [])
                ];

                const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
                const loginLink = `${baseUrl}/login`;

                sendTaskAssignmentEmail(
                    populatedTask.assignee.email,
                    populatedTask.name,
                    populatedTask.assignee.name,
                    assignedBy,
                    emailAttachments,
                    loginLink,
                    populatedTask.category
                );
            }

            // Emit real-time event
            req.app.get('io').emit('taskUpdated', populatedTask);

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
        const task = await Task.findOne({
            _id: req.params.id,
            company: req.companyId
        });

        if (task) {
            await task.deleteOne();
            // Emit real-time event
            req.app.get('io').emit('taskDeleted', req.params.id);
            res.json({ message: 'Task removed' });
        } else {
            res.status(404);
            throw new Error('Task not found');
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Bulk upload tasks/issues from Excel
// @route   POST /api/tasks/bulk-upload
// @access  Private (Manage Tasks)
const bulkUploadTasks = async (req, res) => {
    try {
        // 1️⃣ File validation
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

        const { project, category } = req.body;

        if (!project) {
            return res.status(400).json({ message: 'Project is required' });
        }

        const projectIdObj = new mongoose.Types.ObjectId(project);

        // 2️⃣ Parse Excel
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawSheet = workbook.Sheets[sheetName];

        const jsonData = xlsx.utils.sheet_to_json(rawSheet);
        if (!jsonData || jsonData.length === 0) {
            return res.status(400).json({ message: 'No data found in the Excel file' });
        }

        // Helper to find column name case-insensitively
        const findColumn = (row, possibleNames) => {
            const keys = Object.keys(row);
            for (const name of possibleNames) {
                const found = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
                if (found) return found;
            }
            return null;
        };

        const firstRow = jsonData[0];
        const titleKey = findColumn(firstRow, ['Title', 'Name', 'Task Name', 'Issue Name']);
        const descKey = findColumn(firstRow, ['Description', 'Task Description', 'Details']);
        const emailKey = findColumn(firstRow, ['Assignee Email', 'Email', 'Assignee']);
        const statusKey = findColumn(firstRow, ['Status', 'Task Status', 'State']);

        if (!titleKey) {
            return res.status(400).json({
                message: 'Invalid Excel format. Could not find "Title" or "Name" column.'
            });
        }

        // 3️⃣ Fetch statuses once for this project
        const allStatuses = await TaskStatus.find({ project: projectIdObj });
        const statusMap = {};
        let pendingStatus = null;
        let firstActiveStatus = null;

        allStatuses.forEach(s => {
            const normalizedName = s.name.trim().toLowerCase();
            statusMap[normalizedName] = s._id;

            if (s.status === 'active' && !firstActiveStatus) {
                firstActiveStatus = s;
            }

            if (normalizedName === 'pending') {
                pendingStatus = s;
            }
        });

        // Use first active as fallback if no "pending" exists
        const fallbackStatus = pendingStatus || firstActiveStatus;

        // 4️⃣ Collect distinct emails
        const emails = [...new Set(
            jsonData
                .map(row => emailKey ? row[emailKey]?.toString()?.trim()?.toLowerCase() : null)
                .filter(Boolean)
        )];

        // Only find users that belong to this company
        const company = await Company.findById(req.companyId);
        const memberIds = company.members.map(m => m.user);
        const users = await User.find({ 
            email: { $in: emails },
            _id: { $in: memberIds }
        });

        const userMap = {};
        users.forEach(u => {
            userMap[u.email.toLowerCase()] = u._id;
        });

        // 5️⃣ Project validation
        const projectDoc = await Project.findById(project).select('members').lean();

        if (!projectDoc) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const projectMembersSet = new Set(projectDoc.members.map(id => id.toString()));

        // 6️⃣ Existing task names
        const existingProjectTasks = await Task.find({ project, category }).select('name');

        const existingNames = new Set(existingProjectTasks.map(t => t.name.toLowerCase()));
        const newNamesInBatch = new Set();

        // 7️⃣ Prepare arrays
        const validTasks = [];
        const errors = [];
        const MAX_ERRORS = 1000;
        const now = new Date();

        // 8️⃣ Process rows
        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];

            const title = titleKey ? row[titleKey]?.toString()?.trim() : null;
            const description = descKey ? row[descKey]?.toString()?.trim() : '';
            const assigneeEmail = emailKey ? row[emailKey]?.toString()?.trim()?.toLowerCase() : null;
            const excelStatusName = statusKey ? row[statusKey]?.toString()?.trim()?.toLowerCase() : null;

            if (!title && !assigneeEmail) continue;

            if (!title) {
                if (errors.length < MAX_ERRORS) {
                    errors.push({ row: i + 2, message: 'Title is required' });
                }
                continue;
            }

            const titleLower = title.toLowerCase();

            if (existingNames.has(titleLower) || newNamesInBatch.has(titleLower)) {
                if (errors.length < MAX_ERRORS) {
                    errors.push({
                        row: i + 2,
                        message: `A ${category.toLowerCase()} with this title already exists`
                    });
                }
                continue;
            }

            let assigneeId = null;
            if (assigneeEmail) {
                const foundUser = userMap[assigneeEmail];
                if (foundUser && projectMembersSet.has(foundUser.toString())) {
                    assigneeId = foundUser;
                }
            }

            let taskStatusId = fallbackStatus?._id;
            if (excelStatusName && statusMap[excelStatusName]) {
                taskStatusId = statusMap[excelStatusName];
            } else if (pendingStatus) {
                // If provided status not found, default to pending (as per user request)
                taskStatusId = pendingStatus._id;
            }

            validTasks.push({
                name: title,
                description,
                taskStatus: taskStatusId,
                status: 'active',
                assignee: assigneeId,
                project: projectIdObj,
                company: req.companyId,
                category: category || 'TASK',
                createdAt: now,
                updatedAt: now,
                mentionedUsers: [],
                attachments: [],
                videoAttachments: []
            });

            newNamesInBatch.add(titleLower);
        }

        let insertedCount = 0;

        // 9️⃣ Insert tasks
        if (validTasks.length > 0) {

            const bulkWriteResult = await Task.insertMany(
                validTasks,
                { ordered: false }
            );

            insertedCount = bulkWriteResult.length;
        }

        // Emit real-time event to refresh lists on the frontend
        if (insertedCount > 0) {
            req.app.get('io').emit('taskCreated');
        }

        // 🔟 Response
        res.status(200).json({
            message: `Successfully inserted ${insertedCount} records.`,
            errors,
            insertedCount
        });

    } catch (error) {

        console.error('Bulk upload error:', error);

        res.status(500).json({
            message: error.message
        });

    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask,
    bulkUploadTasks
};
