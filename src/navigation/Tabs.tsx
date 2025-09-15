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
import { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export default function Tabs() {
  const role = useSelector((state: RootState) => state.auth.user?.role);

  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({
        headerShown: false,
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
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      {role === 'customer' ? (
        <>
          <Tab.Screen name="Home" component={CustomerHome} />
          <Tab.Screen name="Jobs" component={JobsScreen} />
          <Tab.Screen name="Invoices" component={InvoicesScreen} />
          <Tab.Screen name="Chat" component={ChatScreen} />
        </>
      ) : (
        <>
          <Tab.Screen name="Home" component={WorkerHome} />
          <Tab.Screen name="Chat" component={ChatScreen} />
        </>
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}