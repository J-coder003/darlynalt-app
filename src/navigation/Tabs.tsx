import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootState } from '../store/store';
import CustomerHome from '../screens/CustomerHome';
import WorkerHome from '../screens/WorkerHome';
import JobsScreen from '../screens/JobsScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import WalletScreen from '../screens/WalletScreen';
import RequestListScreen from '../screens/RequestListScreen';
import RequestManagementScreen from '../screens/RequestManagementScreen';
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export default function Tabs() {
  const role = useSelector((state: RootState) => state.auth.user?.role);

  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopColor: '#1a1a30',
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: -4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Jobs':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case 'Invoices':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'Wallet':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'Requests':
              iconName = focused ? 'document-text' : 'document-text-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#7c8bff',
        tabBarInactiveTintColor: '#8f94b2',
      })}
    >
      {role === 'customer' ? (
        <>
          <Tab.Screen name="Home" component={CustomerHome} />
          <Tab.Screen name="Jobs" component={JobsScreen} />
          <Tab.Screen name="Invoices" component={InvoicesScreen} />
          <Tab.Screen name="Wallet" component={WalletScreen} />
          <Tab.Screen name="Requests" component={RequestManagementScreen} />
          <Tab.Screen name="Chat" component={ChatScreen} />
        </>
      ) : (
        <>
          <Tab.Screen name="Home" component={WorkerHome} />
          <Tab.Screen name="Wallet" component={WalletScreen} />
          <Tab.Screen name="Requests" component={RequestListScreen} />
          <Tab.Screen name="Chat" component={ChatScreen} />
        </>
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}