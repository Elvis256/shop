import React, {useState, useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {storage} from '../lib/storage';

import TabNavigator from './TabNavigator';
import AgeGateScreen from '../screens/AgeGateScreen';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Product screens
import ProductDetailScreen from '../screens/product/ProductDetailScreen';
import SearchScreen from '../screens/product/SearchScreen';
import CategoryProductsScreen from '../screens/product/CategoryProductsScreen';

// Checkout screens
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import OrdersScreen from '../screens/checkout/OrdersScreen';
import OrderDetailScreen from '../screens/checkout/OrderDetailScreen';

// Account screens
import ProfileScreen from '../screens/account/ProfileScreen';
import AddressesScreen from '../screens/account/AddressesScreen';
import ChangePasswordScreen from '../screens/account/ChangePasswordScreen';

import LoadingSpinner from '../components/LoadingSpinner';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);

  useEffect(() => {
    storage.isAgeVerified().then(verified => setAgeVerified(verified));
  }, []);

  if (ageVerified === null) return <LoadingSpinner />;

  if (!ageVerified) {
    return <AgeGateScreen onVerified={() => setAgeVerified(true)} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Main" component={TabNavigator} />

        {/* Auth */}
        <Stack.Screen name="Login" component={LoginScreen} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{animation: 'slide_from_bottom'}} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* Products */}
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Search" component={SearchScreen} options={{animation: 'fade'}} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />

        {/* Checkout */}
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />

        {/* Account */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Addresses" component={AddressesScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
