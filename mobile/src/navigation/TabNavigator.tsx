import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors, Fonts} from '../lib/theme';
import {useCart} from '../contexts/CartContext';

import HomeScreen from '../screens/tabs/HomeScreen';
import CategoriesScreen from '../screens/tabs/CategoriesScreen';
import CartScreen from '../screens/tabs/CartScreen';
import WishlistScreen from '../screens/tabs/WishlistScreen';
import AccountScreen from '../screens/tabs/AccountScreen';
import {View, Text, StyleSheet} from 'react-native';

const Tab = createBottomTabNavigator();

function CartBadge({count}: {count: number}) {
  if (count === 0) return null;
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.badge.discount,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  text: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});

export default function TabNavigator() {
  const {itemCount} = useCart();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.borderLight,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: Fonts.sizes.xs,
          fontWeight: '500',
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({color, size}) => <Icon name="home-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{
          tabBarIcon: ({color, size}) => <Icon name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarIcon: ({color, size}) => (
            <View>
              <Icon name="cart-outline" size={size} color={color} />
              <CartBadge count={itemCount} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{
          tabBarIcon: ({color, size}) => <Icon name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({color, size}) => <Icon name="person-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
