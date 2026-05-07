# Cookie Jar Lift Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the first cookie click in a tab session, lift and tilt the glass jar (dome + tube + rim ring + brass knob) off-frame, leaving the wooden plinth and wiggling cookie. State persists across navigation, resets on hard refresh.

**Architecture:** A new in-memory React Context (`JarContext`) lives at the top of `App.jsx` so the open/closed flag survives `CookieClicker` unmount/remount during navigation. `CookieClicker.jsx` groups the five lid meshes into a single `THREE.Group`, conditionally builds it on mount based on context state, and animates `position.y` + `rotation.z` over 800ms in the existing rAF loop on first click.

**Tech Stack:** React 19, React Context, Three.js 0.184, Vite. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-07-cookie-jar-lift-animation-design.md`

**Notes for the executor:**
- Frontend has no test suite (per `CLAUDE.md`). Verification is manual + `npm run lint`. Do not introduce a test framework for this feature.
- Backend, `useCookieClicker.js`, and the points/click pipeline are off-limits. Do not touch them.
- User preference: commit messages must NOT include `Co-Authored-By` lines.
- The spec doc and this plan doc are already on disk but uncommitted. **Task 1 commits them together** as a single doc commit before any code changes.

---

## File Structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `frontend/src/contexts/JarContext.jsx` | **Create** | `JarProvider` + `useJar()` hook. Owns the boolean `open` state in memory only. |
| `frontend/src/App.jsx` | **Modify** | Wrap the returned tree's outermost element with `<JarProvider>`. |
| `frontend/src/components/CookieClicker.jsx` | **Modify** | Consume `useJar()`. Group the five lid meshes into a `THREE.Group`. Conditionally build/skip the lid based on `open`. On first click, set `open=true` immediately and start the lift-and-tilt animation in the rAF loop. |

No other files change. No backend, no `useCookieClicker.js`, no `package.json`.

---

## Task 1: Commit design + plan documents

**Files:**
- Already on disk: `docs/superpowers/specs/2026-05-07-cookie-jar-lift-animation-design.md`
- Already on disk: `docs/superpowers/plans/2026-05-07-cookie-jar-lift-animation.md`

- [ ] **Step 1: Confirm both docs exist and are uncommitted**

Run:
```bash
git status --short docs/superpowers/specs/2026-05-07-cookie-jar-lift-animation-design.md docs/superpowers/plans/2026-05-07-cookie-jar-lift-animation.md
```
Expected: both files show `??` (untracked) or `A`/`M` (staged/modified).

- [ ] **Step 2: Stage both docs together**

Run:
```bash
git add docs/superpowers/specs/2026-05-07-cookie-jar-lift-animation-design.md docs/superpowers/plans/2026-05-07-cookie-jar-lift-animation.md
```

- [ ] **Step 3: Commit (no Co-Authored-By line)**

Run:
```bash
git commit -m "$(cat <<'EOF'
docs(cookie-jar): add design + implementation plan for lift animation

Spec and plan for lifting the glass jar off the wooden plinth on
first click, with state persisting across in-tab navigation and
resetting on hard refresh.
EOF
)"
```
Expected: one commit, two files added.

---

## Task 2: Create `JarContext` and integrate provider into `App.jsx`

**Files:**
- Create: `frontend/src/contexts/JarContext.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create the context module**

Write `frontend/src/contexts/JarContext.jsx` with this exact content:

```jsx
import { createContext, useContext, useMemo, useState } from 'react';

const JarContext = createContext(null);

export function JarProvider({ children }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <JarContext.Provider value={value}>{children}</JarContext.Provider>;
}

export function useJar() {
  const ctx = useContext(JarContext);
  if (!ctx) {
    throw new Error('useJar must be used inside a <JarProvider>');
  }
  return ctx;
}
```

- [ ] **Step 2: Wrap `App.jsx`'s returned tree with `<JarProvider>`**

In `frontend/src/App.jsx`:

(a) Add the import alongside the existing imports near the top of the file:

```jsx
import { JarProvider } from './contexts/JarContext.jsx'
```

(b) Wrap the existing `<div className="flex flex-col min-h-screen">…</div>` returned by `App` so it becomes the child of `<JarProvider>`. The new `return` statement looks like:

```jsx
  return (
    <JarProvider>
      <div className="flex flex-col min-h-screen">
        {/* …existing children unchanged… */}
      </div>
    </JarProvider>
  )
```

Do not modify any of the children inside the `<div>`.

- [ ] **Step 3: Lint**

Run from `frontend/`:
```bash
npm run lint
```
Expected: no new errors or warnings introduced by the two changed files.

- [ ] **Step 4: Manual smoke check**

Run from repo root:
```bash
npm run dev
```
Open `http://127.0.0.1:5173/`. Confirm:
- The page renders normally (header, cookie jar, points panel, footer).
- No console errors mentioning `useJar` or `JarContext`.
- Click the cookie a few times — points still increment.

Stop the dev server when satisfied.

- [ ] **Step 5: Commit**

Run:
```bash
git add frontend/src/contexts/JarContext.jsx frontend/src/App.jsx
git commit -m "$(cat <<'EOF'
feat(cookie-jar): add JarContext for cross-navigation open state

JarProvider holds an in-memory boolean. Resets on hard refresh,
survives CookieClicker unmount/remount during route changes.
Wrapped App's returned tree so all routes share the same provider.
EOF
)"
```

---

## Task 3: Group the lid meshes into a `THREE.Group` (no behavior change)

This is a pure refactor that pulls the five lid pieces (`dome`, `tube`, `rimRing`, `knobBase`, `knobBall`) into a single `THREE.Group` and consolidates lid disposal into one helper. No animation, no context wiring yet — the visual output and lifecycle are identical to current `main`.

**Files:**
- Modify: `frontend/src/components/CookieClicker.jsx`

- [ ] **Step 1: Build a `lidGroup` and add the five lid meshes to it**

In `frontend/src/components/CookieClicker.jsx`, locate the section that currently looks like (around the lines that build the dome, tube, rim ring, knob base, and knob ball — start of glass material at the line beginning `const glassMat = new THREE.MeshPhysicalMaterial({`):

Replace the block from `const glassMat = new THREE.MeshPhysicalMaterial({...})` through the line `scene.add(knobBall);` (the last lid `scene.add` call) with this exact block:

```jsx
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.04,
      transmission: 1.0,
      thickness: 0.35,
      ior: 1.5,
      attenuationColor: 0xfff0d6,
      attenuationDistance: 6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const DOME_R = 1.45;
    const TUBE_H = 0.9;
    const TUBE_BOTTOM_Y = -0.69;
    const TUBE_TOP_Y = TUBE_BOTTOM_Y + TUBE_H;

    const lidGroup = new THREE.Group();

    const domeGeo = new THREE.SphereGeometry(
      DOME_R,
      96,
      64,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const dome = new THREE.Mesh(domeGeo, glassMat);
    dome.position.y = TUBE_TOP_Y;
    dome.renderOrder = 2;
    lidGroup.add(dome);

    const tubeGeo = new THREE.CylinderGeometry(DOME_R, DOME_R, TUBE_H, 96, 1, true);
    const tube = new THREE.Mesh(tubeGeo, glassMat);
    tube.position.y = TUBE_BOTTOM_Y + TUBE_H / 2;
    tube.renderOrder = 2;
    lidGroup.add(tube);

    const rimRingGeo = new THREE.TorusGeometry(DOME_R, 0.045, 24, 96);
    const rimRing = new THREE.Mesh(rimRingGeo, glassMat);
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = TUBE_BOTTOM_Y;
    rimRing.renderOrder = 2;
    lidGroup.add(rimRing);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd9a35c,
      metalness: 1.0,
      roughness: 0.22,
    });
    const knobBaseGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.06, 32);
    const knobBase = new THREE.Mesh(knobBaseGeo, brassMat);
    knobBase.position.y = TUBE_TOP_Y + DOME_R + 0.03;
    lidGroup.add(knobBase);

    const knobBallGeo = new THREE.SphereGeometry(0.13, 48, 32);
    const knobBall = new THREE.Mesh(knobBallGeo, brassMat);
    knobBall.position.y = TUBE_TOP_Y + DOME_R + 0.16;
    lidGroup.add(knobBall);

    scene.add(lidGroup);

    const disposeLid = () => {
      domeGeo.dispose();
      tubeGeo.dispose();
      rimRingGeo.dispose();
      knobBaseGeo.dispose();
      knobBallGeo.dispose();
      glassMat.dispose();
      brassMat.dispose();
    };
    let lidDisposed = false;
```

The five `scene.add(...)` calls for dome / tube / rimRing / knobBase / knobBall are now `lidGroup.add(...)`, and there is exactly one new `scene.add(lidGroup)` at the end.

- [ ] **Step 2: Replace lid disposals in the cleanup function with a single call**

Locate the cleanup function returned from the `useEffect` (the block that begins with `return () => {`). Find these lines inside it and **delete** them:

```jsx
      domeGeo.dispose();
      tubeGeo.dispose();
      rimRingGeo.dispose();
      knobBaseGeo.dispose();
      knobBallGeo.dispose();
      glassMat.dispose();
      brassMat.dispose();
```

In their place, insert a single guarded call near the top of the cleanup body (above the other dispose calls is fine):

```jsx
      if (!lidDisposed) {
        disposeLid();
        lidDisposed = true;
      }
```

The other dispose calls (`pmrem`, `envMap`, `glowGeo`, `glowMat`, `plinthTopGeo`, `plinthBaseGeo`, `trimGeo`, `woodMat`, `woodDarkMat`, `brassDimMat`, `domeGeo`-style entries that we just removed, `renderer.dispose`) remain untouched except for the seven lid lines you just deleted.

- [ ] **Step 3: Lint**

Run from `frontend/`:
```bash
npm run lint
```
Expected: no new errors. If lint flags unused locals (e.g. `dome`, `tube`, `rimRing`, `knobBase`, `knobBall`), that's OK only if it was OK before — these were already used solely for `scene.add`. They are still used by `lidGroup.add`. If lint complains about something else, fix it before committing.

- [ ] **Step 4: Manual visual check**

Run from repo root:
```bash
npm run dev
```
Open `http://127.0.0.1:5173/`. Confirm:
- The jar looks identical to before — dome on top of tube, brass knob on top, rim ring at the bottom, sitting on the wooden plinth.
- The cookie wiggles inside.
- Clicking still increments points.
- Navigate to `/story` and back — no console errors, jar still renders.

Stop the dev server when satisfied.

- [ ] **Step 5: Commit**

Run:
```bash
git add frontend/src/components/CookieClicker.jsx
git commit -m "$(cat <<'EOF'
refactor(cookie-jar): group lid meshes into THREE.Group

Combine dome, tube, rim ring, and brass knob into a single
lidGroup and consolidate their disposal into disposeLid().
Pure refactor; no visual or lifecycle change. Sets up the
upcoming lift animation, which needs to translate/rotate
all five pieces in unison.
EOF
)"
```

---

## Task 4: Conditional build + lift-and-tilt animation on first click

This task wires `useJar()` into `CookieClicker`, skips lid construction when `open === true` on mount, and animates `lidGroup` over 800ms on first click.

**Files:**
- Modify: `frontend/src/components/CookieClicker.jsx`

- [ ] **Step 1: Import `useJar` and read it in the component**

In `frontend/src/components/CookieClicker.jsx`:

(a) Add this import alongside the others at the top of the file:

```jsx
import { useJar } from "../contexts/JarContext.jsx";
```

(b) Inside `CookieClicker()`, just below the existing `const { displayPoints, handleClick, isAuthenticated, displayName } = useCookieClicker();` line, add:

```jsx
  const { open, setOpen } = useJar();
  const lidCtxRef = useRef(null);
  const initialOpenRef = useRef(open);
```

`initialOpenRef` captures `open` once at first render so the scene-build effect (which runs once with `[]` deps) reads the value from mount-time. We keep `open` itself in scope so the click handler always sees the live value.

- [ ] **Step 2: Conditionally build the lid based on initial open state**

Locate the block you wrote in Task 3 starting `const glassMat = new THREE.MeshPhysicalMaterial({`. Replace that entire block — from `const glassMat = ...` through `let lidDisposed = false;` (inclusive) — with this exact block, which moves all lid construction inside an `if (!initialOpenRef.current)` guard and stores the lid context on `lidCtxRef`:

```jsx
    if (!initialOpenRef.current) {
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.04,
        transmission: 1.0,
        thickness: 0.35,
        ior: 1.5,
        attenuationColor: 0xfff0d6,
        attenuationDistance: 6,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        side: THREE.DoubleSide,
        transparent: true,
      });

      const DOME_R = 1.45;
      const TUBE_H = 0.9;
      const TUBE_BOTTOM_Y = -0.69;
      const TUBE_TOP_Y = TUBE_BOTTOM_Y + TUBE_H;

      const lidGroup = new THREE.Group();

      const domeGeo = new THREE.SphereGeometry(
        DOME_R,
        96,
        64,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      const dome = new THREE.Mesh(domeGeo, glassMat);
      dome.position.y = TUBE_TOP_Y;
      dome.renderOrder = 2;
      lidGroup.add(dome);

      const tubeGeo = new THREE.CylinderGeometry(DOME_R, DOME_R, TUBE_H, 96, 1, true);
      const tube = new THREE.Mesh(tubeGeo, glassMat);
      tube.position.y = TUBE_BOTTOM_Y + TUBE_H / 2;
      tube.renderOrder = 2;
      lidGroup.add(tube);

      const rimRingGeo = new THREE.TorusGeometry(DOME_R, 0.045, 24, 96);
      const rimRing = new THREE.Mesh(rimRingGeo, glassMat);
      rimRing.rotation.x = Math.PI / 2;
      rimRing.position.y = TUBE_BOTTOM_Y;
      rimRing.renderOrder = 2;
      lidGroup.add(rimRing);

      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xd9a35c,
        metalness: 1.0,
        roughness: 0.22,
      });
      const knobBaseGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.06, 32);
      const knobBase = new THREE.Mesh(knobBaseGeo, brassMat);
      knobBase.position.y = TUBE_TOP_Y + DOME_R + 0.03;
      lidGroup.add(knobBase);

      const knobBallGeo = new THREE.SphereGeometry(0.13, 48, 32);
      const knobBall = new THREE.Mesh(knobBallGeo, brassMat);
      knobBall.position.y = TUBE_TOP_Y + DOME_R + 0.16;
      lidGroup.add(knobBall);

      scene.add(lidGroup);

      const disposeLid = () => {
        domeGeo.dispose();
        tubeGeo.dispose();
        rimRingGeo.dispose();
        knobBaseGeo.dispose();
        knobBallGeo.dispose();
        glassMat.dispose();
        brassMat.dispose();
      };

      lidCtxRef.current = {
        group: lidGroup,
        dispose: disposeLid,
        animStart: null,
        disposed: false,
      };
    }
```

When `initialOpenRef.current === true`, the entire block is skipped — no lid resources are allocated and `lidCtxRef.current` stays at its initialized `null` from Task 4 Step 1.

- [ ] **Step 3: Drive the animation inside the existing rAF loop**

Locate the existing `animate` function:

```jsx
    const animate = (timestamp) => {
      frameId = requestAnimationFrame(animate);
      if (cookieModel) {
        const t = timestamp / 1000;
        cookieModel.rotation.y =
          Math.sin(t * Math.PI * wiggleFrequency) * wiggleAmplitudeY;
        cookieModel.rotation.z =
          Math.sin(t * Math.PI * 2 * wiggleFrequency) * wiggleAmplitudeZ;
      }
      renderer.render(scene, camera);
    };
```

Replace it with:

```jsx
    const LID_LIFT_DURATION_MS = 800;
    const LID_LIFT_Y = 3.5;
    const LID_TILT_Z = 0.4;
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

    const animate = (timestamp) => {
      frameId = requestAnimationFrame(animate);
      if (cookieModel) {
        const t = timestamp / 1000;
        cookieModel.rotation.y =
          Math.sin(t * Math.PI * wiggleFrequency) * wiggleAmplitudeY;
        cookieModel.rotation.z =
          Math.sin(t * Math.PI * 2 * wiggleFrequency) * wiggleAmplitudeZ;
      }
      const lidCtx = lidCtxRef.current;
      if (lidCtx && !lidCtx.disposed && lidCtx.animStart !== null) {
        const elapsed = timestamp - lidCtx.animStart;
        const progress = Math.min(elapsed / LID_LIFT_DURATION_MS, 1);
        const eased = easeOutCubic(progress);
        lidCtx.group.position.y = LID_LIFT_Y * eased;
        lidCtx.group.rotation.z = LID_TILT_Z * eased;
        if (progress >= 1) {
          scene.remove(lidCtx.group);
          lidCtx.dispose();
          lidCtx.disposed = true;
          lidCtx.animStart = null;
        }
      }
      renderer.render(scene, camera);
    };
```

- [ ] **Step 4: Update the cleanup to use the ref-tracked context**

In the same `useEffect`'s `return () => {…}` cleanup, replace the existing guarded lid-dispose block (the one you added in Task 3 that reads `if (!lidDisposed) { disposeLid(); lidDisposed = true; }`) with this version that reads the ref:

```jsx
      const lidCtx = lidCtxRef.current;
      if (lidCtx && !lidCtx.disposed) {
        lidCtx.dispose();
        lidCtx.disposed = true;
      }
      lidCtxRef.current = null;
```

If this block already reads `lidDisposed`/`disposeLid` from local-scope variables you kept around, the change above replaces both code paths (was-built and was-not-built) with one — the ref is `null` when the lid was never built, so the guard `if (lidCtx && ...)` covers both cases.

- [ ] **Step 5: Trigger the lift in the click handler**

Locate the existing handler:

```jsx
  const handleCookieClick = () => {
    handleClick();
  };
```

Replace with:

```jsx
  const handleCookieClick = () => {
    if (!open) {
      setOpen(true);
      const lidCtx = lidCtxRef.current;
      if (lidCtx && !lidCtx.disposed && lidCtx.animStart === null) {
        lidCtx.animStart = performance.now();
      }
    }
    handleClick();
  };
```

- [ ] **Step 6: Lint**

Run from `frontend/`:
```bash
npm run lint
```
Expected: no new errors. The `useEffect` still has `[]` deps; the `react-hooks/exhaustive-deps` rule may complain about reading `initialOpenRef`/`lidCtxRef`/`open`. Refs are exempt and `open` is read via `initialOpenRef` inside the effect — no real dependency on `open`. If the linter still flags it, add `// eslint-disable-next-line react-hooks/exhaustive-deps` immediately above the closing `}, []);` of that effect, with no other change. Do not add `open` to the deps array — that would cause the entire scene to rebuild whenever the jar opens.

- [ ] **Step 7: Manual verification — closed state and first lift**

Run from repo root:
```bash
npm run dev
```

Open `http://127.0.0.1:5173/` (use a fresh tab to ensure `open=false` initially).

Verify in order:

1. **Closed state:** the glass dome, tube, rim ring, and brass knob are visible over the cookie. Cookie wiggles.
2. **First click:** the lid rises smoothly upward AND tilts ~23° to one side over ~800ms, exiting the top of the canvas. The cookie continues wiggling on the wooden plinth. No console errors.
3. **Second click during animation** (rapidly click again before the 800ms ends): points still increment in the panel; the lift does not retrigger; the lid keeps animating its current arc.
4. **After animation:** only the wooden plinth + wiggling cookie remain. Subsequent clicks increment points normally.
5. **Cross-navigation persistence:** click "Story" or another nav link to leave `/`, then return to `/`. The jar should still be open (no lid). Clicking continues to increment points.
6. **Hard refresh** (Cmd-Shift-R / Ctrl-Shift-R): the lid returns. First click again triggers the lift.
7. **DevTools console** throughout the above: zero errors.

If the lid clips back into frame at the end of the lift, raise `LID_LIFT_Y` from `3.5` to `4.0` and retest.

Stop the dev server when satisfied.

- [ ] **Step 8: Commit**

Run:
```bash
git add frontend/src/components/CookieClicker.jsx
git commit -m "$(cat <<'EOF'
feat(cookie-jar): lift-and-tilt animation on first click

Read open/setOpen from JarContext. Skip building the lid group
when open is already true on mount (so navigating back to /
shows the already-opened state instantly). On first click,
flip open=true immediately and animate lidGroup over 800ms
with easeOutCubic: y 0->3.5, rotation.z 0->0.4 rad. After
the animation completes, remove from scene and dispose.
EOF
)"
```

---

## Task 5: Final verification pass

**Files:** none modified.

- [ ] **Step 1: Lint the whole frontend**

Run from `frontend/`:
```bash
npm run lint
```
Expected: clean (or no new findings beyond pre-existing baseline).

- [ ] **Step 2: Production build smoke test**

Run from `frontend/`:
```bash
npm run build
```
Expected: build completes without errors. Three.js bundles will be large; that's pre-existing.

- [ ] **Step 3: Confirm git history**

Run:
```bash
git log --oneline -6
```
Expected: four new commits on top of `main`:
1. `docs(cookie-jar): add design + implementation plan...`
2. `feat(cookie-jar): add JarContext for cross-navigation open state`
3. `refactor(cookie-jar): group lid meshes into THREE.Group`
4. `feat(cookie-jar): lift-and-tilt animation on first click`

- [ ] **Step 4: Final manual run-through**

`npm run dev` from repo root, then in a fresh tab walk through the verification list from Task 4 Step 7 once more. Report PASS/FAIL on each numbered item.

No commit on this task.
