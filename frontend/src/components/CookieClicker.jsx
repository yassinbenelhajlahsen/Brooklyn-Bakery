import { useCookieClicker } from "../hooks/useCookieClicker.js";
import { useJar } from "../contexts/JarContext.jsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import cookieModelUrl from "../threeDModels/Cookie3.glb?url";
import glove0Url from "../assets/glove0.svg";
import glove1Url from "../assets/glove1.svg";
import glove2Url from "../assets/glove2.svg";
import glove3Url from "../assets/glove3.svg";

/** Same thresholds / ids as `backend/controllers/cookieUpgradesController.js` — unlocks are derived locally from points (no round-trip on each change). */
const COOKIE_CURSOR_OPTIONS = [
  {
    id: "base",
    threshold: 0,
    label: "1+ pt per click",
    description: "Default glove",
    cursorUrl: glove0Url,
    pointsNumerator: 1,
    pointsDenominator: 1,
    accentColor: "#9aa19c",
    burstTier: 1,
  },
  {
    id: "one_half_points",
    threshold: 15,
    label: "1.5+ pts per click",
    description: "1.5× points per click",
    cursorUrl: glove1Url,
    pointsNumerator: 3,
    pointsDenominator: 2,
    accentColor: "#46d27a",
    burstTier: 2,
  },
  {
    id: "double_points",
    threshold: 25,
    label: "2+ pts per click",
    description: "2× points per click",
    cursorUrl: glove2Url,
    pointsNumerator: 2,
    pointsDenominator: 1,
    accentColor: "#3a7df5",
    burstTier: 3,
  },
  {
    id: "triple_points",
    threshold: 50,
    label: "3+ pts per click",
    description: "3× points per click",
    cursorUrl: glove3Url,
    pointsNumerator: 3,
    pointsDenominator: 1,
    accentColor: "#ff7a1f",
    burstTier: 4,
  },
];

const BURST_LIFETIME_MS = 700;

const BURST_KEYFRAMES = `
@keyframes bb-burst-ring { 0% { transform: scale(0.2); opacity: 0.95; } 100% { transform: scale(0.8); opacity: 0; } }
@keyframes bb-burst-flash { 0% { transform: scale(0.4); opacity: 0.9; } 100% { transform: scale(1.2); opacity: 0; } }
@keyframes bb-burst-spark { 0% { transform: rotate(var(--bb-angle)) translateY(0) scale(1); opacity: 1; } 100% { transform: rotate(var(--bb-angle)) translateY(calc(var(--bb-spark-distance) * -1)) scale(0.4); opacity: 0; } }
.bb-burst { position: absolute; pointer-events: none; will-change: transform, opacity; }
.bb-burst-ring { position: absolute; left: 0; top: 0; width: var(--bb-size); height: var(--bb-size); border: 2px solid var(--bb-color); border-radius: 50%; animation: bb-burst-ring var(--bb-duration) cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.bb-burst-flash { position: absolute; left: 0; top: 0; width: calc(var(--bb-size) * 0.7); height: calc(var(--bb-size) * 0.7); background: radial-gradient(circle, var(--bb-color) 0%, transparent 65%); filter: blur(2px); animation: bb-burst-flash calc(var(--bb-duration) * 0.55) ease-out forwards; }
.bb-burst-spark { position: absolute; left: 0; top: 0; width: 3px; height: var(--bb-spark-length); background: var(--bb-color); border-radius: 2px; box-shadow: 0 0 6px var(--bb-color); animation: bb-burst-spark var(--bb-duration) cubic-bezier(0.22, 1, 0.36, 1) forwards; }
`;

const CURSOR_STORAGE_PREFIX = "bb:cookieCursorChoice:";

/** Returns null while logged-in but profile id is not ready yet (avoid reading guest prefs). */
function storageKeyForCursorChoice(profileId, isAuthenticated) {
  if (!isAuthenticated) return `${CURSOR_STORAGE_PREFIX}guest`;
  if (!profileId) return null;
  return `${CURSOR_STORAGE_PREFIX}${profileId}`;
}

function readStoredCursorChoice(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const found = COOKIE_CURSOR_OPTIONS.some((o) => o.id === raw);
    return found ? raw : null;
  } catch {
    console.trace("failed to read stored cursor choice");
    return null;
  }
}

function writeStoredCursorChoice(key, optionId) {
  try {
    localStorage.setItem(key, optionId);
  } catch {
    console.trace("failed to write stored cursor choice")// localStorage unavailable (Safari private mode) — preference is in-memory only.
  }
}

export default function CookieClicker() {
  const pointsRuleRef = useRef({ num: 1, den: 1 });
  const { displayPoints, handleClick, isAuthenticated, displayName, loading, profile } = useCookieClicker(pointsRuleRef);
  const { open, setOpen } = useJar();
  const lidCtxRef = useRef(null);
  const plinthCtxRef = useRef(null);
  const cookieAnimRef = useRef(null);
  const openTriggeredRef = useRef(false);
  const initialOpenRef = useRef(open);
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const heading = displayName ? `${displayName}'s bakery` : "Your bakery";

  const storageKey = storageKeyForCursorChoice(profile?.id, isAuthenticated);

  const [cursorMenuTick, setCursorMenuTick] = useState(0);
  const [bursts, setBursts] = useState([]);
  const burstIdRef = useRef(0);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const cookieModelRef = useRef(null);
  const debrisRef = useRef([]);

  const selectedOptionId = useMemo(() => {
    void cursorMenuTick;
    const unlocked = COOKIE_CURSOR_OPTIONS.filter((o) => displayPoints >= o.threshold);
    const unlockedSet = new Set(unlocked.map((o) => o.id));
    const stored = storageKey != null ? readStoredCursorChoice(storageKey) : null;
    let pick =
      stored && unlockedSet.has(stored)
        ? stored
        : "base";
    if (!unlockedSet.has(pick)) {
      pick = unlocked[unlocked.length - 1]?.id ?? "base";
    }
    return pick;
  }, [displayPoints, storageKey, cursorMenuTick]);

  const selectedOption =
    COOKIE_CURSOR_OPTIONS.find((o) => o.id === selectedOptionId) ??
    COOKIE_CURSOR_OPTIONS[0];

  const pointsRule = useMemo(
    () => ({
      num: selectedOption.pointsNumerator,
      den: selectedOption.pointsDenominator,
    }),
    [selectedOption],
  );

  useLayoutEffect(() => {
    pointsRuleRef.current = pointsRule;
  }, [pointsRule]);

  // Cursor URL must be wrapped in double quotes: Vite inlines small SVGs as
  // data URIs with single-quoted attributes (width='48' …), which would
  // prematurely close a single-quoted url('…') and invalidate the declaration.
  const cursorCss = `.bb-cookie-cursor, .bb-cookie-cursor canvas { cursor: url("${selectedOption.cursorUrl}") 16 11, pointer !important; }${BURST_KEYFRAMES}`;

  const selectCursorOption = (optionId) => {
    const opt = COOKIE_CURSOR_OPTIONS.find((o) => o.id === optionId);
    if (!opt || displayPoints < opt.threshold) return;
    if (storageKey != null) writeStoredCursorChoice(storageKey, optionId);
    setCursorMenuTick((t) => t + 1);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    let frameId = 0;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas,
      alpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.6, 6.2);
    camera.lookAt(0, 0.2, 0);
    cameraRef.current = camera;

    const resize = () => {
      if (!wrapper) return;
      const { width, height } = wrapper.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new RoomEnvironment(renderer);
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;

    const keyLight = new THREE.SpotLight(
      "#fff5e0",
      12,
      18,
      Math.PI / 5,
      0.55,
      1.6,
    );
    keyLight.position.set(2.5, 5, 5);
    keyLight.target.position.set(0, 0, 0);
    scene.add(keyLight);
    scene.add(keyLight.target);

    const rimLight = new THREE.DirectionalLight("#b08858", 0.7);
    rimLight.position.set(-4, 1.5, -3);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight("#fff0d8", 0.4);
    fillLight.position.set(3, -2, 2);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight("#fdf7f0", 0.55);
    scene.add(ambient);

    if (!initialOpenRef.current) {
      const plinthTopGeo = new THREE.CylinderGeometry(1.55, 1.6, 0.18, 96);
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0x6a4423,
        roughness: 0.65,
        metalness: 0.05,
      });
      const plinthTop = new THREE.Mesh(plinthTopGeo, woodMat);
      plinthTop.position.y = -0.78;

      const plinthBaseGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.22, 96);
      const woodDarkMat = new THREE.MeshStandardMaterial({
        color: 0x432a14,
        roughness: 0.75,
        metalness: 0.05,
      });
      const plinthBase = new THREE.Mesh(plinthBaseGeo, woodDarkMat);
      plinthBase.position.y = -0.97;

      const trimGeo = new THREE.TorusGeometry(1.55, 0.025, 16, 96);
      const brassDimMat = new THREE.MeshStandardMaterial({
        color: 0x8a6534,
        metalness: 1,
        roughness: 0.5,
      });
      const trim = new THREE.Mesh(trimGeo, brassDimMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = -0.69;

      const plinthGroup = new THREE.Group();
      plinthGroup.add(plinthTop);
      plinthGroup.add(plinthBase);
      plinthGroup.add(trim);
      scene.add(plinthGroup);

      const disposePlinth = () => {
        plinthTopGeo.dispose();
        plinthBaseGeo.dispose();
        trimGeo.dispose();
        woodMat.dispose();
        woodDarkMat.dispose();
        brassDimMat.dispose();
      };

      plinthCtxRef.current = {
        group: plinthGroup,
        dispose: disposePlinth,
        animStart: null,
        disposed: false,
      };
    }

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

    let cookieModel = null;
    const COOKIE_CLOSED_SCALE = 10;
    const COOKIE_OPEN_SCALE = 20;
    const COOKIE_X = -0.1;
    const PLINTH_TOP_Y = -0.69;
    const COOKIE_LIFT = 0.04;
    const CAMERA_LOOK_Y = 0.2;

    const loader = new GLTFLoader();
    loader.load(
      cookieModelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.rotation.x = Math.PI / 2;
        model.scale.set(1, 1, 1);
        model.updateMatrixWorld(true);
        const baseBox = new THREE.Box3().setFromObject(model);

        const closedY =
          PLINTH_TOP_Y - baseBox.min.y * COOKIE_CLOSED_SCALE + COOKIE_LIFT;
        const openY =
          CAMERA_LOOK_Y -
          ((baseBox.min.y + baseBox.max.y) / 2) * COOKIE_OPEN_SCALE;

        const startOpen = initialOpenRef.current || openTriggeredRef.current;
        const initialScale = startOpen ? COOKIE_OPEN_SCALE : COOKIE_CLOSED_SCALE;
        const initialY = startOpen ? openY : closedY;

        model.scale.set(initialScale, initialScale, initialScale);
        model.position.x = COOKIE_X;
        model.position.y = initialY;
        model.renderOrder = 1;
        scene.add(model);
        cookieModel = model;
        cookieModelRef.current = model;
        cookieAnimRef.current = {
          closedScale: COOKIE_CLOSED_SCALE,
          openScale: COOKIE_OPEN_SCALE,
          closedY,
          openY,
          animStart: null,
        };
      },
      undefined,
      (error) => {
        console.error("Failed to load cookie model:", error);
      },
    );

    const wiggleFrequency = 0.2;
    const wiggleAmplitudeY = 1; // radians
    const wiggleAmplitudeZ = 0.75; // radians

    const LID_LIFT_DURATION_MS = 900;
    const LID_LIFT_Y = 8.0;
    const LID_TILT_Z = 0.4;
    const PLINTH_DROP_DURATION_MS = 900;
    const PLINTH_DROP_Y = -5.0;
    const COOKIE_GROW_DURATION_MS = 700;
    const COOKIE_GROW_DELAY_MS = 200;
    const easeInQuad = (x) => x * x;
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

    const DEBRIS_GRAVITY = 9.81;

    const animate = (timestamp) => {
      frameId = requestAnimationFrame(animate);

      if (debrisRef.current.length > 0) {
        debrisRef.current = debrisRef.current.filter((d) => {
          const t = (timestamp - d.startTime) / 1000;
          if (t >= d.lifetime) {
            scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            d.mesh.material.dispose();
            return false;
          }
          d.mesh.position.x = d.spawnPos.x + d.velocity.x * t;
          d.mesh.position.y = d.spawnPos.y + d.velocity.y * t - 0.5 * DEBRIS_GRAVITY * t * t;
          d.mesh.position.z = d.spawnPos.z + d.velocity.z * t;
          d.mesh.rotation.x = d.initRotation.x + d.angularVel.x * t;
          d.mesh.rotation.y = d.initRotation.y + d.angularVel.y * t;
          d.mesh.rotation.z = d.initRotation.z + d.angularVel.z * t;
          d.mesh.material.opacity = Math.max(0, 1 - t / d.lifetime);
          return true;
        });
      }

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
        const eased = easeInQuad(progress);
        lidCtx.group.position.y = LID_LIFT_Y * eased;
        lidCtx.group.rotation.z = LID_TILT_Z * eased;
        if (progress >= 1) {
          scene.remove(lidCtx.group);
          lidCtx.dispose();
          lidCtx.disposed = true;
          lidCtx.animStart = null;
          lidCtxRef.current = null;
        }
      }

      const plinthCtx = plinthCtxRef.current;
      if (plinthCtx && !plinthCtx.disposed && plinthCtx.animStart !== null) {
        const elapsed = timestamp - plinthCtx.animStart;
        const progress = Math.min(elapsed / PLINTH_DROP_DURATION_MS, 1);
        const eased = easeInQuad(progress);
        plinthCtx.group.position.y = PLINTH_DROP_Y * eased;
        if (progress >= 1) {
          scene.remove(plinthCtx.group);
          plinthCtx.dispose();
          plinthCtx.disposed = true;
          plinthCtx.animStart = null;
          plinthCtxRef.current = null;
        }
      }

      const cookieAnim = cookieAnimRef.current;
      if (cookieModel && cookieAnim && cookieAnim.animStart !== null) {
        const elapsed =
          timestamp - cookieAnim.animStart - COOKIE_GROW_DELAY_MS;
        if (elapsed > 0) {
          const progress = Math.min(elapsed / COOKIE_GROW_DURATION_MS, 1);
          const eased = easeOutCubic(progress);
          const s =
            cookieAnim.closedScale +
            (cookieAnim.openScale - cookieAnim.closedScale) * eased;
          cookieModel.scale.set(s, s, s);
          cookieModel.position.y =
            cookieAnim.closedY +
            (cookieAnim.openY - cookieAnim.closedY) * eased;
          if (progress >= 1) {
            cookieAnim.animStart = null;
          }
        }
      }

      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
      pmrem.dispose();
      envMap.dispose();
      const lidCtx = lidCtxRef.current;
      if (lidCtx && !lidCtx.disposed) {
        lidCtx.dispose();
        lidCtx.disposed = true;
      }
      lidCtxRef.current = null;
      const plinthCtx = plinthCtxRef.current;
      if (plinthCtx && !plinthCtx.disposed) {
        plinthCtx.dispose();
        plinthCtx.disposed = true;
      }
      plinthCtxRef.current = null;
      cookieAnimRef.current = null;
      cookieModelRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      debrisRef.current.forEach((d) => {
        scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
      });
      debrisRef.current = [];
      renderer.dispose();
    };
  }, []);

  const COOKIE_DEBRIS_COLORS = [0xc8864a, 0xd4935a, 0xb07030, 0x8b5a2b, 0x7a4e24, 0x3d2b1f, 0xe8c090];

  const spawnCookieDebris = (event) => {
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const model = cookieModelRef.current;
    const wrapper = wrapperRef.current;
    if (!camera || !scene || !model || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const intersects = raycaster.intersectObject(model, true);
    if (intersects.length === 0) return;

    const hit = intersects[0];
    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    const spawnPos = hit.point.clone().addScaledVector(worldNormal, 0.06);

    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const color = COOKIE_DEBRIS_COLORS[Math.floor(Math.random() * COOKIE_DEBRIS_COLORS.length)];
      const size = 0.07 + Math.random() * 0.09;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 1,
        roughness: 0.85,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(spawnPos);
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      scene.add(mesh);

      // speed at which the crumbs come flying out of cookie
      const speed = 1.0 + Math.random() * 2.5;
      const spread = 2.8;
      debrisRef.current.push({
        mesh,
        spawnPos: spawnPos.clone(),
        velocity: {
          x: worldNormal.x * speed + (Math.random() - 0.5) * spread,
          y: worldNormal.y * speed + (Math.random() - 0.5) * spread + 1.2,
          z: worldNormal.z * speed + (Math.random() - 0.5) * spread,
        },
        initRotation: { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z },
        angularVel: {
          x: (Math.random() - 0.5) * 12,
          y: (Math.random() - 0.5) * 12,
          z: (Math.random() - 0.5) * 12,
        },
        startTime: performance.now(),
        lifetime: 1.1 + Math.random() * 0.2,
      });
    }
  };

  const spawnBurst = (event) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = ++burstIdRef.current;
    const tier = selectedOption.burstTier;
    const burst = {
      id,
      x,
      y,
      color: selectedOption.accentColor,
      tier,
      sparkCount: 4 + tier * 2,
      size: 70 + tier * 26,
      sparkLength: 12 + tier * 4,
      sparkDistance: 28 + tier * 14,
    };
    setBursts((prev) => [...prev, burst]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, BURST_LIFETIME_MS);
  };

  const handleCookieClick = (event) => {
    if (!open) {
      setOpen(true);
      openTriggeredRef.current = true;
      const now = performance.now();
      const lidCtx = lidCtxRef.current;
      if (lidCtx && !lidCtx.disposed && lidCtx.animStart === null) {
        lidCtx.animStart = now;
      }
      const plinthCtx = plinthCtxRef.current;
      if (plinthCtx && !plinthCtx.disposed && plinthCtx.animStart === null) {
        plinthCtx.animStart = now;
      }
      const cookieAnim = cookieAnimRef.current;
      if (cookieAnim && cookieAnim.animStart === null) {
        cookieAnim.animStart = now;
      }
    }
    spawnCookieDebris(event);
    spawnBurst(event)
    handleClick();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,460px)_minmax(260px,320px)] justify-center gap-10 md:gap-40 items-start md:items-center">
        <style>{cursorCss}</style>
        <div
          ref={wrapperRef}
          className="bb-cookie-cursor relative w-full aspect-[1/1.15] max-w-[460px] mx-auto"
          data-bb-debug="cursor-wrapper-v3"
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full transition-transform duration-100 ease-in-out hover:scale-105 active:animate-cookie-click"
            onClick={handleCookieClick}
          />
          <div className="pointer-events-none absolute inset-0 overflow-visible">
            {bursts.map((b) => (
              <div
                key={b.id}
                className="bb-burst"
                style={{
                  left: `${b.x}px`,
                  top: `${b.y}px`,
                  "--bb-color": b.color,
                  "--bb-size": `${b.size}px`,
                  "--bb-spark-length": `${b.sparkLength}px`,
                  "--bb-spark-distance": `${b.sparkDistance}px`,
                  "--bb-duration": `${BURST_LIFETIME_MS}ms`,
                }}
              >
                <div
                  className="bb-burst-flash"
                  style={{
                    marginLeft: `calc(var(--bb-size) * -0.35)`,
                    marginTop: `calc(var(--bb-size) * -0.35)`,
                  }}
                />
                <div
                  className="bb-burst-ring"
                  style={{
                    marginLeft: `calc(var(--bb-size) * -0.5)`,
                    marginTop: `calc(var(--bb-size) * -0.5)`,
                  }}
                />
                {Array.from({ length: b.sparkCount }).map((_, i) => (
                  <div
                    key={i}
                    className="bb-burst-spark"
                    style={{
                      marginLeft: "-1.5px",
                      marginTop: `calc(var(--bb-spark-length) * -0.5)`,
                      "--bb-angle": `${(360 / b.sparkCount) * i}deg`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center md:items-start gap-8 text-center md:text-left pointer-events-auto">
          <div className="min-h-[3.75rem] md:min-h-[4.5rem] flex flex-col justify-center">
            {loading ? (
              <div className="h-8 md:h-10 w-56 rounded bg-line/60 animate-pulse" />
            ) : (
              <>
                <h2 className="text-3xl md:text-4xl text-ink">{heading}</h2>
                {!isAuthenticated && (
                  <p className="text-xs text-muted mt-2 italic">
                    Log in to save your points
                  </p>
                )}
              </>
            )}
          </div>
          <div className="bg-surface px-8 py-6 rounded-lg border border-line shadow-card">
            {loading ? (
              <div className="h-[3.75rem] w-28 rounded bg-line/60 animate-pulse" />
            ) : (
              <p className="text-6xl font-bold text-accent m-0 font-display">
                {displayPoints}
              </p>
            )}
            <p className="text-[0.9rem] text-muted mt-2 mb-0 uppercase tracking-[0.05em]">
              Points
            </p>
          </div>

          <div className="w-full max-w-[280px] bg-surface rounded-lg border border-line shadow-card p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted m-0 mb-1">
              UPGRADES
            </p>
            <p className="text-sm text-ink/80 m-0 mb-3">
              Earn more points the more you click!
            </p>
            <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
              {COOKIE_CURSOR_OPTIONS.map((opt) => {
                const unlocked = displayPoints >= opt.threshold;
                const active = opt.id === selectedOptionId;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => selectCursorOption(opt.id)}
                      className={[
                        "w-full text-left rounded-md px-3 py-2 text-sm transition-colors border",
                        unlocked
                          ? active
                            ? "border-accent bg-accent/10 text-ink font-medium"
                            : "border-transparent bg-line/25 text-ink hover:bg-line/40"
                          : "border-transparent bg-line/10 text-muted cursor-not-allowed opacity-70",
                      ].join(" ")}
                    >
                      <span className="block">{opt.label}</span>
                      <span className="block text-[0.75rem] text-muted font-normal mt-0.5">
                        {unlocked
                          ? opt.description
                          : `Unlock at ${opt.threshold} pts`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
