import { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = makeStyles(colors);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Email iyo password ayaa loo baahan yahay' });
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Gelitaanka wuu fashilmay', text2: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="E-Garoon" subtitle="Soo gal akoonkaaga" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Card style={styles.cardTop}>
              <TextField
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="captain@demo.local"
              />
              <TextField
                label="Furaha sirta"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
              />
              <Button title="Soo gal" onPress={onSubmit} loading={loading} style={styles.mt2} />
            </Card>

            <Pressable onPress={() => navigation.navigate('Register')} style={styles.link}>
              <Text style={styles.linkText}>Ma lihid akoon? Isdiiwaangeli</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 40 },
    cardTop: { marginTop: 8 },
    mt2: { marginTop: 8 },
    link: { marginTop: 16, paddingVertical: 8 },
    linkText: {
      textAlign: 'center',
      color: colors.brandGreen,
      fontWeight: '600',
    },
  });
}
