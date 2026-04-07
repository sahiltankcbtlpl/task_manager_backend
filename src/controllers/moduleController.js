const Module = require('../models/Module');
const Subscription = require('../models/Subscription');

// @desc    Get all active modules
// @route   GET /api/modules
// @access  Private (Super Admin)
const getModules = async (req, res) => {
    try {
        const modules = await Module.find({ status: 'Active' }).sort({ name: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new module
// @route   POST /api/modules
// @access  Private (Super Admin)
const createModule = async (req, res) => {
    try {
        const { name } = req.body;
        
        // Find module by name (any status)
        let module = await Module.findOne({ name });

        if (module) {
            if (module.status === 'Active') {
                return res.status(400).json({ message: 'Module already exists' });
            } else {
                // Reactivate soft-deleted module
                module.status = 'Active';
                await module.save();
                return res.status(200).json(module);
            }
        }

        const newModule = await Module.create({ name });
        res.status(201).json(newModule);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Soft delete a module
// @route   DELETE /api/modules/:id
// @access  Private (Super Admin)
const deleteModule = async (req, res) => {
    try {
        const module = await Module.findById(req.params.id);
        if (!module) {
            return res.status(404).json({ message: 'Module not found' });
        }

        // Remove this module from all subscription plans that use it
        await Subscription.updateMany(
            { 'features.module': module.name },
            { $pull: { features: { module: module.name } } }
        );

        module.status = 'Deleted';
        await module.save();
        res.json({ message: 'Module removed and detached from all subscription plans' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    getModules,
    createModule,
    deleteModule
};
