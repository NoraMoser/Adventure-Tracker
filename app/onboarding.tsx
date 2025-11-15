// app/onboarding.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExplorableIcon, ExplorableLogo } from "../components/Logo";
import { theme } from "../constants/theme";
import { useSettings } from "../contexts/SettingsContext";

const { width, height } = Dimensions.get("window");

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  icon?: string;
  customContent?: React.ReactNode;
  backgroundColor: string;
  textColor: string;
  action?: () => void;
  actionLabel?: string;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateSettings } = useSettings();
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userName, setUserName] = useState("");
  const [selectedUnits, setSelectedUnits] = useState<"metric" | "imperial">(
    "metric"
  );
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermissionGranted(true);

        // Also try to get background permission (optional)
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch (e) {
          // Background permission is optional
        }

        return true;
      } else {
        Alert.alert(
          "Location Required",
          "explorAble needs location access to track your activities and save spots. You can enable this later in Settings.",
          [{ text: "OK" }]
        );
        return false;
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
      return false;
    }
  };

  const completeOnboarding = async () => {
    try {
      // Save user preferences
      await updateSettings({
        units: selectedUnits,
      });

      // Save user name if provided
      if (userName.trim()) {
        await AsyncStorage.setItem("userName", userName.trim());
      }

      // Mark onboarding as complete
      await AsyncStorage.setItem("onboardingComplete", "true");

      // Navigate to main app
      router.replace("/");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    }
  };

  const slides: OnboardingSlide[] = [
    {
      id: "welcome",
      title: "Welcome to",
      subtitle:
        "Organize your adventures into trips, track activities, and save your favorite spots",
      backgroundColor: theme.colors.offWhite,
      textColor: theme.colors.navy,
      customContent: (
        <View style={styles.logoContainer}>
          <ExplorableIcon size={120} />
          <View style={{ marginTop: 20 }}>
            <ExplorableLogo width={240} showTagline={true} />
          </View>
        </View>
      ),
    },
    {
      id: "name",
      title: "What's your name?",
      subtitle: "Let's personalize your experience",
      backgroundColor: theme.colors.white,
      textColor: theme.colors.navy,
      customContent: (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.nameInput}
            placeholder="Enter your name (optional)"
            value={userName}
            onChangeText={setUserName}
            placeholderTextColor={theme.colors.lightGray}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.skipText}>You can skip this if you prefer</Text>
        </View>
      ),
    },
    {
      id: "trips",
      title: "Organize with Trips",
      subtitle: "Create trips to group your adventures together",
      icon: "airplane",
      backgroundColor: theme.colors.navy,
      textColor: theme.colors.white,
      customContent: (
        <View style={styles.tripsPreview}>
          <View style={styles.tripExample}>
            <View style={styles.tripIconContainer}>
              <Ionicons name="airplane" size={40} color={theme.colors.white} />
            </View>
            <Text style={styles.tripExampleTitle}>Weekend in Seattle</Text>
            <Text style={styles.tripExampleSubtitle}>3 activities • 5 spots</Text>
          </View>
          <View style={styles.tripFeatures}>
            <View style={styles.tripFeature}>
              <Ionicons name="calendar" size={24} color={theme.colors.white} />
              <Text style={styles.tripFeatureText}>Set dates</Text>
            </View>
            <View style={styles.tripFeature}>
              <Ionicons name="people" size={24} color={theme.colors.white} />
              <Text style={styles.tripFeatureText}>Tag friends</Text>
            </View>
            <View style={styles.tripFeature}>
              <Ionicons name="images" size={24} color={theme.colors.white} />
              <Text style={styles.tripFeatureText}>Collect memories</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "track",
      title: "Track Activities",
      subtitle: "Record your adventures and add them to trips",
      icon: "fitness",
      backgroundColor: theme.colors.forest,
      textColor: theme.colors.white,
      customContent: (
        <View style={styles.featureContainer}>
          <View style={styles.featureGrid}>
            <View style={styles.featureItem}>
              <Ionicons name="bicycle" size={40} color={theme.colors.white} />
              <Text style={styles.featureText}>Bike</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="walk" size={40} color={theme.colors.white} />
              <Text style={styles.featureText}>Run</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="trail-sign" size={40} color={theme.colors.white} />
              <Text style={styles.featureText}>Hike</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="boat" size={40} color={theme.colors.white} />
              <Text style={styles.featureText}>Paddle</Text>
            </View>
          </View>
          <View style={styles.addToTripHint}>
            <Ionicons name="airplane" size={20} color={theme.colors.white} />
            <Text style={styles.addToTripHintText}>
              Add any activity to a trip with one tap
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: "save",
      title: "Save Special Spots",
      subtitle: "Mark locations you love and organize them into trips",
      icon: "location",
      backgroundColor: theme.colors.burntOrange,
      textColor: theme.colors.white,
      customContent: (
        <View style={styles.spotsPreview}>
          <View style={styles.categoriesPreview}>
            <View style={styles.categoryRow}>
              <View
                style={[styles.categoryBadge, { backgroundColor: "#cc5500" }]}
              >
                <Ionicons name="umbrella" size={24} color="white" />
                <Text style={styles.categoryLabel}>Beach</Text>
              </View>
              <View
                style={[styles.categoryBadge, { backgroundColor: "#2d5a3d" }]}
              >
                <Ionicons name="walk" size={24} color="white" />
                <Text style={styles.categoryLabel}>Trail</Text>
              </View>
            </View>
            <View style={styles.categoryRow}>
              <View
                style={[styles.categoryBadge, { backgroundColor: "#8b5cf6" }]}
              >
                <Ionicons name="camera" size={24} color="white" />
                <Text style={styles.categoryLabel}>View</Text>
              </View>
              <View
                style={[styles.categoryBadge, { backgroundColor: "#059669" }]}
              >
                <Ionicons name="bonfire" size={24} color="white" />
                <Text style={styles.categoryLabel}>Camp</Text>
              </View>
            </View>
          </View>
          <View style={styles.addToTripHint}>
            <Ionicons name="airplane" size={20} color={theme.colors.white} />
            <Text style={styles.addToTripHintText}>
              Save spots to remember them or add to trips
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: "auto-trips",
      title: "Smart Trip Detection",
      subtitle: "Let us find and suggest trips you can create",
      backgroundColor: theme.colors.forest,
      textColor: theme.colors.white,
      customContent: (
        <View style={styles.autoTripPreview}>
          <View style={styles.autoTripCard}>
            <Ionicons name="sparkles" size={50} color="#FFD700" />
            <Text style={styles.autoTripTitle}>One-Tap Organization</Text>
            <Text style={styles.autoTripText}>
              Tap "Create Trips" and we'll detect activities and spots from the same time or location to suggest trips
            </Text>
          </View>
          <View style={styles.autoTripExample}>
            <View style={styles.autoTripExampleHeader}>
              <Ionicons name="calendar" size={20} color={theme.colors.white} />
              <Text style={styles.autoTripExampleDate}>Oct 12-13, 2024</Text>
            </View>
            <Text style={styles.autoTripExampleTitle}>Mountain Weekend</Text>
            <Text style={styles.autoTripExampleDetails}>
              2 hikes • 3 viewpoints • 1 camping spot
            </Text>
            <Text style={styles.autoTripExampleNote}>
              You decide which to create!
            </Text>
          </View>
        </View>
      ),
    },
    {
      id: "friends",
      title: "Share with Friends",
      subtitle: "Tag friends in trips and see their adventures",
      backgroundColor: theme.colors.navy,
      textColor: theme.colors.white,
      customContent: (
        <View style={styles.friendsPreview}>
          <View style={styles.friendFeature}>
            <Ionicons
              name="people-circle"
              size={50}
              color={theme.colors.white}
            />
            <Text style={styles.friendFeatureTitle}>Tag Friends in Trips</Text>
            <Text style={styles.friendFeatureText}>
              Share your adventures and see mutual trips
            </Text>
          </View>
          <View style={styles.friendFeatureRow}>
            <View style={styles.friendFeatureSmall}>
              <Ionicons name="heart" size={30} color="#FF4757" />
              <Text style={styles.friendFeatureSmallText}>Like & Comment</Text>
            </View>
            <View style={styles.friendFeatureSmall}>
              <Ionicons name="share-social" size={30} color="#4ECDC4" />
              <Text style={styles.friendFeatureSmallText}>
                Share Spots
              </Text>
            </View>
          </View>
          <View style={styles.friendFeatureRow}>
            <View style={styles.friendFeatureSmall}>
              <Ionicons name="location-sharp" size={30} color="#FFD700" />
              <Text style={styles.friendFeatureSmallText}>Find Mutual Places</Text>
            </View>
            <View style={styles.friendFeatureSmall}>
              <Ionicons name="airplane" size={30} color="#9B59B6" />
              <Text style={styles.friendFeatureSmallText}>Mutual Trips</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      id: "wishlist",
      title: "Plan Future Adventures",
      subtitle: "Save places you want to visit and ideas for future trips",
      icon: "heart",
      backgroundColor: theme.colors.burntOrange,
      textColor: theme.colors.white,
      customContent: (
        <View style={styles.wishlistPreview}>
          <View style={styles.wishlistExplainer}>
            <Ionicons name="heart" size={40} color={theme.colors.white} />
            <Text style={styles.wishlistExplainerText}>
              Add your own ideas or heart spots from friends' posts
            </Text>
          </View>
          <View style={styles.priorityItem}>
            <Ionicons name="flame" size={30} color="#FFD700" />
            <Text style={styles.priorityText}>Must See</Text>
          </View>
          <View style={styles.priorityItem}>
            <Ionicons name="star" size={30} color="#4ECDC4" />
            <Text style={styles.priorityText}>Want to Visit</Text>
          </View>
          <View style={styles.priorityItem}>
            <Ionicons name="time" size={30} color="#95A5A6" />
            <Text style={styles.priorityText}>Maybe Someday</Text>
          </View>
        </View>
      ),
    },
    {
      id: "preferences",
      title: "Your Preferences",
      subtitle: "Choose your preferred distance units",
      backgroundColor: theme.colors.white,
      textColor: theme.colors.navy,
      customContent: (
        <View style={styles.preferencesContainer}>
          <Text style={styles.preferenceLabel}>Distance Units</Text>
          <View style={styles.unitsToggle}>
            <TouchableOpacity
              style={[
                styles.unitOption,
                selectedUnits === "metric" && styles.unitOptionActive,
              ]}
              onPress={() => setSelectedUnits("metric")}
            >
              <Text
                style={[
                  styles.unitText,
                  selectedUnits === "metric" && styles.unitTextActive,
                ]}
              >
                Kilometers
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitOption,
                selectedUnits === "imperial" && styles.unitOptionActive,
              ]}
              onPress={() => setSelectedUnits("imperial")}
            >
              <Text
                style={[
                  styles.unitText,
                  selectedUnits === "imperial" && styles.unitTextActive,
                ]}
              >
                Miles
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.unitsHint}>
            You can change this anytime in Settings
          </Text>
        </View>
      ),
    },
    {
      id: "ready",
      title: "You're All Set!",
      subtitle: `Welcome${
        userName ? `, ${userName}` : ""
      }! Let's start exploring`,
      backgroundColor: theme.colors.offWhite,
      textColor: theme.colors.navy,
      customContent: (
        <View style={styles.readyContainer}>
          <Ionicons
            name="checkmark-circle"
            size={100}
            color={theme.colors.forest}
          />
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>You're ready to:</Text>
            <View style={styles.summaryItem}>
              <Ionicons
                name="airplane"
                size={20}
                color={theme.colors.navy}
              />
              <Text style={styles.summaryText}>
                Create trips to organize adventures
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="fitness" size={20} color={theme.colors.navy} />
              <Text style={styles.summaryText}>
                Track activities and add to trips
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons
                name="location"
                size={20}
                color={theme.colors.navy}
              />
              <Text style={styles.summaryText}>
                Save spots and organize them
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons
                name="speedometer"
                size={20}
                color={theme.colors.gray}
              />
              <Text style={styles.summaryText}>
                Units: {selectedUnits === "metric" ? "Kilometers" : "Miles"}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons
                name={
                  locationPermissionGranted
                    ? "checkmark-circle"
                    : "close-circle"
                }
                size={20}
                color={
                  locationPermissionGranted
                    ? theme.colors.forest
                    : theme.colors.burntOrange
                }
              />
              <Text style={styles.summaryText}>
                Location:{" "}
                {locationPermissionGranted
                  ? "Enabled"
                  : "Not enabled (can enable later)"}
              </Text>
            </View>
          </View>
        </View>
      ),
    },
  ];

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollViewRef.current?.scrollTo({ x: width * nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    Alert.alert("Skip Setup?", "You can always change these settings later", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Skip",
        onPress: completeOnboarding,
        style: "destructive",
      },
    ]);
  };

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (
      slideIndex !== currentIndex &&
      slideIndex >= 0 &&
      slideIndex < slides.length
    ) {
      setCurrentIndex(slideIndex);
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: currentSlide.backgroundColor },
      ]}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Skip button */}
      {currentIndex < slides.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text
            style={[styles.skipButtonText, { color: currentSlide.textColor }]}
          >
            Skip
          </Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="center"
        bounces={false}
        overScrollMode="never"
        directionalLockEnabled={true}
        scrollEnabled={true}
      >
        {slides.map((slide, index) => (
          <Animated.View
            key={slide.id}
            style={[
              styles.slide,
              { backgroundColor: slide.backgroundColor },
              index === currentIndex && {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {slide.customContent}

            <View style={styles.slideContent}>
              {slide.icon && !slide.customContent && (
                <Ionicons
                  name={slide.icon as any}
                  size={80}
                  color={slide.textColor}
                />
              )}

              <Text style={[styles.slideTitle, { color: slide.textColor }]}>
                {slide.title}
              </Text>

              <Text
                style={[
                  styles.slideSubtitle,
                  { color: slide.textColor, opacity: 0.8 },
                ]}
              >
                {slide.subtitle}
              </Text>

              {slide.action && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: locationPermissionGranted
                        ? theme.colors.white + "40"
                        : theme.colors.white,
                      opacity: locationPermissionGranted ? 0.8 : 1,
                    },
                  ]}
                  onPress={slide.action}
                  disabled={locationPermissionGranted}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      {
                        color: theme.colors.forest,
                      },
                    ]}
                  >
                    {slide.actionLabel}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        {/* Swipe hint - only show on first few slides */}
        {currentIndex < 3 && (
          <Text
            style={[
              styles.swipeHint,
              { color: currentSlide.textColor, opacity: 0.6 },
            ]}
          >
            Swipe left to continue →
          </Text>
        )}

        {/* Page indicators */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                scrollViewRef.current?.scrollTo({
                  x: width * index,
                  animated: true,
                });
                setCurrentIndex(index);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
            >
              <View
                style={[
                  styles.paginationDot,
                  {
                    backgroundColor:
                      index === currentIndex
                        ? currentSlide.textColor
                        : `${currentSlide.textColor}30`,
                    width: index === currentIndex ? 24 : 8,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigation buttons */}
        <View style={styles.navigationButtons}>
          {/* Back button - show after first slide */}
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  borderColor:
                    currentSlide.textColor === theme.colors.white
                      ? theme.colors.white
                      : theme.colors.forest,
                },
              ]}
              onPress={() => {
                const prevIndex = currentIndex - 1;
                scrollViewRef.current?.scrollTo({
                  x: width * prevIndex,
                  animated: true,
                });
                setCurrentIndex(prevIndex);
              }}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color={
                  currentSlide.textColor === theme.colors.white
                    ? theme.colors.white
                    : theme.colors.forest
                }
              />
            </TouchableOpacity>
          )}

          {/* Next/Get Started button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor:
                  currentSlide.textColor === theme.colors.white
                    ? theme.colors.white
                    : theme.colors.forest,
                flex: currentIndex === 0 ? 1 : undefined,
                marginLeft: currentIndex > 0 ? 10 : 0,
              },
            ]}
            onPress={handleNext}
          >
            <Text
              style={[
                styles.nextButtonText,
                {
                  color:
                    currentSlide.textColor === theme.colors.white
                      ? theme.colors.forest
                      : theme.colors.white,
                },
              ]}
            >
              {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={
                currentIndex === slides.length - 1
                  ? "checkmark"
                  : "arrow-forward"
              }
              size={20}
              color={
                currentSlide.textColor === theme.colors.white
                  ? theme.colors.forest
                  : theme.colors.white
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  slide: {
    width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  slideContent: {
    alignItems: "center",
    marginTop: 30,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  slideSubtitle: {
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  inputContainer: {
    width: "100%",
    alignItems: "center",
  },
  nameInput: {
    backgroundColor: theme.colors.offWhite,
    borderWidth: 2,
    borderColor: theme.colors.forest,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 18,
    width: "100%",
    textAlign: "center",
    color: theme.colors.navy,
  },
  skipText: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 10,
  },
  tripsPreview: {
    alignItems: "center",
    marginBottom: 20,
  },
  tripExample: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 25,
  },
  tripIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  tripExampleTitle: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 5,
  },
  tripExampleSubtitle: {
    color: theme.colors.white,
    fontSize: 14,
    opacity: 0.8,
  },
  tripFeatures: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  tripFeature: {
    alignItems: "center",
  },
  tripFeatureText: {
    color: theme.colors.white,
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  featureContainer: {
    width: "100%",
    marginBottom: 20,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  featureItem: {
    alignItems: "center",
    margin: 15,
    minWidth: 70,
  },
  featureText: {
    color: theme.colors.white,
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    width: 70,
  },
  addToTripHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    padding: 15,
    borderRadius: 12,
  },
  addToTripHintText: {
    color: theme.colors.white,
    fontSize: 14,
    marginLeft: 10,
    fontWeight: "500",
  },
  spotsPreview: {
    width: "100%",
    marginBottom: 20,
  },
  categoriesPreview: {
    marginBottom: 20,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  categoryLabel: {
    color: theme.colors.white,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  autoTripPreview: {
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
  },
  autoTripCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  autoTripTitle: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 10,
  },
  autoTripText: {
    color: theme.colors.white,
    fontSize: 14,
    textAlign: "center",
    opacity: 0.9,
    lineHeight: 20,
  },
  autoTripExample: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 15,
    width: "100%",
  },
  autoTripExampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  autoTripExampleDate: {
    color: theme.colors.white,
    fontSize: 12,
    marginLeft: 8,
    opacity: 0.8,
  },
  autoTripExampleTitle: {
    color: theme.colors.white,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 5,
  },
  autoTripExampleDetails: {
    color: theme.colors.white,
    fontSize: 13,
    opacity: 0.8,
  },
  autoTripExampleNote: {
    color: theme.colors.white,
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
    fontStyle: "italic",
  },
  friendsPreview: {
    alignItems: "center",
    marginBottom: 20,
  },
  friendFeature: {
    alignItems: "center",
    marginBottom: 25,
  },
  friendFeatureTitle: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: "600",
    marginTop: 10,
  },
  friendFeatureText: {
    color: theme.colors.white,
    fontSize: 14,
    opacity: 0.9,
    marginTop: 5,
  },
  friendFeatureRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  friendFeatureSmall: {
    alignItems: "center",
    flex: 1,
  },
  friendFeatureSmallText: {
    color: theme.colors.white,
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  preferencesContainer: {
    width: "100%",
    marginBottom: 20,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 10,
  },
  unitsToggle: {
    flexDirection: "row",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 4,
  },
  unitOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  unitOptionActive: {
    backgroundColor: theme.colors.forest,
  },
  unitText: {
    fontSize: 16,
    color: theme.colors.gray,
    fontWeight: "500",
  },
  unitTextActive: {
    color: theme.colors.white,
  },
  unitsHint: {
    fontSize: 12,
    color: theme.colors.gray,
    marginTop: 10,
    textAlign: "center",
  },
  permissionInfo: {
    marginBottom: 20,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  permissionText: {
    color: theme.colors.white,
    marginLeft: 12,
    fontSize: 16,
  },
  actionButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  readyContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  summaryContainer: {
    marginTop: 30,
    backgroundColor: theme.colors.white,
    padding: 20,
    borderRadius: 12,
    width: "100%",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  summaryText: {
    fontSize: 16,
    color: theme.colors.gray,
    marginLeft: 10,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.borderGray,
    marginVertical: 10,
  },
  bottomNav: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20,
  },
  swipeHint: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
    fontStyle: "italic",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    minWidth: 120,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
  wishlistPreview: {
  alignItems: "center",
  marginBottom: 20,
},
wishlistExplainer: {
  alignItems: "center",
  marginBottom: 25,
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  padding: 20,
  borderRadius: 12,
  width: "100%",
},
wishlistExplainerText: {
  color: theme.colors.white,
  fontSize: 15,
  marginTop: 12,
  textAlign: "center",
  lineHeight: 22,
},
priorityItem: {
  flexDirection: "row",
  alignItems: "center",
  marginVertical: 10,
},
priorityText: {
  color: theme.colors.white,
  marginLeft: 15,
  fontSize: 18,
  fontWeight: "500",
},
});