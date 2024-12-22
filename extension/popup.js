document.addEventListener('DOMContentLoaded', async () => {
    const printerSelect = document.getElementById('printerSelect');
    const saveButton = document.getElementById('saveButton');
    const configureButton = document.getElementById('configureButton');
    const ippConfig = document.getElementById('ippConfig');
    const saveConfigButton = document.getElementById('saveConfigButton');
    const status = document.getElementById('status');

    // IPP config inputs
    const ippHost = document.getElementById('ippHost');
    const ippPort = document.getElementById('ippPort');
    const ippPath = document.getElementById('ippPath');

    let printerConfigs = {};

    // Load printer configurations
    chrome.storage.sync.get(['printerConfigs'], (result) => {
        if (result.printerConfigs) {
            printerConfigs = result.printerConfigs;
        }
    });

    // Load currently selected printer
    chrome.storage.sync.get(['selectedPrinter'], (result) => {
        const selectedPrinter = result.selectedPrinter || '';
        loadPrinters(selectedPrinter);
    });

    // Load available printers
    async function loadPrinters(selectedPrinter) {
        try {
            printerSelect.disabled = true;
            saveButton.disabled = true;
            status.textContent = 'Loading printers...';
            status.className = 'status';

            const response = await fetch('http://localhost:3000/printers');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const printers = await response.json();

            printerSelect.innerHTML = '';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- Select Printer --';
            printerSelect.appendChild(defaultOption);

            // Sort printers by name
            const sortedPrinters = printers.sort((a, b) => {
                if (a.isDefault) return -1;
                if (b.isDefault) return 1;
                return a.name.localeCompare(b.name);
            });

            // Add printer options
            sortedPrinters.forEach(printer => {
                const option = document.createElement('option');
                option.value = printer.name;
                option.textContent = printer.name + (printer.isDefault ? ' (Default)' : '');
                if (printer.name === selectedPrinter || (!selectedPrinter && printer.isDefault)) {
                    option.selected = true;
                }
                printerSelect.appendChild(option);
            });

            printerSelect.disabled = false;
            saveButton.disabled = false;
            status.textContent = '';

            // Enable save button only if a printer is selected
            updateSaveButton();
            
            // Load IPP config for selected printer
            loadIPPConfig();
        } catch (error) {
            console.error('Error loading printers:', error);
            status.textContent = 'Error loading printers. Is the server running?';
            status.className = 'status error';
            printerSelect.disabled = true;
            saveButton.disabled = true;
        }
    }

    // Update save button state based on selection
    function updateSaveButton() {
        const hasSelection = printerSelect.value !== '';
        saveButton.disabled = !hasSelection;
    }

    // Load IPP configuration for selected printer
    function loadIPPConfig() {
        const selectedPrinter = printerSelect.value;
        const config = printerConfigs[selectedPrinter] || {};
        
        ippHost.value = config.host || '';
        ippPort.value = config.port || '631';
        ippPath.value = config.path || '/ipp/print';
    }

    // Handle printer selection change
    printerSelect.addEventListener('change', () => {
        updateSaveButton();
        loadIPPConfig();
    });

    // Toggle IPP configuration panel
    configureButton.addEventListener('click', () => {
        if (ippConfig.classList.contains('visible')) {
            ippConfig.classList.remove('visible');
            configureButton.textContent = 'Configure';
        } else {
            ippConfig.classList.add('visible');
            configureButton.textContent = 'Hide Config';
            loadIPPConfig();
        }
    });

    // Save printer selection
    saveButton.addEventListener('click', () => {
        const selectedPrinter = printerSelect.value;
        
        if (!selectedPrinter) {
            status.textContent = 'Please select a printer';
            status.className = 'status error';
            return;
        }

        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        chrome.storage.sync.set({ selectedPrinter }, () => {
            status.textContent = 'Printer selection saved!';
            status.className = 'status success';
            saveButton.textContent = 'Save Selection';
            saveButton.disabled = false;
            
            // Clear status message after 2 seconds
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
        });
    });

    // Save IPP configuration
    saveConfigButton.addEventListener('click', () => {
        const selectedPrinter = printerSelect.value;
        
        if (!selectedPrinter) {
            status.textContent = 'Please select a printer first';
            status.className = 'status error';
            return;
        }

        const config = {
            host: ippHost.value.trim(),
            port: ippPort.value.trim(),
            path: ippPath.value.trim()
        };

        // Validate IP address
        if (config.host && !/^(\d{1,3}\.){3}\d{1,3}$/.test(config.host)) {
            status.textContent = 'Invalid IP address format';
            status.className = 'status error';
            return;
        }

        // Validate port
        const port = parseInt(config.port);
        if (isNaN(port) || port < 1 || port > 65535) {
            status.textContent = 'Invalid port number';
            status.className = 'status error';
            return;
        }

        // Save configuration
        printerConfigs[selectedPrinter] = config;
        chrome.storage.sync.set({ printerConfigs }, () => {
            status.textContent = 'IPP configuration saved!';
            status.className = 'status success';
            
            // Clear status message after 2 seconds
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
        });
    });
}); 