// settings.js
document.addEventListener('DOMContentLoaded', () => {
    // 元素引用
    const elements = {
        form: document.getElementById('settingsForm'),
        cloudSyncEnabled: document.getElementById('cloudSyncEnabled'),
        cloudServiceOptions: document.getElementById('cloudServiceOptions'),
        cloudServiceProvider: document.getElementById('cloudServiceProvider'),
        supabaseSettings: document.getElementById('supabaseSettings'),
        supabaseUrl: document.getElementById('supabaseUrl'),
        supabaseAnonKey: document.getElementById('supabaseAnonKey'),
        showAnonKey: document.getElementById('showAnonKey'),
        testConnection: document.getElementById('testConnection'),
        connectionStatus: document.getElementById('connectionStatus'),
        initDatabase: document.getElementById('initDatabase'),
        initStatus: document.getElementById('initStatus'),
        autoSaveInterval: document.getElementById('autoSaveInterval')
    };

    // 当前设置
    let currentSettings = {
        cloudSync: {
            enabled: false,
            provider: 'supabase',
            supabase: {
                url: '',
                anonKey: ''
            }
        },
        autoSaveInterval: 30
    };

    // 初始化页面
    loadSettings();
    setupEventListeners();

    // 加载保存的设置
    async function loadSettings() {
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get('settings', resolve);
            });

            if (result.settings) {
                currentSettings = result.settings;
                
                // 更新UI以匹配设置
                elements.cloudSyncEnabled.checked = currentSettings.cloudSync.enabled;
                elements.cloudServiceProvider.value = currentSettings.cloudSync.provider || 'supabase';
                
                if (currentSettings.cloudSync.supabase) {
                    elements.supabaseUrl.value = currentSettings.cloudSync.supabase.url || '';
                    elements.supabaseAnonKey.value = currentSettings.cloudSync.supabase.anonKey || '';
                }
                
                elements.autoSaveInterval.value = currentSettings.autoSaveInterval || 30;
                
                // 如果云同步已启用，显示相关设置
                updateVisibleSettings();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    // 保存设置
    async function saveSettings() {
        try {
            // 更新当前设置对象
            currentSettings.cloudSync.enabled = elements.cloudSyncEnabled.checked;
            currentSettings.cloudSync.provider = elements.cloudServiceProvider.value;
            
            if (!currentSettings.cloudSync.supabase) {
                currentSettings.cloudSync.supabase = {};
            }
            
            currentSettings.cloudSync.supabase.url = elements.supabaseUrl.value;
            currentSettings.cloudSync.supabase.anonKey = elements.supabaseAnonKey.value;
            currentSettings.autoSaveInterval = parseInt(elements.autoSaveInterval.value, 10) || 30;
            
            // 保存到Chrome存储
            await new Promise(resolve => {
                chrome.storage.local.set({ settings: currentSettings }, resolve);
            });
            
            showMessage('设置已保存');
        } catch (error) {
            console.error('Failed to save settings:', error);
            showMessage('保存设置失败', true);
        }
    }

    // 配置事件监听器
    function setupEventListeners() {
        // 表单提交
        elements.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveSettings();
        });
        
        // 云同步开关更改
        elements.cloudSyncEnabled.addEventListener('change', updateVisibleSettings);
        
        // 云服务提供商更改
        elements.cloudServiceProvider.addEventListener('change', updateVisibleSettings);
        
        // 显示/隐藏密钥
        elements.showAnonKey.addEventListener('change', () => {
            elements.supabaseAnonKey.type = elements.showAnonKey.checked ? 'text' : 'password';
        });
        
        // 测试连接
        elements.testConnection.addEventListener('click', testSupabaseConnection);
        
        // 初始化数据库
        elements.initDatabase.addEventListener('click', initSupabaseDatabase);
    }

    // 根据设置更新UI可见性
    function updateVisibleSettings() {
        // 云服务选项可见性
        if (elements.cloudSyncEnabled.checked) {
            elements.cloudServiceOptions.classList.add('show');
        } else {
            elements.cloudServiceOptions.classList.remove('show');
            elements.supabaseSettings.classList.remove('show');
            return;
        }
        
        // Supabase设置可见性
        if (elements.cloudServiceProvider.value === 'supabase') {
            elements.supabaseSettings.classList.add('show');
        } else {
            elements.supabaseSettings.classList.remove('show');
        }
    }

    // 测试Supabase连接
    async function testSupabaseConnection() {
        const url = elements.supabaseUrl.value.trim();
        const anonKey = elements.supabaseAnonKey.value.trim();
        
        if (!url || !anonKey) {
            showConnectionStatus('请填写Supabase URL和匿名密钥', 'error');
            return;
        }
        
        try {
            showConnectionStatus('正在测试连接...', 'loading');
            
            // 创建一个临时Supabase客户端
            const supabaseClient = supabase.createClient(url, anonKey);
            
            // 尝试一个简单的查询
            const { error } = await supabaseClient.from('prompts').select('count', { count: 'exact', head: true });
            
            if (error && error.code !== 'PGRST116') {
                // PGRST116是"表不存在"错误，这在初始设置时是正常的
                throw error;
            }
            
            showConnectionStatus('连接成功', 'success');
        } catch (error) {
            console.error('Connection test failed:', error);
            
            if (error.message?.includes('Failed to fetch')) {
                showConnectionStatus('连接失败：URL可能不正确或网络问题', 'error');
            } else if (error.message?.includes('invalid token')) {
                showConnectionStatus('连接失败：密钥无效', 'error');
            } else if (error.code === 'PGRST204') {
                showConnectionStatus('连接成功，但表不存在。点击"创建必要的表"按钮进行初始化', 'loading');
            } else {
                showConnectionStatus(`连接失败：${error.message || '未知错误'}`, 'error');
            }
        }
    }

    // 初始化Supabase数据库
    async function initSupabaseDatabase() {
        const url = elements.supabaseUrl.value.trim();
        const anonKey = elements.supabaseAnonKey.value.trim();
        
        if (!url || !anonKey) {
            showInitStatus('请填写Supabase URL和匿名密钥', 'error');
            return;
        }
        
        try {
            showInitStatus('正在初始化数据库...', 'loading');
            
            // 创建一个临时Supabase客户端
            const supabaseClient = supabase.createClient(url, anonKey);
            
            // 尝试创建必要的表
            const createTablesQuery = `
                -- Enable UUID extension
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

                -- Create prompts table
                CREATE TABLE IF NOT EXISTS prompts (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  title TEXT NOT NULL,
                  content TEXT NOT NULL,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
                );

                -- Create tags table
                CREATE TABLE IF NOT EXISTS tags (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  name TEXT NOT NULL UNIQUE
                );

                -- Create junction table for many-to-many relationship
                CREATE TABLE IF NOT EXISTS prompt_tags (
                  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
                  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
                  PRIMARY KEY (prompt_id, tag_id)
                );

                -- Create index for faster tag lookups
                CREATE INDEX IF NOT EXISTS idx_prompt_tags_prompt_id ON prompt_tags(prompt_id);
                CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag_id ON prompt_tags(tag_id);
            `;
            
            // 执行SQL查询
            const { error } = await supabaseClient.rpc('pgcrypto_extensions', {
                query_text: createTablesQuery
            });
            
            if (error) {
                // 尝试备用方法：使用REST API运行SQL
                const res = await fetch(`${url}/rest/v1/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${anonKey}`,
                        'apikey': anonKey
                    },
                    body: JSON.stringify({
                        query: createTablesQuery
                    })
                });
                
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Failed to initialize database');
                }
            }
            
            showInitStatus('数据库初始化成功', 'success');
        } catch (error) {
            console.error('Database initialization failed:', error);
            showInitStatus(`初始化失败：${error.message || '未知错误'}`, 'error');
            
            // 如果是权限问题，提示用户
            if (error.message?.includes('permission denied')) {
                showInitStatus('初始化失败：权限不足。请确保您使用的匿名密钥具有创建表的权限，或者联系数据库管理员帮助创建表。', 'error');
            }
        }
    }

    // 显示连接状态
    function showConnectionStatus(message, type = 'loading') {
        elements.connectionStatus.textContent = message;
        elements.connectionStatus.className = `ml-3 text-sm connection-${type}`;
    }

    // 显示初始化状态
    function showInitStatus(message, type = 'loading') {
        elements.initStatus.textContent = message;
        elements.initStatus.className = `ml-3 text-sm connection-${type}`;
    }

    // 显示消息（可实现为Toast消息）
    function showMessage(message, isError = false) {
        // 简单的警告消息，未来可以改为Toast或其他UI组件
        alert(message);
    }
}); 