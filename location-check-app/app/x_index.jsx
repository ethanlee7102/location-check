import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, Button, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Switch } from 'react-native';


const LOCATION_TASK_NAME = 'background-location-task';
const BACKEND_URL = 'https://c636-2600-1700-7c00-a9d0-3976-ddb3-dea5-3feb.ngrok-free.app'; 

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
    name: 'Homey',
    latitude: 32.86984,
    longitude: -117.21776,
  },

  {
    name: 'Homeyy',
    latitude: 32.86984,
    longitude: -117.21776,
  },

  {
    name: 'Homeyyy',
    latitude: 32.86984,
    longitude: -117.21776,
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

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error){
    console.log('taskmanager error');
    return;
  } 

  const location = data?.locations?.[0];

  if (location) {
    const {latitude, longitude} = location.coords;
    for (let locat of TARGET_LOCATIONS){
      const dist = getDistance(latitude, longitude, locat.latitude, locat.longitude)
      if (dist < 100) {
        const todayKey = getTodayKey();
        const stored = JSON.parse(await AsyncStorage.getItem(todayKey)) || {}; //trying to load todays check in data
        if (!stored[locat.name]){ //if there is no check in data (havent checked in today) 
          stored[locat.name] = true;
          await AsyncStorage.setItem(todayKey, JSON.stringify(stored)); //set a check in for this location and store it for today
          await axios.post(`${BACKEND_URL}/api/checkin`, {  // send the check in data to database
            userId: USER_ID,
            locationName: locat.name,
          });
          console.log(`✅ Synced ${locat.name}`);
        }
      }
    }
  }

})

export default function Index() {
  const [visitedToday, setVisitedToday] = useState({});
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [foregroundGranted, setForegroundGranted] = useState(false);

  useEffect(() => {
    loadVisited();
    checkTrackingStatus();
    checkForegroundPermission();
  }, []);

  const checkTrackingStatus = async () => {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    setTrackingEnabled(started);
  };

  const checkForegroundPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setForegroundGranted(status === 'granted');
  };

  const loadVisited = async() => {
    const key = getTodayKey();
    const data = await AsyncStorage.getItem(key);
    setVisitedToday(data ? JSON.parse(data) : {});
  }

  const startBackgroundTracking = async () => {
    console.log("startBackgroundTracking ran");
    const fg = await Location.requestForegroundPermissionsAsync();
    const bg = await Location.requestBackgroundPermissionsAsync();

    if (fg.status !== 'granted' || bg.status !== 'granted') {
      alert('Location permissions required');
      return;
    }

    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!started) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 20000, // 5 min
        distanceInterval: 100, // 100 meters
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Tracking Location',
          notificationBody: 'Running in background...',
        },
      });
    }
    setTrackingEnabled(true);
    

    
  }

  const stopBackgroundTracking = async () => {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      setTrackingEnabled(false);
      console.log("🚫 Tracking stopped");
    }
  };

  const manualCheck = async () => {
    const loc = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = loc.coords;
    for (let loc of TARGET_LOCATIONS) {
      const dist = getDistance(latitude, longitude, loc.latitude, loc.longitude);
      if (dist < 100 && !visitedToday[loc.name]){
        const key = getTodayKey();
        const updated = { ...visitedToday, [loc.name]: true };
        await AsyncStorage.setItem(key, JSON.stringify(updated));
        setVisitedToday(updated);
        await axios.post(`${BACKEND_URL}/api/checkin`, {
          userId: USER_ID,
          locationName: loc.name,
        });

        alert(`✅ Checked into ${loc.name}`);
      }
    }
  };
  

  


  return (
    <View style={{ marginTop: 30, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>
        Background Tracking: {trackingEnabled ? '✅ Enabled' : '❌ Disabled'}
       
      </Text>
      <Text style={{ fontSize: 18, marginBottom: 10 }}>
        Foreground Tracking: {foregroundGranted ? '✅ Granted' : '❌ Not Granted'}
      </Text>
      <Switch
        value={trackingEnabled}
        onValueChange={async (value) => {
          if (value) {
            await startBackgroundTracking();
          } else {
            await stopBackgroundTracking();
          }
        }}
      />
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
      <Button title="Check Now" onPress={manualCheck} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
  },
  item: {
    fontSize: 18,
    marginVertical: 8,
  },
});
