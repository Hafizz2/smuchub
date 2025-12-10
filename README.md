# University Portal - Enhanced UI

A beautiful web application that scrapes data from your university website and displays it in a modern, organized interface with local storage support.

**Optimized for St. Mary's University College (SMUC) - http://moodle.smuc.edu.et/students/SMUC.php**

## Features

- 🔐 **Secure Login**: Authenticate with your SMUC credentials (Login Id and Password)
- 📊 **Grade Summary**: View your academic grades in a clean table format
- ⚠️ **Course Deficiency**: Track missing or incomplete courses
- 💾 **Local Storage**: All data is stored locally in your browser
- 📤 **Export/Import**: Export your data as JSON or import previously saved data
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- 🔄 **Auto-refresh**: Refresh data with a single click
- 🎯 **SMUC Optimized**: Customized selectors for SMUC's PHP-based system

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Login**: 
   - The SMUC URL is pre-filled: `http://moodle.smuc.edu.et/students/SMUC.php`
   - Enter your **Login Id** (username) and **Password**
   - Click Login to authenticate

2. **Navigate**: Use the tabs to switch between different sections:
   - **Grade Summary**: View your academic grades
   - **Course Deficiency**: Check for missing courses
   - **Settings**: Manage data and configure URLs

3. **Refresh Data**: Click the refresh button (🔄) in each tab to fetch latest data
   - For best results, navigate to the specific pages (grades/deficiency) in your browser first
   - Copy the URLs and paste them in the Settings tab
   - Then click refresh to scrape the data

4. **Export/Import**: Use the Settings tab to export or import your data

## Configuration

### SMUC-Specific Setup

The scraper is optimized for SMUC's table-based PHP system. The login form uses intelligent field detection that works with the "Login Id:" and "Password:" labels.

### Setting Custom URLs (Recommended)

For best results with SMUC:

1. **After logging in**, manually navigate to:
   - Your **Grade Summary/Transcript** page
   - Your **Course Deficiency** page (if available)

2. **Copy the URLs** from your browser address bar

3. **Go to Settings tab** and paste the URLs:
   - Grades Page URL
   - Deficiency Page URL

4. **Click "Save URLs"** and then use the refresh buttons to fetch data

This ensures the scraper goes directly to the correct pages with your data.

### Troubleshooting SMUC Login

If login fails:
- Make sure you're using your correct **Login Id** (not email)
- Check that the password is correct
- The system will save a screenshot as `login-debug.png` if it can't find the form fields
- Try logging in manually in a browser first to verify your credentials work

## Technical Details

- **Backend**: Node.js with Express
- **Scraping**: Puppeteer (headless browser automation)
- **Frontend**: Vanilla JavaScript with modern CSS
- **Storage**: Browser Local Storage API

## Security Notes

- Credentials are sent to the backend but not stored permanently
- Sessions are managed in memory (consider using proper session management for production)
- All scraping happens server-side for security

## Troubleshooting

### Login Fails
- Check that the university URL is correct
- Verify your username and password
- The website structure might be different - you may need to customize selectors

### No Data Retrieved
- Click the refresh button after logging in
- Check browser console for errors
- Verify that the URLs in Settings are correct
- You may need to adjust the scraping selectors in `server.js`

## License

ISC

