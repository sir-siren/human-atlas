import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RENDER_PROFILES, type RenderQuality } from "./render-quality";

/**
 * Configure a borrowed renderer and attach its canvas to a container with a new scene.
 *
 * Controls request invalidation on change. The caller must size the renderer, update camera
 * aspect, and eventually dispose controls and all returned materials/geometries, then dispose
 * the renderer and remove its canvas. No frame loop or resize observer is installed here.
 */
export function createStage(
    renderer: THREE.WebGLRenderer,
    container: HTMLDivElement,
    invalidate: () => void,
    quality: RenderQuality = "low",
) {
    const profile = RENDER_PROFILES[quality];
    const devicePixelRatioSafe =
        typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const isNarrowScreen =
        typeof window !== "undefined" ? window.innerWidth < 768 : false;

    renderer.setPixelRatio(
        Math.min(devicePixelRatioSafe, profile.dpr, isNarrowScreen ? 1.5 : 2),
    );
    renderer.setClearColor("#f2f3f3");
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.appendChild(renderer.domElement);

    renderer.domElement.setAttribute(
        "aria-label",
        "Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.",
    );

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);

    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener("change", () => {
        invalidate();
    });

    scene.add(new THREE.HemisphereLight(0xffffff, 0xa7acb2, 1.05));

    const keyLight = new THREE.DirectionalLight(0xfffaf4, 2.3);
    keyLight.position.set(-2, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe9f0ff, 1.8);
    rimLight.position.set(2, 2, -3);
    scene.add(rimLight);

    if (!profile.decorations) {
        return {
            scene,
            camera,
            controls,
            devicePixelRatioSafe,
            ground: new THREE.Object3D(),
            platform: new THREE.Object3D(),
            ring: new THREE.Object3D(),
            innerRing: new THREE.Object3D(),
            materials: [] as THREE.Material[],
            geometries: [] as THREE.BufferGeometry[],
        };
    }

    const groundGeometry = new THREE.CircleGeometry(30, 96);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xd5d9dc,
        roughness: 1,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.019;
    if (profile.decorations) scene.add(ground);

    const platformGeometry = new THREE.CylinderGeometry(0.68, 0.7, 0.028, 100);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0xeeeeec,
        metalness: 0.12,
        roughness: 0.67,
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = -0.016;
    if (profile.decorations) scene.add(platform);

    const ringGeometry = new THREE.RingGeometry(0.63, 0.632, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x8c969f,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    if (profile.decorations) scene.add(ring);

    const innerRingGeometry = new THREE.RingGeometry(0.55, 0.551, 128);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xa4aeb8,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.001;
    if (profile.decorations) scene.add(innerRing);

    const materials: THREE.Material[] = [
        groundMaterial,
        platformMaterial,
        ringMaterial,
        innerRingMaterial,
    ];
    const geometries: THREE.BufferGeometry[] = [
        groundGeometry,
        platformGeometry,
        ringGeometry,
        innerRingGeometry,
    ];

    return {
        scene,
        camera,
        controls,
        devicePixelRatioSafe,
        ground,
        platform,
        ring,
        innerRing,
        materials,
        geometries,
    };
}

export type SceneStage = ReturnType<typeof createStage>;
