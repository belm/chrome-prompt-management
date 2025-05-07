// supabase.js
// 使用本地库而不是从CDN导入
// import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';

// 全局变量supabase将由lib/supabase.min.js提供
const { createClient } = supabase;

// 默认配置（仅用于开发测试，生产环境将从设置中获取）
const DEFAULT_SUPABASE_URL = '';
const DEFAULT_SUPABASE_ANON_KEY = '';

// Supabase客户端实例
let supabaseClient = null;

// 从设置获取Supabase配置并初始化客户端
async function initSupabaseClient() {
    try {
        const { settings } = await new Promise(resolve => {
            chrome.storage.local.get('settings', resolve);
        });

        // 如果没有设置，或者云同步未启用，仅使用默认配置（不会实际工作）
        if (!settings || !settings.cloudSync || !settings.cloudSync.enabled) {
            console.log('Cloud sync is disabled or not configured');
            return null;
        }

        // 获取Supabase配置
        const supabaseConfig = settings.cloudSync.supabase || {};
        const url = supabaseConfig.url || DEFAULT_SUPABASE_URL;
        const anonKey = supabaseConfig.anonKey || DEFAULT_SUPABASE_ANON_KEY;

        if (!url || !anonKey) {
            console.log('Supabase configuration is missing');
            return null;
        }

        // 创建并返回Supabase客户端
        return createClient(url, anonKey);
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        return null;
    }
}

// 检查当前的同步设置是否启用
async function isCloudSyncEnabled() {
    try {
        const { settings } = await new Promise(resolve => {
            chrome.storage.local.get('settings', resolve);
        });

        return settings && 
               settings.cloudSync && 
               settings.cloudSync.enabled &&
               settings.cloudSync.supabase &&
               settings.cloudSync.supabase.url &&
               settings.cloudSync.supabase.anonKey;
    } catch (error) {
        console.error('Error checking cloud sync status:', error);
        return false;
    }
}

// 获取Supabase客户端实例（如果未初始化则先初始化）
async function getSupabaseClient() {
    if (!supabaseClient) {
        supabaseClient = await initSupabaseClient();
    }
    return supabaseClient;
}

// 提示词API
export const promptsApi = {
    // 检查云同步是否可用
    async isCloudSyncAvailable() {
        return await isCloudSyncEnabled();
    },
    
    // 重新初始化Supabase客户端（设置更改后调用）
    async reinitialize() {
        supabaseClient = await initSupabaseClient();
        return !!supabaseClient;
    },

    // 获取所有提示词及其标签
    async getAllPrompts() {
        try {
            const client = await getSupabaseClient();
            if (!client) return [];

            const { data: prompts, error: promptsError } = await client
                .from('prompts')
                .select('*')
                .order('created_at', { ascending: false });

            if (promptsError) throw promptsError;

            // 获取每个提示词的标签
            for (const prompt of prompts) {
                const { data: promptTags, error: tagsError } = await client
                    .from('prompt_tags')
                    .select('tags(name)')
                    .eq('prompt_id', prompt.id);

                if (tagsError) throw tagsError;
                
                // 从JOIN查询结果中提取标签名称
                prompt.tags = promptTags.map(pt => pt.tags.name);
            }

            return prompts;
        } catch (error) {
            console.error('Error fetching prompts:', error);
            return [];
        }
    },

    // 创建新提示词
    async createPrompt(prompt) {
        try {
            const client = await getSupabaseClient();
            if (!client) throw new Error('Cloud sync is not available');

            // 插入提示词
            const { data: newPrompt, error: promptError } = await client
                .from('prompts')
                .insert([{
                    title: prompt.title,
                    content: prompt.content
                }])
                .select()
                .single();
            
            if (promptError) throw promptError;
            
            // 处理标签
            if (prompt.tags.length > 0) {
                await this.updatePromptTags(newPrompt.id, prompt.tags);
            }
            
            return { ...newPrompt, tags: prompt.tags };
        } catch (error) {
            console.error('Error creating prompt:', error);
            throw error;
        }
    },

    // 更新现有提示词
    async updatePrompt(id, promptData) {
        try {
            const client = await getSupabaseClient();
            if (!client) throw new Error('Cloud sync is not available');

            // 更新提示词
            const { data: updatedPrompt, error: promptError } = await client
                .from('prompts')
                .update({
                    title: promptData.title,
                    content: promptData.content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();
            
            if (promptError) throw promptError;
            
            // 更新标签
            await this.updatePromptTags(id, promptData.tags);
            
            return { ...updatedPrompt, tags: promptData.tags };
        } catch (error) {
            console.error('Error updating prompt:', error);
            throw error;
        }
    },

    // 删除提示词
    async deletePrompt(id) {
        try {
            const client = await getSupabaseClient();
            if (!client) throw new Error('Cloud sync is not available');

            // 删除提示词（级联将删除prompt_tags条目）
            const { error } = await client
                .from('prompts')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error deleting prompt:', error);
            throw error;
        }
    },

    // 辅助函数：更新提示词的标签
    async updatePromptTags(promptId, tagNames) {
        try {
            const client = await getSupabaseClient();
            if (!client) throw new Error('Cloud sync is not available');

            // 首先，删除此提示词的所有现有标签
            const { error: deleteError } = await client
                .from('prompt_tags')
                .delete()
                .eq('prompt_id', promptId);
            
            if (deleteError) throw deleteError;
            
            // 然后，确保tags表中存在所有标签
            for (const tagName of tagNames) {
                // 尝试查找现有标签
                const { data: existingTag } = await client
                    .from('tags')
                    .select('id')
                    .eq('name', tagName)
                    .single();
                
                let tagId;
                
                if (existingTag) {
                    tagId = existingTag.id;
                } else {
                    // 创建新标签
                    const { data: newTag, error: tagError } = await client
                        .from('tags')
                        .insert([{ name: tagName }])
                        .select()
                        .single();
                    
                    if (tagError) throw tagError;
                    tagId = newTag.id;
                }
                
                // 创建prompt_tag关系
                const { error: relationError } = await client
                    .from('prompt_tags')
                    .insert([{
                        prompt_id: promptId,
                        tag_id: tagId
                    }]);
                
                if (relationError) throw relationError;
            }
            
            return true;
        } catch (error) {
            console.error('Error updating prompt tags:', error);
            throw error;
        }
    },

    // 获取所有可用标签
    async getAllTags() {
        try {
            const client = await getSupabaseClient();
            if (!client) return [];

            const { data, error } = await client
                .from('tags')
                .select('name')
                .order('name');
            
            if (error) throw error;
            
            return data.map(tag => tag.name);
        } catch (error) {
            console.error('Error fetching tags:', error);
            return [];
        }
    },

    // 从本地同步提示词到Supabase
    async syncFromLocal(localPrompts) {
        try {
            const client = await getSupabaseClient();
            if (!client) return false;

            // 获取现有提示词
            const { data: existingPrompts, error } = await client
                .from('prompts')
                .select('id');
            
            if (error) throw error;
            
            const existingIds = existingPrompts.map(p => p.id);
            
            // 插入新提示词
            for (const prompt of localPrompts) {
                // 如果已在Supabase中存在则跳过
                if (existingIds.includes(prompt.id)) continue;
                
                await this.createPrompt({
                    title: prompt.title,
                    content: prompt.content,
                    tags: prompt.tags || []
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error syncing prompts:', error);
            throw error;
        }
    }
};

export default {
    getClient: getSupabaseClient,
    isEnabled: isCloudSyncEnabled,
    reinitialize: promptsApi.reinitialize.bind(promptsApi)
}; 