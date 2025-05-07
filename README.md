# Prompt Butler - Chrome Extension

[English](README.md) | [中文](README_CN.md)

A Chrome extension for managing AI prompts efficiently. Save, organize, and reuse your prompts with ease.

## Features

- Create and manage AI prompts with titles and content
- Organize prompts using tags
- Search through your prompts
- Quick copy to clipboard
- Right-click to save selected text as a prompt
- Local storage for data privacy
- Cloud synchronization across devices (via Supabase)

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

### Adding Prompts
- Click the extension icon in the toolbar
- Click "Add Prompt"
- Fill in the title, content, and tags
- Click "Save"

### Using Prompts
- Click the extension icon to view your prompts
- Use the search bar to find specific prompts
- Filter prompts by clicking on tags
- Click "Copy" to copy a prompt to your clipboard

### Quick Save
- Select text on any webpage
- Right-click and select "Save as Prompt"
- The text will be saved as a new prompt

### Cloud Synchronization
- Enable cloud sync in the settings page
- Configure your Supabase connection
- Your prompts will sync across devices
- See the [Supabase Configuration Guide](supabase.md) for detailed setup instructions

## Development

### Project Structure
```
prompt-butler/
├── manifest.json
├── popup.html
├── styles/
│   └── popup.css
├── js/
│   ├── popup.js
│   └── background.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Technologies Used
- HTML5
- CSS3 (with Tailwind CSS)
- JavaScript
- Chrome Extension APIs
- Supabase (for cloud storage)

## Documentation

- [Supabase Configuration Guide](supabase.md) - Instructions for setting up cloud synchronization

## License

MIT License 