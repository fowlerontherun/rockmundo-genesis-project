export const StageTruss = () => {
  return (
    <group position={[0, 5, -7]}>
      {/* Main horizontal truss */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[14, 0.3, 0.3]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Vertical supports */}
      <mesh position={[-6, -2.5, 0]} castShadow>
        <boxGeometry args={[0.3, 5, 0.3]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[6, -2.5, 0]} castShadow>
        <boxGeometry args={[0.3, 5, 0.3]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Moving head lights */}
      {[-4, -2, 0, 2, 4].map((x, i) => (
        <group key={i} position={[x, -0.5, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.3, 0.5, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
            <meshStandardMaterial 
              color="#FFD700" 
              emissive="#FFD700"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>
      ))}

      {/* Cross bracing */}
      {[-3, 3].map((x, i) => (
        <mesh key={i} position={[x, -2.5, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[0.2, 3.5, 0.2]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
};
