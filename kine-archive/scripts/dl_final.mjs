#!/usr/bin/env node
/**
 * Final downloader — handles the "Download is starting" event properly
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const PROXY = 'http://127.0.0.1:7897';
const TEXTBOOKS = '/Users/arniu/.openclaw/workspace/kine-archive';
const BASE = 'https://libgen.li';

const [query, outName, minMBS] = process.argv.slice(2);
const minMB = parseFloat(minMBS || '3');
const outPath = path.join(TEXTBOOKS, 'tier1b', outName);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!query || !outName) { console.log('usage: dl_final.mjs "query" "out.pdf" [minMB]'); process.exit(1); }
  if (fs.existsSync(outPath) && fs.statSync(outPath).size / 1024 / 1024 >= minMB) {
    console.log(`SKIP: ${(fs.statSync(outPath).size/1024/1024).toFixed(1)}MB`);
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: false, args: [`--proxy-server=${PROXY}`] });
  const page = await browser.newPage();

  // Search
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  await page.fill('input[name="req"]', query);
  await page.press('input[name="req"]', 'Enter');
  await sleep(5000);

  const entries = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr')).filter(tr => {
      const tds = tr.querySelectorAll('td');
      return tds.length === 9 && (tds[7]?.innerText||'').trim().toLowerCase() === 'pdf';
    }).map(tr => {
      const tds = tr.querySelectorAll('td');
      const links = Array.from(tds[8]?.querySelectorAll('a') || []).map(a => a.getAttribute('href') || '');
      let md5 = '';
      for (const h of links) { const m = h.match(/md5=([a-f0-9]{32})/); if (m) md5 = m[1]; }
      return { title: tds[0]?.innerText?.trim(), author: tds[1]?.innerText?.trim(), year: tds[3]?.innerText?.trim(), size: tds[6]?.innerText?.trim(), md5 };
    });
  });
  
  if (entries.length === 0) { console.log('NO RESULTS'); await browser.close(); process.exit(1); }
  console.log(`FOUND ${entries.length}`);
  entries.forEach(e => console.log(`  ${e.author} | ${e.year} | ${e.size}`));

  for (const entry of entries) {
    if (!entry.md5) continue;
    console.log(`\n🎯 ${entry.title?.substring(0,40)} (${entry.md5})`);

    // Go to ads.php
    await page.goto(`${BASE}/ads.php?md5=${entry.md5}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    const text = await page.evaluate(() => document.body?.innerText || '');
    if (text.includes('File not found')) { console.log('  FILE NOT FOUND'); continue; }

    // Set download listener BEFORE clicking GET
    const dlPromise = new Promise(resolve => {
      page.on('download', d => resolve(d));
      setTimeout(() => resolve(null), 300000);
    });

    // Find and click the GET link
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

    if (!clicked) { console.log('  Could not find GET link'); continue; }
    console.log('  ✅ GET link clicked, waiting for download (5min)...');

    const download = await dlPromise;
    if (download) {
      console.log(`  📥 Download started: ${download.suggestedFilename()}`);
      const tmpPath = outPath + '.tmp';
      await download.saveAs(tmpPath);
      const buf = fs.readFileSync(tmpPath);
      const mb = buf.length / 1024 / 1024;
      const isPDF = buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
      console.log(`  Size: ${mb.toFixed(1)}MB | Valid: ${isPDF}`);
      
      if (isPDF && mb >= minMB) {
        fs.renameSync(tmpPath, outPath);
        console.log(`✅ SAVED: ${mb.toFixed(1)}MB`);
        await browser.close();
        process.exit(0);
      }
      console.log(`  ⚠️ ${isPDF ? 'Too small' : 'Invalid PDF'}`);
      try { fs.unlinkSync(tmpPath); } catch(e) {}
    } else {
      console.log('  ⏰ Download timeout');
    }
  }

  console.log('❌ FAILED');
  await browser.close();
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
