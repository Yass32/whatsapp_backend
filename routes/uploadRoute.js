/**
 * File Upload Routes - API Endpoints for File Management
 *
 * This module handles file upload operations including:
 * - Image uploads for course covers
 * - Document uploads for course materials
 * - File validation and storage
 */

// 1. First, we need to require necessary modules
const express = require('express');
const router = express.Router();
const multer = require('multer'); // For handling file uploads
const path = require('path'); // For file path operations
const fs = require('fs'); // For file system operations

// 2. Configure multer storage settings
const storage = multer.diskStorage({
    destination: function (request, file, callback) {
        // Create uploads directory if it doesn't exist
        const ROOT = path.resolve(__dirname, ".."); // go up from /routes to project root
        const UPLOAD_DIRECTORY = path.join(ROOT, "uploads", "course_media"); // create uploads/course_media directory
        if (!fs.existsSync(UPLOAD_DIRECTORY)) {
            fs.mkdirSync(UPLOAD_DIRECTORY, { recursive: true });
        }
        callback(null, UPLOAD_DIRECTORY); // Files will be saved in 'uploads/course_media' folder
    },
    filename: function (request, file, callback) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        const basename = path.basename(file.originalname, extension);
        callback(null, basename + '-' + uniqueSuffix + extension);
    }
});

// 3. File filter function to validate file types
const fileFilter = (request, file, callback) => {
    // Allowed file types
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'video/mp4',
        'application/pdf',
        'application/msword',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        callback(null, true); // Accept file
    } else {
        callback(new Error('Invalid file type. Only images, videos, PDF, and Word documents are allowed.'), false);
    }
};

// 4. Configure multer with our settings
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 30 * 1024 * 1024 // 30MB limit
    },
    fileFilter: fileFilter
});




/**
 * POST /upload/single
 * Upload a single file
 *
 * Uploads one file at a time with validation.
 * Commonly used for profile pictures or course cover images.
 *
 * Request: multipart/form-data with 'file' field
 * Response: JSON with file information
 */
router.post('/single', upload.single('file'), (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // File uploaded successfully
        response.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            file: {
                filename: request.file.filename,
                originalname: request.file.originalname,
                mimetype: request.file.mimetype,
                size: request.file.size,
                path: request.file.path,
                url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'File upload failed',
            details: error.message
        });
    }
});



// Cover Image
router.post("/cover", upload.single("file"), (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).json({
                success: false,
                error: 'No cover image uploaded'
            });
        }

        if(request.file.size > 5 * 1024 * 1024) { // Whatsapp cover images 5MB limit
            return response.status(400).json({
                success: false,
                error: 'Image size exceeds limit'
            });
        }

        // File uploaded successfully
        response.status(200).json({
            success: true,
            message: 'Cover image uploaded successfully',
            file: {
                filename: request.file.filename,
                originalname: request.file.originalname,
                mimetype: request.file.mimetype,
                size: request.file.size,
                path: request.file.path, // path to the file
                url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'Cover image upload failed',
            details: error.message
        });
    }
});

// Document
router.post("/document", upload.single("file"), (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).json({
                success: false,
                error: 'No document uploaded'
            });
        }

        if(request.file.size > 30 * 1024 * 1024) { // Whatsapp documents 100MB limit
            return response.status(400).json({
                success: false,
                error: 'Document size exceeds limit'
            });
        }

        // File uploaded successfully
        response.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            file: {
                filename: request.file.filename,
                originalname: request.file.originalname,
                mimetype: request.file.mimetype,
                size: request.file.size,
                path: request.file.path,
                url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'Document upload failed',
            details: error.message
        });
    }
});

// Media (video/audio/image)
router.post("/media", upload.single("file"), (request, response) => {
    const extension = path.extname(request.file.originalname).toLowerCase();
    if( extension === ".mp4") {
        response.type("video/mp4");
        console.log("Video sent to", request.file.path);
    }
    try {
        if (!request.file) {
            return response.status(400).json({
                success: false,
                error: 'No media file uploaded'
            });
        }

        if(request.file.size > 16 * 1024 * 1024) {   // Whatsapp videos 16MB limit
            return response.status(400).json({
                success: false,
                error: 'Media file size exceeds limit'
            });
        }

        // File uploaded successfully
        response.status(200).json({
            success: true,
            message: 'Media file uploaded successfully',
            file: {
                filename: request.file.filename,
                originalname: request.file.originalname,
                mimetype: request.file.mimetype,
                size: request.file.size,
                path: request.file.path,
                url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'Media file upload failed',
            details: error.message
        });
    }
});
  

/**
 * POST /upload/multiple
 * Upload multiple files
 *
 * Uploads up to 10 files at once with validation.
 * Commonly used for course materials or bulk document uploads.
 *
 * Request: multipart/form-data with 'files' field (array)
 * Response: JSON with array of uploaded files
 */
router.post('/multiple', upload.array('files', 10), (request, response) => {
    try {
        if (!request.files || request.files.length === 0) {
            return response.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        // Process uploaded files
        const uploadedFiles = request.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${file.filename}`
        }));

        response.status(200).json({
            success: true,
            message: `${request.files.length} files uploaded successfully`,
            files: uploadedFiles
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'File upload failed',
            details: error.message
        });
    }
});

/**
 * DELETE /upload/:filename
 * Delete a specific file
 *
 * Removes a file from the server by filename.
 * Use with caution - permanent deletion.
 *
 * @param {string} filename - Name of file to delete
 */
router.delete('/:filename', (request, response) => {
    try {
        const filename = request.params.filename;
        const ROOT = path.resolve(__dirname, ".."); // go up from /routes to project root
        const filePath = path.join(ROOT, 'uploads', 'course_media', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return response.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Delete the file
        fs.unlinkSync(filePath);

        response.status(200).json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'File deletion failed',
            details: error.message
        });
    }
});

/**
 * DELETE /upload/all
 * Delete all files
 *
 * Removes all files from the server.
 * Use with caution - permanent deletion.
 */
router.delete('/all', (request, response) => {
    try {
        const ROOT = path.resolve(__dirname, ".."); // go up from /routes to project root
        const uploadDirectory = path.join(ROOT, 'uploads', 'course_media');

        // Check if upload directory exists
        if (!fs.existsSync(uploadDirectory)) {
            return response.status(404).json({
                success: false,
                error: 'Upload directory not found'
            });
        }

        // Delete all files in the upload directory
        fs.readdirSync(uploadDirectory).forEach(file => {
            const filePath = path.join(uploadDirectory, file);
            fs.unlinkSync(filePath);
        });

        response.status(200).json({
            success: true,
            message: 'All files deleted successfully'
        });
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'File deletion failed',
            details: error.message
        });
    }
});

/**
 * GET /upload/:filename
 * Serve uploaded files
 *
 * Serves files from the uploads directory.
 * Allows accessing uploaded files via URL.
 *
 * @param {string} filename - Name of file to serve
 */
router.get('/:filename', (request, response) => {
    try {
        const filename = request.params.filename;
        const filePath = path.join(__dirname, '../uploads/course_media', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return response.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Send the file
        response.sendFile(filePath);
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'File serving failed',
            details: error.message
        });
    }
});

module.exports = router;
