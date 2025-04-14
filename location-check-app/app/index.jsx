import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Button, Switch, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BackgroundGeolocation from 'react-native-background-geolocation';

const BACKEND_URL = 'https://1e61-2600-1700-7c00-a9d0-7154-d070-1dd1-8e5d.ngrok-free.app'; 

const USER_ID = 'user123';

const TARGET_LOCATIONS = [
  {
    name: 'Costa Gym',
    latitude: 32.87044,
    longitude: -117.21679,
  },
  {
    name: 'Home',
    latitude: 32.86984,
    longitude: -117.21776,
  },
  {
    name: 'jibers',
    latitude: 32.86984,
    longitude: -117.21776,
  },
  {
    name: 'warren lecture hall',
    latitude: 32.88072,
    longitude: -117.23428,
  },

];

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; //radius of the earth to take into account earths curve
  const toRad = deg => (deg * Math.PI) / 180; //get radians from the degreeeees
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  //haversine? just blindly trust this nothing will go wrong
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; //this should be the distance in meters
}

const getTodayKey = () => new Date().toISOString().split('T')[0];



export default function Index() {
  const [visitedToday, setVisitedToday] = useState({});
  const [trackingEnabled, setTrackingEnabled] = useState(false);

  useEffect(() => {
    const loadVisited = async () => {
      const key = getTodayKey();
      const data = await AsyncStorage.getItem(key);
      setVisitedToday(data ? JSON.parse(data) : {});
    };

    loadVisited();

    BackgroundGeolocation.onLocation(async (location) => {
      const { latitude, longitude } = location.coords;
      console.log(`📍 New location: ${latitude}, ${longitude}`);
      await checkProximity(latitude, longitude);
    });

    BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 100,
      stopOnTerminate: false,
      startOnBoot: true,
      allowsBackgroundLocationUpdates: true,
      locationAuthorizationRequest: 'Always',
      notification: {
        title: 'Tracking Location',
        text: 'App is tracking even when closed',
      },
    }, (state) => {
      setTrackingEnabled(state.enabled);
      if (!state.enabled) {
        BackgroundGeolocation.start();
      }
    });

    return () => {
      BackgroundGeolocation.removeAllListeners();
    };
  }, []);


  const checkProximity = async (lat, lon) => {
    for (let loc of TARGET_LOCATIONS) {
      const dist = getDistance(lat, lon, loc.latitude, loc.longitude);
      if (dist < 100 && !visitedToday[loc.name]) {
        const key = getTodayKey();
        const updated = { ...visitedToday, [loc.name]: true };
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        setVisitedToday(updated);
        await axios.post(`${BACKEND_URL}/api/checkin`, {
          userId: USER_ID,
          locationName: loc.name,
        });
        console.log(`✅ Checked in at ${loc.name}`);
      }
    }
  };

    
  const toggleTracking = async (value) => {
    if (value) {
      const status = await BackgroundGeolocation.requestPermission();
      if (status === 'granted') {
        BackgroundGeolocation.start();
        setTrackingEnabled(true);
      } else {
        Alert.alert('Permission denied', 'Location permission is required to track.');
      }
    } else {
      BackgroundGeolocation.stop();
      setTrackingEnabled(false);
    }
  };

  const manualCheck = async () => {
    const location = await BackgroundGeolocation.getCurrentPosition({ persist: false });
    await checkProximity(location.coords.latitude, location.coords.longitude);
  };

  

  


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Background Tracking: {trackingEnabled ? '✅ Enabled' : '❌ Disabled'}</Text>
      <Switch value={trackingEnabled} onValueChange={toggleTracking} />
      <Text style={styles.header}>Today's Check-ins</Text>
      <FlatList
        data={TARGET_LOCATIONS}
        keyExtractor={item => item.name}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.name}: {visitedToday[item.name] ? '✅' : '❌'}
          </Text>
        )}
      />
      <Button title="Manual Check" onPress={manualCheck} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
  },
  header: {
    fontSize: 22,
    marginTop: 20,
    marginBottom: 10,
  },
  item: {
    fontSize: 18,
    marginVertical: 6,
  },
});