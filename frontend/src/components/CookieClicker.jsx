import { useCookieClicker } from '../hooks/useCookieClicker.js'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import cookieModelUrl from '../3dModels/Cookie3.glb?url'

export default function CookieClicker() {
  const { displayPoints, handleClick, isAuthenticated, displayName } = useCookieClicker()
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const modelRef = useRef(null)
  const heading = displayName ? `${displayName}'s bakery` : 'Your bakery'

  useEffect(() => {
    if (!canvasRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = null
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, 400 / 400, 0.1, 1000)
    camera.position.z = 3

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.current, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(window.devicePixelRatio)
    rendererRef.current = renderer

    const resizeCanvas = () => {
      if (!wrapperRef.current) return
      const { width, height } = wrapperRef.current.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    resizeCanvas()

    // Lighting
    const directionalLight = new THREE.DirectionalLight("white", 1)
    directionalLight.position.set(5, 5, 5)
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight("white", 1)
    scene.add(ambientLight)

    // Load 3D model
    const loader = new GLTFLoader()
    loader.load(
      cookieModelUrl,
      (gltf) => {
        const model = gltf.scene
        model.scale.set(18, 18, 18)
        model.rotation.x = Math.PI / 2
        scene.add(model)
        modelRef.current = model
      },
      undefined,
      (error) => {
        console.error('Failed to load cookie model:', error)
      }
    )

    const wiggleFrequency = 0.2
    const wiggleAmplitudeY = 1 // radians
    const wiggleAmplitudeZ = 0.75 // radians

    // Animation loop
    const animate = (timestamp) => {
      requestAnimationFrame(animate)

      if (modelRef.current) {
        const elapsedSeconds = timestamp / 1000
        modelRef.current.rotation.y = Math.sin(elapsedSeconds * Math.PI * 1 * wiggleFrequency) * wiggleAmplitudeY
        modelRef.current.rotation.z = Math.sin(elapsedSeconds * Math.PI * 2 * wiggleFrequency) * wiggleAmplitudeZ
      }

      renderer.render(scene, camera)
    }
    requestAnimationFrame(animate)

    // Handle window resize
    const handleResize = () => resizeCanvas()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, [])

  const handleCookieClick = () => {
    handleClick()
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="flex flex-col items-center justify-center gap-8 mb-8 pointer-events-auto text-center">
        <div>
          <h2 className="text-2xl text-ink">{heading}</h2>
          {!isAuthenticated && (
            <p className="text-xs text-muted mt-2 italic">Log in to save your points</p>
          )}
        </div>
        <div className="bg-surface p-6 rounded-lg border border-line shadow-card">
          <p className="text-5xl font-bold text-accent m-0 font-display">{displayPoints}</p>
          <p className="text-[0.9rem] text-muted mt-2 mb-0 uppercase tracking-[0.05em]">Points</p>
        </div>
      </div>

      <div ref={wrapperRef} className="relative w-full aspect-square">
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-pointer transition-transform duration-100 ease-in-out hover:scale-105 active:animate-cookie-click"
          onClick={handleCookieClick}
        />
      </div>
    </div>
  )
}
