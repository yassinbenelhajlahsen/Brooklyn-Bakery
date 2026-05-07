# Cookie Jar Lift Animation — Design

## Summary

On the first cookie click in a tab session, the glass cookie jar (dome, tube, rim ring, brass knob) lifts up and tilts off-frame, leaving the wooden plinth and the wiggling cookie. The "open" state survives navigating away from `/` (e.g. to `/story`) and back. A hard refresh restores the jar to its closed state.

This is purely a visual change to `frontend/src/components/CookieClicker.jsx` plus a tiny shared piece of UI state. The points/click backend, the `useCookieClicker` hook, and the click-throttle behavior are untouched.

## Goals

- Reward the first click with a satisfying lift-and-tilt animation that reveals the cookie.
- Persist the "open" state across `CookieClicker` unmount/remount within the same tab session, so navigating away and back does not re-show the lid.
- Reset to the closed state on hard refresh / new tab.
- Keep points earning unaffected: every click still calls `handleClick()`, including during the animation.

## Non-goals

- No backend changes.
- No changes to `useCookieClicker.js` or the points system.
- No persistence across page reloads (no `localStorage` / `sessionStorage` for jar state).
- No sound, haptics, or particle effects.
- No close-the-jar mechanic.

## Architecture

### State: `JarContext`

A new module `frontend/src/contexts/JarContext.jsx` exports:

- `JarProvider` — React context provider that owns `const [open, setOpen] = useState(false)`.
- `useJar()` — hook returning `{ open, setOpen }`.

The context lives in memory only; no `localStorage` or `sessionStorage`. This gives exactly the lifecycle the feature needs:

- Hard refresh: provider remounts → state initializes to `false` → lid renders.
- Navigation within the tab: `App.jsx` (and the provider) stays mounted → state persists → lid stays hidden after the first click.

Why a Context over `@tanstack/react-query`: the query cache is for server state. Using it for a UI boolean works mechanically but is the wrong abstraction and would confuse readers.

Why a Context over prop-drilling from `App.jsx`: the prop would have to thread through `ShopEarnShell` → `EarnPage` → `CookieClicker`, two intermediate components that have no reason to know about the jar.

### Provider placement

In `App.jsx`, wrap the entire returned tree with `<JarProvider>` (outermost element inside `App`). The provider is cheap and lives for the whole tab session, so placing it at the top avoids any thinking about route boundaries.

### Component changes: `CookieClicker.jsx`

Read `{ open, setOpen }` from `useJar()`.

**Lid grouping.** Combine the five lid meshes (`dome`, `tube`, `rimRing`, `knobBase`, `knobBall`) into a single `THREE.Group` called `lidGroup`. Add `lidGroup` to the scene instead of adding the meshes individually. The group lets a single `position.y` / `rotation.z` change drive all five pieces in unison.

**Conditional build.** Inside the `useEffect` that builds the scene:

- If `open === true` on mount: skip building `lidGroup` entirely. Do not allocate the five lid geometries/materials. The cleanup function must not try to dispose them.
- If `open === false` on mount: build `lidGroup` and add to the scene as the closed jar.

**Click handler.** The existing `handleCookieClick` becomes:

```
const handleCookieClick = () => {
  if (!open) {
    setOpen(true);            // immediate — survives unmount mid-animation
    lidAnimStartRef.current = performance.now();
  }
  handleClick();              // unchanged: points always increment
};
```

`setOpen(true)` is called immediately so that if the user navigates away during the 800ms animation, the state is already saved. On return, the lid is simply not built — no half-finished animation to recover.

**Animation in the rAF loop.** The existing `animate(timestamp)` function gains a small block (only active while `lidAnimStartRef.current !== null`):

```
const DURATION = 800;
const LIFT_Y = 3.5;
const TILT_Z = 0.4;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// inside animate():
if (lidAnimStartRef.current !== null && lidGroup) {
  const elapsed = timestamp - lidAnimStartRef.current;
  const t = Math.min(elapsed / DURATION, 1);
  const p = easeOutCubic(t);
  lidGroup.position.y = LIFT_Y * p;
  lidGroup.rotation.z = TILT_Z * p;
  if (t >= 1) {
    scene.remove(lidGroup);
    disposeLid();
    lidAnimStartRef.current = null;
    lidDisposedRef.current = true;
  }
}
```

Cookie wiggle is unchanged and continues throughout the animation and after.

**Disposal.** Track lid disposal with `lidDisposedRef`. The existing cleanup function disposes all geometries/materials when the component unmounts. With the lid group, two additional cases exist:

1. `open === true` on mount → lid was never built. Cleanup must skip lid resources.
2. Lid finished animating and was already disposed. Cleanup must not double-dispose.

Implementation: introduce a `disposeLid()` helper that disposes the five geometries + the shared `glassMat`, guarded by `lidDisposedRef.current`. The `useEffect` cleanup calls it (no-op if already disposed or never built). The animation completion path also calls it.

The shared `glassMat` is currently used only by lid pieces (dome, tube, rimRing). If that remains true, dispose it inside `disposeLid()`. If a future change reuses `glassMat` outside the lid, this assumption needs revisiting.

### Camera/frustum check

Camera is at `(0, 0.6, 6.2)` with `fov: 38°` looking at `(0, 0.2, 0)`. The dome currently sits centered around `y ≈ TUBE_TOP_Y + DOME_R/2 ≈ 0.21 + 0.725 ≈ 0.94`. Lifting `lidGroup` by `+3.5` puts the dome center at `y ≈ 4.44`, which is well above the visible frustum at that distance. The 0.4 rad tilt does not push any vertex back into frame because the lid's silhouette is already off-screen by then. If during implementation the lift visibly clips, increase `LIFT_Y` to 4.0 — this is a tunable, not a load-bearing number.

## Data flow

```
App.jsx
  └─ JarProvider  (owns useState<boolean>)
       └─ Routes
            └─ ShopEarnShell  (passes through, unaware of jar)
                 └─ EarnPage
                      └─ CookieClicker
                           ├─ useJar() → { open, setOpen }
                           ├─ useCookieClicker() → { handleClick, displayPoints, ... }   // unchanged
                           └─ Three.js scene reads `open` once at mount to decide whether
                              to build lidGroup; click handler calls setOpen(true) once.
```

The Three.js scene effect has `[]` dependencies today and should keep `[]` dependencies. We read `open` only at mount-time to decide whether to build the lid; the animation is driven by a ref, not state, so no re-runs of the scene-build effect are needed. Treat the `open` value captured at mount as the source of truth for "should the lid exist in this scene"; subsequent toggles are handled by the click handler within the same mount.

## Error handling / edge cases

- **Click during animation.** The animation runs for ~800ms. Additional clicks in that window: `open` is already `true`, so the conditional in `handleCookieClick` is skipped and only `handleClick()` runs. Points still register. The lift is not retriggered.
- **Unmount mid-animation.** `cancelAnimationFrame(frameId)` already runs in cleanup. `setOpen(true)` already fired on the click that started the animation, so on remount the lid is not rebuilt. The half-lifted lid simply disappears with the unmount, which is acceptable.
- **Logout / login.** Auth changes do not affect jar state. The provider sits above auth-aware components and the jar is purely cosmetic.
- **`displayName` change.** Heading updates as before; jar state is independent.
- **Slow GLB load.** The cookie model loads asynchronously. The lid animation is independent of the cookie load — clicking before the cookie has loaded still triggers the lift; the cookie pops in when ready.

## Testing / verification

The frontend has no test suite (per `CLAUDE.md`). Verification is manual:

1. `npm run dev` from repo root.
2. Hard refresh `/`. Confirm jar is closed (dome + tube + knob visible over the cookie).
3. Click the jar once. Confirm: lid lifts, tilts ~23° to one side, drifts off the top of the canvas over ~800ms; the wooden plinth and wiggling cookie remain.
4. Click rapidly during the animation. Confirm: points still increment via the existing UI; no second lift triggers; no console errors.
5. Navigate to `/story`, then back to `/`. Confirm: jar stays open (no lid rebuilt).
6. Hard refresh. Confirm: jar is closed again.
7. Open DevTools → Performance / memory: navigate away and back several times after opening the jar. Confirm no leaked Three.js resources (geometries/materials count stable).
8. Run `npm run lint` from `frontend/`. No new warnings.

## File touch list

- **New** `frontend/src/contexts/JarContext.jsx` — provider + hook (~25 lines).
- **Modified** `frontend/src/App.jsx` — wrap tree with `<JarProvider>`.
- **Modified** `frontend/src/components/CookieClicker.jsx` — consume context, group lid, animate, conditional build/dispose.

No other files change. No backend changes. No `package.json` changes (Three.js, React, and Vite are already present).
