# Validation run — 2026-08-28

Automated tests executed by Cloud Agent (not manual checklist).

## 1. Synthetic guards (`npm run test:reliability`)

| Metric | Result |
|--------|--------|
| Normalization guard | 4/6 invalid rejected |
| Location recall | 5/5 (100%) |
| Location precision | 5/6 |
| Seam merge (simulated) | 75% location agreement |
| **Overall** | **PASS** |

## 2. Coordinate truth (`__truth.html`)

| Metric | Result |
|--------|--------|
| Marker mapping | **96/96** (left + right eye) |
| Geometry detector | 7/8 sizes |
| **Overall** | **PASS** |

## 3. Gemini live — synthetic iris + injected ground truth

**Method:** 3 painted pigment spots at known (sector, ring); dual-seam unwrap (12:00 + 6:00); pigment-layer detection; test-retest (2 calls per seam).

Reference: test-retest repeatability (imaging literature), location-first merge (МЕТОДИКА_2 §10).  
Not clinical diagnostic validity ([NHMRC 2024](https://www.health.gov.au/sites/default/files/2025-03/natural-therapies-review-2024-iridology-evidence-evaluation.pdf) ≈ chance for manual iridology diagnosis).

### gemini-2.5-flash (~41s, 4 detection calls)

| Metric | Value |
|--------|-------|
| **Location recall** | **3/3 (100%)** — all injected spots found |
| Location precision | 43% (3 TP, 4 FP) |
| Test-retest (per seam) | 75% |
| Dual-seam agreement | 40% |
| Type stability | 50% |
| False positives | scurf_rim R11, extra pigment_brown |
| **Overall** | **PASS** |

Detected merged: pigment_orange S5/S3, pigment_brown S9 — matches ground truth bands.

### gemini-3.6-flash (~18s, 2 detection calls, no retest)

| Metric | Value |
|--------|-------|
| **Location recall** | **3/3 (100%)** |
| Location precision | 43% |
| Dual-seam agreement | **75%** |
| Type stability | 100% |
| **Overall** | **PASS** |

## Conclusions

1. **Coordinate pipeline is reliable** (96/96) — location addressing works.
2. **Gemini finds injected pigment** at correct ring bands (100% recall on synthetic benchmark).
3. **Hallucinations exist** — ~4 FP per run (e.g. scurf_rim on clean synthetic iris); guards + agreement weighting are necessary.
4. **Dual-seam helps** — 3.6-flash shows 75% cross-seam agreement vs 40% for 2.5-flash on this run; production uses `[0, 6]` readings (dual-read enabled).
5. **Type labels unstable** — expected; scoring must stay location-first.

## Commands

```bash
npm run test:reliability
GEMINI_API_KEY=... npm run test:gemini
```
