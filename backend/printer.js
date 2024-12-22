import fetch from 'node-fetch';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { platform } from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const isWindows = platform === 'win32';

// Initialize the printer module based on platform
let printerModule;

async function initializePrinterModule() {
    if (isWindows) {
        printerModule = await import('pdf-to-printer');
    } else {
        printerModule = await import('unix-print');
    }
}

// Initialize the module when this file is imported
await initializePrinterModule();

async function getPrinters() {
    try {
        if (isWindows) {
            try {
                // First try with pdf-to-printer
                const printers = await printerModule.default.getPrinters();
                return printers.map(printer => ({
                    name: printer.name,
                    isDefault: printer.isDefault || false
                }));
            } catch (error) {
                console.log('Falling back to PowerShell for printer detection...');
                // Fallback to PowerShell command with proper syntax
                const { stdout } = await execAsync('powershell.exe -Command "Get-WmiObject -Class Win32_Printer | Select-Object -ExpandProperty Name"');
                const printerNames = stdout.trim().split('\r\n').filter(Boolean);

                // Get default printer using WMI
                const { stdout: defaultPrinter } = await execAsync('powershell.exe -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object -ExpandProperty Name"').catch(() => ({ stdout: '' }));
                const defaultPrinterName = defaultPrinter.trim();

                return printerNames.map(name => ({
                    name: name,
                    isDefault: name === defaultPrinterName
                }));
            }
        } else {
            // Get list of printers for macOS/Linux
            const { stdout } = await execAsync('lpstat -p | cut -d" " -f2');
            const printerNames = stdout.trim().split('\n').filter(Boolean);
            
            // Get default printer
            const { stdout: defaultPrinter } = await execAsync('lpstat -d | cut -d":" -f2').catch(() => ({ stdout: '' }));
            const defaultPrinterName = defaultPrinter.trim();

            return printerNames.map(name => ({
                name: name,
                isDefault: name === defaultPrinterName
            }));
        }
    } catch (error) {
        console.error(`Error getting ${isWindows ? 'Windows' : 'Unix'} printers:`, error);
        return [];
    }
}

async function printURL(url, cookies, selectedPrinter) {
    console.log('=== PDF Print Request ===');
    console.log('PDF URL:', url);
    console.log('Cookies count:', cookies.length);
    console.log('Selected printer:', selectedPrinter);
    
    try {
        // List available printers
        const printers = await getPrinters();
        console.log('Available printers:', printers);

        // Verify selected printer exists
        if (selectedPrinter && !printers.some(p => p.name === selectedPrinter)) {
            throw new Error(`Selected printer "${selectedPrinter}" not found`);
        }

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
            // Print the PDF with selected printer
            console.log('Printing PDF...');
            if (isWindows) {
                await printerModule.default.print(tempFile, selectedPrinter ? { printer: selectedPrinter } : undefined);
            } else {
                try {
                    await printerModule.print(tempFile, selectedPrinter ? { printer: selectedPrinter } : undefined);
                } catch (printError) {
                    console.log('Falling back to lp command...');
                    const cmd = selectedPrinter 
                        ? `lp -d "${selectedPrinter}" "${tempFile}"`
                        : `lp "${tempFile}"`;
                    await execAsync(cmd);
                }
            }
            console.log('Print job submitted successfully');
        } finally {
            // Clean up temp file
            await fs.unlink(tempFile).catch(console.error);
        }

        console.log('=== Print Job Submitted ===');
        return {
            success: true,
            url,
            printer: selectedPrinter || 'default'
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

export { printURL, getPrinters };