# Deployment Guide

This guide will help you deploy the Sand Grain Website to either Vercel or Netlify.

## Prerequisites

1. A GitHub account
2. A Vercel or Netlify account
3. Git installed on your local machine

## Method 1: Deploy to Vercel (Recommended)

### Step 1: Push to GitHub
```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: Sand Grain Website"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will automatically detect it's a static site
5. Click "Deploy"
6. Your site will be live at `https://your-project-name.vercel.app`

### Vercel Configuration
- **Build Command**: `npm run build` (or leave empty for static sites)
- **Output Directory**: `.` (root directory)
- **Install Command**: `npm install` (optional)

## Method 2: Deploy to Netlify

### Step 1: Push to GitHub (same as above)

### Step 2: Deploy to Netlify
1. Go to [netlify.com](https://netlify.com) and sign in
2. Click "New site from Git"
3. Connect your GitHub account and select your repository
4. Configure build settings:
   - **Build command**: `echo 'Static site deployment'`
   - **Publish directory**: `.` (root directory)
5. Click "Deploy site"
6. Your site will be live at `https://your-site-name.netlify.app`

### Netlify Configuration
The `netlify.toml` file is already configured for optimal performance with:
- Proper redirects for all routes
- Security headers
- Cache control for static assets

## Post-Deployment

### 1. Custom Domain (Optional)
Both platforms allow you to add a custom domain:
- **Vercel**: Go to Project Settings > Domains
- **Netlify**: Go to Site Settings > Domain Management

### 2. Environment Variables (if needed)
If you need environment variables:
- **Vercel**: Project Settings > Environment Variables
- **Netlify**: Site Settings > Environment Variables

### 3. Automatic Deployments
Both platforms will automatically redeploy when you push changes to your main branch.

## Troubleshooting

### Common Issues:
1. **404 errors on subdirectories**: Ensure redirects are properly configured
2. **Assets not loading**: Check file paths are correct
3. **Python dependencies**: The SandScore folder contains Python files that won't run on static hosting

### Python Applications Note:
The SandScore and Scoper applications contain Python code that requires a backend server. For full functionality, you may need to:
1. Deploy the Python backend separately (Heroku, Railway, etc.)
2. Update the frontend to point to the deployed backend URL
3. Or use serverless functions for the Python logic

## File Structure
```
/
├── index.html              # Main website
├── pages/                  # Website pages
├── assets/                 # CSS, JS, images
├── SandScore/             # Sand analysis app
├── Scoper/                # Marine monitoring app
├── package.json           # Node.js configuration
├── vercel.json           # Vercel configuration
├── netlify.toml          # Netlify configuration
└── DEPLOYMENT.md         # This file
```

## Support
- Vercel Documentation: https://vercel.com/docs
- Netlify Documentation: https://docs.netlify.com
