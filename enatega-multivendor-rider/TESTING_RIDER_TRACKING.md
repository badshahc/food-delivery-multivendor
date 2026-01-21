# Testing Rider Location Tracking

This guide explains how to test the realtime rider location tracking system.

## Prerequisites

1. **Backend API** running (usually on port 8001)
2. **Rider App** installed and logged in
3. **Customer App** installed
4. **Order** assigned to a rider (for customer app testing)

---

## Method 1: Using the Simulation API (Easiest)

### Step 1: Get Rider ID

First, you need the rider's ID. You can get it from:
- Database: Check the `riders` collection
- Rider app logs: Check console when rider logs in
- Admin dashboard: View rider details

### Step 2: Run Simulation

```bash
cd restaurant-api

# Basic simulation - move rider from current location to destination
node test-simulate-rider.js <RIDER_ID> <END_LAT> <END_LNG>

# Example: Move rider to a specific location
node test-simulate-rider.js 507f1f77bcf86cd799439011 25.2048 55.2708

# With custom start location and settings
node test-simulate-rider.js 507f1f77bcf86cd799439011 25.2048 55.2708 25.1972 55.2744 20 1000
```

### Step 3: Monitor in Customer App

1. Open customer app
2. Go to an order with the assigned rider
3. Open order tracking screen
4. Watch the rider marker move on the map
5. Check console logs for location updates

**Expected Logs:**
```
[RIDER_TRACKING] Subscribing to rider location updates for riderId: 507f1f77bcf86cd799439011
[RIDER_TRACKING] Received location update: { riderId: '...', coordinates: [55.2708, 25.2048] }
[RIDER_TRACKING] Rendering marker at: { latitude: 25.2048, longitude: 55.2708 }
```

---

## Method 2: Manual Testing with Real Device

### Test Rider App Sending Location

#### Step 1: Enable Logs
The logs are already added. Check the console for:

**When location is obtained:**
```
[LOCATION_CONTEXT] Device location obtained: { latitude: 25.2048, longitude: 55.2708 }
```

**When location is sent:**
```
trackRiderLocation: sending location { latitude: 25.2048, longitude: 55.2708 }
```

**When location is skipped:**
```
trackRiderLocation: no movement since last send { latitude: ..., longitude: ... }
trackRiderLocation: missing token, skipping send
```

#### Step 2: Test Scenarios

**Scenario A: Normal Movement**
1. Open rider app and log in
2. Walk or drive with the device
3. Check console - should see location updates every 60 seconds OR when you move 10 meters
4. Verify logs show location being sent

**Scenario B: Stationary Rider**
1. Keep device stationary
2. Should see location update every 60 seconds
3. Logs should show "no movement since last send" if location hasn't changed

**Scenario C: No Token**
1. Log out of rider app
2. Location tracking should stop
3. Logs should show "missing token, skipping send"

#### Step 3: Verify Backend Receives Updates

Check backend logs:
```bash
# In restaurant-api terminal, you should see:
updateRiderLocation <USER_ID>
```

Or check database:
```javascript
// In MongoDB
db.riders.findOne({ _id: ObjectId("RIDER_ID") }, { location: 1 })
```

---

## Method 3: Test Customer App Receiving Updates

### Step 1: Setup

1. **Assign an order to a rider** (via admin dashboard or API)
2. **Open customer app** and navigate to that order
3. **Open order tracking screen** (where TrackingRider component is used)

### Step 2: Monitor Logs

**In Customer App Console:**
```
[RIDER_TRACKING] Subscribing to rider location updates for riderId: 507f1f77bcf86cd799439011
[RIDER_TRACKING] Initial rider data loaded: { rider: { _id: '...', location: { coordinates: [...] } } }
[RIDER_TRACKING] Received location update: { riderId: '...', coordinates: [55.2708, 25.2048] }
[RIDER_TRACKING] Rendering marker at: { latitude: 25.2048, longitude: 55.2708 }
```

### Step 3: Test Scenarios

**Scenario A: Rider Moving**
1. Use simulation API or have rider move
2. Watch customer app map - marker should update
3. Check logs show subscription updates

**Scenario B: No Updates**
1. If no updates received, check:
   - Rider ID matches
   - GraphQL subscription is connected
   - Backend is publishing updates
   - WebSocket connection is active

**Scenario C: Invalid Coordinates**
- Logs will show: `[RIDER_TRACKING] Invalid coordinates, skipping render`

---

## Method 4: End-to-End Testing

### Complete Flow Test

1. **Start Backend**
   ```bash
   cd restaurant-api
   npm start
   ```

2. **Start Rider App**
   ```bash
   cd food-delivery-multivendor/enatega-multivendor-rider
   npx expo start
   ```

3. **Start Customer App**
   ```bash
   cd food-delivery-multivendor/enatega-multivendor-app
   npx expo start
   ```

4. **Test Flow:**
   - Log in to rider app
   - Assign an order to the rider (via admin or API)
   - Open customer app and view order tracking
   - Move with rider device OR use simulation API
   - Verify customer app shows rider moving on map

---

## Testing Checklist

### Rider App
- [ ] Location permission granted
- [ ] Rider logged in (token exists)
- [ ] Console shows "Device location obtained"
- [ ] Console shows "sending location" every 60s or 10m movement
- [ ] Backend receives updates (check backend logs)

### Customer App
- [ ] Order assigned to rider
- [ ] Console shows "Subscribing to rider location updates"
- [ ] Console shows "Received location update" when rider moves
- [ ] Map marker updates position
- [ ] No errors in console

### Backend
- [ ] `updateRiderLocation` mutation receives requests
- [ ] Location saved to database
- [ ] PubSub publishes updates
- [ ] GraphQL subscription delivers updates

---

## Debugging Tips

### Issue: No Location Updates in Customer App

1. **Check Subscription Connection**
   ```javascript
   // In customer app, check WebSocket connection
   // Look for subscription errors in console
   ```

2. **Verify Rider ID**
   - Ensure the rider ID in subscription matches the assigned rider
   - Check order data: `order.rider._id`

3. **Check Backend PubSub**
   - Verify `publishRiderLocation` is being called
   - Check backend logs for subscription activity

### Issue: Rider Not Sending Location

1. **Check Token**
   - Verify rider is logged in
   - Check AsyncStorage for `RIDER_TOKEN`

2. **Check Location Permission**
   - Ensure location permission is granted
   - Check device settings

3. **Check Movement**
   - Rider must move 10m OR wait 60s
   - Location must change from last sent location

### Issue: Updates Too Slow/Fast

**Adjust in `user.context.tsx`:**
```typescript
timeInterval: 60000,      // Change to reduce/increase time interval
distanceInterval: 10,     // Change to reduce/increase distance threshold
```

---

## Quick Test Commands

### Test Simulation API
```bash
# Move rider to specific location
cd restaurant-api
node test-simulate-rider.js <RIDER_ID> 25.2048 55.2708 25.1972 55.2744 20 1000
```

### Check Rider Location in Database
```javascript
// MongoDB
db.riders.findOne(
  { _id: ObjectId("RIDER_ID") },
  { name: 1, location: 1, updatedAt: 1 }
)
```

### Test GraphQL Subscription Directly
```graphql
subscription {
  subscriptionRiderLocation(riderId: "RIDER_ID") {
    _id
    location {
      coordinates
    }
  }
}
```

---

## Expected Behavior

### Normal Operation
- Rider sends location every 60 seconds OR when moving 10 meters
- Customer app receives updates in real-time
- Map marker updates smoothly
- No errors in console

### Performance
- Location updates should arrive within 1-2 seconds
- Map should update smoothly without lag
- Battery usage should be reasonable (updates every 60s)

---

## Troubleshooting Logs

### Rider App Logs to Watch
```
✅ "Device location obtained" - GPS working
✅ "sending location" - Location being sent
❌ "missing token" - Not logged in
❌ "no movement since last send" - Location unchanged (normal)
```

### Customer App Logs to Watch
```
✅ "Subscribing to rider location updates" - Subscription started
✅ "Received location update" - Updates arriving
✅ "Rendering marker at" - Map updating
❌ "Invalid coordinates" - Data format issue
❌ "Error fetching rider data" - Query failed
```

### Backend Logs to Watch
```
✅ "updateRiderLocation <USER_ID>" - Mutation received
✅ PubSub publishing - Updates being broadcast
❌ "Unauthenticated" - Auth issue
```

---

## Next Steps

After testing, you can:
1. Adjust update intervals for better performance
2. Add error handling for edge cases
3. Optimize battery usage
4. Add analytics for tracking accuracy

