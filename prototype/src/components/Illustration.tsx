import Tuft from './Tuft';

// Illustrations for the Oz sample: W. W. Denslow's public-domain 1900 art (via Project Gutenberg).
// One scene, the wolves, has no usable original for a softened edition (Denslow drew the Tin Woodman
// sitting on a dead wolf), so the edition shows a "to be redrawn" slot where AI art would go.

export type Scene = 'toto' | 'bed' | 'soldier' | 'witch' | 'wolf' | 'clang' | 'crows' | 'lion';

type SceneInfo = { caption: string; src?: string; source: string };

export const SCENES: Record<Scene, SceneInfo> = {
  toto: { caption: 'She caught Toto by the ear.', src: 'art/oz/toto-ear.jpg', source: 'Original art · W. W. Denslow, 1900' },
  bed: { caption: 'Dorothy and Toto, fast asleep as the house sails along.', src: 'art/oz/bed.jpg', source: 'Original art · W. W. Denslow, 1900' },
  soldier: { caption: 'The soldier with the green whiskers led them through the streets.', src: 'art/oz/soldier.jpg', source: 'Original art · W. W. Denslow, 1900' },
  witch: { caption: 'The Wicked Witch, watching from her castle door.', src: 'art/oz/witch.jpg', source: 'Original art · W. W. Denslow, 1900' },
  wolf: { caption: 'The Tin Woodman on the conquered wolf.', src: 'art/oz/wolf.jpg', source: 'Original art · W. W. Denslow, 1900' },
  clang: { caption: 'CLANG! CLANG! The wolves turned tail and ran.', source: 'New illustration needed · AI, in Denslow’s style' },
  crows: { caption: 'Off flew the crows, every last one of them!', src: 'art/oz/crows.jpg', source: 'Original art · W. W. Denslow, 1900' },
  lion: { caption: 'The Lion gave a great big ROAR!', src: 'art/oz/lion.jpg', source: 'Original art · W. W. Denslow, 1900' },
};

export const SCENE_CAPTIONS = Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, v.caption])) as Record<Scene, string>;

export default function Illustration({ scene }: { scene: Scene }) {
  const s = SCENES[scene];
  if (s.src) return <img className="illus-img" src={s.src} alt={s.caption} />;
  return (
    <div className="illus-todo" role="img" aria-label={s.caption}>
      <Tuft pose="write" size={64} still />
      <strong>Redrawn for this edition</strong>
      <span>Denslow’s original shows a defeated wolf, so I’ll draw the wolves running away instead, in his style.</span>
    </div>
  );
}
