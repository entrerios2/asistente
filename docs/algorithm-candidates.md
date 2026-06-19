# Algorithm Candidates — Sound Systems: Design and Optimization

*Beyond Chapter 14 (Mic Placement). Extracted from Bob McCarthy, 3rd Ed.*

---

## 1. Summation Engine (Ch. 4) — Core mathematical model

**Lines** 3131–4242  
**Complexity**: High  
**Type**: Mathematical model + decision tree

The entire summation model is a deterministic engine:

- **Summation formula**: `20 × log10((A + B) / A)` for phase-matched sources
- **Log↔linear conversion table** (lines 3202–3215): 0 dB = 1.0, −1 dB = 0.89, …, −10 dB = 0.32, …
- **Summation zones** defined by (level offset, phase offset) pairs:
  - Coupling zone: phase offset < ±120°, level offset < 10 dB → all gain
  - Cancellation zone: phase offset ≈ 180° ± 30°, matched levels → all loss
  - Combing zone: level offset < 4 dB, phase offset cycles through full range → ripple > 12 dB
  - Transition zone: 4–10 dB level offset, full phase cycles → ripple 6–12 dB
  - Isolation zone: level offset > 10 dB → ripple < 6 dB
- **Phase offset calculation**: `phase = 360 × time_offset × frequency` → convert time offset to phase at any frequency
- **120° tipping point**: addition assured when phase < 120°, subtraction begins beyond
- **7-step spectral progression**: isolation(A) → transition → combing → coupling → combing → transition → isolation(B)
- **Time offset → combing pattern**: peak⁰ (coupling), dip¹, peak¹, dip², … with known frequency spacing

**Algorithm outputs**: Given level offset, time offset, frequency → predict summation zone, gain/loss, response shape.

---

## 2. Coupled Line Source — Coupling Frequency Limit (Ch. 4)

**Line** 3997  
**Type**: Formula

```
F_LIM = 0.33 × T
```
Where `T` = displacement in ms. Above this frequency, phase offset exceeds 120° and combing begins.

**Example**: 3 ms displacement (≈1 m) → F_LIM = 110 Hz

---

## 3. Max Comb-Free Coverage Angle (Ch. 4)

**Line** 3998  
**Type**: Formula

```
Max coverage angle = 60° / λ_displacement
```
Where `λ_displacement` = source displacement in wavelengths.

**Example**: 4 λ apart → max 15° coverage before combing is audible.

---

## 4. Pyramid Height for Coupled Line Source (Ch. 4)

**Lines** 3976–3978  
**Type**: Formula

```
Pyramid height = step_height × (element_count − 1)
```
Where `step_height` = distance to first 2-way crossover (function of coverage angle and displacement).

---

## 5. Coupled Array — Angular Halving (Ch. 9)

**Lines** 5808–5810  
**Type**: Rule

Quantity doubling in a coupled line source → coverage angle halves. Proportional above 1 λ frequency.

```
Coverage(2×N) = Coverage(N) / 2
```

---

## 6. Uncoupled Line Source — Unity/Limit Line Depth (Ch. 4, Ch. 9)

**Line** 4068  
**Type**: Rule

```
Limit_line_depth = 2 × Unity_line_depth
```
Beyond the limit line, three+ arrivals create dominant combing. Uniform coverage exists only between unity and limit lines.

---

## 7. System Subdivision Threshold (Ch. 11)

**Lines** 6523–6527  
**Type**: Decision threshold

Subdivision warranted when range ratio > 1.4:1 (3 dB). Hierarchy:
- AAA: symmetric, matched — no subdivision
- AAB: minor asymmetry — 2 channels
- ABC: full asymmetry — 3+ channels

---

## 8. Speaker Classification (Ch. 2.7)

**Lines** 1905–1931  
**Type**: Decision tree

```
Beamwidth shape?
├── Plateau (flat) → First-order (>60°) / Second-order (20°–60°)
│   ├── First-order: widest, longest plateau, best for uncoupled arrays & solo
│   └── Second-order: medium, needs large horn for long plateau, coupled PS
└── Proportional (narrowing with freq) → Third-order (<20° HF min)
    └── Line array building blocks, ever-narrowing, no nominal angle
```

Application mapping:
- First-order → solo speakers, uncoupled arrays, fills
- Second-order → coupled point source, specialty fills
- Third-order → coupled line source (modern line arrays)

---

## 9. End-Fire Subwoofer Array (Ch. 10, Proc 14.19–14.20)

**Lines** 6359–6383, 10499–10526  
**Type**: Geometric + timing algorithm

**Parameters**: N elements, spacing d (≈1 m)
**Delay per element**: `delay(i) = (N − i) × d / c` where c = sound speed (≈343 m/s)
- 4‑element, 1 m spacing: delay chain = [0, 2.91, 5.83, 8.74] ms (acoustic + electronic mix)
- Min elements: 3 (2 is ineffective)
- Max elements: unbounded (but pattern narrows with quantity)
- Range-limited: matures at distance; close-range sacrifice on cancellation
- Rear cancellation improves with distance

**Verification**: measure phase at front (coupling), measure SPL at rear (cancellation)

---

## 10. Gradient (In-Line) Cardioid Array (Ch. 10, Proc 14.17)

**Lines** 6387–6400, 10465–10490  
**Type**: Timing algorithm

- 2 elements, facing forward, spaced 0.5–1 m apart
- Delay rear element by `spacing / c`
- Reverse polarity on rear element
- Front/back ratio: >20 dB possible over full operating range
- Displacement must net ≥3 ms to prevent rear cancellation below 30 Hz
- Minimum spectral variance configuration

---

## 11. Gradient (Inverted Stack) Cardioid Array (Ch. 10, Proc 14.18)

**Lines** 6407–6456, 10493–10497  
**Type**: Same logic, vertical geometry twist

Same timing as in-line but:
- Vertical stacking → ground plane mic placement near rear-firing box
- Front/back ratio tradeoff: in-line sees more time-stretch penalty, inverted-stack sees level-difference penalty

---

## 12. Level Setting — Overlapped Systems (Ch. 14.4.2, Proc 14.12)

**Lines** 9473–9481, 10338–10361  
**Type**: Procedural (already algorithmic)

See mic-placement-decision-tree.md §7.9.

---

## 13. Spectral Crossover Alignment (Proc 14.9–14.10, 14.14)

**Lines** 10272–10315, 10385–10410  
**Type**: Procedural

- Unity crossover: each band at −6 dB at Fx, combined = 0 dB
- Overlap crossover: each band at −3 dB at Fx → +6 dB peak, EQ flat
- Phase alignment: delay the leading system (steeper phase slope)
- Mic placement: near-field for coupled (1–2 m), far-field for uncoupled

---

## 14. Power Scaling (Ch. 11.2)

**Lines** 6580–6635  
**Type**: Level calculation

Scale B's level by range ratio and axial orientation:
```
Level_offset_B = 20 × log10(range_ratio_B / range_ratio_A)
```
With compensation for coverage edges (e.g., VBOT-to-ONAX gives 6 dB advantage).

---

## 15. Forward Aspect Ratio (FAR) — Room/Speaker Matching (Ch. 3.10, Ch. 11.3)

**Lines** 3081–3091, 6640–6680  
**Type**: Geometric calculation

```
FAR = coverage_depth / coverage_width
Required_coverage_angle = f(FAR)  # wider room = wider speaker needed
```

The "On-axis far to off-axis near" relationship: OFFAX at 1× depth = ONAX at 2× depth (same level).

---

## 16. Summation Zone Identification from Response Shape (Ch. 4)

**Lines** 3404–3435  
**Type**: Pattern recognition

From a measured frequency response:
- Flat +6 dB vs solo → coupling zone
- Deep alternating dips/peaks >12 dB → combing zone
- Ripple <6 dB → isolation zone
- Ripple 6–12 dB → transition zone

Given level offset and time offset, the expected response shape (peak⁰, dip¹, peak¹, …) is deterministic.

---

## 17. Spatial Progression from Spectral Progression (Ch. 4)

**Lines** 3542–3567  
**Type**: Transformation

The spectral response pattern at a given time offset can be bent into the spatial polar pattern:
1. Take the frequency response for a given time offset
2. Convert Hz-axis to angle (0 Hz → 0°, F → 90°)
3. The result is the polar pattern for that source pair in one quadrant
4. Mirror for full 360°

This is a mathematical transformation, not just a heuristic.

---

## 18. Coherence Interpretation Rules (Ch. 12.10)

**Lines** ~8400–8440 (approx)  
**Type**: Diagnostic decision tree

Coherence tells you if your measurement is reliable:
- High coherence (0.9–1.0) → good signal-to-noise, reliable data
- Low coherence at LF → wind, ambient noise, HVAC
- Low coherence at HF → air turbulence, distance, or coverage edge
- Coherence nulls at specific frequencies → reflections or combing
- Coherence consistently low → measurement setup problem

---

## 19. Verification Procedures (Ch. 13)

**Lines** 8449–9135  
**Type**: Procedural with PASS/FAIL criteria

Three verification categories with structured tests:
1. **Analyzer self-verification**: I/O loopback, noise floor, channel matching
2. **Electronic verification**: Polarity, delay accuracy, EQ bypass, limiter threshold
3. **Acoustic verification**: Speaker polarity, driver coverage verification, system delay, frequency response

Each test has: equipment setup → procedure → expected result → PASS/FAIL.

---

## 20. Analysis Tool — Summation Level/Phase Table (Ch. 4)

**Lines** 3198–3269  
**Type**: Lookup table + algorithm

Given two sources with level offsets (−20 to 0 dB) and phase offsets (0° to 180°), the combined level can be:

1. Convert dB levels to linear: `ratio = 10^(dB/20)`
2. Complex addition: `result = sqrt(A² + B² + 2AB × cos(θ))`
3. Convert back: `dB = 20 × log10(result)`

This replaces the book's simplified multiplier table with the actual math.

---

## 21. Speaker Array Type Selection (Ch. 4, Ch. 9)

**Lines** 3905–3909, 5486–5602  
**Type**: Decision tree

```
Select array type based on:
├── Coverage shape needed (radial vs lateral vs rectangular)
├── Available displacement between elements
├── Expected listening distance
├── Speaker order available
└── Power vs uniformity priority

Results:
├── Coupled line source → max power, min uniformity, narrows with qty
├── Coupled point source → radial coverage, unity over distance, angular isolation
├── Uncoupled line source → lateral spread, depth-limited, first-order preferred
└── Uncoupled point source → hybrid, compensated splay
```

---

## Summary: Conversion Priority Matrix

| Candidate | Ch. | Lines | Formula | Decision Tree | Procedure | Priority |
|-----------|-----|-------|---------|---------------|-----------|----------|
| Summation engine | 4 | 3131–3467 | ★★★ | ★★★ | — | **1** |
| End-fire array | 10 | 6359–6383 | ★★★ | ★ | ★★★ | **2** |
| Gradient cardioid | 10 | 6387–6456 | ★★★ | ★ | ★★★ | **2** |
| Speaker classification | 2 | 1905–1931 | — | ★★★ | — | **3** |
| System subdivision | 11 | 6523–6527 | — | ★★★ | — | **3** |
| Spectral crossover | 14 | 10272–10410 | ★★ | ★ | ★★★ | **3** |
| Power scaling | 11 | 6580–6635 | ★★★ | — | — | **4** |
| FAR room matching | 3,11 | 3081–3091 | ★★ | ★★ | — | **4** |
| Verification tests | 13 | 8449–9135 | — | ★★ | ★★★ | **4** |
| Coherence diagnostics | 12 | ~8400 | — | ★★★ | — | **5** |
| Zone/response pattern ID | 4 | 3404–3435 | — | ★★★ | — | **5** |
| Spectral→spatial transform | 4 | 3542–3567 | ★★ | — | — | **5** |
| Array type selection | 4,9 | 3905–5602 | — | ★★★ | — | **5** |
| Coupling freq limit | 4 | 3997 | ★ | — | — | **5** |

**Legend**: ★ = present but minimal, ★★ = substantial, ★★★ = core strength

---

## Recommended Build Order

1. **Summation Engine** — everything else depends on it; it's the physics core
2. **End-fire + Gradient Array calculators** — self-contained, high practical value, formula-driven
3. **Speaker Classification + Subdivision Decision trees** — direct IF/THEN, low ambiguity
4. **Power Scaling + FAR matching** — geometric computation, useful for system design
5. **Verification Tests** — large volume but mostly mechanical translation
6. **Diagnostics (coherence, zone ID, pattern matching)** — requires more judgment, best after core is solid

---

*End of catalog.*
