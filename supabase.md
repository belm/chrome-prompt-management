# Supabase Configuration Guide for Prompt Butler

This guide explains how to set up and configure Supabase for the Prompt Butler Chrome extension.

## Prerequisites

- A Supabase account (sign up at [https://supabase.com](https://supabase.com))
- Basic understanding of SQL and database concepts

## Step 1: Create a Supabase Project

1. Log in to your Supabase account
2. Click "New project" in the dashboard
3. Enter a project name (e.g., "Prompt Butler")
4. Set a secure database password (save this for future reference)
5. Choose the region closest to your location
6. Click "Create new project"

## Step 2: Get Your API Credentials

Once your project is created, you'll need to get the API credentials:

1. Go to your project dashboard
2. In the left sidebar, click on "Project Settings"
3. Click on "API" in the settings menu
4. Copy the "URL" and "anon public" key (you'll need these for the extension settings)

## Step 3: Set Up Database Tables

Run the following SQL in the Supabase SQL Editor (found under "SQL Editor" in the left sidebar) to create the necessary tables:

```sql
-- Create prompts table
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE
);

-- Create tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create junction table for many-to-many relationship
CREATE TABLE prompt_tags (
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (prompt_id, tag_id)
);

-- Create RLS policies
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_tags ENABLE ROW LEVEL SECURITY;
```

## Step 4: Configure Authentication (Optional)

If you want to set up user authentication:

1. Go to "Authentication" in the Supabase dashboard
2. Under "Providers", enable the authentication methods you want (Email, Google, etc.)
3. Configure the settings for each provider

## Step 5: Set Up Row Level Security (RLS) Policies

Run the following SQL to set up RLS policies for public access (for simplicity):

```sql
-- Allow public read/write access to all tables
CREATE POLICY "Public read access" ON prompts FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON prompts FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON prompts FOR DELETE USING (true);

CREATE POLICY "Public read access" ON tags FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON tags FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON tags FOR DELETE USING (true);

CREATE POLICY "Public read access" ON prompt_tags FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON prompt_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON prompt_tags FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON prompt_tags FOR DELETE USING (true);
```

Note: For production use, you should implement proper authentication and restrict access to only authenticated users.

## Step 6: Configure the Extension

1. Open the Prompt Butler extension
2. Click on the settings icon to go to settings page
3. Enable cloud synchronization
4. Enter your Supabase URL and API key (anon public key)
5. Click "Test Connection" to verify the setup
6. Click "Save Settings"

## Troubleshooting

If you encounter issues with your Supabase integration:

1. **Connection Issues**: Verify your URL and API key are correct.
2. **Database Errors**: Check the SQL queries and table structure.
3. **CORS Errors**: Ensure your Supabase project allows requests from Chrome extensions.
4. **Synchronization Problems**: Check your network connection and browser console for errors.

## Advanced Configuration

### Custom Table Names

If you want to use custom table names, modify both the SQL setup and the extension settings accordingly.

### User Authentication

For a multi-user setup, implement proper authentication and modify RLS policies to restrict access by user ID.

Example policy for authenticated users:

```sql
CREATE POLICY "User's prompts" ON prompts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Data Backup

Regularly back up your Supabase database using the built-in backup features in the Supabase dashboard under "Project Settings" > "Database". 