export const RooftopEnvironment = () => {
  return (
    <group>
      {/* City Skyline Backdrop */}
      {[
        { x: -15, height: 12, width: 4 },
        { x: -10, height: 15, width: 3 },
        { x: -5, height: 10, width: 5 },
        { x: 0, height: 18, width: 4 },
        { x: 5, height: 13, width: 3 },
        { x: 10, height: 11, width: 4 },
        { x: 15, height: 16, width: 3 },
      ].map((building, i) => (
        <mesh
          key={`building-${i}`}
          position={[building.x, building.height / 2, -25]}
        >
          <boxGeometry args={[building.width, building.height, 2]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.7} />
          {/* Windows (emissive) */}
          {[...Array(Math.floor(building.height / 2))].map((_, floor) => (
            <mesh
              key={`window-${floor}`}
              position={[0, -building.height / 2 + floor * 2 + 1, 1.1]}
            >
              <planeGeometry args={[building.width * 0.6, 0.3]} />
              <meshStandardMaterial
                color="#ffeb3b"
                emissive="#ffeb3b"
                emissiveIntensity={0.5}
              />
            </mesh>
          ))}
        </mesh>
      ))}

      {/* Rooftop Edge Barriers */}
      {[
        { x: 0, z: 12, rotation: 0 },
        { x: -12, z: 0, rotation: Math.PI / 2 },
        { x: 12, z: 0, rotation: -Math.PI / 2 },
      ].map((barrier, i) => (
        <mesh
          key={`barrier-${i}`}
          position={[barrier.x, 0.5, barrier.z]}
          rotation={[0, barrier.rotation, 0]}
        >
          <boxGeometry args={[24, 1, 0.2]} />
          <meshStandardMaterial color="#888888" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}

      {/* Urban Lighting Fixtures */}
      {[
        { x: -8, z: 8 },
        { x: 8, z: 8 },
        { x: -8, z: -8 },
        { x: 8, z: -8 },
      ].map((light, i) => (
        <group key={`light-${i}`} position={[light.x, 0, light.z]}>
          {/* Light Pole */}
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
            <meshStandardMaterial color="#333333" metalness={0.8} />
          </mesh>
          {/* Light Fixture */}
          <mesh position={[0, 4.5, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.6}
            />
          </mesh>
          <pointLight color="#ffffff" intensity={2} distance={8} position={[0, 4.5, 0]} />
        </group>
      ))}

      {/* Air Conditioning Units */}
      {[
        { x: -10, z: -6 },
        { x: 10, z: -6 },
      ].map((ac, i) => (
        <mesh key={`ac-${i}`} position={[ac.x, 0.5, ac.z]}>
          <boxGeometry args={[2, 1, 1.5]} />
          <meshStandardMaterial color="#555555" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}

      {/* Rooftop Floor (concrete) */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} />
      </mesh>
    </group>
  );
};
