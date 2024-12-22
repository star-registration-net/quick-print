import fetch from 'node-fetch';
import { tmpdir } from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { platform } from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';
import ipp from 'ipp';

const execAsync = promisify(exec);
const isWindows = platform === 'win32';

async function getPrinterIPPUri(printerName) {
    if (isWindows) {
        try {
            // Escape the printer name for PowerShell
            const escapedPrinterName = printerName.replace(/'/g, "''");
            
            // Get printer port information using a simpler PowerShell command
            const cmd = `powershell.exe -Command "&{$printer = Get-Printer -Name '${escapedPrinterName}'; $port = Get-PrinterPort -Name $printer.PortName; Write-Output \\\"$($port.PrinterHostAddress)\\\"}"`;
            const { stdout } = await execAsync(cmd);
            const hostAddress = stdout.trim();

            if (hostAddress && hostAddress !== '') {
                // If we have a host address, construct URI using it
                const ipMatch = hostAddress.match(/\d+\.\d+\.\d+\.\d+/);
                if (ipMatch) {
                    return `ipp://${ipMatch[0]}:631/ipp/print`;
                }
            }

            // Try getting printer port name
            const portCmd = `powershell.exe -Command "&{$printer = Get-Printer -Name '${escapedPrinterName}'; Write-Output \\\"$($printer.PortName)\\\"}"`;
            const { stdout: portStdout } = await execAsync(portCmd);
            const portName = portStdout.trim();

            if (portName && portName.startsWith('IP_')) {
                // Extract IP from port name if it's an IP port
                const ipMatch = portName.match(/\d+\.\d+\.\d+\.\d+/);
                if (ipMatch) {
                    return `ipp://${ipMatch[0]}:631/ipp/print`;
                }
            }

            // Try getting share information
            const shareCmd = `powershell.exe -Command "&{$printer = Get-Printer -Name '${escapedPrinterName}'; Write-Output \\\"$($printer.ShareName)\\\"}"`;
            const { stdout: shareStdout } = await execAsync(shareCmd);
            const shareName = shareStdout.trim();

            if (shareName && shareName !== '') {
                // If it's a shared printer, try to get server name
                const serverCmd = `powershell.exe -Command "&{$printer = Get-Printer -Name '${escapedPrinterName}'; Write-Output \\\"$($printer.ComputerName)\\\"}"`;
                const { stdout: serverStdout } = await execAsync(serverCmd);
                const serverName = serverStdout.trim();
                
                if (serverName && serverName !== '') {
                    return `ipp://${serverName}:631/printers/${encodeURIComponent(printerName)}`;
                }
            }

            // Fallback to local Windows printing
            console.log('No network printer information found, falling back to local printing');
            return null;
        } catch (error) {
            console.log('Could not get printer network information:', error);
            return null;
        }
    } else {
        // On Unix systems, use CUPS default port
        return `ipp://localhost:631/printers/${encodeURIComponent(printerName)}`;
    }
}

async function getPrinters() {
    try {
        if (isWindows) {
            try {
                const { stdout } = await execAsync('powershell.exe -Command "Get-Printer | Select-Object Name,IsDefault | ConvertTo-Json"');
                const printers = JSON.parse(stdout);
                return Array.isArray(printers) ? printers.map(p => ({
                    name: p.Name,
                    isDefault: p.IsDefault
                })) : [printers].map(p => ({
                    name: p.Name,
                    isDefault: p.IsDefault
                }));
            } catch (error) {
                console.log('Falling back to basic printer detection...');
                const { stdout } = await execAsync('powershell.exe -Command "Get-WmiObject -Class Win32_Printer | Select-Object -ExpandProperty Name"');
                const printerNames = stdout.trim().split('\r\n').filter(Boolean);
                const { stdout: defaultPrinter } = await execAsync('powershell.exe -Command "Get-WmiObject -Class Win32_Printer | Where-Object {$_.Default -eq $true} | Select-Object -ExpandProperty Name"').catch(() => ({ stdout: '' }));
                const defaultPrinterName = defaultPrinter.trim();
                return printerNames.map(name => ({
                    name: name,
                    isDefault: name === defaultPrinterName
                }));
            }
        } else {
            const { stdout } = await execAsync('lpstat -p | cut -d" " -f2');
            const printerNames = stdout.trim().split('\n').filter(Boolean);
            const { stdout: defaultPrinter } = await execAsync('lpstat -d | cut -d":" -f2').catch(() => ({ stdout: '' }));
            const defaultPrinterName = defaultPrinter.trim();
            return printerNames.map(name => ({
                name: name,
                isDefault: name === defaultPrinterName
            }));
        }
    } catch (error) {
        console.error(`Error getting printers:`, error);
        return [];
    }
}

async function printURL(url, cookies, selectedPrinter, ippConfig = null) {
    console.log('=== PDF Print Request ===');
    console.log('PDF URL:', url);
    console.log('Cookies count:', cookies.length);
    console.log('Selected printer:', selectedPrinter);
    if (ippConfig) {
        console.log('IPP Config:', ippConfig);
    }
    
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

        // If we have IPP config, use it directly
        if (ippConfig && ippConfig.host) {
            const printerUri = `ipp://${ippConfig.host}:${ippConfig.port}${ippConfig.path}`;
            console.log('Using custom IPP URI:', printerUri);

            try {
                const printer = ipp.Printer(printerUri);
                const msg = {
                    "operation-attributes-tag": {
                        "requesting-user-name": "quick-print",
                        "job-name": "Web Print Job",
                        "document-format": "application/pdf"
                    },
                    data: pdfBuffer
                };

                await new Promise((resolve, reject) => {
                    printer.execute("Print-Job", msg, function(err, res) {
                        if (err) {
                            console.log('IPP printing failed:', err);
                            reject(err);
                        } else {
                            console.log('IPP print job submitted successfully:', res);
                            resolve(res);
                        }
                    });
                });

                return {
                    success: true,
                    url,
                    printer: selectedPrinter || 'default'
                };
            } catch (ippError) {
                console.log('Custom IPP printing failed:', ippError);
                throw new Error('Custom IPP printing failed: ' + ippError.message);
            }
        }

        // Otherwise use automatic detection
        if (isWindows) {
            // On Windows, try to get printer URI first
            const printerUri = await getPrinterIPPUri(selectedPrinter || printers.find(p => p.isDefault)?.name || '');
            
            // If we got a valid IPP URI, try IPP printing
            if (printerUri) {
                console.log('Attempting IPP printing with URI:', printerUri);
                try {
                    const printer = ipp.Printer(printerUri);
                    const msg = {
                        "operation-attributes-tag": {
                            "requesting-user-name": "quick-print",
                            "job-name": "Web Print Job",
                            "document-format": "application/pdf"
                        },
                        data: pdfBuffer
                    };

                    await new Promise((resolve, reject) => {
                        printer.execute("Print-Job", msg, function(err, res) {
                            if (err) {
                                console.log('IPP printing failed:', err);
                                reject(err);
                            } else {
                                console.log('IPP print job submitted successfully:', res);
                                resolve(res);
                            }
                        });
                    });

                    return {
                        success: true,
                        url,
                        printer: selectedPrinter || 'default'
                    };
                } catch (ippError) {
                    console.log('IPP printing failed, falling back to local printing:', ippError);
                }
            }

            // Fall back to local printing if IPP fails or no URI found
            await tryFallbackPrinting(pdfBuffer, selectedPrinter);
            return {
                success: true,
                url,
                printer: selectedPrinter || 'default'
            };
        } else {
            // On Unix systems, use IPP as before
            const printerUri = await getPrinterIPPUri(selectedPrinter || printers.find(p => p.isDefault)?.name || '');
            console.log('Printer URI:', printerUri);

            const printer = ipp.Printer(printerUri);
            const msg = {
                "operation-attributes-tag": {
                    "requesting-user-name": "quick-print",
                    "job-name": "Web Print Job",
                    "document-format": "application/pdf"
                },
                data: pdfBuffer
            };

            return new Promise((resolve, reject) => {
                printer.execute("Print-Job", msg, function(err, res) {
                    if (err) {
                        console.error('IPP print error:', err);
                        // Try fallback method if IPP fails
                        console.log('IPP printing failed, trying fallback method...');
                        tryFallbackPrinting(pdfBuffer, selectedPrinter)
                            .then(() => resolve({
                                success: true,
                                url,
                                printer: selectedPrinter || 'default'
                            }))
                            .catch(reject);
                    } else {
                        console.log('IPP print job submitted successfully:', res);
                        resolve({
                            success: true,
                            url,
                            printer: selectedPrinter || 'default'
                        });
                    }
                });
            });
        }
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

async function tryFallbackPrinting(pdfBuffer, selectedPrinter) {
    // Create temporary file
    const tempFile = path.join(tmpdir(), `print-${Date.now()}.pdf`);
    await fs.writeFile(tempFile, pdfBuffer);

    try {
        if (isWindows) {
            await execAsync(`SumatraPDF -print-to "${selectedPrinter || 'default'}" "${tempFile}"`).catch(async () => {
                // If SumatraPDF fails, try system default
                await execAsync(`start /wait "" "${tempFile}"`);
            });
        } else {
            const cmd = selectedPrinter 
                ? `lp -d "${selectedPrinter}" "${tempFile}"`
                : `lp "${tempFile}"`;
            await execAsync(cmd);
        }
    } finally {
        // Clean up temp file
        await fs.unlink(tempFile).catch(console.error);
    }
}

export { printURL, getPrinters };