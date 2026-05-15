// src/screens/LandingScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Background orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo / Brand */}
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>DARLYN-ALT</Text>
          <View style={styles.logoDivider} />
          <Text style={styles.tagline}>Home Services. Reimagined.</Text>
        </View>

        {/* Feature pills */}
        <View style={styles.pillsRow}>
          {['Solar', 'Smart Home', 'Security', 'HVAC'].map((item) => (
            <View key={item} style={styles.pill}>
              <Text style={styles.pillText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Book trusted professionals for your home upgrades. Track every job in real time.
        </Text>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Auth')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>Get Started</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Already have an account?{' '}
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('Auth')}
          >
            Sign in
          </Text>
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  orb1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(83, 64, 240, 0.12)',
    top: -80,
    right: -80,
  },
  orb2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    bottom: 60,
    left: -60,
  },
  content: {
    width: width - 48,
    alignItems: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 6,
    textAlign: 'center',
  },
  logoDivider: {
    width: 48,
    height: 2,
    backgroundColor: '#5340f0',
    borderRadius: 2,
    marginVertical: 12,
  },
  tagline: {
    fontSize: 15,
    color: '#7070bb',
    letterSpacing: 1,
    textAlign: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  pill: {
    backgroundColor: '#111128',
    borderWidth: 0.5,
    borderColor: '#2a2a50',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    color: '#9090cc',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: '#5555aa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#4f35e8',
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#5340f0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerNote: {
    fontSize: 13,
    color: '#444488',
  },
  footerLink: {
    color: '#7a6ff0',
    fontWeight: '600',
  },
});