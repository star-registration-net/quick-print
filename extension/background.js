chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'print') {
    // Get all cookies for the URL's domain
    const url = new URL(message.url);
    chrome.cookies.getAll({ domain: url.hostname }, async (cookies) => {
      try {
        // Get selected printer and printer configs from storage
        const { selectedPrinter, printerConfigs } = await chrome.storage.sync.get(['selectedPrinter', 'printerConfigs']);
        
        // Get IPP config for selected printer if it exists
        const ippConfig = selectedPrinter && printerConfigs ? printerConfigs[selectedPrinter] : null;
        
        const response = await fetch('http://localhost:3000/print', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            url: message.url,
            cookies: cookies,
            printer: selectedPrinter,
            ippConfig: ippConfig
          })
        });
        
        const data = await response.json();
        console.log('Print job submitted:', data);
      } catch (error) {
        console.error('Error:', error);
      }
    });
  }
}); 