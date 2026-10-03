/* =========================================================
   Final grade: chromatic aberration on the edges, animated
   film grain, vignette and a warm/cool split tone.
   Runs after OutputPass, so it works in display space.
   ========================================================= */
export const GradeShader = {
  name: 'ZigZagGrade',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0016 },
    uGrain: { value: 0.055 },
    uVignette: { value: 1.05 },
    uLift: { value: 0.012 },
    uSaturation: { value: 1.08 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uLift;
    uniform float uSaturation;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float d = dot(c, c);

      // chromatic aberration grows towards the corners
      vec2 off = c * d * uAberration * 12.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;

      // split tone: warm highlights, violet shadows
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += vec3(0.030, 0.012, -0.014) * luma;
      col += vec3(0.010, -0.004, 0.028) * (1.0 - luma);

      // saturation
      col = mix(vec3(luma), col, uSaturation);

      // vignette
      float vig = smoothstep(0.92, 0.16, d * uVignette);
      col *= mix(0.42, 1.0, vig);

      // grain, slightly stronger in the shadows
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (1.25 - luma);

      // gentle lift so blacks read as room-dark, not void-black
      col += uLift * vec3(0.9, 0.8, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
