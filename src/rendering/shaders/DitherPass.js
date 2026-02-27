/**
 * DitherPass — Post-processing shader that applies:
 *
 * 1. Ordered dithering using an 8×8 Bayer matrix
 * 2. Color posterization to 15-bit color (32 levels per channel)
 *
 * This is what makes the final image look like a PS1/Saturn game.
 * The Bayer matrix adds a subtle pattern that simulates extra colors
 * by mixing neighboring pixels — the same trick the PS1 hardware used
 * when scaling from 24-bit to 15-bit color.
 */

export const DitherShader = {
  uniforms: {
    tDiffuse: { value: null },       // The rendered scene texture (auto-set by EffectComposer)
    resolution: { value: null },      // Screen resolution in pixels
    colorLevels: { value: 32.0 },     // 32 levels per channel = 15-bit color (5 bits × 3 channels)
    ditherStrength: { value: 1.0 },   // 0 = no dithering, 1 = full dithering
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float colorLevels;
    uniform float ditherStrength;
    varying vec2 vUv;

    // 8×8 Bayer matrix — the classic ordered dithering pattern.
    // Each value represents a threshold. Pixels brighter than the threshold
    // round up to the next color level; dimmer ones round down.
    // This creates the characteristic cross-hatch pattern of retro graphics.
    float bayer8(vec2 pos) {
      // 8×8 Bayer matrix values (0-63), computed from bit interleaving
      // Using the formula approach rather than a lookup table for clarity
      ivec2 p = ivec2(mod(pos, 8.0));

      int x = p.x;
      int y = p.y;

      // Bayer matrix construction via bit reversal/interleave
      // This gives the same result as a hardcoded 64-element table
      int value = 0;
      int xc = x ^ y;
      int yc = y;

      for (int i = 0; i < 3; i++) {
        value = value << 1;
        value |= (yc & 4) >> 2;
        value = value << 1;
        value |= (xc & 4) >> 2;
        xc = xc << 1;
        yc = yc << 1;
      }

      return float(value) / 64.0; // Normalize to 0..1
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Get the pixel coordinate on the actual render target
      vec2 pixelCoord = vUv * resolution;

      // Get the Bayer threshold for this pixel (0..1)
      float threshold = bayer8(pixelCoord);

      // Shift threshold to center around 0 (-0.5 to +0.5)
      threshold = threshold - 0.5;

      // Apply dithering: nudge each color channel by the threshold.
      // This pushes the color toward the nearest quantization level,
      // with the direction depending on the Bayer pattern position.
      color.rgb += (threshold / colorLevels) * ditherStrength;

      // Posterize: snap each channel to one of N discrete levels.
      // floor(x * N + 0.5) / N = round to nearest level
      color.rgb = floor(color.rgb * colorLevels + 0.5) / colorLevels;

      gl_FragColor = color;
    }
  `,
};
