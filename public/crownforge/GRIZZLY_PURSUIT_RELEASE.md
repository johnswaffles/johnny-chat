# Grizzly pursuit combat — 20260906-bearpursuit1

Bears can begin a low swipe within 2.35 world units and keep pursuing during preparation, contact and recovery. A nearby moving target is followed through the ordinary accelerated, collision-constrained movement integrator. Direct pursuit is limited to a clear segment within six units; longer routes retain existing navigation. Close pursuit uses a tighter waypoint tolerance to avoid repeated stopping behind a moving target.

Chasing chooses the low swipe. Stationary combat retains the standing attack every third cycle. The approved walk paintings play during moving preparation/recovery, with intact swipe paintings for wind-up, hit and follow-through. No artwork was changed. Travel continues advancing the stride during low attacks.

Damage remains a single event on the approved striking frame and rechecks current reach and line of sight. Escaped targets are missed; shielded workers immediately lose target eligibility. Pursuit does not move an upright attacking bear.

Validation: 39 focused tests passed across grizzly-pursuit, painted-grizzly, grizzly-motion, wildlife-routines and unit-inspection regression suites. Five pursuit tests cover moving hits, range escape, blocked travel/line of sight, planted standing attacks, shield cancellation and save restoration. The final transient-state cleanup passed all five pursuit checks again. Local gameplay review exercises chasing and records actual hit frame and movement speed.
