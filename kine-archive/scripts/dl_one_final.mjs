#!/usr/bin/env node
/**
 * Focused downloader — one book at a time
 * Usage: node dl_one_final.mjs <md5> <outpath> [minMB]
 * Example: node dl_one_final.mjs 9d6b1b612a790bdee9a39690bf0ecee6 /path/to/out.pdf 5
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const PROXY = 'http://127.0.0.1:7897';
const BASE = 'https://libgen.li';

const [md5, outPath, minMBS] = process.argv.slice(2);
const minMB = parseFloat(minMBS || '3');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!md5 || !outPath) {
    console.log('usage: dl_one_final.mjs <md5> <outpath> [minMB]');
    process.exit(1);
  }

  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(outPath) && fs.statSync(outPath).size / 1024 / 1024 >= minMB) {
    console.log(`⏭️ EXISTS: ${(fs.statSync(outPath).size/1024/1024).toFixed(1)}MB`);
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true, args: [`--proxy-server=${PROXY}`] });
  const page = await browser.newPage();

  try {
    // Go to ads.php
    console.log(`📄 Fetching ads.php?md5=${md5}`);
    await page.goto(`${BASE}/ads.php?md5=${md5}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    const text = await page.evaluate(() => document.body?.innerText || '');
    if (text.includes('File not found')) {
      console.log('❌ File not found on server');
      await browser.close();
      process.exit(1);
    }

    // Set up download listener BEFORE clicking
    const dlPromise = new Promise(resolve => {
      page.on('download', d => resolve(d));
      setTimeout(() => resolve(null), 600000); // 10 min timeout
    });

    // Click GET link
    const clicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      for (const a of links) {
        if (a.innerText.trim().toUpperCase() === 'GET' && a.getAttribute('href')?.includes('get.php')) {
          a.click();
          return true;
        }
      }
      return false;
    });

    if (!clicked) {
      console.log('❌ Could not find GET link');
      await browser.close();
      process.exit(1);
    }
    console.log('🖱️ GET clicked, waiting for download...');

    const download = await dlPromise;
    if (!download) {
      console.log('⏰ Download timeout (10 min)');
      await browser.close();
      process.exit(1);
    }

    console.log(`📥 ${download.suggestedFilename()}`);
    const tmpPath = outPath + '.tmp';
    await download.saveAs(tmpPath);

    const buf = fs.readFileSync(tmpPath);
    const mb = buf.length / 1024 / 1024;
    const isPDF = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
    console.log(`  Size: ${mb.toFixed(1)}MB | Valid: ${isPDF}`);

    if (isPDF && mb >= minMB) {
      fs.renameSync(tmpPath, outPath);
      console.log(`✅ SAVED: ${(fs.statSync(outPath).size/1024/1024).toFixed(1)}MB`);
      await browser.close();
      process.exit(0);
    } else {
      console.log(`⚠️ ${isPDF ? 'Too small' : 'Invalid PDF'}`);
      try { fs.unlinkSync(tmpPath); } catch(e) {}
      await browser.close();
      process.exit(1);
    }
  } catch(e) {
    console.error(`❌ Error: ${e.message}`);
    await browser.close();
    process.exit(1);
  }
}

main();
