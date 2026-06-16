# 运动科学·典藏库（kine-archive）

运动科学领域经典教材的电子版典藏库。

**23 本 PDF | 808 MB | 文字版 ✅ 全部可搜索**

---

## 📖 教材清单

详见 [`INVENTORY.md`](INVENTORY.md)。

## ⚙️ 下载工具

需要代理环境 `127.0.0.1:7897`（Proxifier / Clash）。

### 单本下载
```bash
node scripts/dl_one_final.mjs <md5> <输出路径> [最小MB]
# 示例
node scripts/dl_one_final.mjs aad9b8e7c02a03cc0f9da514a273c77c tier1b/out.pdf 10
```

### 批量搜索+下载
```bash
node scripts/dl_final.mjs "<搜索词>" "<文件名>" [最小MB]
# 示例
node scripts/dl_final.mjs "Peterson Sports Injuries 5th" Peterson_5th.pdf 5
```

### 批量下载（按预设清单）
```bash
node scripts/libgen_v5.mjs
```

## 📁 目录结构

```
kine-archive/
├── INVENTORY.md          # 教材清单（含版本标记、页数）
├── README.md             # 本文件
├── scripts/
│   ├── libgen_v5.mjs     # 批量下载（按预设清单）
│   ├── dl_final.mjs      # 通用搜索+下载
│   └── dl_one_final.mjs  # 按 MD5 下载单本
├── tier1a/               # S/A 级 — 4本
├── tier1b/               # A/B 级 — 17本
└── tier1c/               # C/D 级 — 2本
```

## 🔍 版本说明

- ✅ = 完整版本，文字可搜索
- ⚠️ = 版本不完全满足（已有版次低于目标版次）
- 部分教材因版权保护期未过，LibGen 上暂无最新版

## 📋 待补

| 教材 | 优先级 | 原因 |
|:-----|:------:|:-----|
| 王瑞元 运动生理学 第6版 | P1 | 中文教材，无电子版流通 |
| 田麦久 运动训练学 (2025) | P1 | 2025年6月新出版 |
| Peterson Sports Injuries 5th | P2 | 已有 4th |
| NASM Corrective Exercise 2nd | P2 | LibGen 只有 1st |
| Hamill Biomechanics 5th | P3 | 已有 4th (2015)，差异小 |
| Ward Sports Therapy 2nd (2024) | P3 | 新书，保护期内 |

## ⚠️ 版权声明

本库教材仅供个人学习和研究使用，请尊重版权。
