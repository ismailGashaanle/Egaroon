import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { colors, typography, radii } from '../theme';

export default function NotificationRow({ title, body, time }) {
  return (
    <Card style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name="notifications" size={18} color={colors.brandGreen} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {title || 'Ogeysiis'}
        </Text>
        {body ? (
          <Text style={styles.body} numberOfLines={3}>
            {body}
          </Text>
        ) : null}
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.statusConfirmedBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brandNavy,
  },
  body: {
    marginTop: 4,
    ...typography.caption,
    color: colors.muted,
    lineHeight: 20,
  },
  time: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '500',
    color: colors.brandGreen,
  },
});
