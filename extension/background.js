chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'print') {
    // Get all cookies for the URL's domain
    const url = new URL(message.url);
    chrome.cookies.getAll({ domain: url.hostname }, async (cookies) => {
      try {
        const response = await fetch('http://localhost:3000/print', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            url: message.url,
            cookies: cookies
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