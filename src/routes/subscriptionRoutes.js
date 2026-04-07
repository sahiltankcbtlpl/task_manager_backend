const express = require('express');
const router = express.Router();
const {
    createSubscription,
    getSubscriptions,
    getSubscriptionById,
    updateSubscription,
    deleteSubscription,
    getSubscriptionUsage
} = require('../controllers/subscriptionController');
const { protect } = require('../middlewares/auth');
const { checkPermission } = require('../middlewares/role');

// All subscription routes are protected
router.use(protect);

router.route('/usage')
    .get(getSubscriptionUsage);

router.route('/')
    .post(checkPermission('subscriptions-create'), createSubscription)
    .get(checkPermission('subscriptions-read'), getSubscriptions);

router.route('/:id')
    .get(checkPermission('subscriptions-read'), getSubscriptionById)
    .put(checkPermission('subscriptions-update'), updateSubscription)
    .delete(checkPermission('subscriptions-delete'), deleteSubscription);

module.exports = router;
