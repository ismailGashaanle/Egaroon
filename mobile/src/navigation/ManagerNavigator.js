import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import WarbixinScreen from '../screens/owner/WarbixinScreen';
import DheeraadScreen from '../screens/manager/DheeraadScreen';
import ScanScreen from '../screens/manager/ScanScreen';
import MaantaScreen from '../screens/manager/MaantaScreen';
import SlotsScreen from '../screens/shared/SlotsScreen';
import WalkInBookScreen from '../screens/shared/WalkInBookScreen';
import OwnerBookingDetailScreen from '../screens/shared/OwnerBookingDetailScreen';
import BookingsSearchScreen from '../screens/shared/BookingsSearchScreen';
import TeamLineupSearchScreen from '../screens/shared/TeamLineupSearchScreen';
import OwnerJoogtoScreen from '../screens/owner/OwnerJoogtoScreen';
import OwnerWalletScreen from '../screens/owner/OwnerWalletScreen';
import TabBarLabel, { useTabBarScreenOptions } from '../components/TabBarLabel';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function tabIcon(name) {
  return ({ color, size }) => <Ionicons name={name} size={size} color={color} />;
}

function ManagerTabs() {
  const tabOptions = useTabBarScreenOptions();
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarIcon: tabIcon('qr-code-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Scan" focused={focused} />,
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
        name="Maanta"
        component={MaantaScreen}
        options={{
          tabBarIcon: tabIcon('today-outline'),
          tabBarLabel: ({ focused }) => <TabBarLabel label="Maanta" focused={focused} />,
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

export default function ManagerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ManagerTabs" component={ManagerTabs} />
      <Stack.Screen name="WalkInBook" component={WalkInBookScreen} />
      <Stack.Screen name="OwnerBookingDetail" component={OwnerBookingDetailScreen} />
      <Stack.Screen name="BookingsSearch" component={BookingsSearchScreen} />
      <Stack.Screen name="TeamLineupSearch" component={TeamLineupSearchScreen} />
      <Stack.Screen name="OwnerJoogto" component={OwnerJoogtoScreen} />
      <Stack.Screen name="OwnerWallet" component={OwnerWalletScreen} />
      <Stack.Screen name="ScanGate" component={ScanScreen} />
    </Stack.Navigator>
  );
}
