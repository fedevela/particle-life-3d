uniform float uFrame;

void main() {
  // Current pixel coordinates in the simulation texture (one pixel == one particle slot).
  vec2 texel = gl_FragCoord.xy;
  // Flatten 2D texel coordinates into a stable 1D particle index.
  // resolution.x is the texture width provided by the runtime (Three.js / GPUComputationRenderer).
  float index = (floor(texel.y) * resolution.x) + floor(texel.x);

  // Build an angle for circular motion:
  // - uFrame term advances the orbit over time
  // - index term gives each particle a phase offset to avoid overlap
  float phase = (uFrame * 0.010) + (index * 0.0035);
  // Per-particle sinusoidal offset used to slightly vary each particle's orbit radius.
  float radialOffset = sin(index * 0.013);
  // Base radius plus a small offset range (~±0.04) to create ring thickness/texture.
  float radius = 0.30 + (0.04 * radialOffset);

  // Position on a circle (x = r cos θ, y = r sin θ).
  float x = radius * cos(phase);
  float y = radius * sin(phase);
  // First derivative of position with respect to phase/time (tangent velocity on the orbit).
  // Signs ensure clockwise/counterclockwise tangential motion consistent with phase progression.
  float vx = -radius * 0.010;
  float vy = radius * 0.010;

  // Pack particle state into RGBA channels:
  // R,G -> position (x,y)
  // B,A -> velocity (vx,vy)
  // This texture is consumed by the render/update passes in later stages.
  gl_FragColor = vec4(x, y, vx, vy);
}
