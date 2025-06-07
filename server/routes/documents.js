const express = require('express');
const router = express.Router();
const Document = require('../models/Document');

router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;
        const newDoc = new Document({ title, content });
        await newDoc.save();
        res.status(201).json(newDoc);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create document' });
    }
});

// other routes...

module.exports = router;
