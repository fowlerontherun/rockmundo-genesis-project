export const CrowdBarrier = () => {
  return (
    <group position={[0, 0, 1]}>
      {/* Main horizontal barrier */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[14, 0.1, 0.1]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Support posts */}
      {[-6, -4, -2, 0, 2, 4, 6].map((x, i) => (
        <mesh key={i} position={[x, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}

      {/* Base plates */}
      {[-6, -4, -2, 0, 2, 4, 6].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} receiveShadow>
          <boxGeometry args={[0.3, 0.05, 0.3]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
    </group>
  );
};
