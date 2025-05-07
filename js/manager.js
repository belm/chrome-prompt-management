// Import Supabase client and API
import { promptsApi } from './supabase.js';

// State management
let state = {
    prompts: [],
    tags: new Set(),
    activeTag: null,
    searchQuery: '',
    editingPromptId: null,
    isOnline: navigator.onLine,
    syncStatus: 'synced', // 'synced', 'syncing', 'failed', 'disabled'
    cloudSyncEnabled: false,
    isSaving: false // 添加保存状态标志
};

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
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
        cancelBtn: document.getElementById('cancelBtn'),
        syncStatus: document.getElementById('syncStatus') || document.createElement('div') // Optional sync status indicator
    };

    // Initialize the app
    init();

    // Initialize the app
    async function init() {
        // Setup offline/online listeners
        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);
        
        // 加载设置
        await loadSettings();
        
        // 加载提示词
        await loadPrompts();
        renderPrompts();
        renderTags();
        setupEventListeners();
        
        // 如果云同步已启用且在线，同步到Supabase
        if (state.cloudSyncEnabled && state.isOnline) {
            syncWithSupabase();
        } else if (!state.cloudSyncEnabled) {
            state.syncStatus = 'disabled';
            updateSyncStatusUI();
        }
    }
    
    // 加载设置
    async function loadSettings() {
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get('settings', resolve);
            });
            
            if (result.settings && result.settings.cloudSync) {
                state.cloudSyncEnabled = result.settings.cloudSync.enabled;
            } else {
                state.cloudSyncEnabled = false;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            state.cloudSyncEnabled = false;
        }
    }
    
    // Handle online/offline changes
    function handleConnectionChange() {
        state.isOnline = navigator.onLine;
        
        if (state.isOnline && state.syncStatus !== 'synced' && state.cloudSyncEnabled) {
            // Try to sync when we come back online
            syncWithSupabase();
        }
        
        // Update UI to reflect connectivity status
        updateSyncStatusUI();
    }
    
    // Update sync status UI
    function updateSyncStatusUI() {
        if (elements.syncStatus) {
            if (!state.cloudSyncEnabled) {
                elements.syncStatus.textContent = '云同步已禁用';
                elements.syncStatus.className = 'sync-status disabled';
            } else if (!state.isOnline) {
                elements.syncStatus.textContent = '离线 - 更改已本地保存';
                elements.syncStatus.className = 'sync-status offline';
            } else if (state.syncStatus === 'syncing') {
                elements.syncStatus.textContent = '正在同步到云端...';
                elements.syncStatus.className = 'sync-status syncing';
            } else if (state.syncStatus === 'failed') {
                elements.syncStatus.textContent = '同步失败 - 稍后重试';
                elements.syncStatus.className = 'sync-status failed';
            } else {
                elements.syncStatus.textContent = '所有更改已同步';
                elements.syncStatus.className = 'sync-status synced';
            }
        }
    }

    // Sync with Supabase
    async function syncWithSupabase() {
        if (!state.isOnline || !state.cloudSyncEnabled) return;
        
        try {
            // 检查云同步是否可用（API可以访问）
            const isAvailable = await promptsApi.isCloudSyncAvailable();
            if (!isAvailable) {
                console.log('Cloud sync is disabled in settings');
                state.syncStatus = 'disabled';
                updateSyncStatusUI();
                return;
            }
            
            state.syncStatus = 'syncing';
            updateSyncStatusUI();
            
            // First, sync local changes to Supabase
            await promptsApi.syncFromLocal(state.prompts);
            
            // Then, get all prompts from Supabase
            const cloudPrompts = await promptsApi.getAllPrompts();
            
            // Merge with local storage
            if (cloudPrompts && cloudPrompts.length > 0) {
                // Save to local storage as backup
                await chrome.storage.local.set({ prompts: cloudPrompts });
                
                // Update state
                state.prompts = cloudPrompts;
                
                // Update tags
                state.tags = new Set();
                state.prompts.forEach(prompt => {
                    prompt.tags.forEach(tag => {
                        state.tags.add(tag);
                    });
                });
                
                // Re-render UI
                renderPrompts();
                renderTags();
            }
            
            state.syncStatus = 'synced';
        } catch (error) {
            console.error('Sync failed:', error);
            state.syncStatus = 'failed';
            
            // Try again in 30 seconds
            setTimeout(syncWithSupabase, 30000);
        } finally {
            updateSyncStatusUI();
        }
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
    async function savePrompts() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ prompts: state.prompts }, async () => {
                // Also sync with Supabase if online and cloud sync is enabled
                if (state.isOnline && state.cloudSyncEnabled) {
                    try {
                        await syncWithSupabase();
                    } catch (error) {
                        console.error('Failed to sync with Supabase:', error);
                        // We'll try again later
                    }
                }
                resolve();
            });
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
        
        // Sort prompts by updatedAt date in descending order (newest first)
        const sortedPrompts = [...filteredPrompts].sort((a, b) => {
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        
        sortedPrompts.forEach(prompt => {
            const promptCard = document.createElement('div');
            promptCard.className = 'prompt-card';
            
            // Truncate content for display
            const truncatedContent = prompt.content.length > 600 
                ? prompt.content.slice(0, 600) + '...' 
                : prompt.content;
            
            // Format dates for display
            const createdDate = new Date(prompt.createdAt || Date.now());
            const updatedDate = new Date(prompt.updatedAt || Date.now());
            
            const createdAtFormatted = isValidDate(createdDate) ? 
                `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString()}` : 
                "未知";
            const updatedAtFormatted = isValidDate(updatedDate) ? 
                `${updatedDate.toLocaleDateString()} ${updatedDate.toLocaleTimeString()}` : 
                "未知";
            
            promptCard.innerHTML = `
                <div class="prompt-header">
                    <h3 class="text-gray-800">${prompt.title}</h3>
                    <div class="prompt-created-time">创建: ${createdAtFormatted}</div>
                </div>
                <p class="text-gray-600 whitespace-pre-line">${truncatedContent}</p>
                <div class="prompt-footer">
                    <div class="prompt-updated-time">更新: ${updatedAtFormatted}</div>
                    <div class="prompt-tags mb-3">
                        ${prompt.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
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
        
        // 如果正在保存中，阻止重复保存
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
        
        // 设置保存状态，禁用保存按钮
        state.isSaving = true;
        const saveButton = elements.promptForm.querySelector('button[type="submit"]');
        const originalText = saveButton.textContent;
        saveButton.textContent = '保存中...';
        saveButton.disabled = true;
        saveButton.classList.add('opacity-50', 'cursor-not-allowed');
        
        try {
            let updatedPrompt;
            
            if (state.editingPromptId) {
                // Update existing prompt
                const index = state.prompts.findIndex(p => p.id === state.editingPromptId);
                if (index !== -1) {
                    // Prepare updated data
                    const promptData = {
                        title,
                        content,
                        tags
                    };
                    
                    if (state.isOnline && state.cloudSyncEnabled) {
                        try {
                            // 如果云同步已启用并且在线，直接更新到Supabase
                            updatedPrompt = await promptsApi.updatePrompt(state.editingPromptId, promptData);
                            state.prompts[index] = updatedPrompt;
                        } catch (error) {
                            console.error('Failed to update prompt in cloud, saving locally:', error);
                            // 如果云同步失败，回退到本地更新
                            state.prompts[index] = {
                                ...state.prompts[index],
                                ...promptData,
                                updatedAt: new Date().toISOString()
                            };
                        }
                    } else {
                        // If offline or cloud sync disabled, update locally
                        state.prompts[index] = {
                            ...state.prompts[index],
                            ...promptData,
                            updatedAt: new Date().toISOString()
                        };
                    }
                }
            } else {
                // Add new prompt
                const promptData = {
                    title,
                    content,
                    tags
                };
                
                if (state.isOnline && state.cloudSyncEnabled) {
                    try {
                        // 如果云同步已启用并且在线，直接创建到Supabase
                        const newPrompt = await promptsApi.createPrompt(promptData);
                        state.prompts.unshift(newPrompt);
                    } catch (error) {
                        console.error('Failed to create prompt in cloud, saving locally:', error);
                        // 如果云同步失败，回退到本地创建
                        const newPrompt = {
                            id: Date.now().toString(),
                            ...promptData,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        state.prompts.unshift(newPrompt);
                    }
                } else {
                    // If offline or cloud sync disabled, create locally first
                    const newPrompt = {
                        id: Date.now().toString(),
                        ...promptData,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    state.prompts.unshift(newPrompt);
                }
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
            console.error('Error saving prompt:', error);
            showToast('Error saving prompt. Please try again.');
        } finally {
            // 无论成功还是失败，都恢复按钮状态
            state.isSaving = false;
            saveButton.textContent = originalText;
            saveButton.disabled = false;
            saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    // Delete prompt
    async function deletePrompt(id) {
        try {
            if (state.isOnline && state.cloudSyncEnabled) {
                try {
                    // 如果云同步已启用并且在线，直接从Supabase删除
                    await promptsApi.deletePrompt(id);
                } catch (error) {
                    console.error('Failed to delete prompt from cloud:', error);
                    // 继续从本地删除
                }
            }
            
            // Always update local state
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
        } catch (error) {
            console.error('Error deleting prompt:', error);
            showToast('Error deleting prompt. Please try again.');
        }
    }

    // 监听存储更改事件，以便在设置更改时更新状态
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.settings) {
            const newSettings = changes.settings.newValue;
            if (newSettings && newSettings.cloudSync) {
                const wasEnabled = state.cloudSyncEnabled;
                state.cloudSyncEnabled = newSettings.cloudSync.enabled;
                
                // 如果云同步状态发生了变化
                if (wasEnabled !== state.cloudSyncEnabled) {
                    if (state.cloudSyncEnabled && state.isOnline) {
                        // 如果启用了云同步，立即同步
                        syncWithSupabase();
                    } else if (!state.cloudSyncEnabled) {
                        // 如果禁用了云同步，更新状态
                        state.syncStatus = 'disabled';
                        updateSyncStatusUI();
                    }
                }
            }
        }
    });

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

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key closes modal
            if (e.key === 'Escape' && !elements.promptModal.classList.contains('hidden')) {
                closePromptModal();
            }
            
            // Ctrl/Cmd + F focuses search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                elements.searchInput.focus();
            }
            
            // Ctrl/Cmd + N adds new prompt
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                openPromptModal();
            }
        });
    }

    function isValidDate(d) {
        return d instanceof Date && !isNaN(d);
    }
}); 