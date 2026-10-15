/**
 * ViewerScreen — single live stream viewer (route-driven host).
 *
 * The viewer UI lives in <LiveViewerPage>; this screen reads the route params
 * and renders one always-active page. Opened from StoreDetail ("live now") for
 * a single store's stream. The swipeable multi-stream feed is LiveFeedScreen,
 * which renders many LiveViewerPage.
 *
 * Route params: streamId, storeName?, storeLogoUrl?, streamTitle?, storeId?
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LiveViewerPage } from '../../components/LiveViewerPage';

export const ViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { streamId, storeName, storeLogoUrl, streamTitle, storeId } = route.params ?? {};

  if (!streamId) {
    return (
      <View style={styles.root}>
        <Text style={styles.msg}>No stream selected.</Text>
      </View>
    );
  }

  return (
    <LiveViewerPage
      stream={{ _id: streamId, storeId, storeName, storeLogoUrl, title: streamTitle }}
      isActive
      onExit={() => navigation.goBack()}
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  msg: { color: '#fff', margin: 32 },
});

export default ViewerScreen;
