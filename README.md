# PhotoFriend

A web-based photo management application with drag-and-drop upload, metadata editing, and smart organization.

**Version:** 0.1.0

## Features

- **Drag & Drop Upload** - Simply drag photos onto the page or click to select
- **Metadata Management** - Add titles, dates, locations, tags, and descriptions
- **Smart File Naming** - Automatically names files based on date and metadata
- **Image Processing** - Auto-rotates and optimizes images for web and Windows compatibility
- **Sortable Gallery** - View photos by newest or oldest first
- **Inline Editing** - Click to edit photo dates directly in the detail view
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

1. **Upload Photos**: Drag and drop images onto the upload area
2. **Add Metadata**: Fill in optional details before uploading
3. **View Gallery**: Photos appear in the gallery sorted by date
4. **Edit Details**: Click any photo to view and edit its information
5. **Change Sort**: Toggle between newest/oldest first

## File Storage

- Photos are stored in the `/photos` directory
- Metadata is saved in `/photos/metadata.json`
- Files are named: `YYYY-MM-DD_title_timestamp.jpg`

## Requirements

- Node.js 14+
- Modern web browser

## License

This software was created for educational purposes. Use at your own risk.