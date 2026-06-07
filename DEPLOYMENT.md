# Deployment Guide - YR Digital Memories

Follow these step-by-step instructions to set up the backend database, storage buckets, admin user, and deploy the application to production using Supabase and Vercel.

---

## Phase 1: Supabase Configuration

### 1. Create a Supabase Project
1. Log in to [Supabase Console](https://supabase.com).
2. Click **New Project** and select your organization.
3. Enter `YR Digital Memories` as the project name, configure a secure database password, and select the region closest to your primary audience.
4. Wait for the database instance to initialize.

### 2. Configure Database Schema (SQL Editor)
1. In your Supabase dashboard sidebar, click on **SQL Editor**.
2. Click **New Query**.
3. Paste the following SQL script to create the tables, enable Row Level Security (RLS), and configure access control policies:

```sql
-- Create memories table
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  memory_title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  scan_count INTEGER DEFAULT 0 NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create scan_analytics table
CREATE TABLE scan_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  device_type TEXT,
  browser TEXT,
  country TEXT,
  city TEXT
);

-- Create settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 1. Memories Table Policies
CREATE POLICY "Allow public read-only of memories" 
ON memories FOR SELECT 
USING (true);

CREATE POLICY "Allow admins full access to memories" 
ON memories FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 2. Scan Analytics Table Policies
CREATE POLICY "Allow public inserts into scan_analytics" 
ON scan_analytics FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow admins to read scan_analytics" 
ON scan_analytics FOR SELECT 
TO authenticated 
USING (true);

-- 3. Settings Table Policies
CREATE POLICY "Allow public read of settings" 
ON settings FOR SELECT 
USING (true);

CREATE POLICY "Allow admins full access to settings" 
ON settings FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
```

4. Click **Run** at the bottom right. Verify that the script executes successfully and tables are created.

### 3. Setup Storage Buckets
1. In your Supabase dashboard sidebar, click on **Storage**.
2. Click **New Bucket**.
3. Name the bucket `memories`.
4. **CRITICAL**: Toggle the **Public** switch to **ON**. This is required to allow clients to stream images and videos directly.
5. Click **Save**.
6. By default, public buckets allow public downloads (GET). However, we need to create policies allowing authenticated admins to upload, modify, and delete files inside this bucket.
   
   * **Method A (Recommended - Direct SQL)**:
     Go to the **SQL Editor** on the left sidebar, open a **New Query**, paste the following script, and click **Run**:
     ```sql
     -- Allow authenticated admin users full access to the memories storage bucket
     CREATE POLICY "Allow admins full access to memories storage" 
     ON storage.objects 
     FOR ALL 
     TO authenticated 
     USING (bucket_id = 'memories')
     WITH CHECK (bucket_id = 'memories');
     ```

   * **Method B (Via Storage Dashboard UI)**:
     * Click **Policies** on the left menu under Storage.
     * Click **New Policy** next to the `memories` bucket block.
     * Choose **For full customization (Allowed Operations)**:
       * **Policy Name**: `Allow admins full access`
       * **Allowed Operations**: Select `SELECT`, `INSERT`, `UPDATE`, `DELETE` (All).
       * **Target roles**: Select `authenticated`.
       * **Policy definition (USING expression)**: `bucket_id = 'memories'`
       * **With check (WITH CHECK expression)**: `bucket_id = 'memories'`
     * Click **Review** and then **Save Policy**.

### 4. Create an Admin Account
1. In your Supabase dashboard sidebar, click on **Authentication**.
2. Click **Users** -> **Add User** -> **Create User**.
3. Enter the email address and password you wish to use to log into the Admin Panel.
4. Uncheck **Auto-confirm user** if you wish to verify email, or keep it checked (recommended for internal admin setup) to activate the account instantly.
5. Click **Save**.

---

## Phase 2: Local Verification

1. Copy `.env.local.example` to a new file named `.env.local` in your root project folder.
2. In Supabase, go to **Project Settings** -> **API**.
3. Copy the **Project API URL** and paste it as `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy the **anon / public** key and paste it as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Run `npm run dev` to start the development server.
6. Open `http://localhost:3000/admin` to test the credentials you created in Phase 1.

---

## Phase 3: Vercel Deployment

### 1. Initialize Git & Commit
If you haven't already committed your workspace to git:
```bash
git init
git add .
git commit -m "Initialize YR Digital Memories Platform"
```

### 2. Connect to Vercel
1. Create a repository on GitHub / GitLab / Bitbucket and push your code.
2. Go to [Vercel Dashboard](https://vercel.com) and click **Add New** -> **Project**.
3. Import your repository.
4. In the **Environment Variables** section, add your Supabase credentials:
   * `NEXT_PUBLIC_SUPABASE_URL` = (Your Supabase URL)
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (Your Supabase public anon key)
5. Click **Deploy**. Vercel will bundle the App Router project and set up dynamic serverless edges.
6. Open your deployed live URL!

### 3. Mobile Testing
* Load the Vercel HTTPS URL on your phone camera.
* Access the `/scan` route.
* Allow camera permissions and scan your physical prints!
