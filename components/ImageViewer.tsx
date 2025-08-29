// components/ImageViewer.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ImageViewerProps {
  images: string[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
}

const ImageViewerItem = ({ 
  uri, 
  isActive,
  onSwipeDisabled,
  onSwipeEnabled,
}: { 
  uri: string; 
  isActive: boolean;
  onSwipeDisabled: () => void;
  onSwipeEnabled: () => void;
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetPosition = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  React.useEffect(() => {
    if (!isActive) {
      resetPosition();
      onSwipeEnabled();
    }
  }, [isActive]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        onSwipeEnabled();
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
        onSwipeDisabled();
      } else {
        savedScale.value = scale.value;
        if (scale.value > 1) {
          onSwipeDisabled();
        } else {
          onSwipeEnabled();
        }
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .enabled(isActive);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetPosition();
        onSwipeEnabled();
      } else {
        scale.value = withSpring(2);
        savedScale.value = 2;
        onSwipeDisabled();
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const composed = Gesture.Simultaneous(
    pinchGesture,
    doubleTapGesture
  );

  const wrappedGesture = scale.value > 1 
    ? Gesture.Simultaneous(composed, panGesture)
    : composed;

  return (
    <GestureDetector gesture={wrappedGesture}>
      <Animated.View style={[styles.imageContainer, animatedStyle]}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
};

export const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  visible,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setScrollEnabled(true);
      // Ensure we scroll to the right image when opening
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: initialIndex, 
          animated: false 
        });
      }, 100);
    }
  }, [visible, initialIndex]);

  if (!visible || !images || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          {images.length > 1 && (
            <Text style={styles.counter}>
              {currentIndex + 1} / {images.length}
            </Text>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item}-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.slide}>
              <ImageViewerItem 
                uri={item} 
                isActive={index === currentIndex}
                onSwipeDisabled={() => setScrollEnabled(false)}
                onSwipeEnabled={() => setScrollEnabled(true)}
              />
            </View>
          )}
          onScroll={(event) => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / screenWidth
            );
            if (newIndex !== currentIndex && newIndex >= 0 && newIndex < images.length) {
              setCurrentIndex(newIndex);
            }
          }}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
        />

        {images.length > 1 && (
          <View style={styles.pagination}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 10,
  },
  counter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: 'white',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default ImageViewer;