import * as THREE from 'three';

/**
 * Shared GLSL: rotates the sun's lat/lng into the globe object's local space.
 *
 * globe.gl orbits by rotating the globe itself rather than the camera, so the
 * current point of view has to be fed back in as `globeRotation` for the
 * terminator to stay put over the right part of the world.
 */
const SUN_CHUNK = /* glsl */ `
  #define PI 3.141592653589793
  uniform vec2 sunPosition;
  uniform vec2 globeRotation;

  float toRad(in float a) { return a * PI / 180.0; }

  vec3 polarToCartesian(in vec2 c) { // c = [lng, lat]
    float theta = toRad(90.0 - c.x);
    float phi = toRad(90.0 - c.y);
    return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
  }

  float sunIntensity(in vec3 normal) {
    float invLon = toRad(globeRotation.x);
    float invLat = -toRad(globeRotation.y);
    mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
    mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
    vec3 sunDir = rotX * rotY * polarToCartesian(sunPosition);
    return dot(normalize(normal), normalize(sunDir));
  }
`;

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
  }
`;

export interface SunUniforms {
  sunPosition: { value: THREE.Vector2 };
  globeRotation: { value: THREE.Vector2 };
  [uniform: string]: THREE.IUniform;
}

/** Blends the daylight and city-lights textures across the terminator. */
export function createGlobeMaterial(dayMap: THREE.Texture, nightMap: THREE.Texture) {
  const uniforms: SunUniforms = {
    dayTexture: { value: dayMap },
    nightTexture: { value: nightMap },
    sunPosition: { value: new THREE.Vector2() },
    globeRotation: { value: new THREE.Vector2() },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      varying vec3 vNormal;
      varying vec2 vUv;
      ${SUN_CHUNK}

      void main() {
        float intensity = sunIntensity(vNormal);
        vec4 dayColor = texture2D(dayTexture, vUv);
        // City lights, plus a trace of daylight so land is still readable at
        // night — a country you just discovered should never be a black hole.
        vec4 nightColor = texture2D(nightTexture, vUv) * 1.6 + dayColor * 0.13;
        // A soft terminator reads as atmosphere rather than a hard edge.
        float blend = smoothstep(-0.18, 0.22, intensity);
        gl_FragColor = mix(nightColor, dayColor, blend);
      }
    `,
  });
}

/** Cloud shell that dims on the night side using the same sun direction. */
export function createCloudsMaterial(cloudMap: THREE.Texture, shared: SunUniforms) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      cloudTexture: { value: cloudMap },
      sunPosition: shared.sunPosition,
      globeRotation: shared.globeRotation,
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: /* glsl */ `
      uniform sampler2D cloudTexture;
      varying vec3 vNormal;
      varying vec2 vUv;
      ${SUN_CHUNK}

      void main() {
        vec4 clouds = texture2D(cloudTexture, vUv);
        float intensity = sunIntensity(vNormal);
        float light = mix(0.12, 1.0, smoothstep(-0.18, 0.22, intensity));
        gl_FragColor = vec4(vec3(light), clouds.a * 0.42);
      }
    `,
  });
}
