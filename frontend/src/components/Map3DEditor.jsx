import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, TransformControls } from '@react-three/drei';

const geometryByKind = {
  pillar: { label: 'Pilar', dimensions: [0.3, 3, 0.3], color: '#d97706' },
  beam: { label: 'Viga', dimensions: [4, 0.35, 0.35], color: '#2563eb' },
  wall: { label: 'Parede', dimensions: [4, 2.8, 0.18], color: '#64748b' },
  slab: { label: 'Laje', dimensions: [5, 0.2, 4], color: '#16a34a' },
};

function SceneElement({ element, selected, mode, onSelect, onTransform }) {
  const meshRef = useRef(null);
  const geometry = geometryByKind[element.kind] || geometryByKind.pillar;
  const dimensions = element.dimensions || geometry.dimensions;

  const mesh = (
    <mesh
      ref={meshRef}
      position={element.position || [0, 0, 0]}
      rotation={element.rotation || [0, 0, 0]}
      scale={element.scale || [1, 1, 1]}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        onSelect(element.id);
      }}
    >
      <boxGeometry args={dimensions} />
      <meshStandardMaterial
        color={selected ? '#0f766e' : (element.color || geometry.color)}
        roughness={0.68}
        metalness={0.04}
      />
    </mesh>
  );

  if (!selected) return mesh;

  const commitTransform = () => {
    if (!meshRef.current) return;
    onTransform(element.id, {
      position: meshRef.current.position.toArray(),
      rotation: meshRef.current.rotation.toArray().slice(0, 3),
      scale: meshRef.current.scale.toArray(),
    });
  };

  return (
    <TransformControls object={meshRef} mode={mode} onMouseUp={commitTransform}>
      {mesh}
    </TransformControls>
  );
}

export default function Map3DEditor({ elements = [], selectedId, mode = 'translate', onSelect, onTransform }) {
  return (
    <div className="model-canvas">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [11, 9, 11], fov: 42, near: 0.1, far: 500 }}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#edf2f1']} />
        <ambientLight intensity={0.75} />
        <directionalLight castShadow intensity={1.7} position={[8, 14, 7]} shadow-mapSize={[1024, 1024]} />
        <Grid
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#b9c6cc"
          sectionSize={5}
          sectionThickness={1.15}
          sectionColor="#72848d"
          fadeDistance={42}
          infiniteGrid
        />
        <axesHelper args={[2.2]} />
        {elements.map((element) => (
          <SceneElement
            key={element.id}
            element={element}
            selected={element.id === selectedId}
            mode={mode}
            onSelect={onSelect}
            onTransform={onTransform}
          />
        ))}
        <OrbitControls makeDefault minDistance={2} maxDistance={80} maxPolarAngle={Math.PI * 0.49} />
      </Canvas>
      {!elements.length && (
        <div className="model-empty-state">
          Adicione componentes estruturais para montar a cena da obra.
        </div>
      )}
      <div className="axis-legend"><span>X · Leste/Oeste</span><span>Y · Altura</span><span>Z · Norte/Sul</span></div>
    </div>
  );
}

export { geometryByKind };