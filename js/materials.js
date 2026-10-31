// Pabrik material signage: acrylic, stainless, gold, ACP, mirror
import * as THREE from 'three';

export const MAT_DEFAULT_COLOR = {
  acrylic: '#ffffff',
  stainless: '#c9cdd3',
  gold: '#d6b06a',
  acp: '#15181e',
  mirror: '#e8eaee',
};

let brushedTex = null;
function brushed() {
  if (brushedTex) return brushedTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const y = Math.random() * 256;
    const v = 110 + Math.random() * 60;
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.3})`;
    g.lineWidth = Math.random() * 1.2 + 0.2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y + (Math.random() - 0.5) * 2);
    g.stroke();
  }
  brushedTex = new THREE.CanvasTexture(c);
  brushedTex.wrapS = brushedTex.wrapT = THREE.RepeatWrapping;
  brushedTex.repeat.set(3, 3);
  return brushedTex;
}

/**
 * @param {string} mat  id bahan
 * @param {string} color warna hex
 * @param {object} o  { map, glow:boolean, emissiveMap, ledColor, side }
 */
export function makeMaterial(mat, color, o = {}) {
  const col = new THREE.Color(color);
  let m;
  switch (mat) {
    case 'stainless':
      m = new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: 0.3, roughnessMap: brushed() });
      break;
    case 'gold':
      m = new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: 0.26, roughnessMap: brushed() });
      break;
    case 'mirror':
      m = new THREE.MeshStandardMaterial({ color: col, metalness: 1, roughness: 0.03 });
      break;
    case 'acp':
      m = new THREE.MeshStandardMaterial({ color: col, metalness: 0.35, roughness: 0.42 });
      break;
    case 'acrylic':
    default:
      m = new THREE.MeshPhysicalMaterial({ color: col, metalness: 0, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
      break;
  }
  if (o.map) { m.map = o.map; }
  if (o.glow) {
    m.emissive = new THREE.Color(o.ledColor || '#ffffff');
    if (mat === 'acrylic' && !o.emissiveMap) m.emissive.multiply(col.clone().lerp(new THREE.Color('#ffffff'), 0.15));
    if (o.emissiveMap) m.emissiveMap = o.emissiveMap;
    m.emissiveIntensity = 1;
    m.userData.glow = true;
  }
  if (o.side) m.side = o.side;
  m.userData.mat = mat;
  return m;
}

export const isTranslucent = (mat) => mat === 'acrylic';
