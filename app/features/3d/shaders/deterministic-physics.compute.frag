// DETERMINISTIC PHYSICS COMPUTE SHADER
// Traceability: SWARM-002, SWARM-003, SWARM-006, SWARM-007

uniform float uFrame;
uniform float uSeed;
uniform float uDeltaTime;
uniform float uFriction; // SWARM-003
uniform vec3 uBoundsMin; // SWARM-006
uniform vec3 uBoundsMax; // SWARM-006

// SWARM-007: Deterministic PRNG from seed
float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    // 1. Read current state
    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);
    
    vec3 pos = posData.xyz;
    vec3 vel = velData.xyz;
    
    // 2. [SWARM-003] Apply friction/velocity decay
    // Logic: vel = vel * exp(-uFriction * uDeltaTime)
    
    // 3. [SWARM-002] Update position (Stationary if velocity is zero)
    // Logic: pos = pos + vel * uDeltaTime
    
    // 4. [SWARM-006] Constrain within 3D volume
    // Logic: pos = clamp(pos, uBoundsMin, uBoundsMax)
    
    // 5. Output based on pass
    #ifdef PASS_POSITION
    gl_FragColor = vec4(pos, 1.0);
    #endif
    
    #ifdef PASS_VELOCITY
    gl_FragColor = vec4(vel, 1.0);
    #endif
}
