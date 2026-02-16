import segmentData from '../data/segments.json';

const { segments, loops } = segmentData;

export const getSegment = (id) => segments.find(s => s.id === id);

export const getLoop = (id) => loops.find(l => l.id === id);

const worstElevation = (combo) => {
  const levels = ['flat', 'rolling', 'hilly'];
  let worst = 0;
  for (const entry of combo) {
    const idx = levels.indexOf(entry.loop.elevation);
    if (idx > worst) worst = idx;
  }
  return levels[worst];
};

const collectSurfaces = (combo) => {
  const surfaces = new Set();
  for (const entry of combo) {
    for (const segId of entry.loop.segments) {
      const seg = getSegment(segId);
      if (seg) surfaces.add(seg.surface);
    }
  }
  return Array.from(surfaces);
};

const collectSegmentIds = (combo) => {
  const ids = new Set();
  for (const entry of combo) {
    for (const segId of entry.loop.segments) {
      ids.add(segId);
    }
  }
  return Array.from(ids);
};

/**
 * Generate route suggestions for a target distance.
 *
 * @param {number} targetMi - Target distance in miles
 * @param {number} toleranceMi - Acceptable deviation from target (default 0.5)
 * @param {string[]} affectedSegmentIds - Segment IDs affected by events (for deprioritization)
 * @returns {Object[]} Sorted route suggestions
 */
export const suggestRoutes = (targetMi, toleranceMi = 0.5, affectedSegmentIds = []) => {
  const candidates = [];

  // 1) Single loops (including repeats up to 3x)
  for (const loop of loops) {
    for (let repeat = 1; repeat <= 3; repeat++) {
      const dist = loop.distance_mi * repeat;
      if (dist >= targetMi - toleranceMi && dist <= targetMi + toleranceMi) {
        candidates.push({
          combo: [{ loop, repeat }],
          distance_mi: Math.round(dist * 100) / 100,
          complexity: repeat === 1 ? 1 : 2,
        });
      }
    }
  }

  // 2) Two different loops combined (no repeats on individual loops for simplicity)
  for (let i = 0; i < loops.length; i++) {
    for (let j = i + 1; j < loops.length; j++) {
      const loopA = loops[i];
      const loopB = loops[j];

      // Don't combine two standalone loops (reservoir + bridle path is a weird route)
      if (loopA.segments.length === 1 && loopB.segments.length === 1) {
        const segA = getSegment(loopA.segments[0]);
        const segB = getSegment(loopB.segments[0]);
        if (segA?.standalone && segB?.standalone) continue;
      }

      const dist = loopA.distance_mi + loopB.distance_mi;
      if (dist >= targetMi - toleranceMi && dist <= targetMi + toleranceMi) {
        candidates.push({
          combo: [{ loop: loopA, repeat: 1 }, { loop: loopB, repeat: 1 }],
          distance_mi: Math.round(dist * 100) / 100,
          complexity: 3,
        });
      }
    }
  }

  // 3) Standalone loop + drive loop combos with repeats
  const standaloneLoops = loops.filter(l => {
    const seg = getSegment(l.segments[0]);
    return l.segments.length === 1 && seg?.standalone;
  });
  const driveLoops = loops.filter(l => !standaloneLoops.includes(l));

  for (const standalone of standaloneLoops) {
    for (const drive of driveLoops) {
      for (let driveRepeat = 1; driveRepeat <= 2; driveRepeat++) {
        const dist = standalone.distance_mi + drive.distance_mi * driveRepeat;
        if (dist >= targetMi - toleranceMi && dist <= targetMi + toleranceMi) {
          const combo = [
            { loop: drive, repeat: driveRepeat },
            { loop: standalone, repeat: 1 },
          ];
          const key = combo.map(c => `${c.loop.id}x${c.repeat}`).sort().join('+');
          const alreadyExists = candidates.some(c => {
            const k = c.combo.map(e => `${e.loop.id}x${e.repeat}`).sort().join('+');
            return k === key;
          });
          if (!alreadyExists) {
            candidates.push({
              combo,
              distance_mi: Math.round(dist * 100) / 100,
              complexity: driveRepeat > 1 ? 4 : 3,
            });
          }
        }
      }
    }
  }

  const results = candidates.map(candidate => {
    const segmentIds = collectSegmentIds(candidate.combo);
    const affectedCount = segmentIds.filter(id => affectedSegmentIds.includes(id)).length;
    const isAffected = affectedCount > 0;

    return {
      name: formatRouteName(candidate.combo),
      distance_mi: candidate.distance_mi,
      elevation: worstElevation(candidate.combo),
      surfaces: collectSurfaces(candidate.combo),
      segmentIds,
      loops: candidate.combo.map(c => ({
        id: c.loop.id,
        name: c.loop.name,
        repeat: c.repeat,
      })),
      isAffected,
      affectedSegmentIds: segmentIds.filter(id => affectedSegmentIds.includes(id)),
      // Lower score = better
      score: candidate.complexity + (isAffected ? 10 : 0),
    };
  });

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return Math.abs(a.distance_mi - targetMi) - Math.abs(b.distance_mi - targetMi);
  });

  const seen = new Set();
  const unique = results.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });

  return unique.slice(0, 4);
};

const formatRouteName = (combo) => {
  return combo
    .map(entry => {
      const name = entry.loop.name;
      if (entry.repeat > 1) return `${name} x${entry.repeat}`;
      return name;
    })
    .join(' + ');
};

export const getPresets = () => segmentData.presets;

export const getAllLoops = () => loops;

export const getAllSegments = () => segments;
