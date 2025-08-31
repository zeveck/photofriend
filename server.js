const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const app = express();
const PORT = 5567;

// Ensure photos directory exists
const photosDir = path.join(__dirname, 'photos');
if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir);
}

// Store photo metadata
const metadataFile = path.join(__dirname, 'photos', 'metadata.json');
let photosMetadata = [];

// Load existing metadata if it exists
if (fs.existsSync(metadataFile)) {
    try {
        photosMetadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    } catch (err) {
        photosMetadata = [];
    }
}

// Configure multer for file uploads (now using memory storage for processing)
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept only image files
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/photos', express.static(photosDir));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'photoframe.html'));
});

// Upload endpoint
app.post('/upload', upload.array('photos', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { title, date, location, tags, description } = req.body;
        const processedFiles = [];

        // Process each uploaded file
        for (const file of req.files) {
            // Generate filename based on metadata
            const fileTitle = title || 'untitled';
            const fileDate = date || new Date().toISOString().split('T')[0];
            const sanitizedTitle = fileTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const timestamp = Date.now();
            const filename = `${fileDate}_${sanitizedTitle}_${timestamp}.jpg`;
            const filepath = path.join(photosDir, filename);

            try {
                // Process image with sharp
                await sharp(file.buffer)
                    .rotate() // Auto-rotate based on EXIF orientation
                    .jpeg({ 
                        quality: 90, 
                        progressive: true,
                        force: true // Force JPEG output
                    })
                    .withMetadata() // Preserve metadata but fix orientation
                    .toFile(filepath);

                const photoData = {
                    filename: filename,
                    originalName: file.originalname,
                    title: title || 'Untitled',
                    date: date || new Date().toISOString().split('T')[0],
                    location: location || '',
                    tags: tags || '',
                    description: description || '',
                    uploadedAt: new Date().toISOString(),
                    size: file.size,
                    mimetype: 'image/jpeg'
                };
                photosMetadata.push(photoData);
                processedFiles.push(filename);
            } catch (processError) {
                console.error('Error processing image:', file.originalname, processError);
                // Try to save without processing as fallback
                const fallbackExt = path.extname(file.originalname) || '.jpg';
                const fallbackFilename = `${fileDate}_${sanitizedTitle}_${timestamp}${fallbackExt}`;
                const fallbackPath = path.join(photosDir, fallbackFilename);
                fs.writeFileSync(fallbackPath, file.buffer);
                
                const photoData = {
                    filename: fallbackFilename,
                    originalName: file.originalname,
                    title: title || 'Untitled',
                    date: date || new Date().toISOString().split('T')[0],
                    location: location || '',
                    tags: tags || '',
                    description: description || '',
                    uploadedAt: new Date().toISOString(),
                    size: file.size,
                    mimetype: file.mimetype
                };
                photosMetadata.push(photoData);
                processedFiles.push(fallbackFilename);
            }
        }

        // Save metadata to file
        fs.writeFileSync(metadataFile, JSON.stringify(photosMetadata, null, 2));

        res.json({ 
            success: true, 
            message: `${processedFiles.length} photo(s) uploaded successfully`,
            files: processedFiles
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload photos' });
    }
});

// Get all photos with metadata
app.get('/api/photos', (req, res) => {
    res.json(photosMetadata);
});

// Get single photo metadata
app.get('/api/photos/:filename', (req, res) => {
    const photo = photosMetadata.find(p => p.filename === req.params.filename);
    if (photo) {
        res.json(photo);
    } else {
        res.status(404).json({ error: 'Photo not found' });
    }
});

// Update photo metadata
app.patch('/api/photos/:filename', (req, res) => {
    const oldFilename = req.params.filename;
    const photoIndex = photosMetadata.findIndex(p => p.filename === oldFilename);
    
    if (photoIndex === -1) {
        return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = photosMetadata[photoIndex];
    let newFilename = oldFilename;

    // Check if date is being updated
    if (req.body.date && req.body.date !== photo.date) {
        // Generate new filename with updated date
        const fileTitle = photo.title || 'untitled';
        const sanitizedTitle = fileTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        // Extract timestamp from old filename or use current time
        let timestamp;
        const oldParts = oldFilename.match(/_(\d+)\./);
        if (oldParts && oldParts[1]) {
            timestamp = oldParts[1];
        } else {
            timestamp = Date.now();
        }
        
        // Determine file extension
        const extension = path.extname(oldFilename) || '.jpg';
        newFilename = `${req.body.date}_${sanitizedTitle}_${timestamp}${extension}`;
        
        // Rename the physical file
        const oldPath = path.join(photosDir, oldFilename);
        const newPath = path.join(photosDir, newFilename);
        
        try {
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
            }
            // Update filename in metadata
            photosMetadata[photoIndex].filename = newFilename;
        } catch (err) {
            console.error('Error renaming file:', err);
            return res.status(500).json({ error: 'Failed to rename file' });
        }
    }

    // Update the metadata fields that were sent
    const allowedFields = ['title', 'date', 'location', 'tags', 'description'];
    Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
            photosMetadata[photoIndex][key] = req.body[key];
        }
    });

    // Save updated metadata to file
    fs.writeFileSync(metadataFile, JSON.stringify(photosMetadata, null, 2));

    res.json({ 
        success: true, 
        message: 'Photo metadata updated successfully',
        photo: photosMetadata[photoIndex],
        newFilename: newFilename
    });
});

// Delete photo
app.delete('/api/photos/:filename', (req, res) => {
    const filename = req.params.filename;
    const photoIndex = photosMetadata.findIndex(p => p.filename === filename);
    
    if (photoIndex === -1) {
        return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete file
    const filePath = path.join(photosDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // Remove from metadata
    photosMetadata.splice(photoIndex, 1);
    fs.writeFileSync(metadataFile, JSON.stringify(photosMetadata, null, 2));

    res.json({ success: true, message: 'Photo deleted successfully' });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
    console.log(`PhotoFriend server running at http://localhost:${PORT}`);
    console.log(`Photos will be stored in: ${photosDir}`);
});