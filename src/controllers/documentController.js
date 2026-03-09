const Document = require('../models/Document');
const Project = require('../models/Project');
const { isUserProjectMember } = require('../utils/projectHelper');
const { sendReviewRequestMail, sendReviewResponseMail, sendDocumentSharedMail } = require('../services/email.service');
const path = require('path');
const fs = require('fs');

// @desc    Upload a new document
// @route   POST /api/documents
// @access  Private
const createDocument = async (req, res) => {
    try {
        const { project, name, description, allowedUsers } = req.body;

        if (!project || !name || !description) {
            return res.status(400).json({ message: 'Project, name, and description are required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'File is required' });
        }

        const isMember = await isUserProjectMember(project, req.user._id);
        if (!isMember && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized for this project' });
        }

        // Parse allowedUsers safely
        let parsedAllowedUsers = [];
        if (allowedUsers) {
            try {
                parsedAllowedUsers = JSON.parse(allowedUsers);
            } catch (e) {
                // if it's not JSON, it might just be a string or array of strings depending on frontend
                parsedAllowedUsers = Array.isArray(allowedUsers) ? allowedUsers : [allowedUsers];
            }
        }

        // Add owner to allowedUsers automatically if not present (optional, but good for logic)
        if (!parsedAllowedUsers.includes(req.user._id.toString())) {
            parsedAllowedUsers.push(req.user._id);
        }

        const document = await Document.create({
            project,
            name,
            description,
            fileUrl: req.file.path,
            fileName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            owner: req.user._id,
            allowedUsers: parsedAllowedUsers
        });

        const populatedDoc = await document.populate([
            { path: 'owner', select: 'name email' },
            { path: 'allowedUsers', select: 'name email' },
            { path: 'project', select: 'title' }
        ]);

        // Send Email to allowed users
        const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
        const docLink = `${baseUrl}/documents?project=${project}`;
        populatedDoc.allowedUsers.forEach(user => {
            if (user._id.toString() !== req.user._id.toString()) {
                sendDocumentSharedMail(
                    user.email,
                    user.name,
                    populatedDoc.name,
                    populatedDoc.project?.title || 'your project',
                    docLink
                );
            }
        });

        res.status(201).json(populatedDoc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all documents (filtered by project optional)
// @route   GET /api/documents
// @access  Private
const getDocuments = async (req, res) => {
    try {
        const { project, page = 1, limit = 10, search } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (project) {
            // Check if user is a member of the project or Super Admin
            const isMember = await isUserProjectMember(project, req.user._id);
            if (!isMember && req.user.role.name !== 'Super Admin') {
                return res.status(403).json({ message: 'Not authorized for this project' });
            }
            query.project = project;
        } else if (req.user.role.name !== 'Super Admin') {
            const userProjects = await Project.find({ members: req.user._id }).select('_id');
            const projectIds = userProjects.map(p => p._id);
            query.project = { $in: projectIds };
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const startIndex = (pageNum - 1) * limitNum;
        const total = await Document.countDocuments(query);

        let documents = await Document.find(query)
            .populate('owner', 'name email')
            .populate('allowedUsers', 'name email')
            .populate('reviewRequests.requestedBy', 'name email')
            .populate('project', 'title')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limitNum);

        // Add visibility logic for frontend mapping
        const responseDocs = documents.map(doc => {
            const docObj = doc.toObject();

            // Check permissions
            const isOwner = doc.owner._id.toString() === req.user._id.toString();
            const SuperAdmin = req.user.role.name === 'Super Admin';
            const isAllowed = doc.allowedUsers.some(user => user._id.toString() === req.user._id.toString());

            const hasAccess = isOwner || isAllowed || SuperAdmin;

            // Restrict sensitive info if not allowed
            if (!hasAccess) {
                delete docObj.fileUrl; // Don't send file URL
            }

            return {
                ...docObj,
                project: docObj.project,
                hasAccess,
                isOwner
            };
        });

        res.json({
            documents: responseDocs,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                pageSize: limitNum,
                totalItems: total
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request a review for a document
// @route   POST /api/documents/:id/request-review
// @access  Private
const requestReview = async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user._id;

        // First, verify the document exists and the user is a project member
        const docCheck = await Document.findById(documentId);
        if (!docCheck) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const isMember = await isUserProjectMember(docCheck.project, userId);
        if (!isMember && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized for this project' });
        }

        // Avoid race conditions: Use atomic update to only add if requestedBy != userId
        const document = await Document.findOneAndUpdate(
            {
                _id: documentId,
                'reviewRequests.requestedBy': { $ne: userId }
            },
            {
                $push: {
                    reviewRequests: { requestedBy: userId, status: 'pending' }
                }
            },
            { new: true }
        ).populate('owner', 'name email');

        if (!document) {
            // If document is null, it means the query failed because user already requested review
            return res.status(400).json({ message: 'Review request already exists or document not found' });
        }

        // Send Email
        const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
        const docLink = `${baseUrl}/documents?review=${documentId}&project=${document.project}`;

        sendReviewRequestMail(
            document.owner.email,
            document.owner.name,
            document.name,
            req.user.name,
            docLink
        );

        res.status(200).json({ message: 'Review request sent' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Respond to a review request
// @route   PUT /api/documents/:id/respond-review
// @access  Private (Owner only)
const respondToReview = async (req, res) => {
    try {
        const { id: documentId } = req.params;
        const { requestId, status } = req.body; // status: 'accepted' | 'declined'

        if (!['accepted', 'declined'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const document = await Document.findById(documentId).populate('reviewRequests.requestedBy', 'name email');

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (document.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized to respond to this request (owner only)' });
        }

        const requestIndex = document.reviewRequests.findIndex(r => r._id.toString() === requestId);

        if (requestIndex === -1) {
            return res.status(404).json({ message: 'Review request not found' });
        }

        const reviewRequest = document.reviewRequests[requestIndex];

        if (reviewRequest.status !== 'pending') {
            return res.status(400).json({ message: 'Request has already been processed' });
        }

        // Update status
        document.reviewRequests[requestIndex].status = status;

        if (status === 'accepted') {
            if (!document.allowedUsers.includes(reviewRequest.requestedBy._id)) {
                document.allowedUsers.push(reviewRequest.requestedBy._id);
            }
        }

        await document.save();

        // Send Email
        const baseUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000';
        const docLink = `${baseUrl}/documents?project=${document.project}`;
        sendReviewResponseMail(
            reviewRequest.requestedBy.email,
            reviewRequest.requestedBy.name,
            document.name,
            status,
            docLink
        );

        res.status(200).json({ message: `Review request ${status}` });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Download a document
// @route   GET /api/documents/:id/download
// @access  Private
const downloadDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const isOwner = document.owner.toString() === req.user._id.toString();
        const isAllowed = document.allowedUsers.includes(req.user._id);
        const isSuperAdmin = req.user.role.name === 'Super Admin';

        if (!isOwner && !isAllowed && !isSuperAdmin) {
            return res.status(403).json({ message: 'Not authorized to download this document' });
        }

        const filePath = path.resolve(document.fileUrl);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found on server' });
        }

        res.download(filePath, document.fileName);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a document
// @route   PUT /api/documents/:id
// @access  Private (Owner only)
const updateDocument = async (req, res) => {
    try {
        const { name, description, allowedUsers } = req.body;
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (document.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized to update this document' });
        }

        if (name) document.name = name;
        if (description) document.description = description;

        if (allowedUsers) {
            let parsedAllowedUsers = [];
            try {
                parsedAllowedUsers = JSON.parse(allowedUsers);
            } catch (e) {
                parsedAllowedUsers = Array.isArray(allowedUsers) ? allowedUsers : [allowedUsers];
            }
            if (!parsedAllowedUsers.includes(document.owner.toString())) {
                parsedAllowedUsers.push(document.owner);
            }
            document.allowedUsers = parsedAllowedUsers;
        }

        // Handle File Replacement
        if (req.file) {
            // Delete old file
            if (document.fileUrl) {
                const oldFilePath = path.resolve(document.fileUrl);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }

            document.fileUrl = req.file.path;
            document.fileName = req.file.originalname;
            document.mimetype = req.file.mimetype;
            document.size = req.file.size;
        } else if (req.body.removeFile === 'true') {
            // Remove existing file without replacing
            if (document.fileUrl) {
                const oldFilePath = path.resolve(document.fileUrl);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            document.fileUrl = undefined;
            document.fileName = undefined;
            document.mimetype = undefined;
            document.size = undefined;
        }

        const updatedDoc = await document.save();
        const populatedDoc = await updatedDoc.populate([
            { path: 'owner', select: 'name email' },
            { path: 'allowedUsers', select: 'name email' }
        ]);

        res.status(200).json(populatedDoc);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private (Owner only)
const deleteDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        if (document.owner.toString() !== req.user._id.toString() && req.user.role.name !== 'Super Admin') {
            return res.status(403).json({ message: 'Not authorized to delete this document' });
        }

        // Delete file from server
        const filePath = path.resolve(document.fileUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await document.deleteOne();
        res.status(200).json({ message: 'Document removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createDocument,
    getDocuments,
    requestReview,
    respondToReview,
    downloadDocument,
    updateDocument,
    deleteDocument
};
