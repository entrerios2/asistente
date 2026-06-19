# Summation Engine — Decision Tree

*Source: Bob McCarthy, Sound Systems: Design and Optimization, 3rd Ed., Ch. 4*

---

## 1. Core Concept

Given two correlated audio sources A and B with known **level offset** and **phase offset**, the combined response is deterministic. Every result at a given (level, phase) pair is predictable — no variance. This is the engine behind all crossover, array, and room interaction decisions.

---

## 2. Level-Only Summation (Phase-Matched)

### 2.1 The Formula

```
Sum_gain_dB = 20 × log₁₀((A_linear + B_linear) / A_linear)
```

Where `A` is the stronger signal and `B` is the weaker.

### 2.2 Log ↔ Linear Conversion

```
Linear_ratio = 10^(dB / 20)
dB = 20 × log₁₀(linear_ratio)
```

**Reference table (single source):**

| Loss (dB) | Linear | Gain (dB) | Linear |
|-----------|--------|-----------|--------|
| 0 dB      | 1.00   | 0 dB      | 1.00   |
| −1 dB     | 0.89   | +1 dB     | 1.12   |
| −2 dB     | 0.79   | +2 dB     | 1.26   |
| −3 dB     | 0.71   | +3 dB     | 1.41   |
| −4 dB     | 0.63   | +4 dB     | 1.59   |
| −5 dB     | 0.56   | +5 dB     | 1.78   |
| −6 dB     | 0.50   | +6 dB     | 2.00   |
| −7 dB     | 0.45   | +7 dB     | 2.24   |
| −8 dB     | 0.40   | +8 dB     | 2.51   |
| −9 dB     | 0.35   | +9 dB     | 2.82   |
| −10 dB    | 0.32   | +10 dB    | 3.16   |
| −12 dB    | 0.25   | +12 dB    | 4.00   |
| −15 dB    | 0.18   | +15 dB    | 5.60   |
| −20 dB    | 0.10   | +20 dB    | 10.00  |

### 2.3 Multiple Inputs (Phase-Matched)

```
Sum_linear = Σ(10^(dB_n / 20)) for all n inputs
Sum_dB = 20 × log₁₀(Sum_linear)
```

**Multiple-input reference (all matched level & phase):**

| Quantity | Linear sum | Log gain |
|----------|------------|----------|
| 1        | 1          | 0 dB     |
| 2        | 2          | +6 dB    |
| 3        | 3          | +10 dB   |
| 4        | 4          | +12 dB   |
| 5        | 5          | +14 dB   |
| 6        | 6          | +17 dB   |
| 8        | 8          | +18 dB   |
| 10       | 10         | +20 dB   |
| 16       | 16         | +24 dB   |
| 32       | 32         | +30 dB   |

**Level tapering example** (8 speakers):

Convert each tapered level to linear, sum them, convert back to dB. Compare to max (8 × 1.0 = 8 = +18.1 dB) to find taper loss.

---

## 3. Phase Multiplier Model (Simplified)

For phase offsets other than 0°, the linear contribution of B is derated by a multiplier:

```
Sum_linear = A_linear + (B_linear × phase_multiplier)
Sum_dB = 20 × log₁₀(Sum_linear)
```

| Phase offset | Approx multiplier | Accuracy  |
|-------------|-------------------|-----------|
| 0°          | 1.00              | exact     |
| 30°         | 0.92              | ±0.15 dB  |
| 60°         | 0.70              | ±0.25 dB  |
| 90°         | 0.35              | ±0.5 dB   |
| 120°        | 0.00 (at equal levels) | varies with level |
| 150°        | too variable      | —         |
| 180°        | −1.00             | exact     |

**Key insight**: Adding 30° of phase offset is equivalent to turning B down ~1 dB. The effects of phase and level offset are additive in this simplified model.

---

## 4. Complex Summation (Full Precision)

For arbitrary level and phase, use complex addition:

```
Re_n = 10^(L_n / 20) × cos(Φ_n)
Im_n = 10^(L_n / 20) × sin(Φ_n)

ΣRe = Re_A + Re_B + ... + Re_n
ΣIm = Im_A + Im_B + ... + Im_n

Sum_dB = 20 × log₁₀(√(ΣRe² + ΣIm²))
```

---

## 5. Time Offset → Phase Offset

```
Phase_offset(°) = 360 × time_offset(ms) × frequency(kHz)
```

Since time offset is linear, phase offset over frequency is a spiral:
- 1 ms offset → 360°/kHz → 360° @1 kHz, 720° @2 kHz, etc.
- 180° @500 Hz, 540° @1500 Hz, etc.

### Comb frequency (fundamental):
```
F_comb = 1 / time_offset
```
Peaks occur at multiples of `F_comb`, dips at `(n + 0.5) × F_comb`.

---

## 6. Summation Zone Classification

This is the central decision tree. Given a pair of correlated sources at a given frequency, classify into one of five zones:

```
Input:
  level_offset = |L_A − L_B| (dB)
  phase_offset = |Φ_A − Φ_B| (degrees, wrap to 0–360)

Decision tree:
│
├── IF phase_offset < 120° AND level_offset ≤ 10 dB
│   └── ZONE: COUPLING (all gain, no loss)
│       ├── Max gain: +6 dB (@ 0 dB, 0°)
│       └── Min gain: 0 dB (at 120° or 10 dB)
│
├── IF phase_offset within ±30° of 180° AND level_offset < 2 dB
│   └── ZONE: CANCELLATION (all loss, no gain)
│       └── Strong cancellation (> −6 dB) needs near-perfect conditions
│
├── IF level_offset ≤ 4 dB AND phase_offset cycles through full range
│   └── ZONE: COMBING (ripple > 12 dB)
│       └── Damage control: maximize isolation or minimize time offset
│
├── IF 4 dB < level_offset < 10 dB AND full phase cycles
│   └── ZONE: TRANSITION (ripple 6–12 dB)
│       └── Semi-isolated, less severe than combing
│
└── IF level_offset ≥ 10 dB
    └── ZONE: ISOLATION (ripple < 6 dB)
        └── Minimal power addition, low ripple, predictable coverage
```

**Simplified boundary summary:**

| Zone           | Level offset | Phase offset        | Ripple  |
|----------------|-------------|---------------------|---------|
| Coupling       | ≤ 10 dB     | < 120°              | none    |
| Cancellation   | < 2 dB      | 180° ± 30°          | deep    |
| Combing        | ≤ 4 dB      | cycles full range   | >12 dB  |
| Transition     | 4–10 dB     | cycles full range   | 6–12 dB |
| Isolation      | ≥ 10 dB     | any                 | < 6 dB  |

---

## 7. Spectral Summation Zone Progression

As frequency rises with a fixed time offset, zones progress in a known sequence:

```
Starting at DC (0 Hz) = phase_offset = 0° = coupling

1. Coupling zone (peak⁰):
   └── From 0 Hz up to where phase_offset = 120°
       F_coupling_limit = (120 / 360) / time_offset
                         ≈ 0.333 / time_offset

2. Combing or Transition zone (dip¹, peak¹, dip², ...):
   └── Begins when phase_offset > 120° AND depends on level_offset:
       IF level_offset ≤ 4 dB → COMBING (ripple >12 dB)
       IF 4 < level_offset < 10 → TRANSITION (ripple 6–12 dB)

3. Isolation zone:
   └── IF level_offset ≥ 10 dB at any phase → ISOLATION
```

### Standard milestones:
| Milestone  | Phase offset | Frequency (given 1 ms TO) |
|------------|-------------|---------------------------|
| Peak⁰ end  | 120°        | 333 Hz                    |
| Dip¹       | 180°        | 500 Hz                    |
| Peak¹      | 360°        | 1 kHz                     |
| Dip²       | 540°        | 1.5 kHz                   |
| Peak²      | 720°        | 2 kHz                     |

For time offset `T` ms: multiply all frequencies above by `1/T`.

### Perceptual Note:
- Peak⁰ = pure gain (wide, most audible)
- Dip¹ = deepest hole (wide, audible)
- Peak¹ = most recognizable tonal modifier
- Peaks/Dips beyond peak¹ narrow logarithmically → less perceptible
- Wide peaks dominate perceived tonal character
- Narrow dips (< 1/6 octave) are largely inaudible as tonal changes

---

## 8. Crossover Classification

### 8.1 By Level Outcome

```
At the crossover point (equal level from A and B):

IF A+B combined level = isolated level
  → UNITY crossover (A+B = 0 dB @XOVR)

IF A+B combined level > isolated level
  → OVERLAPPED crossover (A+B > 0 dB @XOVR)

IF A+B combined level < isolated level
  → GAPPED crossover (A+B < 0 dB @XOVR)
```

### 8.2 By Progression Length

```
1-step:  coupling(AB)
         └── extremely close sources (sub arrays)

2-step:  coupling(AB) → cancellation(AB)
         └── cardioid arrays

3-step:  isolation(A) → coupling(AB) → isolation(B)
         └── spectral crossovers with steep filters; hard for spatial

5-step:  isolation(A) → transition(AB) → coupling(AB)
         → transition(BA) → isolation(B)
         └── closely coupled arrays with angular isolation

7-step:  isolation(A) → transition(AB) → combing(AB)
         → coupling(AB) → combing(BA) → transition(BA) → isolation(B)
         └── full progression; HF spatial crossovers
```

**Design goal**: minimize time spent in combing zone. Best: spend as much as possible in coupling + isolation, minimizing transition, avoiding combing.

---

## 9. Spatial Geometry (Triangulation)

### 9.1 Triangle Classification

For two sources A, B and listener C:

```
Paths: AC and BC

Level_offset = 20 × log₁₀(AC / BC)
Time_offset = AC − BC  (in ms or distance units)

Triangle type from listener position relative to A/B line:
│
├── Isosceles (AC = BC)
│   └── On coupling line: 0 dB offset, 0 ms offset, +6 dB forever
│
├── Acute (C between A and B, AC ≠ BC)
│   └── Volatile zone: rapid change, toward combing
│
├── Right (C directly in front of A)
│   └── Marker between volatile and stable zones
│
├── Obtuse (C outside A and B)
│   └── Stable zone: slower change, toward isolation
│
└── Uncoupling line (C on AB line extended)
    └── Maximum level and time offset
```

### 9.2 Wavelength Offset

The decisive factor for spatial pattern is λ displacement = source displacement / wavelength.

```
IF λ_displacement = 1:
  └── polar pattern has peak⁰ at 0°, dip¹ at 45°, peak¹ at 90° (1 quadrant)

IF λ_displacement = 2:
  └── polar pattern: peak⁰ at 0°, dip¹ at 30°, peak¹ at 45°, dip² at 60°, peak² at 90°
  
General: pattern scales proportionally — doubling λ displacement halves angles
```

### 9.3 Spatial ↔ Spectral Link

The spectral frequency response and spatial polar pattern are the same shape, just bent:

```
1. Capture summed frequency response for the given time offset
2. Map 0 Hz → 0° polar, F_comb → 90° polar
3. Bend the frequency response into a 90° arc → one quadrant
4. Mirror for full 360° polar pattern

Any (time_offset, frequency) pair = same picture as any other
  with same λ displacement ratio
  e.g., 1 ms @1 kHz = 2 ms @500 Hz = 0.5 ms @2 kHz (all 1 λ)
```

---

## 10. Level + Phase Offset → Summation Zone (Complete Lookup)

Given two inputs with known level offset (0–20 dB) and phase offset (0°–180°):

```
Decision flow:
1. IF level_offset ≥ 10 dB → ISOLATION (ripple < 6 dB)
   
2. ELSE IF level_offset ≤ 4 dB:
   ├── IF phase < 120° → COUPLING (all gain)
   ├── IF 120° ≤ phase < 150° → COMBING begins (ripple >12 dB)
   └── IF phase ≥ 150° → COMBING (full depth)
   
3. ELSE (4 < level_offset < 10 dB):
   ├── IF phase < 120° → COUPLING (reduced gain)
   ├── IF 120° ≤ phase < 150° → TRANSITION begins (ripple 6–12 dB)
   └── IF phase ≥ 150° → TRANSITION (full)
```

### Summation gain lookup (level offset × phase offset):

| Level\Phase | 0° | 30° | 60° | 90° | 120° | 150° | 180° |
|-------------|----|-----|-----|-----|------|------|------|
| 0 dB        | +6 | +5.7| +4.8| +3.0| 0.0  | −5.7 | −∞   |
| −3 dB       | +4.8| +4.5| +3.8| +2.2| 0.7  | −2.3 | −6.9 |
| −6 dB       | +3.5| +3.3| +2.8| +1.8| 0.5  | −0.9 | −2.5 |
| −10 dB      | +2.0| +1.9| +1.6| +1.0| 0.3  | −0.3 | −0.8 |
| −15 dB      | +1.0| +0.9| +0.8| +0.5| 0.1  | −0.1 | −0.3 |
| −20 dB      | +0.4| +0.4| +0.3| +0.2| 0.0  | −0.0 | −0.1 |

*(Values shown are combined level in dB re: solo A; computed via complex summation)*

---

## 11. Algorithm Interface Sketch

```python
@dataclass
class Source:
    level_dB: float    # absolute level
    phase_deg: float   # relative to reference

@dataclass
class SummationResult:
    combined_dB: float
    zone: str          # COUPLING | CANCELLATION | COMBING | TRANSITION | ISOLATION
    ripple_dB: float   # expected ripple magnitude

def compute_summation(sources: list[Source]) -> SummationResult

def classify_zone(level_offset_db: float, phase_offset_deg: float) -> str

def time_to_phase(time_offset_ms: float, frequency_hz: float) -> float

def comb_milestones(time_offset_ms: float) -> dict:
    """Returns {peak0_limit_hz, dip1_hz, peak1_hz, dip2_hz, peak2_hz, ...}"""

def predict_polar_pattern(time_offset_ms: float, frequency_hz: float) -> list[tuple]:
    """Returns [(angle_deg, level_dB), ...] for one quadrant"""

def triangulate(path_ac: float, path_bc: float) -> tuple:
    """Returns (level_offset_db, time_offset_ms, triangle_type)"""
```

---

*End of decision tree. Ready for conversion to executable algorithm.*
