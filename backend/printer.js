import fetch from 'node-fetch';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function printURL(url, cookies, printFolder) {
    console.log('=== PDF Download Request ===');
    console.log('PDF URL:', url);
    console.log('Cookies count:', cookies.length);
    
    try {
        // Format cookies for fetch
        const cookieHeader = cookies.map(cookie => 
            `${cookie.name}=${cookie.value}`
        ).join('; ');

        console.log('Making request with headers:');
        const headers = {
            'Cookie': cookieHeader,
            'Accept': 'application/pdf,*/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        };
        console.log(headers);

        // Download PDF directly using fetch with proper headers
        const response = await fetch(url, { headers });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the PDF buffer directly from response
        const pdfBuffer = await response.buffer();
        console.log('Downloaded PDF size:', pdfBuffer.length, 'bytes');

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

        if (fileStats.size < 100) {
            throw new Error('Downloaded PDF is too small, likely empty or invalid');
        }

        console.log('=== PDF Download Complete ===');
        return {
            success: true,
            filename,
            pdfPath,
            url,
            fileSize: fileStats.size
        };

    } catch (error) {
        console.error('Download error:', error);
        console.error('Error details:', {
            message: error.message,
            url: url,
            stack: error.stack
        });
        throw error;
    }
}

export { printURL };