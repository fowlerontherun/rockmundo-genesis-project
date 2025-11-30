export const FestivalEnvironment = () => {
  return (
    <group>
      {/* Trees scattered around */}
      {[
        { x: -12, z: 6 },
        { x: -14, z: -2 },
        { x: 12, z: 5 },
        { x: 14, z: -3 },
        { x: -10, z: -9 },
        { x: 11, z: -8 },
        { x: -8, z: 10 },
        { x: 9, z: 9 },
      ].map((pos, i) => (
        <group key={i} position={[pos.x, 0, pos.z]}>
          {/* Tree Trunk */}
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 5, 8]} />
            <meshStandardMaterial color="#5D4E37" roughness={0.9} />
          </mesh>
          {/* Tree Canopy */}
          <mesh position={[0, 6, 0]}>
            <sphereGeometry args={[2, 8, 8]} />
            <meshStandardMaterial color="#228B22" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Festival Tents in Background */}
      {[
        { x: -8, z: -12, color: "#ff6b6b" },
        { x: 0, z: -13, color: "#4ecdc4" },
        { x: 8, z: -12, color: "#ffe66d" },
      ].map((tent, i) => (
        <group key={`tent-${i}`} position={[tent.x, 0, tent.z]}>
          {/* Tent Top */}
          <mesh position={[0, 2, 0]}>
            <coneGeometry args={[2, 3, 4]} />
            <meshStandardMaterial color={tent.color} />
          </mesh>
          {/* Tent Pole */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 3, 8]} />
            <meshStandardMaterial color="#cccccc" />
          </mesh>
        </group>
      ))}

      {/* Grass Ground Extension */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#7CB342" roughness={0.95} />
      </mesh>

      {/* Temporary Fencing */}
      {[-15, -10, -5, 5, 10, 15].map((x, i) => (
        <mesh key={`fence-${i}`} position={[x, 0.5, 12]} rotation={[0, 0, 0]}>
          <boxGeometry args={[4, 1, 0.1]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      ))}
    </group>
  );
};
