// Function to extract URL from window.open call
function extractUrlFromWindowOpen(onclick) {
    const match = onclick.match(/window\.open\(['"](.*?)['"]/);
    return match ? match[1] : null;
}

// Function to create QuickPrint link
function createQuickPrintLink(url) {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'quick-print-link';
    link.title = 'Quick Print';
    
    // Create image element
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('printer.png');
    img.className = 'print-icon';
    img.alt = 'Print';
    
    link.appendChild(img);
    
    let isDisabled = false;
    
    link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (isDisabled) return;
        
        // Disable the button and change color
        isDisabled = true;
        link.classList.add('printing');
        link.title = 'Printing...';
        
        // Send print request
        sendToPrint(url);
        
        // Re-enable after 5 seconds
        setTimeout(() => {
            isDisabled = false;
            link.classList.remove('printing');
            link.title = 'Quick Print';
        }, 5000);
    });
    
    return link;
}

// Function to send URL to print
function sendToPrint(url) {
    chrome.runtime.sendMessage({
        type: 'print',
        url: url
    });
}

// Function to add QuickPrint links to specific elements
function addQuickPrintLinks() {
    const buttons = document.querySelectorAll('button[onclick*="generateMap"]');
    buttons.forEach( function(button){
        if (button.dataset.quickPrintProcessed) {
            return;
        }

        button.dataset.quickPrintProcessed = 'true';
        const url = extractUrlFromWindowOpen(button.getAttribute('onclick'));
        button.insertAdjacentElement('afterend', createQuickPrintLink(url));
    });
}

// Function to check if target elements exist
function checkForElements() {
    const hasMapA4Button = document.querySelector('button[title="Open A4"]') !== null;
    const hasMapA4Link = Array.from(document.getElementsByTagName('a')).some(a => {
        const text = a.textContent.trim();
        return text === 'Open A4' || a.title === 'Open A4';
    });

    return hasMapA4Button || hasMapA4Link;
}

// Function to initialize the extension
function initializeExtension() {
    if (checkForElements()) {
        addQuickPrintLinks();
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', initializeExtension);

// Also try immediately in case DOM is already loaded
initializeExtension();

// Set up a retry mechanism
let retryCount = 0;
const maxRetries = 5;
const retryInterval = setInterval(() => {
    if (checkForElements() || retryCount >= maxRetries) {
        clearInterval(retryInterval);
        if (checkForElements()) {
            addQuickPrintLinks();
        }
    }
    retryCount++;
}, 1000);

// Create MutationObserver to handle dynamically loaded content
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
            if (checkForElements()) {
                addQuickPrintLinks();
            }
        }
    });
});

// Start observing the document
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Handle alt+click on any link
document.addEventListener('click', function(e) {
    if (e.altKey && e.target.href) {
        e.preventDefault();
        e.stopPropagation();
        sendToPrint(e.target.href);
    }
}); 