export const AmphitheaterEnvironment = () => {
  return (
    <group>
      {/* Stone Seating Rows (tiered) */}
      {[0, 1, 2, 3, 4, 5].map((tier) => (
        <group key={`tier-${tier}`} position={[0, tier * 0.8, 10 + tier * 2]}>
          {/* Seating Row */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[20, 0.6, 2]} />
            <meshStandardMaterial color="#A9A9A9" roughness={0.9} />
          </mesh>
          {/* Step */}
          <mesh position={[0, -0.3, -1.2]}>
            <boxGeometry args={[20, 0.3, 0.4]} />
            <meshStandardMaterial color="#808080" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Natural Rock Formations */}
      {[
        { x: -12, z: 5, scale: 1.5 },
        { x: 12, z: 5, scale: 1.3 },
        { x: -14, z: -2, scale: 1.0 },
        { x: 14, z: -2, scale: 1.2 },
      ].map((rock, i) => (
        <mesh
          key={`rock-${i}`}
          position={[rock.x, rock.scale * 0.5, rock.z]}
          scale={[rock.scale, rock.scale, rock.scale]}
        >
          <sphereGeometry args={[1, 6, 5]} />
          <meshStandardMaterial color="#696969" roughness={1.0} />
        </mesh>
      ))}

      {/* Trees on Periphery */}
      {[
        { x: -15, z: 8 },
        { x: -16, z: -4 },
        { x: 15, z: 7 },
        { x: 16, z: -3 },
      ].map((pos, i) => (
        <group key={`tree-${i}`} position={[pos.x, 0, pos.z]}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 6, 8]} />
            <meshStandardMaterial color="#5D4E37" roughness={0.9} />
          </mesh>
          <mesh position={[0, 7, 0]}>
            <sphereGeometry args={[2, 8, 8]} />
            <meshStandardMaterial color="#2d5016" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Stone Stage Platform */}
      <mesh position={[0, 0.1, -5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#A9A9A9" roughness={0.8} />
      </mesh>

      {/* Ground (natural earth) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#8B7355" roughness={0.95} />
      </mesh>
    </group>
  );
};
