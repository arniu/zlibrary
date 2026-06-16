#!/usr/bin/env node
/**
 * LibGen v5 — Robust single-page downloader
 * 
 * Uses one page for all books. Better error handling.
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const PROXY = 'http://127.0.0.1:7897';
const TEXTBOOKS = '/Users/arniu/.openclaw/workspace/kine-archive';
const BASE = 'https://libgen.li';

const BOOKS = [
  { name: 'Schoenfeld Muscle Hypertrophy 2nd',     q: 'Science and Development of Muscle Hypertrophy Schoenfeld',     edition: '2nd', year: 2021, out: 'tier1b/Schoenfeld_Muscle_Hypertrophy_2nd.pdf', minMB: 3 },
  { name: 'Wilmore Costill Physiology 9th',         q: 'Physiology of Sport and Exercise Wilmore',                      edition: '9th', year: 2023, out: 'tier1b/Wilmore_Costill_Physiology_Sport_Exercise_9th.pdf', minMB: 3 },
  { name: 'Baechle Earle Essentials 3rd',           q: 'Essentials of Strength Training and Conditioning Baechle',       edition: '3rd', year: 2008, out: 'tier1b/Baechle_Earle_Essentials_Strength_Training_3rd.pdf', minMB: 3 },
  { name: 'Haff Triplett Essentials 4th',           q: 'Haff Triplett Essentials Strength Training Conditioning',        edition: '4th', year: 2015, out: 'tier1b/Haff_Triplett_Essentials_Strength_Training_4th.pdf', minMB: 3 },
  { name: 'Haff Triplett Essentials 4th (alt2)',    q: 'NSCA Essentials of Strength Training and Conditioning 4th',      edition: '4th', year: 2015, out: 'tier1b/Haff_Triplett_Essentials_Strength_Training_4th.pdf', skipIfExists: true },
  { name: 'Flanagan Biomechanics 1st',              q: 'Flanagan Sport Exercise Biomechanics',                           edition: '1st', year: 2019, out: 'tier1b/Flanagan_Sport_Exercise_Biomechanics_1st.pdf', minMB: 3 },
  { name: 'McGinnis Biomechanics 4th',              q: 'McGinnis Biomechanics of Sport and Exercise',                   edition: '4th', year: 2020, out: 'tier1b/McGinnis_Biomechanics_Sport_Exercise_4th.pdf', minMB: 3 },
  { name: 'Prentice Rehabilitation 7th',            q: 'Prentice Rehabilitation Techniques Sports Medicine',             edition: '7th', year: 2020, out: 'tier1b/Prentice_Rehabilitation_7th.pdf', minMB: 50 },
  { name: 'Bompa Periodization 6th',                q: 'Bompa Periodization Theory Methodology Training',                edition: '6th', year: 2019, out: 'tier1b/Bompa_Periodization_6th.pdf', minMB: 3 },
  { name: 'Bompa Periodization (alt2)',             q: 'Periodization Theory and Methodology of Training',               edition: '6th', year: 2019, out: 'tier1b/Bompa_Periodization_6th.pdf', skipIfExists: true },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isDownloaded(outPath, minMB) {
  if (!fs.existsSync(outPath)) return false;
  return fs.statSync(outPath).size / 1024 / 1024 >= minMB;
}

function isValidPdf(outPath) {
  try {
    const buf = fs.readFileSync(outPath);
    if (buf.length < 100) return false;
    if (buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) return false;
    return buf.toString('utf-8', Math.max(0, buf.length - 100)).includes('%%EOF');
  } catch(e) { return false; }
}

async function search(page, query) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  
  // Wait for search input
  await page.waitForSelector('input[name="req"]', { timeout: 10000 });
  await page.fill('input[name="req"]', query);
  await sleep(500);
  await page.press('input[name="req"]', 'Enter');
  await sleep(5000);
  
  return await page.evaluate(() => {
    const data = [];
    document.querySelectorAll('tr').forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length !== 9) return;
      const ext = (tds[7]?.innerText || '').trim().toLowerCase();
      if (ext !== 'pdf') return;
      data.push({
        title: (tds[0]?.innerText || '').trim(),
        author: (tds[1]?.innerText || '').trim(),
        year: (tds[3]?.innerText || '').trim(),
        size: (tds[6]?.innerText || '').trim(),
        links: Array.from(tds[8]?.querySelectorAll('a') || []).map(a => a.getAttribute('href') || ''),
      });
    });
    // Extract md5 from links
    return data.map(d => {
      let md5 = '';
      for (const href of d.links) {
        const m = href.match(/md5=([a-f0-9]{32})/);
        if (m) { md5 = m[1]; break; }
      }
      return { ...d, md5 };
    });
  });
}

function score(book, r) {
  let s = 0;
  const t = r.title.toLowerCase();
  const a = r.author.toLowerCase();
  const bn = book.name.toLowerCase();
  
  // Author matching
  const lookup = {
    'schoenfeld': ['schoenfeld'],
    'wilmore': ['wilmore', 'costill'],
    'baechle': ['baechle', 'earle'],
    'haff': ['haff', 'triplett', 'nsca'],
    'flanagan': ['flanagan'],
    'mcinnis': ['mcinnis'],
    'prentice': ['prentice'],
    'bompa': ['bompa'],
  };
  for (const [key, aliases] of Object.entries(lookup)) {
    if (bn.includes(key) && aliases.some(al => a.includes(al))) {
      s += 120;
      if (a.startsWith(aliases[0]+',')) s += 30;
      break;
    }
  }
  
  // Edition
  const eds = { '2nd': /2nd|second|2e/i, '6th': /6th|sixth|6e/i, '7th': /7th|seventh|7e/i,
                 '3rd': /3rd|third|3e/i, '4th': /4th|fourth|4e/i, '9th': /9th|ninth|9e/i, '1st': /1st|first|1e/i };
  if (book.edition && eds[book.edition]) {
    if (eds[book.edition].test(t)) s += 100;
    for (const [ed, p] of Object.entries(eds)) {
      if (ed !== book.edition && p.test(t)) s -= 80;
    }
  }
  
  // Year
  const y = parseInt(r.year) || 0;
  if (book.year && y > 0) {
    const d = Math.abs(y - book.year);
    if (d === 0) s += 100;
    else if (d <= 1) s += 50;
    else if (d <= 3) s += 20;
    else if (d <= 5) s += 5;
    else s -= 30;
  }
  
  // Size
  const sz = parseFloat(r.size) || 0;
  if (sz > 30) s += 20;
  else if (sz > 10) s += 15;
  else if (sz > 5) s += 5;
  else if (sz < 2) s -= 20;
  
  return s;
}

async function tryDownload(page, md5, outPath, minMB) {
  // Method 1: GET.php
  try {
    const resp = await page.goto(`${BASE}/get.php?md5=${md5}`, { waitUntil: 'load', timeout: 45000 });
    if (resp) {
      const buf = await resp.body();
      if (buf.length > 200 * 1024) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, buf);
        const mb = buf.length / 1024 / 1024;
        if (isValidPdf(outPath) && mb >= minMB) { console.log(`    ✅ GET.php: ${mb.toFixed(1)}MB`); return true; }
        try { fs.unlinkSync(outPath); } catch(e) {}
      }
    }
  } catch(e) { /* next */ }
  
  // Method 2: ads.php
  try {
    await page.goto(`${BASE}/ads.php?md5=${md5}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    
    // Click all GETs  
    for (let i = 0; i < 5; i++) {
      const btns = await page.locator('a:has-text("GET")').all();
      if (btns.length === 0) break;
      try { await btns[0].click({ timeout: 5000 }); } catch(e) {}
      await sleep(2000);
    }
    
    const dlPromise = new Promise(resolve => {
      page.on('download', d => resolve(d));
      setTimeout(() => resolve(null), 180000);
    });
    
    const dl = await dlPromise;
    if (dl) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      await dl.saveAs(outPath);
      const mb = fs.statSync(outPath).size / 1024 / 1024;
      if (isValidPdf(outPath) && mb >= minMB) { console.log(`    ✅ ads.php: ${mb.toFixed(1)}MB`); return true; }
      try { fs.unlinkSync(outPath); } catch(e) {}
      console.log(`    ⚠️ ads.php got ${mb.toFixed(1)}MB but ${!isValidPdf(outPath) ? 'invalid PDF' : 'too small'}`);
    } else {
      console.log('    ⚠️ ads.php: no download triggered');
    }
  } catch(e) { console.log(`    ⚠️ ads.php: ${e.message?.substring(0, 40)}`); }
  
  return false;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('📚 LibGen v5 — Single-page Downloader');
  console.log(`    ${BOOKS.length} targets`);
  console.log('═══════════════════════════════════════════\n');
  
  const browser = await chromium.launch({ 
    headless: false, 
    args: [`--proxy-server=${PROXY}`] 
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  
  const results = [];
  
  for (const book of BOOKS) {
    const outPath = path.join(TEXTBOOKS, book.out);
    
    // Check if already done
    if (book.skipIfExists && isDownloaded(outPath, book.minMB)) continue;
    if (isDownloaded(outPath, book.minMB)) {
      const mb = fs.statSync(outPath).size / 1024 / 1024;
      console.log(`── 📘 ${book.name} ── ✅ ${mb.toFixed(1)}MB exists`);
      results.push({ name: book.name, status: 'skipped', msg: `${mb.toFixed(1)}MB` });
      continue;
    }
    
    const existingMB = fs.existsSync(outPath) ? fs.statSync(outPath).size / 1024 / 1024 : 0;
    console.log(`\n── 📘 ${book.name} ──${existingMB > 0 ? ` (${existingMB.toFixed(1)}MB existing)` : ''}`);
    
    try {
      console.log(`  🔍 "${book.q}"`);
      const rows = await search(page, book.q);
      
      if (rows.length === 0) {
        console.log('  📋 No results');
        results.push({ name: book.name, status: 'not_found', msg: '' });
        continue;
      }
      
      const scored = rows.map(r => ({ ...r, score: score(book, r) })).sort((a, b) => b.score - a.score);
      
      console.log(`  📋 ${rows.length} results`);
      scored.slice(0, 5).forEach(r =>
        console.log(`    [${r.score}pts] ${r.year} ${r.size} | ${r.author?.substring(0, 25)} | ${r.title?.substring(0, 45)}`)
      );
      
      let downloaded = false;
      for (const c of scored) {
        if (c.score < 10 || !c.md5) continue;
        console.log(`  🎯 ${c.title?.substring(0, 45)} (${c.year}, ${c.size})`);
        downloaded = await tryDownload(page, c.md5, outPath, book.minMB);
        if (downloaded) break;
        await sleep(1000);
      }
      
      if (downloaded) {
        const mb = fs.statSync(outPath).size / 1024 / 1024;
        results.push({ name: book.name, status: 'success', msg: `${mb.toFixed(1)}MB` });
      } else {
        const bestInfo = scored[0] ? `${scored[0].title} (${scored[0].year}, ${scored[0].score}pts)` : '';
        results.push({ name: book.name, status: 'failed', msg: bestInfo });
        console.log(`  ❌ Failed`);
      }
    } catch(e) {
      console.log(`  ❌ Error: ${e.message?.substring(0, 60)}`);
      results.push({ name: book.name, status: 'error', msg: e.message?.substring(0, 60) });
    }
    
    await sleep(2000);
  }
  
  // Summary
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📊 FINAL RESULTS');
  console.log('═══════════════════════════════════════════');
  let s=0, f=0, sk=0, nf=0;
  for (const r of results) {
    const icon = r.status==='success'?'✅' : r.status==='skipped'?'⏭️' : r.status==='not_found'?'🔍':'❌';
    console.log(`  ${icon} ${r.name}: ${r.msg || r.status}`);
    if (r.status==='success') s++;
    else if (r.status==='skipped') sk++;
    else if (r.status==='not_found') nf++;
    else f++;
  }
  console.log(`\n✅ ${s} | ⏭️ ${sk} | 🔍 ${nf} | ❌ ${f}`);
  
  // Don't close browser so user can inspect
  console.log('\nBrowser left open for inspection. Close manually.');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
