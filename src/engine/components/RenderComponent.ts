import { Component } from '../core/Component'
import { Object3D, Mesh, MeshStandardMaterial } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export class RenderComponent extends Component {
  private model: Object3D | null = null
  private loader: GLTFLoader
  private material: MeshStandardMaterial | null = null

  constructor() {
    super()
    this.loader = new GLTFLoader()
  }

  public async loadModel(url: string): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(url)
      this.model = gltf.scene
      if (this.entity) {
        (this.entity as any).add(this.model)
      }
    } catch (error) {
      console.error('Failed to load model:', error)
    }
  }

  public setMaterial(material: MeshStandardMaterial): void {
    this.material = material
    if (this.model) {
      this.model.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          (child as Mesh).material = material
        }
      })
    }
  }

  public update(delta: number): void {
    // Model updates can be handled here if needed
  }

  public dispose(): void {
    if (this.model && this.entity) {
      (this.entity as any).remove(this.model)
      this.model = null
    }
  }
} 