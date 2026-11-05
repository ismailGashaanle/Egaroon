import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Switch,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TextField from './TextField';
import Button from './Button';
import { EMPTY_FIELD_FILTERS } from '../lib/fieldFormats';
import { useTheme } from '../context/ThemeContext';
import { radii, spacing, typography } from '../theme';

export default function FieldFiltersSheet({
  visible,
  onClose,
  value,
  onApply,
  sizes = [],
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [draft, setDraft] = useState(value || EMPTY_FIELD_FILTERS);

  useEffect(() => {
    if (visible) setDraft({ ...EMPTY_FIELD_FILTERS, ...value });
  }, [visible, value]);

  const toggleType = (type) => {
    setDraft((prev) => {
      const types = prev.types || [];
      const next = types.includes(type) ? types.filter((x) => x !== type) : [...types, type];
      return { ...prev, types: next };
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Shaandhee field-yada</Text>

          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.label}>Banaan — hadda furan</Text>
              <Text style={styles.hint}>Kaliya field-yada saacad banaan leh maanta</Text>
            </View>
            <Switch
              value={Boolean(draft.openOnly)}
              onValueChange={(openOnly) => setDraft((prev) => ({ ...prev, openOnly }))}
              trackColor={{ false: colors.border, true: colors.brandGreen }}
            />
          </View>

          <Text style={styles.section}>Cabbirka (tirada field-yada)</Text>
          <View style={styles.chips}>
            {sizes.map((s) => {
              const on = (draft.types || []).includes(s.type);
              return (
                <Pressable
                  key={s.type}
                  onPress={() => toggleType(s.type)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {s.type} ({s.count})
                  </Text>
                </Pressable>
              );
            })}
            {!sizes.length ? (
              <Text style={styles.hint}>Field ma jiro</Text>
            ) : null}
          </View>

          <Text style={styles.section}>Qiimaha kooxda (USD)</Text>
          <View style={styles.priceRow}>
            <TextField
              style={styles.priceField}
              label="Ugu yar $"
              value={String(draft.minPrice ?? '')}
              onChangeText={(minPrice) => setDraft((prev) => ({ ...prev, minPrice }))}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <TextField
              style={styles.priceField}
              label="Ugu badan $"
              value={String(draft.maxPrice ?? '')}
              onChangeText={(maxPrice) => setDraft((prev) => ({ ...prev, maxPrice }))}
              keyboardType="decimal-pad"
              placeholder="100"
            />
          </View>

          <View style={styles.actions}>
            <Button
              variant="outline"
              title="Nadiifi"
              onPress={() => {
                onApply(EMPTY_FIELD_FILTERS);
                onClose();
              }}
              style={styles.actionBtn}
            />
            <Button
              title="Muuji field-yada"
              onPress={() => {
                onApply(draft);
                onClose();
              }}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    flex: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingTop: 8,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    rowCopy: { flex: 1 },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    hint: {
      marginTop: 2,
      ...typography.caption,
      color: colors.muted,
      fontWeight: '500',
    },
    section: {
      marginTop: 18,
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipOn: {
      backgroundColor: colors.brandGreen,
      borderColor: colors.brandGreen,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    chipTextOn: { color: colors.white },
    priceRow: { flexDirection: 'row', gap: 10 },
    priceField: { flex: 1 },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
    },
    actionBtn: { flex: 1 },
  });
}
