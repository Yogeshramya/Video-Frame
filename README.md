# YR Digital Memories Platform

This repository contains the twin-project setup for the Augmented Reality Digital Memories platform:
1. **[admin-portal](./admin-portal)**: Next.js application for admin users to manage printed frame records, upload target images/videos, and view scan analytics.
2. **[video-frame](./video-frame)**: Next.js application for scanning physical photo frames via the camera and watching augmented video playback.

---

## Vercel Multi-Project Deployment Guide

Since this repository houses both the client application and the admin panel, you must deploy them as **two separate projects** in Vercel using the **Root Directory** setting.

### Project 1: Video Frame Client Application
1. Go to the [Vercel Dashboard](https://vercel.com) and click **Add New** -> **Project**.
2. Select this git repository and click **Import**.
3. Under **Configure Project**, click the **Edit** button next to the **Root Directory** option.
4. Select the `video-frame` folder and click **Continue**.
5. Set the project name (e.g., `yr-digital-memories-client`).
6. Add the following **Environment Variables**:
   * `NEXT_PUBLIC_SUPABASE_URL` = *(Your Supabase API URL)*
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(Your Supabase public anon key)*
7. Click **Deploy**.

---

### Project 2: Admin Portal Application
1. Go to the [Vercel Dashboard](https://vercel.com) and click **Add New** -> **Project**.
2. Select the **same** git repository and click **Import**.
3. Under **Configure Project**, click the **Edit** button next to the **Root Directory** option.
4. Select the `admin-portal` folder and click **Continue**.
5. Set the project name (e.g., `yr-digital-memories-admin`).
6. Add the following **Environment Variables**:
   * `NEXT_PUBLIC_SUPABASE_URL` = *(Your Supabase API URL)*
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(Your Supabase public anon key)*
7. Click **Deploy**.
