import fetch from 'node-fetch';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { platform } from 'process';

// Import platform-specific printing modules
const isWindows = platform === 'win32';
let print, getPrinters;
if (isWindows) {
    const pdfToPrinter = await import('pdf-to-printer');
    print = pdfToPrinter.print;
    getPrinters = pdfToPrinter.getPrinters;
} else {
    const unixPrint = await import('unix-print');
    print = unixPrint.print;
    getPrinters = unixPrint.getPrinters;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function printURL(url, cookies) {
    console.log('=== PDF Print Request ===');
    console.log('PDF URL:', url);
    console.log('Cookies count:', cookies.length);
    
    try {
        // List available printers
        const printers = await getPrinters();
        console.log('Available printers:', printers);

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

        // Download PDF
        const response = await fetch(url, { headers });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers.raw());

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the PDF buffer
        const pdfBuffer = await response.buffer();
        console.log('Downloaded PDF size:', pdfBuffer.length, 'bytes');

        if (pdfBuffer.length < 100) {
            throw new Error('Downloaded PDF is too small, likely empty or invalid');
        }

        // Create temporary file
        const tempFile = path.join(tmpdir(), `print-${Date.now()}.pdf`);
        await fs.writeFile(tempFile, pdfBuffer);

        try {
            // Print the PDF
            console.log('Printing PDF...');
            await print(tempFile);
            console.log('Print job submitted successfully');
        } finally {
            // Clean up temp file
            await fs.unlink(tempFile).catch(console.error);
        }

        console.log('=== Print Job Submitted ===');
        return {
            success: true,
            url
        };

    } catch (error) {
        console.error('Print error:', error);
        console.error('Error details:', {
            message: error.message,
            url: url,
            stack: error.stack
        });
        throw error;
    }
}

export { printURL };