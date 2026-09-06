# Greatwood Grizzly motion and interception

Release: `20260906-bearmotion1`

The bear now walks using distance traveled, four staggered paw contacts, articulated limbs, planted paw surfaces and quiet breathing. The torso keeps its mass instead of wobbling between mismatched whole-body pictures. Four independently authored views share the same actor-coordinate motion. Overlapping fur surfaces, three prepared image levels and separate paws keep the silhouette continuous through the stride.

Low swipes alternate paws. Every third attack rises onto the hind legs, winds up, strikes downward and settles onto all fours. The 2.2-second rear-up is slower than the 1.45-second ground swipe; both retain the existing 29 damage and contact-time range/line-of-sight checks. A committed strike finishes when prey moves away, producing a miss instead of snapping to another stance. The facing stays fixed through the committed attack. The health bar and click height accommodate rearing.

All ten fighting classes on either team automatically intercept reachable bears within 140 world units when they have no current fight. This includes patrols, guard posts and rally movement. Their previous route resumes after the bear dies; explicit new orders discard the old resumption. Each half-second scan allows at most three route searches, rotates fairly through fighters and backs off failed routes for eight seconds. Active bear fights are retained when Ashen defense or raid planning runs.

The five-minute encounter schedule, bear health/damage, worker Last Light Ward, terrain, music and character artwork remain intact. Save data retains the bear motion/attack state and prior orders through the existing unit serialization.

## Verification

- Nine new regression tests cover support and fixed bone lengths across the four views, planted-paw ground velocity, cycle continuity, blocked movement, rear-up support/return, attack-phase continuity, actual hit cadence, escaped strikes, saved attack state, all 20 faction/class combinations, preserved fights, workers/radius exclusions, order resumption/manual overrides, and bounded/fair failed routes.
- All eleven existing wildlife/routine checks pass, including a lone guard losing, two guards winning with a casualty, both worker wards, saved encounter cadence, legal woodland spawning and a 920-second economy run through three encounters. The latter measured 99.8% active worker samples, a maximum two-second idle interval and deposits from all four workers.
- Roster gameplay, Hearthkin gameplay, building defense, camera rendering and character loading suites pass.
- The four-view studio was inspected at walk/idle and both attack contacts. The actual Canvas game was observed with a Crown Shieldbearer and Ashen Hidewall independently intercepting the same bear. For this prolonged local QA fight only, all three combatants were given 1,800 HP; production health was unchanged. Both response flags and actual damage were observed. At 98.2 seconds / 5,887 samples, render p99 was 5.4 ms, simulation p99 0.3 ms and the largest frame interval 50 ms. No browser errors or frame intervals over 100 ms were recorded. These are local measurements, not a cross-device guarantee.
- Scoped syntax, source/public parity, whitespace and site build checks passed (50 scoped source/mirror files). Temporary gameplay harnesses are excluded from the release.

Art: `assets/crownforge-grizzly-rig-v2.png`, original accepted built-in ImageGen output (RGBA 1024×1536, 938,300 fully transparent pixels). Exact generation/extraction prompts and provenance: `GRIZZLY_MOTION_ART_PROMPTS.json`. Source pixels were not edited. Preview: `dev/grizzly-studio.html`.
