# How to Get Your Google Analytics 4 (GA4) Measurement ID

## Step 1: Create a Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. If you don't have an account, click "Start measuring"

## Step 2: Create a GA4 Property (if you don't have one)

1. In Google Analytics, click **Admin** (gear icon) in the bottom left
2. In the **Property** column, click **Create Property**
3. Enter your property details:
   - **Property name**: `noos.blog` (or your site name)
   - **Reporting time zone**: Choose your timezone
   - **Currency**: Choose your currency
4. Click **Next**
5. Fill in business information (optional)
6. Click **Create**

## Step 3: Set Up a Data Stream

1. After creating the property, you'll see **Data Streams**
2. Click **Add stream** → **Web**
3. Enter your website details:
   - **Website URL**: `https://noos.blog`
   - **Stream name**: `noos.blog` (or any name you prefer)
4. Click **Create stream**

## Step 4: Find Your Measurement ID

After creating the data stream, you'll see a page with your stream details.

**Your Measurement ID** will be displayed at the top in format: **`G-XXXXXXXXXX`**

It looks like this:
```
Measurement ID
G-XXXXXXXXXX
```

### Alternative: Find it in Admin Settings

If you need to find it later:
1. Go to **Admin** (gear icon)
2. In the **Property** column, click **Data Streams**
3. Click on your web stream (e.g., `noos.blog`)
4. Your **Measurement ID** is at the top of the page

## Step 5: Add to Your Blog

1. Copy your Measurement ID (e.g., `G-ABCD123456`)
2. Open `config.toml` in your blog repository
3. Find the `google_analytics_id` field
4. Add your ID:

```toml
google_analytics_id = "G-ABCD123456"
```

5. Save and commit the file
6. Push to `main` branch — GitHub Actions will deploy automatically

## Step 6: Verify It's Working

1. After deployment, visit your blog
2. Open your browser's Developer Tools (F12)
3. Go to the **Network** tab
4. Filter by "gtag" or "collect"
5. Look for requests to `googletagmanager.com` or `google-analytics.com`
6. You should see requests being sent

### Alternative: Check in Google Analytics

1. Go to Google Analytics
2. Click **Reports** → **Realtime**
3. Visit your blog in another tab/window
4. You should see yourself appear in the realtime report within a few seconds

## Quick Reference

- **Measurement ID format**: `G-XXXXXXXXXX` (starts with "G-")
- **Where it goes**: `config.toml` → `google_analytics_id` field
- **Location in GA**: Admin → Data Streams → [Your Stream]

## Troubleshooting

**Can't find the Measurement ID?**
- Make sure you're looking at a **GA4 property** (not Universal Analytics)
- Check you've created a **Web data stream** (not iOS/Android)
- The ID should start with "G-" not "UA-"

**Not tracking?**
- Verify the ID in `config.toml` matches exactly (including quotes)
- Check browser console for errors (F12 → Console tab)
- Ensure you deployed the changes (GitHub Actions completed)
- Wait a few minutes for data to appear in GA4

**Privacy/Ad Blockers?**
- Some ad blockers prevent Google Analytics
- Test in incognito mode or disable ad blockers temporarily
- Real users with ad blockers won't be tracked (this is expected)

