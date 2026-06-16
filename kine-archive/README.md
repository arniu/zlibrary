# 运动科学典藏库（kine-archive）

运动科学领域经典教材的电子版典藏库。

**23 本 PDF | 808 MB | 全部可搜索**

---

## 教材清单

详见 [`INVENTORY.md`](INVENTORY.md)。

## 目录结构

```
kine-archive/
├── INVENTORY.md       # 教材清单（含版本标记、页数、验证状态）
├── README.md          # 本文件
├── scripts/           # 下载工具（需 Proxifier 127.0.0.1:7897）
│   ├── libgen_v5.mjs      # 批量下载（按预设清单）
│   ├── dl_final.mjs       # 通用搜索+下载
│   └── dl_one_final.mjs   # 按 MD5 下载单本
├── tier1a/            # S/A 级 — 4 本，270 MB
├── tier1b/            # A/B 级 — 17 本，525 MB
└── tier1c/            # C/D 级 — 2 本，12 MB
```

## 版本标记

| 标记 | 含义 |
|:----:|:------|
| ✅ | 版本完整，文字可搜索 |
| ⚠️ | 已有版次低于目标版次（内容差异较小） |

## 待补教材

| 教材 | 优先级 | 原因 |
|:-----|:------:|:-----|
| 王瑞元 运动生理学 第6版 | P1 | 中文教材，无电子版流通 |
| 田麦久 运动训练学 (2025) | P1 | 2025年6月新出版 |
| Peterson Sports Injuries 5th | P2 | 已有 4th |
| NASM Corrective Exercise 2nd | P2 | LibGen 只有 1st |
| Hamill Biomechanics 5th | P3 | 已有 4th，差异小 |
| Ward Sports Therapy 2nd (2024) | P3 | 新书，保护期内 |
