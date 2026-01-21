import React, { useEffect } from 'react'
import { Marker } from 'react-native-maps'
import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { rider } from '../../../apollo/queries'
import { subscriptionRiderLocation } from '../../../apollo/subscriptions'
import RiderMarker from '../../../assets/SVG/rider-marker'

const RIDER = gql`
  ${rider}
`
const RIDER_LOCATION = gql`
  ${subscriptionRiderLocation}
`
const TrackingRider = ({ id }) => {
  // Validate id before making query
  if (!id || id === 'null' || id === 'undefined' || typeof id !== 'string') {
    console.log('[TrackingRider] ERROR: Invalid rider ID provided', { 
      id, 
      type: typeof id,
      isNull: id === null,
      isUndefined: id === undefined
    })
    return null
  }

  console.log('[TrackingRider] Initializing with riderId:', id, 'Type:', typeof id)

  const { loading, error, data, subscribeToMore } = useQuery(RIDER, {
    variables: { id },
    fetchPolicy: 'network-only',
    skip: !id, // Skip query if no id
    errorPolicy: 'all' // Return partial data even on error
  })

  useEffect(() => {
    if (!id) {
      console.log('[TrackingRider] Cannot subscribe: no rider ID')
      return
    }

    if (!subscribeToMore) {
      console.log('[TrackingRider] WARNING: subscribeToMore not available yet', {
        loading,
        error: error?.message,
        hasData: !!data
      })
      return
    }

    console.log('[TrackingRider] ✅ Setting up RIDER_LOCATION subscription', {
      riderId: id,
      subscriptionDocument: 'RIDER_LOCATION',
      variables: { riderId: id }
    })

    try {
      const unsubscribe = subscribeToMore({
        document: RIDER_LOCATION,
        variables: { riderId: id },
        updateQuery: (prev, { subscriptionData }) => {
          console.log('[TrackingRider] 📡 Subscription callback triggered', {
            hasData: !!subscriptionData.data,
            hasError: !!subscriptionData.error
          })

          if (!subscriptionData.data) {
            console.log('[TrackingRider] Subscription update: no data yet', subscriptionData)
            return prev
          }

          const locationData = subscriptionData.data.subscriptionRiderLocation
          console.log('[TrackingRider] ✅ Subscription update received', {
            riderId: id,
            subscriptionRiderId: locationData?._id,
            coords: locationData?.location?.coordinates,
            fullData: locationData
          })

          return {
            rider: {
              ...prev.rider,
              ...locationData
            }
          }
        },
        onError: (err) => {
          console.log('[TrackingRider] ❌ Subscription error:', {
            error: err.message,
            graphQLErrors: err.graphQLErrors,
            networkError: err.networkError,
            riderId: id
          })
        }
      })

      console.log('[TrackingRider] ✅ Subscription set up successfully, unsubscribe function:', typeof unsubscribe)
      return unsubscribe
    } catch (err) {
      console.log('[TrackingRider] ❌ Error setting up subscription:', err)
    }
  }, [id, subscribeToMore, loading, error, data])

  if (loading) {
    console.log('[TrackingRider] Loading rider data...')
    return null
  }

  if (error) {
    console.log('[TrackingRider] ERROR loading rider:', {
      error: error.message,
      graphQLErrors: error.graphQLErrors,
      networkError: error.networkError,
      riderId: id
    })
    return null
  }

  if (!data || !data.rider) {
    console.log('[TrackingRider] ERROR: No rider data returned', { data, riderId: id })
    return null
  }

  const lat = parseFloat(data?.rider?.location?.coordinates?.[1])
  const lng = parseFloat(data?.rider?.location?.coordinates?.[0])

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    console.log('[TrackingRider] invalid coordinates', data?.rider?.location)
    return null
  }

  console.log('[TrackingRider] render marker', { riderId: id, lat, lng })

  return (
    <Marker
      coordinate={{
        latitude: lat,
        longitude: lng
      }}>
      <RiderMarker />
    </Marker>
  )
}

export default TrackingRider
