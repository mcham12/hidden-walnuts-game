import { Scene, WebGLRenderer, PerspectiveCamera, Clock } from 'three'

export class Engine {
  private scene: Scene | null = null
  private renderer: WebGLRenderer
  private camera: PerspectiveCamera
  private clock: Clock
  private isRunning: boolean = false

  constructor() {
    // Initialize Three.js components
    this.scene = new Scene()
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.renderer = new WebGLRenderer({ antialias: true })
    this.clock = new Clock()

    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    document.body.appendChild(this.renderer.domElement)

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this))
  }

  public setScene(scene: Scene): void {
    this.scene = scene
  }

  public start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.clock.start()
    this.gameLoop()
  }

  public stop(): void {
    this.isRunning = false
    this.clock.stop()
  }

  private gameLoop(): void {
    if (!this.isRunning || !this.scene) return

    const delta = this.clock.getDelta()
    
    // Update game state
    // TODO: Add update logic for game objects

    // Render the scene
    this.renderer.render(this.scene, this.camera)

    // Continue the game loop
    requestAnimationFrame(this.gameLoop.bind(this))
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
} 