# Prompt Butler - Chrome扩展程序

[English](README.md) | 中文

一个用于高效管理AI提示词的Chrome扩展。轻松保存、组织和重用您的提示词。

## 功能特点

- 创建和管理带有标题和内容的AI提示词
- 使用标签组织提示词
- 搜索您的提示词
- 快速复制到剪贴板
- 右键单击保存选定文本作为提示词
- 支持本地存储和云端同步
- 跨设备同步您的提示词（通过Supabase云服务）

## 安装方法

1. 克隆此仓库或下载源代码
2. 打开Chrome并导航至 `chrome://extensions/`
3. 在右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"并选择扩展目录

## 使用方法

### 管理页面
- 点击扩展图标在工具栏中
- 点击页面上的设置图标进入设置页面
- 在设置页面可配置云同步选项

### 添加提示词
- 点击"Add Prompt"按钮
- 填写标题、内容和标签
- 点击"Save"保存

### 使用提示词
- 点击扩展图标查看您的提示词
- 使用搜索栏查找特定提示词
- 通过点击标签筛选提示词
- 点击"Copy"将提示词复制到剪贴板

### 快速保存
- 在任何网页上选择文本
- 右键单击并选择"Save as Prompt"
- 文本将被保存为新的提示词

### 云同步设置
- 在设置页面启用云同步
- 配置您的Supabase连接信息
- 测试连接并初始化数据库
- 所有提示词将自动同步到云端
- 查看[Supabase配置指南](supabase.md)获取详细设置说明

## 开发信息

### 项目结构
```
prompt-management-tool/
├── manifest.json
├── manager.html       # 提示词管理页面
├── settings.html      # 设置页面
├── styles/
│   ├── manager.css
│   └── settings.css
├── js/
│   ├── manager.js     # 管理页面逻辑
│   ├── settings.js    # 设置页面逻辑
│   ├── supabase.js    # Supabase API封装
│   ├── background.js  # 后台脚本
│   └── lib/           # 第三方库
│       └── supabase.min.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 使用的技术
- HTML5
- CSS3 (使用 Tailwind CSS)
- JavaScript
- Chrome扩展API
- Supabase (云数据存储)

## 文档

- [Supabase配置指南](supabase.md) - 云同步功能设置说明

## 云同步功能

本扩展支持通过Supabase实现云同步功能，您可以：

1. 在设置页面启用/禁用云同步
2. 配置您自己的Supabase项目信息
3. 测试连接并初始化数据库
4. 在多个设备间同步您的提示词

### 离线支持
- 所有功能在离线状态下仍然可用
- 在恢复网络连接后，数据会自动同步到云端

## 许可证

MIT许可证 