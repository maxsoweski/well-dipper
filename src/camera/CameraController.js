import * as THREE from 'three';

/**
 * Handles mouse-look camera rotation.
 *
 * How it works: tracks the mouse position relative to the center of the screen,
 * then gently rotates the camera toward where the mouse is pointing.
 * The rotation is smoothed (interpolated) so it feels dreamy, not twitchy.
 */
export class CameraController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    // Mouse position as -1 to +1 range (0,0 = center of screen)
    this.mouseX = 0;
    this.mouseY = 0;

    // How much the mouse influences the camera (lower = more subtle)
    this.sensitivity = 0.3;

    // The current rotation offset (smoothly interpolated toward target)
    this.currentRotX = 0;
    this.currentRotY = 0;

    // How fast the camera catches up to the mouse (lower = smoother/dreamier)
    this.smoothing = 0.03;

    // Base rotation — the camera's "resting" orientation that it drifts around
    this.baseEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    // Slow auto-rotation so the view drifts even without mouse input
    this.autoRotateSpeed = 0.02; // degrees per second
    this.autoRotateAngle = 0;

    this._setupListeners();
  }

  _setupListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      // Convert mouse pixel position to -1..+1 range
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  /**
   * Call every frame with delta time (seconds since last frame).
   */
  update(deltaTime) {
    // Target rotation based on mouse position
    const targetRotY = -this.mouseX * this.sensitivity;
    const targetRotX = -this.mouseY * this.sensitivity;

    // Smoothly interpolate toward target (lerp)
    this.currentRotX += (targetRotX - this.currentRotX) * this.smoothing;
    this.currentRotY += (targetRotY - this.currentRotY) * this.smoothing;

    // Add slow auto-rotation so it feels alive even without mouse movement
    this.autoRotateAngle += this.autoRotateSpeed * deltaTime;

    // Apply rotations to camera
    // YXZ order: yaw (left/right) first, then pitch (up/down)
    this.camera.rotation.set(
      this.currentRotX,
      this.currentRotY + this.autoRotateAngle * (Math.PI / 180),
      0,
      'YXZ'
    );
  }
}
