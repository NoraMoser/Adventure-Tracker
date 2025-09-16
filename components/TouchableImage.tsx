// components/TouchableImage.tsx
import React, { useState } from 'react';
import { Image, ImageStyle, TouchableOpacity } from 'react-native';
import ImageViewer from './ImageViewer';

interface TouchableImageProps {
  source: { uri: string };
  style?: ImageStyle;
  images?: string[]; // All images in the set
  imageIndex?: number; // Index of this image in the set
}

export const TouchableImage: React.FC<TouchableImageProps> = ({
  source,
  style,
  images,
  imageIndex = 0,
}) => {
  const [viewerVisible, setViewerVisible] = useState(false);

  const imageArray = images || [source.uri];

  return (
    <>
      <TouchableOpacity onPress={() => setViewerVisible(true)}>
        <Image source={source} style={style} />
      </TouchableOpacity>
      
      <ImageViewer
        images={imageArray}
        visible={viewerVisible}
        initialIndex={imageIndex}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
};