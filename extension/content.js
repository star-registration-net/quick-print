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
    
    link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendToPrint(url);
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
    // Process only the first "Open A4" button
    const mapA4Button = document.querySelector('button[title="Open A4"]');
    if (mapA4Button && !mapA4Button.dataset.quickPrintProcessed) {
        const onclick = mapA4Button.getAttribute('onclick');
        if (onclick && onclick.includes('window.open')) {
            const url = extractUrlFromWindowOpen(onclick);
            if (url) {
                mapA4Button.dataset.quickPrintProcessed = 'true';
                mapA4Button.insertAdjacentElement('afterend', createQuickPrintLink(url));
            }
        }
    }

    // If no button found, try finding the first "Open A4" link
    if (!mapA4Button) {
        const mapA4Link = Array.from(document.getElementsByTagName('a')).find(a => 
            a.textContent.trim() === 'Open A4' || a.title === 'Open A4'
        );
        
        if (mapA4Link && !mapA4Link.dataset.quickPrintProcessed && 
            !mapA4Link.nextElementSibling?.classList.contains('quick-print-link')) {
            mapA4Link.dataset.quickPrintProcessed = 'true';
            if (mapA4Link.href) {
                mapA4Link.insertAdjacentElement('afterend', createQuickPrintLink(mapA4Link.href));
            }
        }
    }
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