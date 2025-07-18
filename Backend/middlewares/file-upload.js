// middlewares/file-upload.js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 
const HttpError = require('../models/http-error');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
     
        const ext = path.extname(file.originalname); 
        cb(null, `${uuidv4()}${ext}`); 
    },
});

const fileFilter = (req, file, cb) => {
   
    if (file.mimetype.startsWith('image/') || file.mimetype === 'text/plain') {
        cb(null, true);
    } else {
       
        cb(new HttpError('Invalid file type! Only images (PNG, JPEG, GIF, etc.) and plain text files (.txt, .log) are allowed.', 400), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
    fileFilter: fileFilter
});

module.exports = upload;