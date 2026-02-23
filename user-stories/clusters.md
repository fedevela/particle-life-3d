| Functional Type | Domain Area | Domain Goal | Primary Persona | Current UI Coverage | Gaps / Opportunities |
|---|---|---|---|---|---|
| Functional | Simulation Runtime | Run a real-time particle world with continuous state updates | Explorer / Hobbyist | Main simulation canvas, play loop, freeze/unfreeze | Add explicit play-speed control (0.5x/1x/2x) |
| Functional | Population Mechanics | Control crowd density and interaction frequency | Experimenter | Particle count slider + numeric input + Enter apply | Add presets for low/med/high density |
| Functional | Species Mechanics | Control diversity and cross-species interactions | Experimenter | Species count slider + numeric input + bounds | Add species-specific visibility toggles |
| Functional | Interaction Rule System | Swap attraction/repulsion rule matrices quickly | Experimenter / Research-minded user | Named ecosystem preset buttons + random preset | Add “save current rule set” and “load custom preset” |
| Functional | Disturbance Mechanics | Perturb the simulation and observe resilience | Explorer | zap button | Add disturbance intensity slider and localized zap |
| Functional | Direct Manipulation Mechanics | Manually influence particles/clusters in real time | Explorer / Creator | Mouse drag + touch drag + grab-radius feedback | Add multi-touch gestures and stronger haptic-style feedback cues |
| Functional | Visual Signal Mechanics | Make motion and species patterns interpretable | Explorer | Trails control, random colors | Add colorblind-safe palettes and per-species color lock |
| Functional | Experiment Reset / Seed Control | Reproduce and replay scenarios | Experimenter | p-system click/tap reset; randomized starts | Add explicit seed display/copy to reproduce outcomes |
| Functional | Responsiveness / Device Operation | Keep simulation usable across viewport sizes and devices | All users | Auto-resizing canvas; touch handlers | Add mobile-first control layout for small screens |
| Non Functional | Educational Onboarding | Explain concepts while users observe behavior | Learner / Newcomer | intro.html with embedded mini simulation + pause | Add progress indicator (“you are in section X of Y”) |
| Non Functional | Educational Curriculum Flow | Provide structured learning sequence and guided examples | Learner | Numbered intro sections + experiment cards + links to p-system demos | Add explicit “next concept” path and section summaries |
| Non Functional | Educational Resource Curation | Connect users to external references and historical context | Learner / Curious user | links.html, main-page video/text cards, related link block | Add tags/filtering by topic (emergence, rules, art, code) |
| Non Functional | Information Architecture / Navigation | Move cleanly between play, learning, and references | All users | Links among index.html, intro.html, links.html | Add persistent top nav / breadcrumb for faster switching |
| Non Functional | Discoverability / First-Run Guidance | Help first-time users understand controls quickly | First-time user | Controls are present but mostly self-discovered | Add lightweight “first run” overlay/tooltips for 3 key controls |
