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
    // Process buttons with specific text content
    const buttons = document.querySelectorAll('button[title="Open A4"], button[title="Open Letter"], button[title="Open A4 (Logo)"], button[title="Open Letter (Logo)"]');
    buttons.forEach(button => {
        // Skip if already processed or if there's already a QuickPrint link next to it
        if (button.dataset.quickPrintProcessed || 
            button.nextElementSibling?.classList.contains('quick-print-link')) {
            return;
        }
        
        const onclick = button.getAttribute('onclick');
        if (onclick && onclick.includes('window.open')) {
            const url = extractUrlFromWindowOpen(onclick);
            if (url) {
                button.dataset.quickPrintProcessed = 'true';
                button.insertAdjacentElement('afterend', createQuickPrintLink(url));
            }
        }
    });

    // Process links with specific text or title
    const linkSelectors = [
        'a[title="Open A4"]',
        'a[title="Open Letter"]',
        'a[title="Open A4 (Logo)"]',
        'a[title="Open Letter (Logo)"]',
        'a:contains("Open A4")',
        'a:contains("Open Letter")',
        'a:contains("Open A4 (Logo)")',
        'a:contains("Open Letter (Logo)")'
    ].join(', ');

    // Custom function to find links by text content
    function findLinksByText(text) {
        return Array.from(document.getElementsByTagName('a')).filter(a => 
            a.textContent.trim() === text
        );
    }

    // Process all types of links
    const textLinks = [
        ...findLinksByText('Open A4'),
        ...findLinksByText('Open Letter'),
        ...findLinksByText('Open A4 (Logo)'),
        ...findLinksByText('Open Letter (Logo)'),
        ...document.querySelectorAll(linkSelectors)
    ];

    // Remove duplicates
    const processedLinks = new Set();
    textLinks.forEach(link => {
        // Skip if already processed or duplicate
        if (link.dataset.quickPrintProcessed || 
            link.nextElementSibling?.classList.contains('quick-print-link') ||
            processedLinks.has(link)) {
            return;
        }
        
        processedLinks.add(link);
        if (link.href) {
            link.dataset.quickPrintProcessed = 'true';
            link.insertAdjacentElement('afterend', createQuickPrintLink(link.href));
        }
    });
}

// Function to check if target elements exist
function checkForElements() {
    const hasButtons = document.querySelector(
        'button[title="Open A4"], button[title="Open Letter"], ' +
        'button[title="Open A4 (Logo)"], button[title="Open Letter (Logo)"]'
    ) !== null;

    const hasLinks = Array.from(document.getElementsByTagName('a')).some(a => {
        const text = a.textContent.trim();
        return text === 'Open A4' || 
               text === 'Open Letter' || 
               text === 'Open A4 (Logo)' || 
               text === 'Open Letter (Logo)';
    });

    return hasButtons || hasLinks;
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