export const ClubEnvironment = () => {
  return (
    <group>
      {/* Exposed Brick Walls */}
      <mesh position={[-7, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[15, 5]} />
        <meshStandardMaterial color="#8B4513" roughness={1.0} />
      </mesh>
      <mesh position={[7, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[15, 5]} />
        <meshStandardMaterial color="#8B4513" roughness={1.0} />
      </mesh>

      {/* Neon Signs */}
      {[
        { x: -6, text: "LIVE", color: "#ff006e" },
        { x: 6, text: "MUSIC", color: "#00f5ff" },
      ].map((sign, i) => (
        <group key={`neon-${i}`} position={[sign.x, 4, -7.5]}>
          <mesh>
            <boxGeometry args={[2, 0.5, 0.2]} />
            <meshStandardMaterial
              color={sign.color}
              emissive={sign.color}
              emissiveIntensity={0.8}
              toneMapped={false}
            />
          </mesh>
          {/* Neon Glow */}
          <pointLight color={sign.color} intensity={2} distance={5} />
        </group>
      ))}

      {/* Bar Area in Corner */}
      <group position={[-10, 0, 8]}>
        {/* Bar Counter */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[4, 0.2, 2]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Bar Back Wall */}
        <mesh position={[0, 2, 1]}>
          <boxGeometry args={[4, 4, 0.2]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        {/* Shelves */}
        {[1.5, 2.5, 3.5].map((y, i) => (
          <mesh key={`shelf-${i}`} position={[0, y, 0.9]}>
            <boxGeometry args={[3.5, 0.05, 0.3]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
        ))}
        {/* Bar Stools */}
        {[-1, 0, 1].map((x, i) => (
          <group key={`stool-${i}`} position={[x, 0, -1]}>
            <mesh position={[0, 0.75, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 1.5, 12]} />
              <meshStandardMaterial color="#444444" metalness={0.8} />
            </mesh>
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 0.1, 12]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Exposed Ceiling Pipes */}
      {[-5, 0, 5].map((x, i) => (
        <mesh key={`pipe-${i}`} position={[x, 4.8, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 14, 8]} />
          <meshStandardMaterial color="#666666" roughness={0.5} metalness={0.8} />
        </mesh>
      ))}

      {/* Low Ceiling */}
      <mesh position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 15]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Concrete Floor */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
      </mesh>
    </group>
  );
};
