# SR Print Extension

A Chrome extension and backend service for directly downloading and printing PDFs from web pages, even when the URL doesn't end in .pdf.

## Project Structure

```
.
├── backend/         # Node.js backend server
│   ├── printer.js   # PDF download and processing
│   └── server.js    # Express server
└── extension/       # Chrome extension files
    ├── manifest.json
    ├── popup.html
    └── popup.js
```

## Backend Setup

1. Install dependencies:
```bash
cd backend
npm install node-fetch express
```

2. Required dependencies in package.json:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "node-fetch": "^2.6.7"
  }
}
```

3. Start the server:
```bash
node server.js
```

The backend server will:
- Accept PDF download requests from the extension
- Handle direct PDF downloads while preserving original formatting
- Store PDFs temporarily in the prints/ directory
- Forward PDFs to the system's default printer

## Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `extension` directory
4. The extension icon should appear in your Chrome toolbar

## Usage

1. When on a webpage containing a PDF (even if URL doesn't end in .pdf):
   - Click the extension icon
   - The PDF will be downloaded and sent to your default printer

2. The extension handles:
   - Direct PDF URLs
   - URLs that return PDFs without .pdf extension
   - Maintaining all PDF formatting and content

## Development Notes

### Backend (printer.js)
- Uses node-fetch for direct PDF downloads
- Preserves original PDF formatting
- Handles cookies and headers properly
- Includes error handling and logging

### Extension
- Communicates with backend server
- Passes necessary cookies and headers
- Simple one-click interface

## Troubleshooting

1. PDF Not Downloading
   - Check if URL is accessible
   - Verify backend server is running
   - Check browser console for errors

2. PDF Format Issues
   - Verify content-type headers
   - Check PDF file size in prints directory

## Security Notes

- Temporary PDFs are stored in prints/ directory
- Files are removed after printing
- Cookies are handled securely
- CORS and security headers are implemented