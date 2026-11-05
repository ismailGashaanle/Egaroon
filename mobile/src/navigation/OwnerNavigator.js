import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HoygaScreen from '../screens/owner/HoygaScreen';
import WarbixinScreen from '../screens/owner/WarbixinScreen';
import DheeraadScreen from '../screens/owner/DheeraadScreen';
import ScanScreen from '../screens/shared/ScanScreen';
import SlotsScreen from '../screens/shared/SlotsScreen';
import WalkInBookScreen from '../screens/shared/WalkInBookScreen';
import OwnerBookingDetailScreen from '../screens/shared/OwnerBookingDetailScreen';
import BookingsSearchScreen from '../screens/shared/BookingsSearchScreen';
import TeamLineupSearchScreen from '../screens/shared/TeamLineupSearchScreen';
import StadiumDetailScreen from '../screens/owner/StadiumDetailScreen';
import StadiumFormScreen from '../screens/owner/StadiumFormScreen';
import FieldFormScreen from '../screens/owner/FieldFormScreen';
import CupFormScreen from '../screens/owner/CupFormScreen';
import OwnerAgreementsScreen from '../screens/owner/OwnerAgreementsScreen';
import OwnerSubscriptionsScreen from '../screens/owner/OwnerSubscriptionsScreen';
import OwnerJoogtoScreen from '../screens/owner/OwnerJoogtoScreen';
import OwnerWalletScreen from '../screens/owner/OwnerWalletScreen';
import TabBarLabel, { useTabBarScreenOptions } from '../components/TabBarLabel';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function tabIcon(outline, filled) {
  return ({ color, size, focused }) => (
    <Ionicons name={focused && filled ? filled : outline} size={size} color={color} />
  );
}

function OwnerTabs() {
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
        name="Slots"
        component={SlotsScreen}
        options={{
          tabBarIcon: tabIcon('calendar-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Slots" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarIcon: tabIcon('qr-code-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Scan" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Warbixin"
        component={WarbixinScreen}
        options={{
          tabBarIcon: tabIcon('briefcase-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Warbixin" focused={focused} />,
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

export default function OwnerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
      <Stack.Screen name="StadiumDetail" component={StadiumDetailScreen} />
      <Stack.Screen name="StadiumForm" component={StadiumFormScreen} />
      <Stack.Screen name="FieldForm" component={FieldFormScreen} />
      <Stack.Screen name="CupForm" component={CupFormScreen} />
      <Stack.Screen name="WalkInBook" component={WalkInBookScreen} />
      <Stack.Screen name="OwnerBookingDetail" component={OwnerBookingDetailScreen} />
      <Stack.Screen name="BookingsSearch" component={BookingsSearchScreen} />
      <Stack.Screen name="TeamLineupSearch" component={TeamLineupSearchScreen} />
      <Stack.Screen name="OwnerAgreements" component={OwnerAgreementsScreen} />
      <Stack.Screen name="OwnerSubscriptions" component={OwnerSubscriptionsScreen} />
      <Stack.Screen name="OwnerJoogto" component={OwnerJoogtoScreen} />
      <Stack.Screen name="OwnerWallet" component={OwnerWalletScreen} />
      <Stack.Screen name="ScanGate" component={ScanScreen} />
    </Stack.Navigator>
  );
}
