// State management
let state = {
    prompts: [],
    tags: new Set(),
    activeTag: null,
    searchQuery: '',
    editingPromptId: null,
    isSaving: false
};

// DOM Elements
const elements = {
    searchInput: document.getElementById('searchInput'),
    addPromptBtn: document.getElementById('addPromptBtn'),
    promptsList: document.getElementById('promptsList'),
    tagsList: document.getElementById('tagsList'),
    promptModal: document.getElementById('promptModal'),
    promptForm: document.getElementById('promptForm'),
    modalTitle: document.getElementById('modalTitle'),
    promptTitle: document.getElementById('promptTitle'),
    promptContent: document.getElementById('promptContent'),
    promptTags: document.getElementById('promptTags'),
    cancelBtn: document.getElementById('cancelBtn')
};

// Initialize the app
async function init() {
    await loadPrompts();
    renderPrompts();
    renderTags();
    setupEventListeners();
}

// Load prompts from storage
async function loadPrompts() {
    return new Promise((resolve) => {
        chrome.storage.local.get('prompts', (result) => {
            state.prompts = result.prompts || [];
            
            // Extract all tags
            state.tags = new Set();
            state.prompts.forEach(prompt => {
                prompt.tags.forEach(tag => {
                    state.tags.add(tag);
                });
            });
            
            resolve();
        });
    });
}

// Save prompts to storage
function savePrompts() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ prompts: state.prompts }, resolve);
    });
}

// Render prompts based on active tag and search query
function renderPrompts() {
    elements.promptsList.innerHTML = '';
    
    const filteredPrompts = state.prompts.filter(prompt => {
        // Filter by active tag
        if (state.activeTag && !prompt.tags.includes(state.activeTag)) {
            return false;
        }
        
        // Filter by search query
        if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            return (
                prompt.title.toLowerCase().includes(query) ||
                prompt.content.toLowerCase().includes(query) ||
                prompt.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        return true;
    });
    
    if (filteredPrompts.length === 0) {
        elements.promptsList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <p class="text-lg">No prompts found</p>
            </div>
        `;
        return;
    }
    
    filteredPrompts.forEach(prompt => {
        const promptCard = document.createElement('div');
        promptCard.className = 'prompt-card';
        
        // Truncate content for display
        const truncatedContent = prompt.content.length > 400 
            ? prompt.content.slice(0, 400) + '...' 
            : prompt.content;
        
        promptCard.innerHTML = `
            <h3 class="text-gray-800">${prompt.title}</h3>
            <p class="text-gray-600 whitespace-pre-line">${truncatedContent}</p>
            <div class="mb-3">
                ${prompt.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <div class="prompt-card-actions">
                <button class="copy-btn" data-id="${prompt.id}">Copy</button>
                <button class="edit-btn" data-id="${prompt.id}">Edit</button>
                <button class="delete-btn" data-id="${prompt.id}">Delete</button>
            </div>
        `;
        
        // Add event listeners
        const copyBtn = promptCard.querySelector('.copy-btn');
        const editBtn = promptCard.querySelector('.edit-btn');
        const deleteBtn = promptCard.querySelector('.delete-btn');
        
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(prompt.content);
            showToast('Prompt copied to clipboard');
        });
        
        editBtn.addEventListener('click', () => {
            openPromptModal(prompt);
        });
        
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this prompt?')) {
                deletePrompt(prompt.id);
            }
        });
        
        elements.promptsList.appendChild(promptCard);
    });
}

// Render tags
function renderTags() {
    elements.tagsList.innerHTML = '';
    
    // Add "All" tag
    const allTag = document.createElement('li');
    allTag.className = `tag ${!state.activeTag ? 'active' : ''}`;
    allTag.textContent = 'All';
    allTag.addEventListener('click', () => {
        state.activeTag = null;
        renderTags();
        renderPrompts();
    });
    elements.tagsList.appendChild(allTag);
    
    // Sort tags alphabetically
    const sortedTags = Array.from(state.tags).sort();
    
    // Add other tags
    sortedTags.forEach(tag => {
        const tagElement = document.createElement('li');
        tagElement.className = `tag ${state.activeTag === tag ? 'active' : ''}`;
        tagElement.textContent = tag;
        tagElement.addEventListener('click', () => {
            state.activeTag = tag;
            renderTags();
            renderPrompts();
        });
        elements.tagsList.appendChild(tagElement);
    });
}

// Open prompt modal for add/edit
function openPromptModal(prompt = null) {
    state.editingPromptId = prompt ? prompt.id : null;
    elements.modalTitle.textContent = prompt ? 'Edit Prompt' : 'Add New Prompt';
    elements.promptTitle.value = prompt ? prompt.title : '';
    elements.promptContent.value = prompt ? prompt.content : '';
    elements.promptTags.value = prompt ? prompt.tags.join(', ') : '';
    elements.promptModal.classList.remove('hidden');
}

// Close prompt modal
function closePromptModal() {
    elements.promptModal.classList.add('hidden');
    elements.promptForm.reset();
    state.editingPromptId = null;
}

// Save prompt
async function savePrompt(e) {
    e.preventDefault();
    
    if (state.isSaving) {
        return;
    }
    
    const title = elements.promptTitle.value.trim();
    const content = elements.promptContent.value.trim();
    const tags = elements.promptTags.value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag !== '');
    
    if (!title || !content) {
        alert('Title and content are required');
        return;
    }
    
    state.isSaving = true;
    const saveButton = elements.promptForm.querySelector('button[type="submit"]');
    const originalText = saveButton.textContent;
    saveButton.textContent = '保存中...';
    saveButton.disabled = true;
    saveButton.classList.add('opacity-50', 'cursor-not-allowed');
    
    try {
        if (state.editingPromptId) {
            // Update existing prompt
            const index = state.prompts.findIndex(p => p.id === state.editingPromptId);
            if (index !== -1) {
                state.prompts[index] = {
                    ...state.prompts[index],
                    title,
                    content,
                    tags,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            // Add new prompt
            const newPrompt = {
                id: Date.now().toString(),
                title,
                content,
                tags,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            state.prompts.unshift(newPrompt);
        }
        
        // Update tags set
        state.tags = new Set();
        state.prompts.forEach(prompt => {
            prompt.tags.forEach(tag => {
                state.tags.add(tag);
            });
        });
        
        await savePrompts();
        closePromptModal();
        renderTags();
        renderPrompts();
        showToast(state.editingPromptId ? 'Prompt updated successfully' : 'Prompt added successfully');
    } catch (error) {
        console.error('保存提示词失败:', error);
        showToast('保存失败，请重试');
    } finally {
        state.isSaving = false;
        saveButton.textContent = originalText;
        saveButton.disabled = false;
        saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// Delete prompt
async function deletePrompt(id) {
    state.prompts = state.prompts.filter(p => p.id !== id);
    
    // Update tags set
    state.tags = new Set();
    state.prompts.forEach(prompt => {
        prompt.tags.forEach(tag => {
            state.tags.add(tag);
        });
    });
    
    await savePrompts();
    renderTags();
    renderPrompts();
    showToast('Prompt deleted successfully');
}

// Show toast notification
function showToast(message) {
    let toast = document.querySelector('.toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    elements.addPromptBtn.addEventListener('click', () => {
        openPromptModal();
    });
    
    elements.cancelBtn.addEventListener('click', () => {
        closePromptModal();
    });
    
    elements.promptForm.addEventListener('submit', savePrompt);
    
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderPrompts();
    });
    
    // Close modal when clicking outside
    elements.promptModal.addEventListener('click', (e) => {
        if (e.target === elements.promptModal) {
            closePromptModal();
        }
    });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 