# Realtime Rider Tracking Architecture

This document explains how realtime rider location tracking works in the Enatega multivendor system.

## Overview

The system uses a **GraphQL Subscription** pattern with **PubSub** to provide realtime location updates. The flow involves:
1. **Rider App** - Continuously tracks and sends location updates
2. **Backend API** - Receives updates, stores in database, and publishes to subscribers
3. **Customer/Store Apps** - Subscribe to location updates and display on map

---

## Architecture Flow

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Rider App     │────────▶│  Backend API │────────▶│ Customer/Store  │
│                 │  Mutate │              │ Publish │      Apps       │
│ - Watch GPS     │────────▶│ - Update DB   │────────▶│ - Subscribe     │
│ - Send Location │         │ - PubSub     │         │ - Update Map    │
└─────────────────┘         └──────────────┘         └─────────────────┘
```

---

## 1. Rider App - Location Tracking

### Location Tracking Setup
**File**: `lib/context/global/user.context.tsx`

The rider app continuously tracks location using Expo's `Location.watchPositionAsync`:

```typescript
const trackRiderLocation = async () => {
  locationListener.current = await watchPositionAsync(
    {
      accuracy: LocationAccuracy.BestForNavigation,
      timeInterval: 60000,      // Update every 60 seconds
      distanceInterval: 10,      // Or when moved 10 meters
    },
    async (location) => {
      // Skip if location hasn't changed
      if (coordinatesRef.current?.coords?.latitude === location.coords?.latitude &&
          coordinatesRef.current?.coords?.longitude === location.coords?.longitude)
        return;
      
      coordinatesRef.current = location;
      
      // Send location update to backend
      client.mutate({
        mutation: UPDATE_LOCATION,
        variables: {
          latitude: location.coords.latitude.toString(),
          longitude: location.coords.longitude.toString(),
        },
      });
    }
  );
};
```

**Key Points:**
- Tracks location with `BestForNavigation` accuracy
- Updates every **60 seconds** OR when rider moves **10 meters** (whichever comes first)
- Skips sending if location hasn't changed
- Requires authentication token from AsyncStorage

### Mutation Definition
**File**: `lib/apollo/mutations/rider.mutation.ts`

```graphql
mutation UpdateRiderLocation($latitude: String!, $longitude: String!) {
  updateRiderLocation(latitude: $latitude, longitude: $longitude) {
    _id
  }
}
```

---

## 2. Backend API - Processing Updates

### Mutation Resolver
**File**: `restaurant-api/graphql/resolvers/rider.js`

When the backend receives a location update:

```javascript
updateRiderLocation: async (_, args, { req }) => {
  // 1. Authenticate rider
  if (!req.userId) {
    throw new Error("Unauthenticated!");
  }

  // 2. Find rider in database
  const rider = await Rider.findById(req.userId);
  if (!rider) {
    throw new Error("Unauthenticated!");
  }

  // 3. Create GeoJSON Point (longitude, latitude order)
  const location = new Point({
    coordinates: [args.longitude, args.latitude],
  });

  // 4. Update rider's location in database
  rider.location = location;
  const result = await rider.save();

  // 5. Publish location update to all subscribers
  publishRiderLocation({
    ...result._doc,
    _id: result.id,
    location: location,
  });

  return transformRider(result);
}
```

### PubSub Publishing
**File**: `restaurant-api/helpers/pubsub.js`

```javascript
const publishRiderLocation = (rider) => {
  pubsub.publish(RIDER_LOCATION, { 
    subscriptionRiderLocation: rider 
  });
};
```

---

## 3. GraphQL Subscription - Real-time Updates

### Subscription Definition
**File**: `restaurant-api/graphql/resolvers/rider.js`

```javascript
Subscription: {
  subscriptionRiderLocation: {
    subscribe: withFilter(
      () => pubsub.asyncIterator(RIDER_LOCATION),
      (payload, args) => {
        // Only send updates for the specific rider being tracked
        const riderId = payload.subscriptionRiderLocation._id;
        return riderId === args.riderId;
      }
    ),
  },
}
```

**Key Features:**
- Uses `withFilter` to only send updates to clients tracking a specific rider
- Filters by `riderId` to ensure customers only receive updates for their assigned rider

### GraphQL Schema
**File**: `restaurant-api/graphql/schema/index.js`

```graphql
subscription SubscriptionRiderLocation($riderId: String!) {
  subscriptionRiderLocation(riderId: $riderId) {
    _id
    location {
      coordinates
    }
  }
}
```

---

## 4. Customer/Store Apps - Receiving Updates

### Subscription Setup
**File**: `enatega-multivendor-app/src/components/OrderDetail/TrackingRider/TrackingRider.js`

The customer app subscribes to rider location updates:

```javascript
const TrackingRider = ({ id }) => {
  // 1. Fetch initial rider data
  const { loading, error, data, subscribeToMore } = useQuery(RIDER, {
    variables: { id },
    fetchPolicy: 'network-only'
  });

  // 2. Subscribe to real-time location updates
  useEffect(() => {
    const unsubscribe = subscribeToMore({
      document: RIDER_LOCATION,
      variables: { riderId: id },
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        
        // Merge new location into existing rider data
        return {
          rider: {
            ...prev.rider,
            ...subscriptionData.data.subscriptionRiderLocation
          }
        };
      }
    });
    return unsubscribe;
  }, []);

  // 3. Display rider marker on map
  return (
    <Marker
      coordinate={{
        latitude: parseFloat(data.rider.location.coordinates[1]),
        longitude: parseFloat(data.rider.location.coordinates[0])
      }}>
      <RiderMarker />
    </Marker>
  );
}
```

**Key Points:**
- Uses Apollo's `subscribeToMore` to add real-time updates to existing query
- Automatically updates the map marker when new location is received
- Handles coordinate conversion (GeoJSON uses [lng, lat], maps use [lat, lng])

---

## Data Flow Summary

1. **Rider App** → GPS tracks location every 60s or 10m movement
2. **Rider App** → Sends `updateRiderLocation` mutation to backend
3. **Backend** → Updates MongoDB with new location (GeoJSON Point)
4. **Backend** → Publishes update via PubSub to `RIDER_LOCATION` channel
5. **Backend** → Filters subscription by `riderId` using `withFilter`
6. **Customer App** → Receives subscription update via WebSocket
7. **Customer App** → Updates Apollo cache with new location
8. **Customer App** → Re-renders map marker with new coordinates

---

## Technology Stack

- **Frontend (Rider)**: Expo Location API, Apollo Client
- **Backend**: GraphQL (Apollo Server), PubSub (graphql-subscriptions)
- **Database**: MongoDB with GeoJSON Point storage
- **Real-time**: WebSocket connections for GraphQL subscriptions
- **Filtering**: `withFilter` from `graphql-subscriptions`

---

## Configuration

### Location Tracking Settings
- **Accuracy**: `BestForNavigation` (highest accuracy)
- **Time Interval**: 60 seconds
- **Distance Interval**: 10 meters
- **Update Condition**: Whichever threshold is reached first

### Database Schema
Rider location is stored as GeoJSON Point:
```javascript
{
  location: {
    type: "Point",
    coordinates: [longitude, latitude]  // Note: lng first, lat second
  }
}
```

### Security
- Requires authentication token
- Rider can only update their own location
- Subscriptions filtered by `riderId` to prevent unauthorized access

---

## Performance Considerations

1. **Throttling**: Updates only sent when location changes or time threshold reached
2. **Caching**: Apollo Client caches rider data, subscriptions update cache
3. **Filtering**: Backend filters subscriptions to only relevant clients
4. **Efficiency**: Skips database update if location hasn't changed

---

## Troubleshooting

### Rider location not updating
1. Check location permissions are granted
2. Verify authentication token exists
3. Check network connectivity
4. Verify mutation is being called (check network tab)

### Customer not seeing rider updates
1. Verify subscription is active (check WebSocket connection)
2. Confirm `riderId` matches the assigned rider
3. Check backend logs for PubSub publishing
4. Verify GraphQL subscription is properly set up

### High battery usage
- Consider increasing `timeInterval` to reduce update frequency
- Increase `distanceInterval` to only update on significant movement

