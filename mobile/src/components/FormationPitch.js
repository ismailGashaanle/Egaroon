import { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { slotsForFormation } from '../lib/formationLayouts';

function surnameLabel(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

/**
 * Pro pitch board — dark green turf, white markings, headshot + black name label.
 */
export default function FormationPitch({
  formationKey = '2-3-1',
  capacity = 7,
  players = [],
  onSlotPress,
  selectedSlot,
  editable = false,
  showBench = true,
  compact = false,
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const slots = useMemo(
    () => slotsForFormation(formationKey, capacity),
    [formationKey, capacity]
  );
  const bySlot = useMemo(() => {
    const map = {};
    (players || [])
      .filter((p) => p.status !== 'bench' && p.formationSlot)
      .forEach((p) => {
        map[p.formationSlot] = p;
      });
    return map;
  }, [players]);
  const bench = useMemo(
    () => (players || []).filter((p) => p.status === 'bench'),
    [players]
  );

  const avatar = compact ? 36 : 44;
  const tokenW = compact ? 52 : 62;

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.pitch, compact && styles.pitchCompact]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ w: width, h: height });
        }}
      >
        {/* Subtle turf feel */}
        <View style={styles.stripes} pointerEvents="none" />
        <View style={styles.boundary} pointerEvents="none">
          <View style={styles.halfway} />
          <View style={styles.centerCircle} />
          <View style={styles.centerSpot} />
          <View style={[styles.box, styles.boxTop]} />
          <View style={[styles.six, styles.sixTop]} />
          <View style={[styles.box, styles.boxBottom]} />
          <View style={[styles.six, styles.sixBottom]} />
        </View>

        {size.w > 0 &&
          slots.map((slot) => {
            const player = bySlot[slot.id];
            const selected = selectedSlot === slot.id;
            const injured = Boolean(player?.injured);
            const label = player ? surnameLabel(player.displayName) : slot.id;
            const left = (slot.x / 100) * size.w;
            const top = (slot.y / 100) * size.h;

            return (
              <Pressable
                key={slot.id}
                disabled={!editable}
                onPress={() => editable && onSlotPress?.(slot)}
                style={[
                  styles.token,
                  {
                    left,
                    top,
                    width: tokenW,
                    marginLeft: -tokenW / 2,
                    marginTop: -(avatar / 2 + 10),
                  },
                ]}
              >
                <View>
                  <View
                    style={[
                      styles.avatar,
                      {
                        width: avatar,
                        height: avatar,
                        borderRadius: avatar / 2,
                      },
                      selected && styles.avatarSelected,
                      injured && styles.avatarInjured,
                      !player && styles.avatarEmpty,
                    ]}
                  >
                    {player?.photoUrl ? (
                      <Image source={{ uri: player.photoUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {player
                          ? player.jerseyNumber || initials(player.displayName)
                          : slot.id}
                      </Text>
                    )}
                  </View>
                  {injured ? (
                    <View style={styles.injBadge}>
                      <Ionicons name="medkit" size={8} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.nameTag, injured && styles.nameTagInjured]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
      </View>

      {showBench && bench.length > 0 ? (
        <View style={styles.benchStrip}>
          <Text style={styles.benchTitle}>BENCH</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {bench.map((p) => (
              <View
                key={p._id || p._key || `${p.displayName}-${p.jerseyNumber}`}
                style={styles.benchToken}
              >
                <View style={[styles.benchAvatar, p.injured && styles.avatarInjured]}>
                  {p.photoUrl ? (
                    <Image source={{ uri: p.photoUrl }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {p.jerseyNumber || initials(p.displayName)}
                    </Text>
                  )}
                  {p.injured ? (
                    <View style={styles.injBadge}>
                      <Ionicons name="medkit" size={8} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.nameTag}>
                  {surnameLabel(p.displayName)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const LINE = 'rgba(255,255,255,0.72)';

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  pitch: {
    width: '100%',
    aspectRatio: 2 / 3,
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#0d3d1f',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  pitchCompact: { maxWidth: 300 },
  stripes: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 92, 46, 0.45)',
  },
  boundary: {
    ...StyleSheet.absoluteFillObject,
    top: '4%',
    left: '4%',
    right: '4%',
    bottom: '4%',
    borderWidth: 1,
    borderColor: LINE,
  },
  halfway: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    borderTopWidth: 1,
    borderColor: LINE,
  },
  centerCircle: {
    position: 'absolute',
    left: '32%',
    top: '41%',
    width: '36%',
    height: '18%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINE,
  },
  centerSpot: {
    position: 'absolute',
    left: '48.5%',
    top: '49%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LINE,
  },
  box: {
    position: 'absolute',
    left: '19%',
    width: '62%',
    height: '16%',
    borderWidth: 1,
    borderColor: LINE,
  },
  boxTop: { top: 0, borderTopWidth: 0 },
  boxBottom: { bottom: 0, borderBottomWidth: 0 },
  six: {
    position: 'absolute',
    left: '34%',
    width: '32%',
    height: '7%',
    borderWidth: 1,
    borderColor: LINE,
  },
  sixTop: { top: 0, borderTopWidth: 0 },
  sixBottom: { bottom: 0, borderBottomWidth: 0 },
  token: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  avatar: {
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSelected: {
    borderColor: '#fcd34d',
  },
  avatarInjured: { borderColor: '#f87171' },
  avatarEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  injBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameTag: {
    marginTop: 3,
    maxWidth: 64,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: '#000',
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    overflow: 'hidden',
    textAlign: 'center',
  },
  nameTagInjured: { backgroundColor: '#7f1d1d' },
  benchStrip: {
    marginTop: 10,
    backgroundColor: '#2a2118',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(180,120,40,0.35)',
  },
  benchTitle: {
    color: 'rgba(253,230,138,0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  benchToken: { width: 56, alignItems: 'center', marginRight: 10 },
  benchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fbbf24',
    backgroundColor: '#451a03',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
