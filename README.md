# PhotoFriend

A web-based photo management application with drag-and-drop upload, metadata editing, and smart organization.

**Version:** 0.2.2

## Features

- **Drag & Drop Upload** - Simply drag photos onto the page or click to select
- **Album Organization** - Create custom albums and organize photos by category
- **Album Management** - Move photos between albums with drag & drop or bulk operations
- **Visual Album Indicators** - Non-default albums show overlay badges on thumbnails
- **Album Filtering** - Filter gallery view by specific albums
- **Metadata Management** - Add titles, dates, locations, tags, and descriptions
- **Smart File Naming** - Automatically names files based on date and metadata
- **Image Processing** - Auto-rotates and optimizes images (including WebP to JPG conversion)
- **Sortable Gallery** - View photos by newest or oldest first
- **Photo Navigation** - Navigate between photos with prev/next buttons and arrow keys
- **Inline Editing** - Edit all metadata fields (title, date, location, tags, description) directly in the detail view
- **Image Cropping** - Crop images with interactive crop tool and undo functionality
- **Photo Deletion** - Delete photos with confirmation prompt
- **Bulk Operations** - Select multiple photos and move them to albums at once
- **Persistent Preferences** - Remembers your sort preferences

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser to http://localhost:5567

## Usage

### Basic Photo Management
1. **Upload Photos**: Drag and drop images onto the upload area
2. **Add Metadata**: Fill in optional details and select an album before uploading
3. **View Gallery**: Photos appear in the gallery sorted by date
4. **Edit Details**: Click any photo to view and edit its information
5. **Change Sort**: Toggle between newest/oldest first

### Album Management
1. **Create Albums**: Click "+ New Album" when uploading or use the album management
2. **Organize Photos**: Drag photos to album drop zones or use bulk selection
3. **Filter by Album**: Use the album filter dropdown to view specific albums
4. **Visual Identification**: Photos in non-default albums show album name overlays
5. **Bulk Operations**: Select multiple photos (Ctrl+click) and move them together

## File Storage

- Photos are organized in `/photos/[album-name]/` directories
- Default album photos are stored in `/photos/default/`
- Metadata is saved in `/photos/metadata.json`
- Files are named: `YYYY-MM-DD_title_timestamp.jpg`
- All uploaded images are converted to JPEG format for consistency

## Requirements

- Node.js 14+
- Modern web browser

## License

This software was created for educational purposes. Use at your own risk.