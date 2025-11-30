export const BeachEnvironment = () => {
  return (
    <group>
      {/* Palm Trees */}
      {[
        { x: -10, z: 5 },
        { x: -12, z: -3 },
        { x: 10, z: 4 },
        { x: 12, z: -2 },
        { x: -8, z: -8 },
        { x: 9, z: -7 },
      ].map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
          {/* Trunk */}
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.3, 0.4, 6, 8]} />
            <meshStandardMaterial color="#8B7355" roughness={0.9} />
          </mesh>
          {/* Palm Leaves */}
          {[0, 1, 2, 3, 4, 5].map((leaf) => (
            <mesh
              key={leaf}
              position={[
                Math.cos((leaf * Math.PI) / 3) * 0.5,
                6,
                Math.sin((leaf * Math.PI) / 3) * 0.5,
              ]}
              rotation={[
                Math.cos((leaf * Math.PI) / 3) * 0.3,
                (leaf * Math.PI) / 3,
                0,
              ]}
            >
              <coneGeometry args={[0.8, 3, 6]} />
              <meshStandardMaterial color="#2d5016" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Beach Umbrellas */}
      {[
        { x: -6, z: 8 },
        { x: 6, z: 9 },
      ].map((pos, i) => (
        <group key={`umbrella-${i}`} position={[pos.x, 0, pos.z]}>
          {/* Pole */}
          <mesh position={[0, 2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 4, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Umbrella Top */}
          <mesh position={[0, 4, 0]} rotation={[0, 0, 0]}>
            <coneGeometry args={[2, 1.5, 8]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#ff6b6b" : "#4ecdc4"} />
          </mesh>
        </group>
      ))}

      {/* Water Horizon */}
      <mesh position={[0, 0.1, -20]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 20]} />
        <meshStandardMaterial color="#1e90ff" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Sandy Beach Ground Extension */}
      <mesh position={[0, 0.05, 5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#f4d03f" roughness={0.95} />
      </mesh>
    </group>
  );
};
