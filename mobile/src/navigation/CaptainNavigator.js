import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HoygaScreen from '../screens/captain/HoygaScreen';
import BallamoScreen from '../screens/captain/BallamoScreen';
import RaadiScreen from '../screens/captain/RaadiScreen';
import BookingDetailScreen from '../screens/captain/BookingDetailScreen';
import LineupScreen from '../screens/captain/LineupScreen';
import TeamLineupSearchScreen from '../screens/shared/TeamLineupSearchScreen';
import DheeraadScreen, { CaptainInfoScreen } from '../screens/captain/DheeraadScreen';
import SearchResultsScreen from '../screens/captain/SearchResultsScreen';
import FieldSelectScreen from '../screens/captain/FieldSelectScreen';
import SlotSelectScreen from '../screens/captain/SlotSelectScreen';
import ConfirmBookingScreen from '../screens/captain/ConfirmBookingScreen';
import PayBookingScreen from '../screens/captain/PayBookingScreen';
import InviteTeamBScreen from '../screens/captain/InviteTeamBScreen';
import JoinMatchCodeScreen from '../screens/captain/JoinMatchCodeScreen';
import TabBarLabel, { useTabBarScreenOptions } from '../components/TabBarLabel';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function tabIcon(outline, filled) {
  return ({ color, size, focused }) => (
    <Ionicons name={focused && filled ? filled : outline} size={size} color={color} />
  );
}

function CaptainTabs() {
  const tabOptions = useTabBarScreenOptions();
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="Hoyga"
        component={HoygaScreen}
        options={{
          tabBarIcon: tabIcon('home-outline', 'home'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Hoyga" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Ballamo"
        component={BallamoScreen}
        options={{
          tabBarIcon: tabIcon('ticket-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Ballamo" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Raadi"
        component={RaadiScreen}
        options={{
          tabBarIcon: tabIcon('search-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Raadi" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Dheeraad"
        component={DheeraadScreen}
        options={{
          tabBarIcon: tabIcon('person-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Dheeraad" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Stack wraps tabs so booking flow pushes above the tab bar.
 * Raadi → FieldSelect → SlotSelect → ConfirmBooking → BookingDetail (+ pay modal)
 *   → InviteTeamB → BookingDetail
 */
export default function CaptainNavigator() {
  const { colors } = useTheme();
  const stackHeader = {
    headerStyle: { backgroundColor: colors.brandNavy },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '700' },
  };

  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={CaptainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FieldSelect"
        component={FieldSelectScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SlotSelect"
        component={SlotSelectScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConfirmBooking"
        component={ConfirmBookingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PayBooking"
        component={PayBookingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="InviteTeamB"
        component={InviteTeamBScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JoinMatchCode"
        component={JoinMatchCodeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Tixraac', ...stackHeader }}
      />
      <Stack.Screen
        name="Lineup"
        component={LineupScreen}
        options={{ title: 'Lineup', ...stackHeader }}
      />
      <Stack.Screen
        name="TeamLineupSearch"
        component={TeamLineupSearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="About" component={CaptainInfoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Help" component={CaptainInfoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Contact" component={CaptainInfoScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
