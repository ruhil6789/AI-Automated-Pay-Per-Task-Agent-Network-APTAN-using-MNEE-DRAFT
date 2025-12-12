# Vercel Deployment Guide

This guide will help you deploy the APTAN frontend to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your backend API deployed separately (see Backend Deployment section)
3. GitHub repository connected to Vercel

## Frontend Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect your GitHub repository to Vercel:**
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select the repository: `AI-Automated-Pay-Per-Task-Agent-Network-APTAN-using-MNEE-DRAFT`

2. **Configure Project Settings:**
   - **Project Name:** Use a custom name like `aptan-using-mnee` or `aptan-mnee` (must be lowercase, no spaces - only letters, digits, '.', '_', and '-')
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend` (IMPORTANT: Set this to `frontend`)
   - **Build Command:** `npm run build` (will run in frontend directory)
   - **Output Directory:** `build`
   - **Install Command:** `npm install`
   
   **Note:** If your repository name contains spaces, Vercel will show an error. Simply change the **Project Name** field to a valid name (e.g., `aptan-using-mnee`) while keeping the repository connection.

3. **Set Environment Variables:**
   In the Vercel project settings, add these environment variables:
   
   ```
   REACT_APP_CONTRACT_ADDRESS=0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92
   REACT_APP_MNEE_ADDRESS=0x0D10aC728b7DE11183c22ebE5027369394808708
   REACT_APP_API_URL=https://your-backend-url.com
   ```
   
   **Important:** Replace `https://your-backend-url.com` with your actual backend API URL.

4. **Deploy:**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Navigate to project root and deploy:**
   ```bash
   cd /path/to/AI-Automated-Pay-Per-Task-Agent-Network-APTAN-using-MNEE-DRAFT
   vercel
   ```

4. **Set environment variables:**
   ```bash
   vercel env add REACT_APP_CONTRACT_ADDRESS
   vercel env add REACT_APP_MNEE_ADDRESS
   vercel env add REACT_APP_API_URL
   ```

5. **Redeploy with environment variables:**
   ```bash
   vercel --prod
   ```

## Backend Deployment

The backend requires WebSocket support and long-running processes (cron jobs, blockchain sync), so it cannot be deployed as Vercel serverless functions. Deploy it separately using one of these options:

### Option 1: Railway (Recommended)

1. Go to [railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Add a new service and select the `backend` directory
5. Set environment variables in Railway dashboard
6. Deploy

### Option 2: Render

1. Go to [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables
6. Deploy

### Option 3: Heroku

1. Install Heroku CLI
2. Create a new app
3. Set buildpack to Node.js
4. Deploy:
   ```bash
   cd backend
   heroku create your-app-name
   git subtree push --prefix backend heroku main
   ```

### Backend Environment Variables

Set these in your backend hosting platform:

```env
# Contract Configuration
CONTRACT_ADDRESS=0x34F0f88b1E637640F1fB0B01dBDFd02F7a8B7B92
RPC_URL=https://rpc.sepolia.org
SYNC_FROM_BLOCK=9788210

# API Keys
OPENAI_API_KEY=your-openai-key
GROQ_API_KEY=your-groq-key

# Database (if using MongoDB)
MONGODB_URI=your-mongodb-uri
DB_NAME=aptan

# Frontend URL (for CORS)
FRONTEND_URL=https://your-vercel-app.vercel.app

# Agent Private Key (for automated task completion)
AGENT_PRIVATE_KEY=your-private-key
```

## Post-Deployment Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to separate hosting service
- [ ] Environment variables set in both frontend and backend
- [ ] `REACT_APP_API_URL` points to your backend URL
- [ ] Backend `FRONTEND_URL` points to your Vercel URL
- [ ] CORS configured correctly
- [ ] WebSocket connections working
- [ ] Test creating a task
- [ ] Test viewing tasks
- [ ] Test task completion flow

## Troubleshooting

### 404 Error After Deployment

If you see a "404: NOT_FOUND" error after deployment:

1. **Check Build Logs:**
   - Go to your Vercel project dashboard
   - Click on the deployment
   - Check the "Build Logs" tab to see if the build completed successfully
   - Look for any errors during `npm install` or `npm run build`

2. **Verify Configuration:**
   - Ensure **Root Directory** is set to `frontend` in Project Settings → General
   - Verify **Build Command** is `npm run build`
   - Verify **Output Directory** is `build`
   - Check that `frontend/vercel.json` exists (it should be there after the latest commit)

3. **Redeploy:**
   - If you made changes to `vercel.json`, push to GitHub and Vercel will auto-redeploy
   - Or manually trigger a redeploy from the Vercel dashboard

4. **Check File Structure:**
   - Ensure `frontend/build` directory is created after build
   - Verify `frontend/build/index.html` exists

5. **If Root Directory is NOT set to `frontend`:**
   - The root `vercel.json` will be used instead
   - Make sure the root `vercel.json` is properly configured
   - Or set Root Directory to `frontend` in Vercel settings

### Frontend can't connect to backend

- Check that `REACT_APP_API_URL` is set correctly in Vercel
- Verify backend is accessible and CORS is configured
- Check browser console for errors

### WebSocket connection fails

- Ensure backend supports WebSockets (Railway, Render, Heroku all do)
- Check that `FRONTEND_URL` in backend matches your Vercel URL
- Verify Socket.IO is properly configured

### Build fails on Vercel

- Ensure Root Directory is set to `frontend` in Vercel settings
- Check that all dependencies are in `frontend/package.json`
- Review build logs for specific errors
- Check Node.js version compatibility (Vercel uses Node 18.x by default)

## Custom Domain

To add a custom domain:

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Continuous Deployment

Vercel automatically deploys on every push to your main branch. To disable or configure:

1. Go to Project Settings → Git
2. Configure deployment settings as needed

## Support

For issues specific to:
- **Vercel:** Check [Vercel Documentation](https://vercel.com/docs)
- **Backend Deployment:** Refer to your hosting platform's documentation
- **Project Issues:** Check the main README.md

