import { Ionicons } from "@expo/vector-icons";
import { Camera, CameraView } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PanResponder,
} from "react-native";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import Slider from "@react-native-community/slider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CameraCaptureProps {
  onCapture: (uri: string) => void;
  onClose: () => void;
  /** Allow taking multiple photos before closing (default: false) */
  allowMultiple?: boolean;
  /** Show edit screen after capture (default: true) */
  showEditAfterCapture?: boolean;
}

type EditMode = "none" | "crop";

export function CameraCapture({
  onCapture,
  onClose,
  allowMultiple = false,
  showEditAfterCapture = true,
}: CameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  
  // Camera state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("back");
  const [zoom, setZoom] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Gesture state
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  
  // Edit state
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Crop state
  const [cropBox, setCropBox] = useState({
    x: 50,
    y: 150,
    width: SCREEN_WIDTH - 100,
    height: SCREEN_WIDTH - 100,
  });
  const [selectedAspect, setSelectedAspect] = useState<string>("free");

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // Pinch gesture handlers
  const handlePinchGesture = (event: any) => {
    "worklet";
    scale.value = baseScale.value * event.nativeEvent.scale;
    const zoomValue = Math.min(Math.max(scale.value - 1, 0), 1);
    runOnJS(setZoom)(zoomValue);
  };

  const handlePinchStateChange = (event: any) => {
    "worklet";
    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (scale.value < 1) {
        scale.value = 1;
        runOnJS(setZoom)(0);
      }
      baseScale.value = scale.value;
    } else if (event.nativeEvent.state === State.BEGAN) {
      baseScale.value = scale.value;
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: true,
      });

      if (photo && photo.uri) {
        if (showEditAfterCapture) {
          setCapturedPhoto(photo.uri);
          setOriginalPhoto(photo.uri);
          setEditMode("none");
        } else {
          onCapture(photo.uri);
          if (!allowMultiple) {
            onClose();
          }
        }
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take picture");
    } finally {
      setIsCapturing(false);
    }
  };

  const flipCamera = () => {
    setCameraFacing((current) => (current === "back" ? "front" : "back"));
    setZoom(0);
    scale.value = 1;
    baseScale.value = 1;
  };

  const handleClose = () => {
    setZoom(0);
    scale.value = 1;
    baseScale.value = 1;
    setCapturedPhoto(null);
    setOriginalPhoto(null);
    onClose();
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setOriginalPhoto(null);
    setEditMode("none");
  };

  const resetEdits = () => {
    if (originalPhoto) {
      setCapturedPhoto(originalPhoto);
    }
  };

  const rotatePhoto = async () => {
    if (!capturedPhoto) return;
    
    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        capturedPhoto,
        [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCapturedPhoto(result.uri);
    } catch (error) {
      console.error("Rotate error:", error);
      Alert.alert("Error", "Failed to rotate image");
    } finally {
      setIsProcessing(false);
    }
  };

  const flipPhotoHorizontal = async () => {
    if (!capturedPhoto) return;
    
    setIsProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        capturedPhoto,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCapturedPhoto(result.uri);
    } catch (error) {
      console.error("Flip error:", error);
      Alert.alert("Error", "Failed to flip image");
    } finally {
      setIsProcessing(false);
    }
  };

  const setAspectRatio = (aspect: string) => {
    setSelectedAspect(aspect);
    const baseSize = Math.min(SCREEN_WIDTH - 100, SCREEN_HEIGHT * 0.4);
    
    let newWidth = baseSize;
    let newHeight = baseSize;
    
    switch (aspect) {
      case "1:1":
        newWidth = newHeight = baseSize;
        break;
      case "4:3":
        newWidth = baseSize;
        newHeight = (baseSize * 3) / 4;
        break;
      case "3:4":
        newWidth = (baseSize * 3) / 4;
        newHeight = baseSize;
        break;
      case "16:9":
        newWidth = baseSize;
        newHeight = (baseSize * 9) / 16;
        break;
      default:
        // Free - keep current
        return;
    }
    
    setCropBox({
      x: (SCREEN_WIDTH - newWidth) / 2,
      y: (SCREEN_HEIGHT - newHeight) / 2 - 50,
      width: newWidth,
      height: newHeight,
    });
  };

  const applyCrop = async () => {
    if (!capturedPhoto) return;
    
    setIsProcessing(true);
    try {
      const imageInfo = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(
          capturedPhoto,
          (width, height) => resolve({ width, height }),
          (error) => reject(error)
        );
      });

      // Calculate scale between display and actual image
      const displayWidth = SCREEN_WIDTH;
      const displayHeight = (imageInfo.height / imageInfo.width) * displayWidth;
      
      const scaleX = imageInfo.width / displayWidth;
      const scaleY = imageInfo.height / displayHeight;
      
      // Offset for centering (image is centered with "contain")
      const offsetY = (SCREEN_HEIGHT - displayHeight) / 2;
      
      const cropOrigin = {
        originX: Math.max(0, Math.round(cropBox.x * scaleX)),
        originY: Math.max(0, Math.round((cropBox.y - offsetY) * scaleY)),
        width: Math.round(cropBox.width * scaleX),
        height: Math.round(cropBox.height * scaleY),
      };
      
      // Clamp to image bounds
      cropOrigin.originX = Math.min(cropOrigin.originX, imageInfo.width - 10);
      cropOrigin.originY = Math.min(cropOrigin.originY, imageInfo.height - 10);
      cropOrigin.width = Math.min(cropOrigin.width, imageInfo.width - cropOrigin.originX);
      cropOrigin.height = Math.min(cropOrigin.height, imageInfo.height - cropOrigin.originY);

      const result = await ImageManipulator.manipulateAsync(
        capturedPhoto,
        [{ crop: cropOrigin }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      setCapturedPhoto(result.uri);
      setEditMode("none");
    } catch (error) {
      console.error("Crop error:", error);
      Alert.alert("Error", "Failed to crop image");
    } finally {
      setIsProcessing(false);
    }
  };

  const savePhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      if (!allowMultiple) {
        handleClose();
      } else {
        retakePhoto();
      }
    }
  };

  // Crop box pan responder for moving
  const cropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        setCropBox((prev) => {
          const newX = Math.max(0, Math.min(prev.x + gestureState.dx / 10, SCREEN_WIDTH - prev.width));
          const newY = Math.max(100, Math.min(prev.y + gestureState.dy / 10, SCREEN_HEIGHT - prev.height - 150));
          return { ...prev, x: newX, y: newY };
        });
      },
    })
  ).current;

  // Permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionDenied}>
          <Ionicons name="camera-outline" size={60} color="#666" />
          <Text style={styles.permissionText}>Camera permission denied</Text>
          <Text style={styles.permissionSubtext}>
            Please enable camera access in your device settings
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={onClose}>
            <Text style={styles.permissionButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  // Edit mode
  if (capturedPhoto) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: capturedPhoto }}
          style={styles.previewImage}
          resizeMode="contain"
        />
        
        {/* Crop overlay */}
        {editMode === "crop" && (
          <View style={styles.cropOverlay}>
            {/* Dark areas around crop box */}
            <View style={[styles.cropDark, { top: 0, left: 0, right: 0, height: cropBox.y }]} />
            <View style={[styles.cropDark, { top: cropBox.y + cropBox.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.cropDark, { top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.height }]} />
            <View style={[styles.cropDark, { top: cropBox.y, right: 0, left: cropBox.x + cropBox.width, height: cropBox.height }]} />
            
            {/* Crop box */}
            <View
              style={[
                styles.cropBox,
                {
                  left: cropBox.x,
                  top: cropBox.y,
                  width: cropBox.width,
                  height: cropBox.height,
                },
              ]}
              {...cropPanResponder.panHandlers}
            >
              {/* Corner handles */}
              <View style={[styles.cropHandle, styles.cropHandleTL]} />
              <View style={[styles.cropHandle, styles.cropHandleTR]} />
              <View style={[styles.cropHandle, styles.cropHandleBL]} />
              <View style={[styles.cropHandle, styles.cropHandleBR]} />
              
              {/* Grid lines */}
              <View style={[styles.gridLine, styles.gridLineH1]} />
              <View style={[styles.gridLine, styles.gridLineH2]} />
              <View style={[styles.gridLine, styles.gridLineV1]} />
              <View style={[styles.gridLine, styles.gridLineV2]} />
            </View>
          </View>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}

        {/* Top bar */}
        <View style={styles.editTopBar}>
          <TouchableOpacity style={styles.editTopButton} onPress={retakePhoto}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.editTitle}>
            {editMode === "crop" ? "Crop Photo" : "Edit Photo"}
          </Text>
          <TouchableOpacity style={styles.editTopButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Edit tools - normal mode */}
        {editMode === "none" && (
          <View style={styles.editToolsContainer}>
            <View style={styles.editTools}>
              <TouchableOpacity style={styles.editTool} onPress={() => setEditMode("crop")}>
                <Ionicons name="crop" size={26} color="white" />
                <Text style={styles.editToolText}>Crop</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.editTool} onPress={rotatePhoto} disabled={isProcessing}>
                <Ionicons name="refresh" size={26} color="white" />
                <Text style={styles.editToolText}>Rotate</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.editTool} onPress={flipPhotoHorizontal} disabled={isProcessing}>
                <Ionicons name="swap-horizontal" size={26} color="white" />
                <Text style={styles.editToolText}>Flip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.editTool} onPress={resetEdits} disabled={isProcessing}>
                <Ionicons name="refresh-circle" size={26} color="white" />
                <Text style={styles.editToolText}>Reset</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
                <Ionicons name="camera" size={20} color="white" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.usePhotoButton} onPress={savePhoto}>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.usePhotoButtonText}>Use Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Crop mode actions */}
        {editMode === "crop" && (
          <View style={styles.cropActionsContainer}>
            <View style={styles.aspectRatioRow}>
              {["free", "1:1", "4:3", "3:4", "16:9"].map((aspect) => (
                <TouchableOpacity
                  key={aspect}
                  style={[
                    styles.aspectButton,
                    selectedAspect === aspect && styles.aspectButtonActive,
                  ]}
                  onPress={() => setAspectRatio(aspect)}
                >
                  <Text
                    style={[
                      styles.aspectButtonText,
                      selectedAspect === aspect && styles.aspectButtonTextActive,
                    ]}
                  >
                    {aspect === "free" ? "Free" : aspect}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.cropActions}>
              <TouchableOpacity style={styles.cropCancelButton} onPress={() => setEditMode("none")}>
                <Text style={styles.cropCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.cropApplyButton} onPress={applyCrop} disabled={isProcessing}>
                <Ionicons name="checkmark" size={20} color="white" />
                <Text style={styles.cropApplyText}>Apply Crop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Camera view
  return (
    <GestureHandlerRootView style={styles.container}>
      <PinchGestureHandler
        onGestureEvent={handlePinchGesture}
        onHandlerStateChange={handlePinchStateChange}
      >
        <Animated.View style={styles.container}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={cameraFacing}
            zoom={zoom}
          />
          
          <View style={styles.overlay}>
            {/* Top controls */}
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.controlButton} onPress={handleClose}>
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
                <Ionicons name="camera-reverse" size={28} color="white" />
              </TouchableOpacity>
            </View>

            {/* Zoom indicator */}
            <View style={[styles.zoomIndicator, { opacity: zoom > 0 ? 1 : 0.6 }]}>
              <Text style={styles.zoomText}>
                {zoom === 0 ? "1.0x" : `${(1 + zoom * 4).toFixed(1)}x`}
              </Text>
            </View>

            {/* Zoom slider */}
            <View style={styles.zoomSliderContainer}>
              <TouchableOpacity
                onPress={() => {
                  const newZoom = Math.max(0, zoom - 0.1);
                  setZoom(newZoom);
                  scale.value = 1 + newZoom;
                }}
              >
                <Ionicons name="remove" size={24} color="white" />
              </TouchableOpacity>

              <Slider
                style={styles.zoomSlider}
                minimumValue={0}
                maximumValue={1}
                value={zoom}
                onValueChange={(value) => {
                  setZoom(value);
                  scale.value = 1 + value;
                }}
                minimumTrackTintColor="#FFFFFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#FFFFFF"
              />

              <TouchableOpacity
                onPress={() => {
                  const newZoom = Math.min(1, zoom + 0.1);
                  setZoom(newZoom);
                  scale.value = 1 + newZoom;
                }}
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Capture button */}
            <View style={styles.bottomControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>
              <Text style={styles.hintText}>Pinch to zoom</Text>
            </View>
          </View>
        </Animated.View>
      </PinchGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  
  // Top controls
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  controlButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 25,
  },
  
  // Zoom
  zoomIndicator: {
    position: "absolute",
    top: 120,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zoomText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  zoomSliderContainer: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 10,
    borderRadius: 25,
  },
  zoomSlider: {
    flex: 1,
    marginHorizontal: 10,
    height: 40,
  },
  
  // Bottom controls
  bottomControls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  hintText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 10,
  },
  
  // Permission denied
  permissionDenied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  permissionText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    textAlign: "center",
  },
  permissionSubtext: {
    color: "#999",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 30,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "white",
    fontSize: 16,
  },
  
  // Preview / Edit mode
  previewImage: {
    flex: 1,
    width: "100%",
  },
  editTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  editTopButton: {
    padding: 8,
  },
  editTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  
  // Edit tools
  editToolsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingBottom: 40,
  },
  editTools: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  editTool: {
    alignItems: "center",
    padding: 10,
  },
  editToolText: {
    color: "white",
    fontSize: 12,
    marginTop: 6,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retakeButtonText: {
    color: "white",
    fontSize: 16,
    marginLeft: 8,
  },
  usePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2d5a3d",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  usePhotoButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  
  // Processing overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    color: "white",
    fontSize: 16,
    marginTop: 15,
  },
  
  // Crop mode
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cropDark: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  cropBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "white",
  },
  cropHandle: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "white",
    borderWidth: 3,
  },
  cropHandleTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cropHandleTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cropHandleBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cropHandleBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  gridLineH1: {
    left: 0,
    right: 0,
    top: "33%",
    height: 1,
  },
  gridLineH2: {
    left: 0,
    right: 0,
    top: "66%",
    height: 1,
  },
  gridLineV1: {
    top: 0,
    bottom: 0,
    left: "33%",
    width: 1,
  },
  gridLineV2: {
    top: 0,
    bottom: 0,
    left: "66%",
    width: 1,
  },
  
  // Crop actions
  cropActionsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingBottom: 40,
  },
  aspectRatioRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 15,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  aspectButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 18,
  },
  aspectButtonActive: {
    backgroundColor: "white",
  },
  aspectButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "500",
  },
  aspectButtonTextActive: {
    color: "black",
  },
  cropActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 25,
  },
  cropCancelButton: {
    padding: 10,
  },
  cropCancelText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontWeight: "500",
  },
  cropApplyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2d5a3d",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
  },
  cropApplyText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
});