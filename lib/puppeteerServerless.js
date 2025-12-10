// lib/puppeteerServerless.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

async function getBrowser() {
  // chrome-aws-lambda provides an executablePath for the environment;
  // on local dev it falls back to locally installed chrome if possible.
  const options = {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true
  };

  const browser = await puppeteer.launch(options);
  return browser;
}

module.exports = { getBrowser };
