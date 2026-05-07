import { useCookieClicker } from "../hooks/useCookieClicker.js";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import cookieModelUrl from "../threeDModels/Cookie3.glb?url";

export default function CookieClicker() {
  const { displayPoints, handleClick, isAuthenticated, displayName } =
    useCookieClicker();
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const heading = displayName ? `${displayName}'s bakery` : "Your bakery";

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

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.6, 6.2);
    camera.lookAt(0, 0.2, 0);

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

    const glowGeo = new THREE.CircleGeometry(2.4, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffc88a,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    const glowDisc = new THREE.Mesh(glowGeo, glowMat);
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = -1.05;
    scene.add(glowDisc);

    const plinthTopGeo = new THREE.CylinderGeometry(1.55, 1.6, 0.18, 96);
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6a4423,
      roughness: 0.65,
      metalness: 0.05,
    });
    const plinthTop = new THREE.Mesh(plinthTopGeo, woodMat);
    plinthTop.position.y = -0.78;
    scene.add(plinthTop);

    const plinthBaseGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.22, 96);
    const woodDarkMat = new THREE.MeshStandardMaterial({
      color: 0x432a14,
      roughness: 0.75,
      metalness: 0.05,
    });
    const plinthBase = new THREE.Mesh(plinthBaseGeo, woodDarkMat);
    plinthBase.position.y = -0.97;
    scene.add(plinthBase);

    const trimGeo = new THREE.TorusGeometry(1.55, 0.025, 16, 96);
    const brassDimMat = new THREE.MeshStandardMaterial({
      color: 0x8a6534,
      metalness: 1,
      roughness: 0.5,
    });
    const trim = new THREE.Mesh(trimGeo, brassDimMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.69;
    scene.add(trim);

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
    scene.add(dome);

    const tubeGeo = new THREE.CylinderGeometry(DOME_R, DOME_R, TUBE_H, 96, 1, true);
    const tube = new THREE.Mesh(tubeGeo, glassMat);
    tube.position.y = TUBE_BOTTOM_Y + TUBE_H / 2;
    tube.renderOrder = 2;
    scene.add(tube);

    const rimRingGeo = new THREE.TorusGeometry(DOME_R, 0.045, 24, 96);
    const rimRing = new THREE.Mesh(rimRingGeo, glassMat);
    rimRing.rotation.x = Math.PI / 2;
    rimRing.position.y = TUBE_BOTTOM_Y;
    rimRing.renderOrder = 2;
    scene.add(rimRing);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd9a35c,
      metalness: 1.0,
      roughness: 0.22,
    });
    const knobBaseGeo = new THREE.CylinderGeometry(0.13, 0.16, 0.06, 32);
    const knobBase = new THREE.Mesh(knobBaseGeo, brassMat);
    knobBase.position.y = TUBE_TOP_Y + DOME_R + 0.03;
    scene.add(knobBase);

    const knobBallGeo = new THREE.SphereGeometry(0.13, 48, 32);
    const knobBall = new THREE.Mesh(knobBallGeo, brassMat);
    knobBall.position.y = TUBE_TOP_Y + DOME_R + 0.16;
    scene.add(knobBall);

    let cookieModel = null;
    const COOKIE_SCALE = 10;
    const COOKIE_X = -0.1;
    const PLINTH_TOP_Y = -0.69;
    const COOKIE_LIFT = 0.04;

    const loader = new GLTFLoader();
    loader.load(
      cookieModelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(COOKIE_SCALE, COOKIE_SCALE, COOKIE_SCALE);
        model.rotation.x = Math.PI / 2;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        model.position.x = COOKIE_X;
        model.position.y = PLINTH_TOP_Y - box.min.y + COOKIE_LIFT;
        model.renderOrder = 1;
        scene.add(model);
        cookieModel = model;
      },
      undefined,
      (error) => {
        console.error("Failed to load cookie model:", error);
      },
    );

    const wiggleFrequency = 0.2;
    const wiggleAmplitudeY = 1; // radians
    const wiggleAmplitudeZ = 0.75; // radians

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
    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
      pmrem.dispose();
      envMap.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      plinthTopGeo.dispose();
      plinthBaseGeo.dispose();
      trimGeo.dispose();
      woodMat.dispose();
      woodDarkMat.dispose();
      brassDimMat.dispose();
      brassMat.dispose();
      domeGeo.dispose();
      tubeGeo.dispose();
      rimRingGeo.dispose();
      knobBaseGeo.dispose();
      knobBallGeo.dispose();
      glassMat.dispose();
      renderer.dispose();
    };
  }, []);

  const handleCookieClick = () => {
    handleClick();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,460px)_minmax(220px,300px)] justify-center gap-10 md:gap-50 items-center">
        <div
          ref={wrapperRef}
          className="relative w-full aspect-[1/1.15] max-w-[460px] mx-auto"
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full cursor-pointer transition-transform duration-100 ease-in-out hover:scale-105 active:animate-cookie-click"
            onClick={handleCookieClick}
          />
        </div>

        <div className="flex flex-col items-center md:items-start gap-8 text-center md:text-left pointer-events-auto">
          <div>
            <h2 className="text-3xl md:text-4xl text-ink">{heading}</h2>
            {!isAuthenticated && (
              <p className="text-xs text-muted mt-2 italic">
                Log in to save your points
              </p>
            )}
          </div>
          <div className="bg-surface px-8 py-6 rounded-lg border border-line shadow-card">
            <p className="text-6xl font-bold text-accent m-0 font-display">
              {displayPoints}
            </p>
            <p className="text-[0.9rem] text-muted mt-2 mb-0 uppercase tracking-[0.05em]">
              Points
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
