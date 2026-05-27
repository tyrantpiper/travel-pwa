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

> **Purpose**: Systematic performance monitoring using the community-standard
> **Baseline → Identify → Fix → Validate** loop for PWA optimization.

## Step 1: Bundle Size Analysis
// turbo
Run `npm run build` and check output size.

**Parse Output:**
- Total bundle size (JS, CSS)
- Largest chunks (top 5)
- Compare against baseline (if exists)

## Step 2: Lighthouse Audit (Core Web Vitals)
// turbo
Run: `npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless" --only-categories=performance`

**Key Metrics (2026 Standard):**
- Performance Score
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- **Interaction to Next Paint (INP)** — replaces TTI as the primary responsiveness metric

## Step 3: Stability Check
Run Lighthouse 3 times and average results to reduce false signals.

## Step 4: Memory Profiling
Check for common memory leak patterns:
- Search for event listeners without cleanup:
  ```grep
  Pattern: addEventListener\(
  Cross-reference: removeEventListener\(
  ```
- Search for uncleaned subscriptions:
  ```grep
  Pattern: \.subscribe\(|supabase\.channel\(
  Cross-reference: \.unsubscribe\(|\.removeChannel\(
  ```
- Flag any `setInterval` without corresponding `clearInterval`

## Step 5: Identify Bottlenecks

Classify findings into actionable categories:

| Category | Diagnostic Tool | Common Bottlenecks | Optimization |
|:---------|:----------------|:-------------------|:-------------|
| **Page Load** | Lighthouse, Bundle Analyzer | Large 3rd-party scripts, render-blocking | Code-split, tree-shake, lazy-load |
| **Memory** | Event listener audit | Detached DOM, retained refs | Cleanup in useEffect returns |
| **Responsiveness** | INP measurement | Long CPU tasks (>50ms) | Batch DOM writes, offload heavy calc |
| **Database** | Slow query patterns | N+1 queries, missing indexes | Batch queries, add indexes |

## Step 6: Generate Performance Report
Create artifact: `perf_report_{date}.md`

**Report Sections:**
1. **Executive Summary**: Pass/Fail based on thresholds
   - Performance Score >= 90: ✅ Pass
   - Performance Score 70-89: 🟡 Needs Attention
   - Performance Score < 70: 🔴 Critical
2. **Core Web Vitals Table** (with INP)
3. **Bundle Analysis**: Top 5 largest chunks
4. **Memory Health**: Leak risk assessment
5. **Bottleneck Classification**: Categorized findings table
6. **Recommendations**: Specific optimization suggestions with expected impact

## Step 7: Compare with Baseline (Delta Tracking)
If previous report exists:
- Calculate delta for each metric
- Highlight regressions (>5% decrease)
- Celebrate improvements
- Track trend over last 3 reports (if available)

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
| **INP** | <200ms | 200-500ms | >500ms |
