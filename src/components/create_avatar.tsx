import React from 'react';
import { View } from 'react-native';
import { Avataars } from 'rn-customize-avatar/avataaars';

export const CreateAvatar = function () {
  return (
    <View style={{ flex: 1 }}>
      <Avataars backgroundColor="grey" hairColorList={['433333', '000000']} />
    </View>
  );
}