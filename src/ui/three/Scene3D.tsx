import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  PerspectiveCamera,
  TubeGeometry,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Selection } from '../../state/store';
import { ORBIT_GESTURES, zoomsToCursor } from './controls';
import { placeLabels, type LabelBox } from './declutter';
import { DETAIL, fitDistance, startDirection, type Detail, type Vec3 } from './geometry';
import type {
  NodeModel,
  PipeModel,
  PumpModel,
  ReservoirModel,
  SceneModel,
  SurfaceModel,
} from './model';
import type { Status } from './status';
import type { SceneColors } from './useThemeColors';
import type { ViewProfile } from './viewProfile';

export interface LabelAnchor {
  id: string;
  position: Vec3;
  /** Which label stays when two overlap and the view thins them out. Higher stays. */
  priority?: number;
  /** Full text and the shorter one the label can fall back to (its element holds both). */
  text?: string;
  short?: string;
}

export interface Scene3DProps {
  model: SceneModel;
  /** Pixel ratio cap, tap tolerance and hit sizes of the device. */
  profile: ViewProfile;
  colors: SceneColors;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  showHgl: boolean;
  /** Results are older than the design: the HGL is drawn faint. */
  stale: boolean;
  /** Changing this number puts the camera back in the starting position. */
  resetCount: number;
  ariaLabel: string;
  /** World positions of the HTML labels and the elements to move, by label id. */
  labels: LabelAnchor[];
  labelElements: RefObject<Map<string, HTMLElement>>;
}

const FOV = 35;

/** What the meshes need to know about the device: segment counts and tap handling. */
interface SceneSettings {
  detail: Detail;
  /** A click that follows a drag of more than this many pixels is an orbit, not a selection. */
  clickSlop: number;
  hitScale: number;
}

const Settings = createContext<SceneSettings>({ detail: DETAIL.high, clickSlop: 5, hitScale: 1 });

type Disposable = { dispose: () => void };

/** Frees GPU resources created with useMemo when they are replaced or the view closes. */
function useDispose(...resources: (Disposable | null)[]) {
  useEffect(
    () => () => {
      for (const resource of resources) resource?.dispose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    resources,
  );
}

function statusColor(colors: SceneColors, kind: 'pressure' | 'velocity', status: Status): string {
  if (status === 'none') return colors.pipe;
  if (kind === 'pressure') {
    return { low: colors.pressureLow, ok: colors.pressureOk, high: colors.pressureHigh }[status];
  }
  return { low: colors.velocityLow, ok: colors.velocityOk, high: colors.velocityHigh }[status];
}

function clickHandler(
  onSelect: (selection: Selection) => void,
  selection: Selection,
  slop: number,
) {
  return (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > slop) return;
    // A tap on a pipe or pump next to a node also crosses the hit area of the node. The node is
    // the smaller target, so it wins, unless it is behind the terrain.
    if (selection && selection.type !== 'node') {
      for (const hit of event.intersections) {
        const data = hit.object.userData as { node?: string; terrain?: boolean };
        if (data.terrain) break;
        if (data.node) {
          onSelect({ type: 'node', id: data.node });
          return;
        }
      }
    }
    onSelect(selection);
  };
}

function setCursor(event: ThreeEvent<PointerEvent>, cursor: string) {
  const target = event.nativeEvent.target;
  if (target instanceof HTMLElement) target.style.cursor = cursor;
}

const hover = {
  onPointerOver: (event: ThreeEvent<PointerEvent>) => setCursor(event, 'pointer'),
  onPointerOut: (event: ThreeEvent<PointerEvent>) => setCursor(event, ''),
};

function useSurfaceGeometries(surface: SurfaceModel) {
  const mesh = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(surface.positions, 3));
    geometry.setIndex(new BufferAttribute(surface.indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }, [surface]);
  const lines = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(surface.positions, 3));
    geometry.setIndex(new BufferAttribute(surface.lineIndices, 1));
    return geometry;
  }, [surface]);
  useDispose(mesh, lines);
  return { mesh, lines };
}

function Terrain({
  surface,
  colors,
  onSelect,
}: {
  surface: SurfaceModel;
  colors: SceneColors;
  onSelect: (selection: Selection) => void;
}) {
  const { mesh, lines } = useSurfaceGeometries(surface);
  const { clickSlop } = useContext(Settings);
  return (
    <group>
      {/* The terrain takes clicks so that elements behind a hill are not selected through it. */}
      <mesh
        geometry={mesh}
        userData={{ terrain: true }}
        onClick={clickHandler(onSelect, null, clickSlop)}
      >
        <meshLambertMaterial
          color={colors.terrainFill}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={colors.terrain} transparent opacity={0.45} />
      </lineSegments>
    </group>
  );
}

function HglSurface({
  surface,
  nodes,
  colors,
  stale,
  markerRadius,
}: {
  surface: SurfaceModel;
  nodes: NodeModel[];
  colors: SceneColors;
  stale: boolean;
  markerRadius: number;
}) {
  const { mesh, lines } = useSurfaceGeometries(surface);
  const stems = useMemo(() => {
    const positions: number[] = [];
    for (const node of nodes) {
      if (!node.hgl) continue;
      positions.push(node.ground.x, node.ground.y, node.ground.z);
      positions.push(node.hgl.x, node.hgl.y, node.hgl.z);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    return geometry;
  }, [nodes]);
  useDispose(stems);
  const fade = stale ? 0.3 : 1;

  return (
    <group>
      <mesh geometry={mesh} renderOrder={2}>
        <meshBasicMaterial
          color={colors.hgl}
          transparent
          opacity={0.24 * fade}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={lines} renderOrder={3}>
        <lineBasicMaterial color={colors.hgl} transparent opacity={0.7 * fade} />
      </lineSegments>
      <lineSegments geometry={stems} renderOrder={3}>
        <lineBasicMaterial color={colors.hgl} transparent opacity={fade} />
      </lineSegments>
      {nodes.map(
        (node) =>
          node.hgl && (
            <mesh key={node.id} position={[node.hgl.x, node.hgl.y, node.hgl.z]} renderOrder={3}>
              <sphereGeometry args={[markerRadius, 12, 8]} />
              <meshBasicMaterial color={colors.hgl} transparent opacity={fade} />
            </mesh>
          ),
      )}
    </group>
  );
}

function useTube(path: Vec3[], radius: number) {
  const { detail } = useContext(Settings);
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      path.map((p) => new Vector3(p.x, p.y, p.z)),
      false,
      'centripetal',
    );
    return new TubeGeometry(
      curve,
      Math.max(8, (path.length - 1) * detail.tubeRings),
      radius,
      detail.tubeSides,
      false,
    );
  }, [path, radius, detail]);
  useDispose(geometry);
  return geometry;
}

function Pipe({
  pipe,
  hitRadius,
  colors,
  selected,
  onSelect,
}: {
  pipe: PipeModel;
  hitRadius: number;
  colors: SceneColors;
  selected: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const { clickSlop } = useContext(Settings);
  const tube = useTube(pipe.path, pipe.radius);
  // A wider, invisible tube takes the clicks (thin pipes are a few pixels wide) and becomes
  // the highlight when the pipe is selected.
  const halo = useTube(pipe.path, Math.max(pipe.radius * 2.2, hitRadius));
  return (
    <group>
      <mesh geometry={tube}>
        <meshLambertMaterial color={statusColor(colors, 'velocity', pipe.status)} />
      </mesh>
      <mesh
        geometry={halo}
        onClick={clickHandler(onSelect, { type: 'pipe', id: pipe.id }, clickSlop)}
        renderOrder={4}
        {...hover}
      >
        <meshBasicMaterial
          color={colors.selected}
          transparent
          opacity={selected ? 0.6 : 0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Node({
  node,
  colors,
  selected,
  onSelect,
}: {
  node: NodeModel;
  colors: SceneColors;
  selected: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const { x, y, z } = node.position;
  const { detail, clickSlop, hitScale } = useContext(Settings);
  return (
    <group position={[x, y, z]}>
      <mesh>
        <sphereGeometry args={[node.radius, ...detail.sphere]} />
        <meshLambertMaterial color={statusColor(colors, 'pressure', node.status)} />
      </mesh>
      <mesh
        userData={{ node: node.id }}
        onClick={clickHandler(onSelect, { type: 'node', id: node.id }, clickSlop)}
        renderOrder={4}
        {...hover}
      >
        <sphereGeometry args={[node.radius * 1.8 * hitScale, ...detail.sphere]} />
        <meshBasicMaterial
          color={colors.selected}
          transparent
          opacity={selected ? 0.6 : 0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Reservoir({
  reservoir,
  colors,
  selected,
  onSelect,
}: {
  reservoir: ReservoirModel;
  colors: SceneColors;
  selected: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const { position, radius, bottomY, waterY, topY } = reservoir;
  const tankHeight = topY - bottomY;
  const waterHeight = waterY - bottomY;
  const columnHeight = bottomY - position.y;
  const { detail, clickSlop } = useContext(Settings);
  const sides = detail.cylinderSides;
  return (
    <group position={[position.x, 0, position.z]}>
      {columnHeight > 0 && (
        <mesh position={[0, position.y + columnHeight / 2, 0]}>
          <cylinderGeometry args={[radius * 0.35, radius * 0.45, columnHeight, sides / 2]} />
          <meshLambertMaterial color={colors.reservoir} />
        </mesh>
      )}
      <mesh position={[0, bottomY + waterHeight / 2, 0]}>
        <cylinderGeometry args={[radius * 0.9, radius * 0.9, waterHeight, sides]} />
        <meshBasicMaterial color={colors.water} />
      </mesh>
      <mesh
        position={[0, bottomY + tankHeight / 2, 0]}
        onClick={clickHandler(onSelect, { type: 'reservoir', id: reservoir.id }, clickSlop)}
        renderOrder={1}
        {...hover}
      >
        <cylinderGeometry args={[radius, radius, tankHeight, sides, 1, true]} />
        <meshLambertMaterial
          color={selected ? colors.selected : colors.reservoir}
          transparent
          opacity={selected ? 0.75 : 0.5}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Pump({
  pump,
  size,
  colors,
  selected,
  onSelect,
}: {
  pump: PumpModel;
  size: number;
  colors: SceneColors;
  selected: boolean;
  onSelect: (selection: Selection) => void;
}) {
  const { detail, clickSlop } = useContext(Settings);
  const sides = Math.round(detail.cylinderSides * 0.75);
  const tube = useTube(pump.path, pump.radius);
  const { position, quaternion } = pump.marker;
  const color = selected ? colors.selected : colors.pump;
  return (
    <group>
      <mesh geometry={tube}>
        <meshLambertMaterial color={colors.pipe} />
      </mesh>
      {/* Pump body with a cone that points from suction to discharge. */}
      <group
        position={[position.x, position.y + size * 0.6, position.z]}
        quaternion={quaternion}
        onClick={clickHandler(onSelect, { type: 'pump', id: pump.id }, clickSlop)}
        {...hover}
      >
        <mesh>
          <cylinderGeometry args={[size, size, size * 2, sides]} />
          <meshLambertMaterial color={color} />
        </mesh>
        <mesh position={[0, size * 1.9, 0]}>
          <coneGeometry args={[size * 0.8, size * 1.8, sides]} />
          <meshLambertMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
}

/** Orbit, zoom and pan. Renders only when the camera moves (the frame loop is on demand). */
function CameraControls({
  bounds,
  resetCount,
}: {
  bounds: SceneModel['bounds'];
  resetCount: number;
}) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const controls = useRef<OrbitControls | null>(null);
  const moved = useRef(false);
  const lastReset = useRef(resetCount);
  const framed = useRef<SceneModel['bounds'] | null>(null);

  useLayoutEffect(() => {
    const orbit = new OrbitControls(camera, domElement);
    orbit.enableDamping = false;
    orbit.maxPolarAngle = Math.PI * 0.495;
    orbit.zoomToCursor = true;
    orbit.touches = { ...ORBIT_GESTURES.touches };
    orbit.mouseButtons = { ...ORBIT_GESTURES.mouseButtons };
    const onChange = () => invalidate();
    const onStart = () => {
      moved.current = true;
    };
    // Capture phase: the setting must be in place before the controls handle the same event.
    const onPointerDown = (event: PointerEvent) => {
      orbit.zoomToCursor = zoomsToCursor(event.pointerType);
    };
    const onWheel = () => {
      orbit.zoomToCursor = zoomsToCursor('mouse');
    };
    domElement.addEventListener('pointerdown', onPointerDown, true);
    domElement.addEventListener('wheel', onWheel, true);
    orbit.addEventListener('change', onChange);
    orbit.addEventListener('start', onStart);
    controls.current = orbit;
    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown, true);
      domElement.removeEventListener('wheel', onWheel, true);
      orbit.removeEventListener('change', onChange);
      orbit.removeEventListener('start', onStart);
      orbit.dispose();
      controls.current = null;
    };
  }, [camera, domElement, invalidate]);

  // Frames the scene. A reset goes back to the starting direction; a change of the vertical
  // scale keeps the direction the user chose; a resize only reframes an untouched view.
  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!orbit || width === 0 || height === 0) return;
    const reset = lastReset.current !== resetCount;
    lastReset.current = resetCount;
    if (reset) moved.current = false;
    const resized = framed.current === bounds && !reset;
    framed.current = bounds;
    if (resized && moved.current) return;

    const target = new Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    const direction =
      moved.current && !reset
        ? camera.position.clone().sub(orbit.target).normalize()
        : new Vector3().copy(startDirection(width / height));
    const { halfSize } = bounds;
    const radius = Math.hypot(halfSize.x, halfSize.y, halfSize.z);
    // 3 % of slack keeps markers and labels at the edge of the terrain inside the view.
    const distance = fitDistance(halfSize, direction, (FOV * Math.PI) / 180, width / height) * 1.03;

    camera.position.copy(target).addScaledVector(direction, distance);
    camera.near = radius / 100;
    camera.far = radius * 40;
    if (camera instanceof PerspectiveCamera) camera.fov = FOV;
    camera.updateProjectionMatrix();
    orbit.target.copy(target);
    orbit.minDistance = radius * 0.2;
    orbit.maxDistance = radius * 10;
    orbit.update();
    invalidate();
  }, [bounds, resetCount, width, height, camera, invalidate]);

  return null;
}

/** Horizontal padding and border of a label, CSS px: the part of its width that is not text. */
const LABEL_CHROME = 10;

/**
 * Moves the HTML labels to the screen position of their anchors on every rendered frame. With
 * `declutter`, a label that would overlap one of higher priority changes to its short form or
 * is hidden.
 */
function LabelProjector({
  labels,
  elements,
  declutter,
}: {
  labels: LabelAnchor[];
  elements: RefObject<Map<string, HTMLElement>>;
  declutter: boolean;
}) {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    // Frame callbacks run before the renderer refreshes the camera matrices.
    camera.updateMatrixWorld();
    const placed: {
      label: LabelAnchor;
      element: HTMLElement;
      left: number;
      top: number;
      box: LabelBox;
    }[] = [];
    for (const label of labels) {
      const element = elements.current.get(label.id);
      if (!element) continue;
      point.set(label.position.x, label.position.y, label.position.z).project(camera);
      const visible = point.z > -1 && point.z < 1 && Math.abs(point.x) < 1 && Math.abs(point.y) < 1;
      if (!visible) {
        element.style.visibility = 'hidden';
        continue;
      }
      const left = (point.x * 0.5 + 0.5) * size.width;
      const top = (-point.y * 0.5 + 0.5) * size.height;
      const box: LabelBox = {
        id: label.id,
        left,
        right: left,
        top,
        bottom: top,
        priority: label.priority ?? 0,
        depth: point.z,
      };
      placed.push({ label, element, left, top, box });
    }
    if (declutter) {
      // Labels are measured in their full form: first every write, then every read, so the
      // frame costs one layout. The width of the short form is estimated from the lengths of
      // the two texts.
      for (const { element } of placed) delete element.dataset.form;
      for (const { label, element, left, top, box } of placed) {
        const width = element.offsetWidth;
        box.left = left - width / 2;
        box.right = left + width / 2;
        box.top = top - element.offsetHeight;
        if (label.short !== undefined && label.text) {
          const ratio = Math.min(1, label.short.length / label.text.length);
          box.shortWidth = LABEL_CHROME + Math.max(0, width - LABEL_CHROME) * ratio;
        }
      }
    }
    const forms = declutter ? placeLabels(placed.map((p) => p.box)) : null;
    for (const { element, left, top, box } of placed) {
      const form = forms ? forms.get(box.id) : 'full';
      if (!form) {
        element.style.visibility = 'hidden';
        continue;
      }
      if (form === 'short') element.dataset.form = 'short';
      element.style.visibility = 'visible';
      // Nearer labels go on top of farther ones.
      element.style.zIndex = String(Math.round((1 - box.depth) * 1e6));
      element.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px) translate(-50%, -100%)`;
    }
  });
  return null;
}

/** Asks for one frame whenever the scene content changes. */
function RenderOnChange({ token }: { token: unknown[] }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate, ...token]);
  return null;
}

export default function Scene3D({
  model,
  profile,
  colors,
  selection,
  onSelect,
  showHgl,
  stale,
  resetCount,
  ariaLabel,
  labels,
  labelElements,
}: Scene3DProps) {
  const { extent } = model.layout;
  const isSelected = (type: NonNullable<Selection>['type'], id: string) =>
    selection?.type === type && selection.id === id;
  const { detail } = model;
  const { clickSlop, hitScale } = profile;
  const settings = useMemo<SceneSettings>(
    () => ({ detail, clickSlop, hitScale }),
    [detail, clickSlop, hitScale],
  );

  return (
    <Canvas
      role="img"
      aria-label={ariaLabel}
      frameloop="demand"
      dpr={[1, profile.maxDpr]}
      flat
      camera={{ fov: FOV, position: [0, extent, extent * 2], near: 1, far: extent * 40 }}
      onPointerMissed={(event) => {
        if (event.type === 'click') onSelect(null);
      }}
    >
      <ambientLight intensity={1.7} />
      <directionalLight position={[-extent, extent * 2, extent]} intensity={1.5} />

      {/* The provider is inside the canvas: its React tree does not see contexts from outside. */}
      <Settings.Provider value={settings}>
        <Terrain surface={model.terrain} colors={colors} onSelect={onSelect} />
        {model.pipes.map((pipe) => (
          <Pipe
            key={pipe.id}
            pipe={pipe}
            hitRadius={extent * 0.012 * hitScale}
            colors={colors}
            selected={isSelected('pipe', pipe.id)}
            onSelect={onSelect}
          />
        ))}
        {model.nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            colors={colors}
            selected={isSelected('node', node.id)}
            onSelect={onSelect}
          />
        ))}
        {model.reservoirs.map((reservoir) => (
          <Reservoir
            key={reservoir.id}
            reservoir={reservoir}
            colors={colors}
            selected={isSelected('reservoir', reservoir.id)}
            onSelect={onSelect}
          />
        ))}
        {model.pumps.map((pump) => (
          <Pump
            key={pump.id}
            pump={pump}
            size={extent * 0.018}
            colors={colors}
            selected={isSelected('pump', pump.id)}
            onSelect={onSelect}
          />
        ))}
        {showHgl && model.hgl && (
          <HglSurface
            surface={model.hgl}
            nodes={model.nodes}
            colors={colors}
            stale={stale}
            markerRadius={extent * 0.005}
          />
        )}
      </Settings.Provider>

      <CameraControls bounds={model.bounds} resetCount={resetCount} />
      <LabelProjector
        labels={labels}
        elements={labelElements}
        declutter={profile.compact || profile.touch}
      />
      <RenderOnChange token={[model, colors, selection, showHgl, stale, labels, profile]} />
    </Canvas>
  );
}
