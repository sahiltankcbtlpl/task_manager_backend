const DocumentPage = require('../models/DocumentPage');
const Document = require('../models/Document');

// @desc    Create a new document page
// @route   POST /api/documentPages
// @access  Private
const createDocumentPage = async (req, res) => {
    try {
        const { doc_id, pageNo, pageContent } = req.body;

        if (!doc_id || pageNo === undefined) {
            return res.status(400).json({ message: 'doc_id and pageNo are required' });
        }

        const document = await Document.findById(doc_id);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const existingPage = await DocumentPage.findOne({ doc_id, pageNo });
        if (existingPage) {
            return res.status(400).json({ message: 'Page number already exists for this document' });
        }

        const documentPage = await DocumentPage.create({
            doc_id,
            pageNo,
            pageContent: pageContent || '',
            createdBy: req.user._id,
        });

        res.status(201).json(documentPage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get all pages for a specific document
// @route   GET /api/documentPages/:docId
// @access  Private
const getDocumentPages = async (req, res) => {
    try {
        const { docId } = req.params;

        const document = await Document.findById(docId);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const pages = await DocumentPage.find({ doc_id: docId })
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .sort({ pageNo: 1 });

        res.status(200).json(pages);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a document page
// @route   PUT /api/documentPages/:id
// @access  Private
const updateDocumentPage = async (req, res) => {
    try {
        const { id } = req.params;
        const { pageContent, pageNo } = req.body;

        const documentPage = await DocumentPage.findById(id);

        if (!documentPage) {
            return res.status(404).json({ message: 'Document page not found' });
        }

        if (pageNo !== undefined && pageNo !== documentPage.pageNo) {
            const conflictPage = await DocumentPage.findOne({ doc_id: documentPage.doc_id, pageNo });
            if (conflictPage && conflictPage._id.toString() !== id) {
                return res.status(400).json({ message: 'Page number already exists for this document' });
            }
            documentPage.pageNo = pageNo;
        }

        if (pageContent !== undefined) {
            documentPage.pageContent = pageContent;
        }

        documentPage.updatedBy = req.user._id;

        const updatedPage = await documentPage.save();

        res.status(200).json(updatedPage);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a document page
// @route   DELETE /api/documentPages/:id
// @access  Private
const deleteDocumentPage = async (req, res) => {
    try {
        const { id } = req.params;

        const documentPage = await DocumentPage.findById(id);

        if (!documentPage) {
            return res.status(404).json({ message: 'Document page not found' });
        }

        await documentPage.deleteOne();

        res.status(200).json({ message: 'Document page removed' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createDocumentPage,
    getDocumentPages,
    updateDocumentPage,
    deleteDocumentPage
};
