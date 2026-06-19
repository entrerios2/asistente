# Measurement Microphone Placement — Decision Tree

*Source: Bob McCarthy, Sound Systems: Design and Optimization, 3rd Ed., Ch. 14.3–14.4*

---

## 1. Core Position Types (6 classes)

| Class | Location | Used for |
|-------|----------|----------|
| **ONAX** | On-axis — mid-point of coverage (horizontal & vertical), mid-point depth | EQ, level, aim, splay, spacing |
| **OFFAX** | Horizontal coverage edge — last seat at mid-point depth | Aim (horizontal) |
| **VTOP** | Vertical top — highest seats, on-axis horizontally | Aim (vertical) |
| **VBOT** | Vertical bottom — lowest seats, on-axis horizontally | Aim (vertical) |
| **XOVR** (XAB, XAA) | Spatial crossover — geometric centerline (symmetric) or closer to quiet element (asymmetric) | Splay, spacing, delay |
| **SYM** | Symmetrically opposite to an element elsewhere | Symmetry verification (copies of ONAX) |

---

## 2. Overall Decision Hierarchy

```
1. Determine TASK
   │
2. Determine SYSTEM TYPE + CONFIGURATION
   │
3. Select MIC POSITION CLASSES
   │
4. Determine SPECIFIC PLACEMENT within each class
   │
5. Apply HEIGHT / AIMING RULES
```

---

## 3. Task → Position Class Mapping

```
EQ (solo)        → ONAX  [optional spatial averaging around ONAX]
EQ (combined)    → ONAX A + XAB + ONAX B
Aim (horizontal) → ONAX + OFFAX (L+R if asymmetric)
Aim (vertical)   → ONAX + VTOP + VBOT
Splay/spacing    → ONAX A + XOVR + ONAX B
Level setting    → ONAX A + ONAX B
Delay setting    → XOVR (single position)
Symmetry check   → SYM (copy of ONAX on opposite side)
```

---

## 4. System Type Decision Tree

### 4.1 Single Speaker

```
Single Speaker?
├── Symmetric orientation
│   ├── ONAX = mid-point width & depth
│   └── OFFAX = along coverage edges at mid-point depth
│
└── Asymmetric orientation (typical vertical)
    ├── VTOP = upper coverage limit
    ├── VBOT = lower coverage limit
    └── ONAX = closer to VTOP (moves up as range ratio rises)
```

### 4.2 Coupled Arrays

```
Coupled Array?
│
├── Line source (symmetric)
│   ├── No angular or displacement isolation → ONAX AA (merged)
│   ├── OFFAX AA
│   └── XOVR positions merge into ONAX
│
├── Point source (symmetric, 2-element A₁A₂)
│   ├── OFFAX A₁
│   ├── ONAX A₁
│   ├── XAA (geometric centerline)
│   ├── SYM (ONAX A₂ = symmetrical opposite)
│   └── SYM (OFFAX A₂ = symmetrical opposite)
│   │
│   ├── Extension to 3 elements (A₁₋₁, A₂, A₁₋₂)
│   │   └── Add ONAX A₂
│   │
│   └── Extension to 4 elements (A₁₋₁, A₂₋₁, A₂₋₂, A₁₋₂)
│       └── Add another SYM
│
├── Point source (asymmetric, AB)
│   ├── OFFAX A
│   ├── ONAX A
│   ├── XAB (migrates toward quiet source B)
│   ├── ONAX B
│   └── OFFAX B
│   │
│   └── Extension to ABC
│       ├── OFFAX B → XBC
│       ├── ONAX C
│       └── OFFAX C
│
└── Point destination (coupled)
    └── Identical to coupled point source
```

### 4.3 Uncoupled Arrays

```
Uncoupled Array?
│
├── Line source
│   ├── Same mic/element relationship as coupled point source
│   ├── ONAX = in front of speaker at mid-point depth (unity line)
│   ├── XOVR = geometric mid-point (symmetric) / closer to B (asymmetric)
│   ├── OFFAX = verify array extension
│   └── SYM = verify remaining elements at their ONAX
│
├── Point source (hybrid of coupled PS + uncoupled LS)
│   ├── Symmetric:
│   │   ├── XOVR = angular mid-point (like coupled PS) + depth mid-point (like uncoupled LS)
│   │   ├── ONAX A, OFFAX A
│   │   └── ONAX B, OFFAX B (depths rescaled per level relationship to A)
│   │
│   └── Asymmetric:
│       └── XOVR migrates toward quiet source (B)
│
└── Point destination
    ├── Symmetric:
    │   ├── ONAX = half-way to pattern cross point (= end of coverage)
    │   ├── XOVR = midway between two ONAX locations
    │   └── OFFAX = outer edge at mid-point depth
    │
    └── Asymmetric (B = delay/fill, much smaller):
        ├── ONAX B = XAB (merged — no isolation at any location)
        ├── Level, EQ, delay all set from this same location
        └── OFFAX ≈ irrelevant (A takes over after B fades)
```

---

## 5. Height Selection Rules

```
Height decision:
│
├── Sitting head height (≈ear height)
│   ├── Preferred when standing height would be off vertical axis
│   │   (e.g. front-fills, top rows under balcony)
│   └── Caution: seat back reflections (minor in soft-seater,
│       significant with hard backs — disappears when occupied)
│
├── Standing head height
│   ├── Suitable for most standard applications
│   ├── Reduces seat back reflection strength
│   └── Raked seating compensation:
│       └── Place mic one row below vertical target
│           (standing height in closer row ≈ sitting height one row back)
│
└── Ground plane (on floor)
    ├── Floor reflection couples in-phase → +6 dB vs sitting/standing
    ├── Difficult to prevent VHF combing in practice
    ├── Use when empty flat floor creates reflections that won't
    │   match show conditions (e.g. arena floor before seating)
    └── Good for subwoofer-to-mains phase alignment
```

---

## 6. Mic Aiming Rules

```
Aim decision:
│
├── Point mic at speakers (free-field approach)
│   ├── ±30° = almost no effect (omni mics)
│   ├── 90° off axis = −6 dB HF loss — DON'T
│   └── NEVER point at ceiling (random incidence for HVAC/noise)
│
├── Hanging from balcony rail (last resort)
│   ├── Best: keep aimed at speakers
│   └── If hanging straight down: assume −6 dB VHF
│
└── At spatial crossovers:
    └── Point mic between the two speakers
        (e.g. frontfill + mains)
```

---

## 7. Procedural Decision Logic

### 7.1 Aim — Solo Horizontal (Proc 14.1)

```
Mics: OFFAX1 · ONAX · OFFAX2
Mid-point depth for all

Compare ONAX vs OFFAX1 vs OFFAX2:
  IF OFFAX1 > OFFAX2 → aim toward OFFAX1
  IF OFFAX1 < OFFAX2 → aim toward OFFAX2
```

### 7.2 Aim — Left/Right Main Horizontal (Proc 14.2)

```
Mics: OFFAX L · ONAX L · X_LR (room center)
Mid-point depth

Compare ONAX L vs OFFAX L vs X_LR:
  IF OFFAX L > X_LR → aim inward (toward center)
  IF OFFAX L < X_LR → aim outward (toward OFFAX L)
  FAIL if variance > 6 dB → fill speaker required
```

### 7.3 Aim — Solo Vertical (Proc 14.3)

```
Mics: VTOP · ONAX · VBOT
On-axis horizontally

Compare ONAX vs VTOP vs VBOT:
  IF VTOP > VBOT → aim down
  IF VTOP < VBOT → aim up
  FAIL if variance > 6 dB → fill speaker required
```

### 7.4 Aim — Top Element of AB Array Vertical (Proc 14.4)

```
Mics: VTOP · ONAX A · XAB (to find)

1. Compare ONAX A vs VTOP:
   IF VTOP > ONAX A → aim down
   IF VTOP = ONAX A → minimum variance achieved
2. Sweep XAB mic until A solo = −6 dB re. ONAX A
   (this becomes connection point for B speaker below)
   FAIL if VTOP−ONAX variance > 6 dB → delay fill required
```

### 7.5 Unity Splay — AA Symmetric (Proc 14.5)

```
Mics: ONAX A₁ · XAA (radial mid-point) · ONAX A₂

Solo-muting method:
1. Drive A₁ solo; EQ at ONAX A₁
2. Move XAA mic until A₁ solo @XAA = −6 dB re. A₁ solo @ONAX A₁
3. Mute A₁, drive A₂ solo
4. Adjust splay until A₂ solo @XAA = A₁ solo @XAA (= −6 dB)

No-solo method:
1. Drive both, EQ combined at ONAX A₁
2. Compare combined @XAA vs combined @ONAX A₁
3. Adjust splay until they match

Decision:
  IF XAA > ONAX A → increase splay
  IF XAA < ONAX A → decrease splay
  FAIL if unity splay but array still too narrow → fills needed
```

### 7.6 Unity Splay — AB Asymmetric (Proc 14.6)

```
Mics: ONAX A · XAB (TBD) · ONAX B

Prereq: A and B level-matched and EQ'd

1. @ONAX A: store A solo reference
2. Sweep XAB until A solo = −6 dB re. ONAX A
3. Mute A, drive B solo
4. Adjust splay until B solo @XAB = A solo @XAB (= −6 dB re. ONAX A)
5. Delay-align B to A at XAB

Decision:
  PASS if XAB = ONAX A after splay adjustment
  FAIL if XAB > ONAX A → increase splay; IF < → decrease
```

### 7.7 Unity Spacing — AA Symmetric (Proc 14.7)

```
Same logic as 14.5 but with linear spacing instead of splay angle

Mics: ONAX A₁ · XAA (linear mid-point) · ONAX A₂

Decision:
  IF XAA > ONAX A → increase spacing
  IF XAA < ONAX A → decrease spacing
  FAIL if unity spacing but array too narrow → more elements needed
```

### 7.8 Level Setting — Isolated Systems (Proc 14.11)

```
Mics: ONAX A · ONAX B

1. @ONAX A: EQ speaker A solo → store as GOLD reference
2. @ONAX B: EQ speaker B solo
3. Adjust B level until B solo @ONAX B = A solo @ONAX A
```

### 7.9 Level Setting — Overlapped / Non-Isolated (Proc 14.12)

```
Mics: ONAX A · ONAX B (= XAB)

1. @ONAX B: Measure A solo → tells how much fill is needed
   (e.g. −6 dB from A needs −6 dB from B to reach 0 dB)
2. @ONAX B: EQ and level-set B solo to match A solo reference
3. @ONAX B: Set B delay to sync A + B
4. @ONAX B: Adjust B level until A+B combined = A solo @ONAX A

PASS if ONAX A (A solo) = ONAX B (A+B combined)
```

### 7.10 Delay Setting — Spatial Crossover (Proc 14.13)

```
Mics: XAB (single position)

1. @XAB: Measure A solo impulse → mark HF arrival as "0 ms"
2. @XAB: Measure B solo → compare arrival time
3. Adjust B delay to match B impulse to A impulse
4. @XAB: Combine A+B → should show +6 dB vs soloists
5. Fine-adjust B delay for phase alignment
```

### 7.11 EQ — Single System (Proc 14.15)

```
Mics: ONAX (spatial averaging optional around ONAX area)

1. Prereq: known near-field response (flat expected)
2. @ONAX: measure unequalized response (Room+Spkr transfer function)
3. Vertically center response in plateau range (typically 2–8 kHz)
4. Optional: spatial average multiple ONAX positions
5. Use cut filters on speaker/room summation peaks
6. Restore HF air loss with VHF boost

FAIL if excessive ripple variance → fix other issues before EQ
```

### 7.12 EQ — Combined System A+B (Proc 14.16)

```
Mics: ONAX A · XAB · ONAX B

1. Prereq: position, level, solo EQ, delay set on both systems
2. @all 3: measure A solo, B solo, A+B
3. Compare each A+B vs solo at same location
4. Compare A+B response across all 3 locations
5. Apply asymmetric EQ for maximum conformity to target curve

PASS if combined response matches target at A, XAB, B
FAIL if combined EQ filters differ >6 dB from solo filters → restart
If variance unavoidable → favor A system over B
```

---

## 8. Spatial Averaging Rules

```
Spatial averaging (for EQ only — NOT for aim/splay/delay/level):

├── Summed mics ("Y" cord) → NEVER (creates combing)
├── Moving mic → NEVER (no phase/coherence)
├── Multiplexed mics → NEVER (same problems as moving)
│
├── Mathematical trace averaging
│   ├── Use coherence weighting
│   ├── Keep all positions within ONAX coverage area
│   └── Recommended for EQ only
│
├── Optical averaging
│   ├── Overlay multiple traces, detect trends visually
│   ├── Allows location-based weighting (e.g. ignore LF bump near wall)
│   └── Recommended for EQ only
│
└── Star pattern (Roger Gans)
    └── Begin at ONAX, move short distances H+V from there
```

---

## 9. Context Validation Rules

```
After placing mics, validate via context checks:

├── ONAX should be speaker's best-case scenario
│   └── If other areas look better → mic wrong / aim wrong / blockage
│
├── Distance check
│   ├── HF loss at 50 m = expected
│   └── HF loss at 5 m → investigate (aim/blockage/driver)
│
├── Room acoustics check
│   └── Reverberant hall / glass arena / wind → lower expectations
│
├── Local conditions check
│   └── Line of sight? Strong local reflection? → investigate before EQ
│
├── Array type check
│   ├── 12-element coupled array expects pink shift
│   └── Flat response → investigate (drivers not flat? polarity reversal?)
│
├── Inverse square law check
│   └── No 6 dB/doubling drop? → near-field / off-axis movement?
│
├── Off-axis check
│   └── ONAX alone has no context → must compare with OFFAX
│
├── Spatial crossover check
│   └── 20 dB dip at 5 kHz near ONAX = problem / near XOVR = expected
│
├── Stereo symmetry check
│   └── Right side should match left
│
└── Audience presence check
    └── Is response change physically possible? Or leakage?
```

---

## 10. Algorithm Interface Sketch

```python
# Conceptual entry point
def recommend_mic_positions(
    task: TaskType,              # EQ | AIM_H | AIM_V | SPLAY | SPACING | LEVEL | DELAY
    system_type: SystemType,     # SINGLE | COUPLED_LS | COUPLED_PS | COUPLED_PD
                                 # | UNCOUPLED_LS | UNCOUPLED_PS | UNCOUPLED_PD
    symmetry: Symmetry,          # SYMMETRIC | ASYMMETRIC
    element_count: int,          # 1, 2, 3, ...
    room_boundary: Polygon,      # listening area shape
    speaker_positions: list,     # positions, aims, coverage angles
    depth_info: DepthInfo,       # coverage start/end rows, mid-point depth
    height_mode: HeightMode,     # SITTING | STANDING | GROUND_PLANE
) -> list[MicRecommendation]:
    ...
```

```python
@dataclass
class MicRecommendation:
    mic_class: str          # ONAX | OFFAX | VTOP | VBOT | XOVR | SYM
    role: str               # "EQ" | "aim_ref" | "crossover" | "symmetry" | ...
    target_speaker: str     # which element(s) this mic is for
    location_hint: str      # geometric description
    height: str             # sitting | standing | ground_plane
    special_notes: list[str]
```

---

*End of decision tree. Ready for conversion to executable algorithm.*
