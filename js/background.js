// Create context menu items when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'saveAsPrompt',
        title: 'Save as Prompt',
        contexts: ['selection']
    });
});

// Handle action button click (extension icon)
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'manager.html' });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'saveAsPrompt') {
        const selectedText = info.selectionText;
        
        // Get existing prompts
        chrome.storage.local.get('prompts', (result) => {
            const prompts = result.prompts || [];
            
            // Add new prompt
            const newPrompt = {
                id: Date.now().toString(),
                title: selectedText.slice(0, 50) + (selectedText.length > 50 ? '...' : ''),
                content: selectedText,
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            prompts.unshift(newPrompt);
            
            // Save updated prompts
            chrome.storage.local.set({ prompts }, () => {
                // Show notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: 'Prompt Saved',
                    message: 'The selected text has been saved as a prompt'
                });
            });
        });
    }
}); 