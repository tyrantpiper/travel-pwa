---
description: Automated performance profiling with Lighthouse and bundle analysis
triggers:
  - "效能"
  - "performance"
  - "lighthouse"
  - "bundle size"
  - "慢"
  - "slow"
---

# Performance Profiler Workflow

> **Purpose**: Proactive performance monitoring for PWA optimization.

## Step 1: Bundle Size Analysis
// turbo
Run `npm run build` and check output size.

**Parse Output:**
- Total bundle size (JS, CSS)
- Largest chunks (top 5)
- Compare against baseline (if exists)

## Step 2: Lighthouse Audit (Dev Mode)
// turbo
Run: `npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless" --only-categories=performance`

**Key Metrics:**
- Performance Score
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)

## Step 3: Stability Check
Run Lighthouse 3 times and average results to reduce false signals.

## Step 4: Generate Performance Report
Create artifact: `perf_report_{date}.md`

**Report Sections:**
1. **Executive Summary**: Pass/Fail based on thresholds
   - Performance Score >= 90: ✅ Pass
   - Performance Score 70-89: 🟡 Needs Attention
   - Performance Score < 70: 🔴 Critical
2. **Core Web Vitals Table**
3. **Bundle Analysis**: Top 5 largest chunks
4. **Recommendations**: Specific optimization suggestions

## Step 5: Compare with Baseline
If previous report exists:
- Calculate delta for each metric
- Highlight regressions (>5% decrease)
- Celebrate improvements

## ⚠️ Critical Rules
- Run on **production build** for accurate results
- **DO NOT** auto-apply optimizations
- Report only; human decides action

## [NEURAL] Neural Linkage
8. **Trigger Optimization**:
   - If Performance < 70: Suggest triggering `/ui-optimize` workflow.
   - Execute: `python backend/scripts/telemetry.py --source "Perf Profiler" --message "Perf score: {Score}" --level "INFO"`

## Thresholds
| Metric | Good | Needs Work | Poor |
|:---|:---:|:---:|:---:|
| Performance | ≥90 | 70-89 | <70 |
| FCP | <1.8s | 1.8-3s | >3s |
| LCP | <2.5s | 2.5-4s | >4s |
| CLS | <0.1 | 0.1-0.25 | >0.25 |
