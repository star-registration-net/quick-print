import fetch from 'node-fetch';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function printURL(url, cookies, printFolder) {
  console.log('Starting PDF download...');
  
  // Create print folder if it doesn't exist
  await fs.mkdir(printFolder, { recursive: true });
  console.log('Print folder ready:', printFolder);

  try {
    // Format cookies for fetch
    const cookieHeader = cookies.map(cookie => 
      `${cookie.name}=${cookie.value}`
    ).join('; ');

    // Download PDF directly using fetch
    const response = await fetch(url, {
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/pdf',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Check if content-type is PDF
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/pdf')) {
      console.warn('Warning: Response may not be a PDF. Content-Type:', contentType);
    }

    // Get the PDF buffer
    const pdfBuffer = await response.buffer();

    // Generate filename and path
    const filename = `print-${Date.now()}.pdf`;
    const pdfPath = path.join(printFolder, filename);

    // Write PDF file
    console.log('Writing PDF to:', pdfPath);
    await fs.writeFile(pdfPath, pdfBuffer);

    // Verify file
    const fileStats = await fs.stat(pdfPath);
    console.log('PDF file stats:', {
      path: pdfPath,
      size: fileStats.size,
      created: fileStats.birthtime
    });

    if (fileStats.size < 1000) {
      throw new Error('Downloaded PDF is too small, likely empty');
    }

    return {
      success: true,
      filename,
      pdfPath,
      url,
      fileSize: fileStats.size
    };

  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

export { printURL }; 