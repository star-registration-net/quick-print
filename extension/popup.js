document.addEventListener('DOMContentLoaded', async () => {
    const printerSelect = document.getElementById('printerSelect');
    const saveButton = document.getElementById('saveButton');
    const status = document.getElementById('status');

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

    // Handle printer selection change
    printerSelect.addEventListener('change', updateSaveButton);

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
}); 