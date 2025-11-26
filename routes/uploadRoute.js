/**
 * File Upload Routes - API Endpoints for Cloudinary File Management
 *
 * This module handles file upload operations to Cloudinary including:
 * - Image uploads for course covers (up to 5MB)
 * - Document uploads for course materials (up to 30MB)
 * - Media uploads for course content (up to 16MB)
 * - File validation and cloud storage management
 * 
 * @module uploadRoute
 * @requires express
 * @requires multer
 * @requires multer-storage-cloudinary
 * @requires ../config/cloudinaryConfig
 */

// 1. First, we need to require necessary modules
const express = require('express');
const router = express.Router();
const multer = require('multer'); // For handling file uploads
const path = require('path'); // For file path operations
const fs = require('fs'); // For file system operations
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinaryConfig');


/**
 * Cloudinary storage configuration
 * Automatically handles file upload to Cloudinary with proper folder organization
*/
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (request, file) => {
    let folder = 'course_media'; // organize your upload

    console.log('Uploading file:', file.originalname, 'of type:', file.mimetype);

    // Detect file type
    let resourceType = 'auto';   // auto-detect image/video/pdf
    if (file.mimetype.startsWith('application/')) {
      resourceType = 'raw';
    }

    // Extract file extension for raw files (PDF, DOCX, etc.)
    const ext = resourceType === 'raw' ? require('path').extname(file.originalname) : '';
    
    return {
      folder: folder,
      resource_type: resourceType, // auto-detect (image, video, raw, etc.)
      public_id: `${file.originalname.split('.')[0]}-${Date.now()}${ext}`, // filename without extension
    };
  },
});


/*
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
*/

/**
 * File filter function to validate file types
 * @param {Object} request - Express request object
 * @param {Object} file - Uploaded file object
 * @param {Function} callback - Callback function
 */
const fileFilter = (request, file, callback) => {
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

// Configure multer with Cloudinary storage
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 30 * 1024 * 1024 // 30MB limit
    },
    fileFilter: fileFilter
});




/**
 * @route POST /upload/single
 * @description Upload a single file to Cloudinary
 * @param {Object} request.file - File from multipart/form-data with 'file' field
 * @returns {Object} JSON with Cloudinary file information
 */
router.post('/single', upload.single('file'), async (request, response) => {
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
                filename: request.file.filename, // unique Cloudinary ID
                url: request.file.path, // 🌐 Cloudinary URL
                resource_type: request.file.resource_type, // Cloudinary resource type (image, video, raw, etc.)
                format: request.file.format,
                size: request.file.size
                //originalname: request.file.originalname,
                //mimetype: request.file.mimetype,
                //path: request.file.path,
                //url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        response.status(500).json({
            success: false,
            message: 'File upload failed',
            error: error.message
        });
    }
});



// Cover Image
router.post("/cover", upload.single("file"), async (request, response) => {
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
                filename: request.file.filename, // unique Cloudinary ID
                url: request.file.path, // 🌐 Cloudinary URL
                resource_type: request.file.resource_type, // Cloudinary resource type (image, video, raw, etc.)
                format: request.file.format,
                size: request.file.size    
                //originalname: request.file.originalname,
                //mimetype: request.file.mimetype,
                //path: request.file.path,
                //url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        console.error('Cover image upload error:', error);
        response.status(500).json({
            success: false,
            message: 'Cover image upload failed',
            error: error.message
        });
    }
});

// Document
router.post("/document", upload.single("file"), async (request, response) => {
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
                filename: request.file.filename, // unique Cloudinary ID
                url: request.file.path, // 🌐 Cloudinary URL
                resource_type: request.file.resource_type, // Cloudinary resource type (image, video, raw, etc.)
                format: request.file.format,
                size: request.file.size 
                //originalname: request.file.originalname,
                //mimetype: request.file.mimetype,
                //path: request.file.path,
                //url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        console.error('Document upload error:', error);
        response.status(500).json({
            success: false,
            message: 'Document upload failed',
            error: error.message
        });
    }
});

// Media (video/audio/image)
router.post("/media", upload.single("file"), async (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).json({
                success: false,
                error: 'No media file uploaded'
            });
        }

        const extension = path.extname(request.file.originalname).toLowerCase();
        if( extension === ".mp4") {
            response.type("video/mp4");
            console.log("Video sent to", request.file.path);
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
                filename: request.file.filename, // unique Cloudinary ID
                url: request.file.path, // 🌐 Cloudinary URL
                resource_type: request.file.resource_type, // Cloudinary resource type (image, video, raw, etc.)
                format: request.file.format,
                size: request.file.size   
                //originalname: request.file.originalname,
                //mimetype: request.file.mimetype,
                //path: request.file.path,
                //url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${request.file.filename}` // URL to access the file
            }
        });
    } catch (error) {
        console.error('Media upload error:', error);
        response.status(500).json({
            success: false,
            message: 'Media file upload failed',
            error: error.message
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
router.post('/multiple', upload.array('files', 10), async (request, response) => {
    try {
        if (!request.files || request.files.length === 0) {
            return response.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }

        // Process uploaded files
        const uploadedFiles = request.files.map(file => ({
            filename: file.filename, // unique Cloudinary ID
            url: file.path, // 🌐 Cloudinary URL
            resource_type: file.resource_type, // Cloudinary resource type (image, video, raw, etc.)  
            format: file.format,
            size: file.size     
            //originalname: file.originalname,
            //mimetype: file.mimetype,
            //path: file.path,
            //url: `https://whatsapp-backend-s4dm.onrender.com/uploads/course_media/${file.filename}`
        }));

        response.status(200).json({
            success: true,
            message: `${uploadedFiles.length} files uploaded successfully`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('❌ Multiple upload failed:', error);
        response.status(500).json({
            success: false,
            error: 'Multiple file upload failed',
            details: error.message
        });
    }
});

/**
 * @route DELETE /upload/:filename
 * @description Delete a specific file from Cloudinary
 * @param {string} filename - Public ID of the file in Cloudinary
 * @returns {Object} JSON with deletion status
 */
router.delete('/:filename', async (request, response) => {
    try {

        const { filename } = request.params;
        if (!filename) return response.status(400).json({ success: false, message: 'Missing file ID' });

        // Cloudinary destroy
        const result = await cloudinary.uploader.destroy(filename, { resource_type: 'auto' });

        if (result.result === 'ok') {
            response.status(200).json({ success: true, message: 'File deleted successfully', result });
        } else {
            response.status(404).json({ success: false, message: 'File not found or already deleted', result });
        }



        /*
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
        */
    } catch (error) {
        console.error('❌ Delete failed:', error);
        response.status(500).json({
            success: false,
            message: 'File deletion failed',
            error: error.message
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
router.delete('/all', async (request, response) => {
    try {
        const folder = 'course_media';
        const { resources } = await cloudinary.api.resources({
            type: 'upload',
            prefix: folder + '/',
            max_results: 500,
        });

        if (!resources.length) {
            return response.status(200).json({ success: true, message: 'No files to delete' });
        }

        const publicIds = resources.map(file => file.public_id);
        const deleteResult = await cloudinary.api.delete_resources(publicIds, { resource_type: 'auto' });

        response.status(200).json({
            success: true,
            message: `Deleted ${publicIds.length} files successfully`,
            result: deleteResult,
        });

        /*
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
        */
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
router.get('/:filename', async (request, response) => {
    try {

        const { filename } = request.params;
        if (!filename) return response.status(400).json({ success: false, message: 'Missing file ID' });

        // Get detailed info about the file from Cloudinary
        const result = await cloudinary.api.resource(filename, {
            resource_type: 'auto', // Automatically detect (image, video, raw, etc.)
        });

        // Return all details
        response.status(200).json({
        success: true,
        message: 'File retrieved successfully',
        file: {
            public_id: result.public_id,
            url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            created_at: result.created_at,
            type: result.resource_type,
            folder: result.folder,
        },
        });


        /*
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
        */
    } catch (error) {
        response.status(500).json({
            success: false,
            error: 'File serving failed',
            details: error.message
        });
    }
});

module.exports = router;