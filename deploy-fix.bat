@echo off
echo ===================================
echo  Weaveflow Trigger Tasks Deployer
echo ===================================
echo.
echo Step 1: Installing @vercel/blob...
cd /d "d:\Personal Projects\weaveflow\packages\trigger-tasks"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo.
echo Step 2: Deploying to Trigger.dev production...
call npx trigger deploy --env-file .env
if %errorlevel% neq 0 (
    echo ERROR: Deploy failed!
    pause
    exit /b 1
)
echo.
echo Step 3: Installing @vercel/blob in web app...
cd /d "d:\Personal Projects\weaveflow\apps\web"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Web app npm install failed!
    pause
    exit /b 1
)
echo.
echo Step 4: Committing and pushing web app changes to Vercel...
cd /d "d:\Personal Projects\weaveflow"
git add apps/web/package.json apps/web/src/lib/transloadit.ts packages/trigger-tasks/package.json packages/trigger-tasks/src/index.ts
git commit -m "fix: replace Transloadit with Vercel Blob for reliable file uploads"
git push
echo.
echo ===================================
echo  ALL DONE! Deployment complete.
echo ===================================
pause
