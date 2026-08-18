const express = require('express');
const router = express.Router({ mergeParams: true });
const reviewController = require('../controllers/reviewController');

router.get('/',       reviewController.getReviewsByBook);
router.get('/:id',    reviewController.getReviewById);
router.post('/',      reviewController.createReview);
router.put('/:id',    reviewController.updateReview);
router.delete('/:id', reviewController.deleteReview);

module.exports = router;
