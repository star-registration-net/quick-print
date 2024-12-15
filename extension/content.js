document.addEventListener('click', function(e) {
  if (e.altKey && e.target.href) {
    e.preventDefault();
    chrome.runtime.sendMessage({
      type: 'print',
      url: e.target.href
    });
  }
});

// Listen for PDF capture request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'capturePDF') {
    // Use Chrome's printing API to generate PDF
    const printOptions = {
      marginType: 'default',
      paperWidth: 8.5,
      paperHeight: 11,
      printBackground: true,
      preferCSSPageSize: true
    };

    chrome.printing.printToPDF(printOptions).then(pdfBlob => {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = function() {
        const base64data = reader.result.split(',')[1];
        sendResponse({ pdfData: base64data });
      };
    }).catch(error => {
      console.error('PDF generation failed:', error);
      sendResponse({ error: error.message });
    });

    return true; // Keep the message channel open for async response
  }
}); 