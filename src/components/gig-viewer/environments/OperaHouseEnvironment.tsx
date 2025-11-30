export const OperaHouseEnvironment = () => {
  return (
    <group>
      {/* Ornate Red Velvet Curtain Sides */}
      <mesh position={[-7.5, 4, -7.5]} rotation={[0, Math.PI / 4, 0]}>
        <planeGeometry args={[3, 8]} />
        <meshStandardMaterial color="#8B0000" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh position={[7.5, 4, -7.5]} rotation={[0, -Math.PI / 4, 0]}>
        <planeGeometry args={[3, 8]} />
        <meshStandardMaterial color="#8B0000" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Gold Trim Pillars */}
      {[-8, 8].map((x, i) => (
        <group key={`pillar-${i}`} position={[x, 0, -6]}>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.3, 0.4, 8, 12]} />
            <meshStandardMaterial color="#FFD700" roughness={0.2} metalness={0.8} />
          </mesh>
          {/* Pillar Capital */}
          <mesh position={[0, 8.5, 0]}>
            <cylinderGeometry args={[0.6, 0.4, 1, 12]} />
            <meshStandardMaterial color="#FFD700" roughness={0.2} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Balcony Seating Rows */}
      {[0, 1, 2].map((row) => (
        <group key={`balcony-${row}`} position={[0, 6 + row * 1.5, 8 + row * 2]}>
          {/* Left Balcony */}
          <mesh position={[-10, 0, 0]}>
            <boxGeometry args={[8, 1, 3]} />
            <meshStandardMaterial color="#8B4513" roughness={0.6} />
          </mesh>
          {/* Right Balcony */}
          <mesh position={[10, 0, 0]}>
            <boxGeometry args={[8, 1, 3]} />
            <meshStandardMaterial color="#8B4513" roughness={0.6} />
          </mesh>
          {/* Balcony Railing */}
          <mesh position={[-10, 0.8, -1.5]}>
            <boxGeometry args={[8, 0.2, 0.1]} />
            <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[10, 0.8, -1.5]}>
            <boxGeometry args={[8, 0.2, 0.1]} />
            <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Chandelier */}
      <group position={[0, 10, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial 
            color="#FFD700" 
            roughness={0.1} 
            metalness={0.9}
            emissive="#FFD700"
            emissiveIntensity={0.3}
          />
        </mesh>
        {/* Chandelier Arms */}
        {[0, 1, 2, 3, 4, 5].map((arm) => (
          <mesh
            key={arm}
            position={[
              Math.cos((arm * Math.PI) / 3) * 1.5,
              -0.5,
              Math.sin((arm * Math.PI) / 3) * 1.5,
            ]}
          >
            <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
            <meshStandardMaterial color="#FFD700" roughness={0.2} metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Polished Wood Floor Enhancement */}
      <mesh position={[0, 0.06, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#3E2723" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  );
};
