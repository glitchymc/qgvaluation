# Valuation Intelligence

M&A and equity raise valuation tool powered by Claude AI. Runs comparable company analysis, DCF, and precedent transaction analysis from uploaded financial statements.

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub
- Create a new repo at github.com
- Upload this entire folder, or run:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Deploy on Vercel
- Go to vercel.com and sign in (free account works)
- Click "Add New Project"
- Import your GitHub repo
- Vercel auto-detects Vite — no config needed
- Before clicking Deploy, go to **Environment Variables** and add:
  - Key: `ANTHROPIC_API_KEY`
  - Value: your key from console.anthropic.com
- Click Deploy

### 3. Share the link
Vercel gives you a URL like `your-project.vercel.app` — send that to your client.

## Get an Anthropic API Key
1. Go to console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Each analysis costs roughly $0.01–0.03

## Local Development
```bash
npm install
# Create .env file with: ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```
