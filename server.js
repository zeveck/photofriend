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

// Default album for existing photos
const DEFAULT_ALBUM = 'default';

// Store photo metadata
const metadataFile = path.join(__dirname, 'photos', 'metadata.json');
let photosMetadata = [];

// Load existing metadata if it exists
if (fs.existsSync(metadataFile)) {
    try {
        photosMetadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        
        // Migrate existing photos to have album field
        let needsSave = false;
        photosMetadata.forEach(photo => {
            if (!photo.album) {
                photo.album = DEFAULT_ALBUM;
                needsSave = true;
            }
        });
        
        if (needsSave) {
            fs.writeFileSync(metadataFile, JSON.stringify(photosMetadata, null, 2));
        }
    } catch (err) {
        photosMetadata = [];
    }
}

// Ensure default album directory exists
const defaultAlbumDir = path.join(photosDir, DEFAULT_ALBUM);
if (!fs.existsSync(defaultAlbumDir)) {
    fs.mkdirSync(defaultAlbumDir);
}

// Move existing photos to default album if they're in the root photos directory
photosMetadata.forEach(photo => {
    const oldPath = path.join(photosDir, photo.filename);
    const newPath = path.join(photosDir, photo.album || DEFAULT_ALBUM, photo.filename);
    
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        try {
            fs.renameSync(oldPath, newPath);
        } catch (err) {
            console.error(`Failed to move ${photo.filename} to album:`, err);
        }
    }
});

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

// Serve static files with album support
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

        const { title, date, location, tags, description, album } = req.body;
        const processedFiles = [];

        // Process each uploaded file
        for (const file of req.files) {
            // Generate filename based on metadata
            const fileTitle = title || 'untitled';
            const fileDate = date || new Date().toISOString().split('T')[0];
            const fileAlbum = album || DEFAULT_ALBUM;
            const sanitizedTitle = fileTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const timestamp = Date.now();
            const filename = `${fileDate}_${sanitizedTitle}_${timestamp}.jpg`;
            
            // Ensure album directory exists
            const albumDir = path.join(photosDir, fileAlbum);
            if (!fs.existsSync(albumDir)) {
                fs.mkdirSync(albumDir, { recursive: true });
            }
            
            const filepath = path.join(albumDir, filename);

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
                    album: fileAlbum,
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
                const fallbackPath = path.join(albumDir, fallbackFilename);
                fs.writeFileSync(fallbackPath, file.buffer);
                
                const photoData = {
                    filename: fallbackFilename,
                    originalName: file.originalname,
                    title: title || 'Untitled',
                    date: date || new Date().toISOString().split('T')[0],
                    location: location || '',
                    tags: tags || '',
                    description: description || '',
                    album: fileAlbum,
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
        
        // Rename the physical file (including album directory)
        const albumDir = photo.album || DEFAULT_ALBUM;
        const oldPath = path.join(photosDir, albumDir, oldFilename);
        const newPath = path.join(photosDir, albumDir, newFilename);

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

    const photo = photosMetadata[photoIndex];
    // Delete file from album directory
    const filePath = path.join(photosDir, photo.album || DEFAULT_ALBUM, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // Remove from metadata
    photosMetadata.splice(photoIndex, 1);
    fs.writeFileSync(metadataFile, JSON.stringify(photosMetadata, null, 2));

    res.json({ success: true, message: 'Photo deleted successfully' });
});

// Get all albums
app.get('/api/albums', (req, res) => {
    try {
        const albums = [];
        const entries = fs.readdirSync(photosDir, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const albumPath = path.join(photosDir, entry.name);
                const photos = photosMetadata.filter(p => p.album === entry.name);
                albums.push({
                    name: entry.name,
                    photoCount: photos.length,
                    isDefault: entry.name === DEFAULT_ALBUM
                });
            }
        }
        
        res.json(albums);
    } catch (error) {
        console.error('Error getting albums:', error);
        res.status(500).json({ error: 'Failed to get albums' });
    }
});

// Create new album
app.post('/api/albums', (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Album name is required' });
        }
        
        // Sanitize album name for filesystem
        const sanitizedName = name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
        
        if (!sanitizedName) {
            return res.status(400).json({ error: 'Invalid album name' });
        }
        
        const albumPath = path.join(photosDir, sanitizedName);
        
        if (fs.existsSync(albumPath)) {
            return res.status(409).json({ error: 'Album already exists' });
        }
        
        fs.mkdirSync(albumPath);
        res.json({ 
            success: true, 
            message: 'Album created successfully',
            album: {
                name: sanitizedName,
                photoCount: 0,
                isDefault: false
            }
        });
    } catch (error) {
        console.error('Error creating album:', error);
        res.status(500).json({ error: 'Failed to create album' });
    }
});

// Delete album
app.delete('/api/albums/:name', (req, res) => {
    try {
        const albumName = req.params.name;
        
        if (albumName === DEFAULT_ALBUM) {
            return res.status(400).json({ error: 'Cannot delete default album' });
        }
        
        const albumPath = path.join(photosDir, albumName);
        
        if (!fs.existsSync(albumPath)) {
            return res.status(404).json({ error: 'Album not found' });
        }
        
        // Check if album has photos
        const photosInAlbum = photosMetadata.filter(p => p.album === albumName);
        if (photosInAlbum.length > 0) {
            return res.status(400).json({ error: 'Cannot delete album with photos. Move photos first.' });
        }
        
        // Check if directory is empty
        const files = fs.readdirSync(albumPath);
        if (files.length > 0) {
            return res.status(400).json({ error: 'Album directory is not empty' });
        }
        
        fs.rmdirSync(albumPath);
        res.json({ success: true, message: 'Album deleted successfully' });
    } catch (error) {
        console.error('Error deleting album:', error);
        res.status(500).json({ error: 'Failed to delete album' });
    }
});

// Crop photo
app.post('/api/photos/:filename/crop', async (req, res) => {
    try {
        const filename = req.params.filename;
        const { x, y, width, height } = req.body;

        // Validate crop parameters
        if (!x && x !== 0 || !y && y !== 0 || !width || !height) {
            return res.status(400).json({ error: 'Invalid crop parameters' });
        }

        const photoIndex = photosMetadata.findIndex(p => p.filename === filename);
        if (photoIndex === -1) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const photo = photosMetadata[photoIndex];
        const albumDir = photo.album || DEFAULT_ALBUM;
        const filePath = path.join(photosDir, albumDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Photo file not found' });
        }

        // Create a backup of the original file
        const backupPath = filePath + '.backup';
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(filePath, backupPath);
        }

        // Perform the crop using sharp
        await sharp(filePath)
            .extract({ left: x, top: y, width: width, height: height })
            .jpeg({ quality: 90, progressive: true })
            .toFile(filePath + '.tmp');

        // Replace original with cropped version
        fs.renameSync(filePath + '.tmp', filePath);

        res.json({
            success: true,
            message: 'Photo cropped successfully',
            filename: filename
        });
    } catch (error) {
        console.error('Error cropping photo:', error);
        res.status(500).json({ error: 'Failed to crop photo: ' + error.message });
    }
});

// Check if photo has a backup (for undo crop)
app.get('/api/photos/:filename/backup', (req, res) => {
    try {
        const filename = req.params.filename;
        const photoIndex = photosMetadata.findIndex(p => p.filename === filename);

        if (photoIndex === -1) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const photo = photosMetadata[photoIndex];
        const albumDir = photo.album || DEFAULT_ALBUM;
        const filePath = path.join(photosDir, albumDir, filename);
        const backupPath = filePath + '.backup';

        const hasBackup = fs.existsSync(backupPath);

        res.json({
            exists: hasBackup,
            filename: filename
        });
    } catch (error) {
        console.error('Error checking backup:', error);
        res.status(500).json({ error: 'Failed to check backup' });
    }
});

// Restore photo from backup (undo crop)
app.post('/api/photos/:filename/restore', async (req, res) => {
    try {
        const filename = req.params.filename;
        const photoIndex = photosMetadata.findIndex(p => p.filename === filename);

        if (photoIndex === -1) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const photo = photosMetadata[photoIndex];
        const albumDir = photo.album || DEFAULT_ALBUM;
        const filePath = path.join(photosDir, albumDir, filename);
        const backupPath = filePath + '.backup';

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'No backup found for this photo' });
        }

        // Replace current image with backup
        fs.copyFileSync(backupPath, filePath);

        // Remove the backup after successful restore
        fs.unlinkSync(backupPath);

        res.json({
            success: true,
            message: 'Photo restored from backup successfully',
            filename: filename
        });
    } catch (error) {
        console.error('Error restoring from backup:', error);
        res.status(500).json({ error: 'Failed to restore from backup: ' + error.message });
    }
});

// Move photo to different album
app.put('/api/photos/:filename/move', (req, res) => {
    try {
        const filename = req.params.filename;
        const { targetAlbum } = req.body;
        
        if (!targetAlbum) {
            return res.status(400).json({ error: 'Target album is required' });
        }
        
        const photoIndex = photosMetadata.findIndex(p => p.filename === filename);
        if (photoIndex === -1) {
            return res.status(404).json({ error: 'Photo not found' });
        }
        
        const photo = photosMetadata[photoIndex];
        const currentAlbum = photo.album || DEFAULT_ALBUM;
        
        if (currentAlbum === targetAlbum) {
            return res.status(400).json({ error: 'Photo is already in target album' });
        }
        
        // Ensure target album exists
        const targetAlbumPath = path.join(photosDir, targetAlbum);
        if (!fs.existsSync(targetAlbumPath)) {
            fs.mkdirSync(targetAlbumPath, { recursive: true });
        }
        
        // Move the physical file
        const currentPath = path.join(photosDir, currentAlbum, filename);
        const targetPath = path.join(photosDir, targetAlbum, filename);
        
        if (!fs.existsSync(currentPath)) {
            return res.status(404).json({ error: 'Photo file not found' });
        }
        
        if (fs.existsSync(targetPath)) {
            return res.status(409).json({ error: 'Photo with same name already exists in target album' });
        }
        
        fs.renameSync(currentPath, targetPath);
        
        // Update metadata
        photosMetadata[photoIndex].album = targetAlbum;
        fs.writeFileSync(metadataFile, JSON.stringify(photosMetadata, null, 2));
        
        res.json({
            success: true,
            message: 'Photo moved successfully',
            photo: photosMetadata[photoIndex]
        });
    } catch (error) {
        console.error('Error moving photo:', error);
        res.status(500).json({ error: 'Failed to move photo' });
    }
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