import { BODY, MOTIONS, length, repetition, skeleton, solveTwoBone, sub, type Vec3 } from './rig';

const distance = (a: Vec3, b: Vec3) => length(sub(a, b));

describe('figure rig', () => {
  it('keeps bone lengths and bends the joint towards the pole', () => {
    const { joint, end } = solveTwoBone([0, 0, 0], [0, -0.4, 0.2], 0.3, 0.26, [0, 0, -1]);
    expect(distance([0, 0, 0], joint)).toBeCloseTo(0.3, 6);
    expect(distance(joint, end)).toBeCloseTo(0.26, 6);
    expect(joint[2]).toBeLessThan(0); // bent backwards, as the pole says
  });

  it('never stretches a bone to reach a target out of range', () => {
    const { joint, end } = solveTwoBone([0, 0, 0], [0, -5, 0], 0.3, 0.26, [0, 0, 1]);
    expect(distance([0, 0, 0], joint)).toBeCloseTo(0.3, 6);
    expect(distance(joint, end)).toBeCloseTo(0.26, 6);
  });

  it('runs one repetition as a seamless, calm loop', () => {
    expect(repetition(0)).toBe(0);
    expect(repetition(0.5)).toBeCloseTo(1, 10);
    expect(repetition(1)).toBeCloseTo(0, 10);
    // Soft turns: almost no movement right at the top and the bottom.
    expect(repetition(0.02)).toBeLessThan(0.02);
    expect(1 - repetition(0.48)).toBeLessThan(0.02);
  });

  it.each(['benchPress', 'latPulldown'] as const)(
    '%s: slow, seamless, symmetric and with intact limbs at every phase',
    (id) => {
      const motion = MOTIONS[id];
      expect(motion.durationS).toBeGreaterThanOrEqual(3.5);
      expect(skeleton(motion, 0)).toEqual(skeleton(motion, 1));
      for (let phase = 0; phase <= 1; phase += 0.05) {
        const s = skeleton(motion, phase);
        for (const side of [0, 1] as const) {
          expect(distance(s.shoulder[side], s.elbow[side])).toBeCloseTo(BODY.upperArm, 5);
          expect(distance(s.elbow[side], s.hand[side])).toBeCloseTo(BODY.forearm, 5);
          expect(distance(s.hip[side], s.knee[side])).toBeCloseTo(BODY.thigh, 5);
          expect(distance(s.knee[side], s.foot[side])).toBeCloseTo(BODY.shin, 5);
        }
        expect(s.hand[1][0]).toBeCloseTo(-s.hand[0][0], 10);
      }
    },
  );

  it('moves the bar the way the exercise does', () => {
    const bench = (phase: number) => skeleton(MOTIONS.benchPress, phase).hand[0];
    // Bench press: hands far above the chest at the top (+Z = up while lying), low at the chest.
    expect(bench(0)[2] - bench(0.5)[2]).toBeGreaterThan(0.3);
    const pulldown = (phase: number) => skeleton(MOTIONS.latPulldown, phase).hand[0];
    // Lat pulldown: hands above the head at the top, at the upper chest when pulled.
    expect(pulldown(0)[1]).toBeGreaterThan(BODY.headY);
    expect(pulldown(0.5)[1]).toBeLessThan(BODY.neckY);
  });
});
