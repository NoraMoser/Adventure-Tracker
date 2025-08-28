// statistics.tsx - Updated with Settings Integration
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { LineChart, PieChart, ProgressChart } from "react-native-chart-kit";
import { theme } from "../constants/theme";
import { useActivity } from "../contexts/ActivityContext";
import { useLocation } from "../contexts/LocationContext";
import { useSettings } from "../contexts/SettingsContext"; // ADD THIS

const { width } = Dimensions.get("window");

// Achievement definitions
const ACHIEVEMENTS = [
  {
    id: "first_activity",
    name: "First Steps",
    icon: "footsteps",
    requirement: "Complete your first activity",
    color: "#4CAF50",
  },
  {
    id: "first_location",
    name: "Explorer",
    icon: "location",
    requirement: "Save your first location",
    color: "#2196F3",
  },
  {
    id: "week_streak",
    name: "Week Warrior",
    icon: "flame",
    requirement: "7 day activity streak",
    color: "#FF9800",
  },
  {
    id: "month_streak",
    name: "Dedicated",
    icon: "trophy",
    requirement: "30 day activity streak",
    color: "#FFD700",
  },
  {
    id: "10_activities",
    name: "Active",
    icon: "fitness",
    requirement: "Complete 10 activities",
    color: "#9C27B0",
  },
  {
    id: "25_locations",
    name: "Adventurer",
    icon: "map",
    requirement: "Save 25 locations",
    color: "#00BCD4",
  },
  {
    id: "100km",
    name: "Century",
    icon: "bicycle",
    requirement: "Travel 100km total",
    color: "#8BC34A",
  },
  {
    id: "5_categories",
    name: "Versatile",
    icon: "apps",
    requirement: "Try 5 different categories",
    color: "#FF5722",
  },
  {
    id: "early_bird",
    name: "Early Bird",
    icon: "sunny",
    requirement: "Activity before 7 AM",
    color: "#FFC107",
  },
  {
    id: "night_owl",
    name: "Night Owl",
    icon: "moon",
    requirement: "Activity after 9 PM",
    color: "#3F51B5",
  },
];

// Personal Record Card Component
const PersonalRecordCard = ({
  title,
  value,
  unit,
  icon,
  date,
  color,
}: {
  title: string;
  value: string;
  unit: string;
  icon: string;
  date: string;
  color: string;
}) => (
  <View style={[styles.prCard, { borderLeftColor: color }]}>
    <View style={styles.prHeader}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={styles.prTitle}>{title}</Text>
    </View>
    <View style={styles.prValue}>
      <Text style={styles.prNumber}>{value}</Text>
      <Text style={styles.prUnit}>{unit}</Text>
    </View>
    <Text style={styles.prDate}>{date}</Text>
  </View>
);

// Achievement Badge Component
const AchievementBadge = ({
  achievement,
  earned,
  progress,
}: {
  achievement: any;
  earned: boolean;
  progress?: number;
}) => (
  <TouchableOpacity
    style={[styles.achievementBadge, !earned && styles.achievementLocked]}
    activeOpacity={0.7}
  >
    <View
      style={[
        styles.achievementIcon,
        { backgroundColor: earned ? achievement.color + "20" : "#f0f0f0" },
      ]}
    >
      <Ionicons
        name={achievement.icon}
        size={24}
        color={earned ? achievement.color : "#ccc"}
      />
    </View>
    <Text
      style={[styles.achievementName, !earned && styles.achievementNameLocked]}
    >
      {achievement.name}
    </Text>
    {!earned && progress !== undefined && (
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: achievement.color,
            },
          ]}
        />
      </View>
    )}
  </TouchableOpacity>
);

export default function StatisticsScreen() {
  const { activities } = useActivity();
  const { savedSpots } = useLocation();
  const {
    formatDistance,
    formatSpeed,
    convertDistance,
    getDistanceUnit,
    getSpeedUnit,
  } = useSettings(); // ADD THIS
  const [selectedPeriod, setSelectedPeriod] = useState<
    "week" | "month" | "year"
  >("week");
  const [selectedMetric, setSelectedMetric] = useState<
    "distance" | "duration" | "activities"
  >("distance");

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const totalDistance = activities.reduce(
      (sum, act) => sum + act.distance,
      0
    );
    const totalDuration = activities.reduce(
      (sum, act) => sum + act.duration,
      0
    );
    const totalActivities = activities.length;
    const totalLocations = savedSpots.length;

    // Calculate averages
    const avgDistance =
      totalActivities > 0 ? totalDistance / totalActivities : 0;
    const avgDuration =
      totalActivities > 0 ? totalDuration / totalActivities : 0;
    const avgSpeed =
      activities.reduce((sum, act) => sum + act.averageSpeed, 0) /
      (totalActivities || 1);

    // Calculate streak
    // Fixed calculateStreak function - use this in both index.tsx and statistics.tsx

    function calculateStreak() {
      if (activities.length === 0) return 0;

      const sortedActivities = [...activities].sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      // Get today's date at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get the most recent activity date at midnight
      const mostRecentActivity = new Date(sortedActivities[0].startTime);
      mostRecentActivity.setHours(0, 0, 0, 0);

      // Calculate days since most recent activity
      const daysSinceLastActivity = Math.floor(
        (today.getTime() - mostRecentActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      // If last activity was more than 1 day ago, streak is broken
      if (daysSinceLastActivity > 1) {
        return 0;
      }

      // Build a set of all activity dates (as date strings)
      const activityDates = new Set(
        activities.map((activity) => {
          const date = new Date(activity.startTime);
          date.setHours(0, 0, 0, 0);
          return date.toDateString();
        })
      );

      // Start counting from the most recent activity date
      let streak = 0;
      let checkDate = new Date(mostRecentActivity);

      // Count consecutive days going backwards
      while (activityDates.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      return streak;
    }
    // Activity type distribution
    const activityTypes = activities.reduce((acc, act) => {
      acc[act.type] = (acc[act.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Category distribution for locations
    const locationCategories = savedSpots.reduce((acc, spot) => {
      acc[spot.category] = (acc[spot.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Personal Records
    const personalRecords = {
      longestDistance: activities.reduce(
        (max, act) => (act.distance > max.distance ? act : max),
        { distance: 0, startTime: new Date() }
      ),
      longestDuration: activities.reduce(
        (max, act) => (act.duration > max.duration ? act : max),
        { duration: 0, startTime: new Date() }
      ),
      fastestSpeed: activities.reduce(
        (max, act) => (act.maxSpeed > max.maxSpeed ? act : max),
        { maxSpeed: 0, startTime: new Date() }
      ),
      mostProductiveDay: (() => {
        const dayCount: Record<string, number> = {};
        activities.forEach((act) => {
          const day = new Date(act.startTime).toDateString();
          dayCount[day] = (dayCount[day] || 0) + 1;
        });
        const maxDay = Object.entries(dayCount).reduce(
          (max, [day, count]) => (count > max.count ? { day, count } : max),
          { day: "", count: 0 }
        );
        return maxDay;
      })(),
    };

    // Time-based data for charts
    const getTimeBasedData = () => {
      const data: number[] = [];
      const labels: string[] = [];

      if (selectedPeriod === "week") {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);

          const dayActivities = activities.filter((act) => {
            const actDate = new Date(act.startTime);
            return actDate.toDateString() === date.toDateString();
          });

          if (selectedMetric === "distance") {
            // Use convertDistance to respect user's units preference
            data.push(
              dayActivities.reduce(
                (sum, act) => sum + convertDistance(act.distance),
                0
              )
            );
          } else if (selectedMetric === "duration") {
            data.push(
              dayActivities.reduce((sum, act) => sum + act.duration / 3600, 0)
            );
          } else {
            data.push(dayActivities.length);
          }

          labels.push(date.toLocaleDateString("en", { weekday: "short" }));
        }
      } else if (selectedPeriod === "month") {
        // Last 4 weeks
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          const weekActivities = activities.filter((act) => {
            const actDate = new Date(act.startTime);
            return actDate >= weekStart && actDate <= weekEnd;
          });

          if (selectedMetric === "distance") {
            data.push(
              weekActivities.reduce(
                (sum, act) => sum + convertDistance(act.distance),
                0
              )
            );
          } else if (selectedMetric === "duration") {
            data.push(
              weekActivities.reduce((sum, act) => sum + act.duration / 3600, 0)
            );
          } else {
            data.push(weekActivities.length);
          }

          labels.push(`Week ${4 - i}`);
        }
      } else {
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date();
          monthDate.setMonth(monthDate.getMonth() - i);
          const month = monthDate.getMonth();
          const year = monthDate.getFullYear();

          const monthActivities = activities.filter((act) => {
            const actDate = new Date(act.startTime);
            return (
              actDate.getMonth() === month && actDate.getFullYear() === year
            );
          });

          if (selectedMetric === "distance") {
            data.push(
              monthActivities.reduce(
                (sum, act) => sum + convertDistance(act.distance),
                0
              )
            );
          } else if (selectedMetric === "duration") {
            data.push(
              monthActivities.reduce((sum, act) => sum + act.duration / 3600, 0)
            );
          } else {
            data.push(monthActivities.length);
          }

          labels.push(monthDate.toLocaleDateString("en", { month: "short" }));
        }
      }

      return { data, labels };
    };

    return {
      totalDistance,
      totalDuration,
      totalActivities,
      totalLocations,
      avgDistance,
      avgDuration,
      avgSpeed,
      streak: calculateStreak(),
      activityTypes,
      locationCategories,
      personalRecords,
      timeBasedData: getTimeBasedData(),
    };
  }, [activities, savedSpots, selectedPeriod, selectedMetric, convertDistance]); // Added convertDistance to deps

  // Calculate achievement progress
  const achievements = ACHIEVEMENTS.map((achievement) => {
    let earned = false;
    let progress = 0;

    switch (achievement.id) {
      case "first_activity":
        earned = stats.totalActivities >= 1;
        progress = Math.min(stats.totalActivities * 100, 100);
        break;
      case "first_location":
        earned = stats.totalLocations >= 1;
        progress = Math.min(stats.totalLocations * 100, 100);
        break;
      case "week_streak":
        earned = stats.streak >= 7;
        progress = (stats.streak / 7) * 100;
        break;
      case "month_streak":
        earned = stats.streak >= 30;
        progress = (stats.streak / 30) * 100;
        break;
      case "10_activities":
        earned = stats.totalActivities >= 10;
        progress = (stats.totalActivities / 10) * 100;
        break;
      case "25_locations":
        earned = stats.totalLocations >= 25;
        progress = (stats.totalLocations / 25) * 100;
        break;
      case "100km":
        earned = stats.totalDistance >= 100000;
        progress = (stats.totalDistance / 100000) * 100;
        break;
      case "5_categories":
        const uniqueCategories = new Set(savedSpots.map((s) => s.category))
          .size;
        earned = uniqueCategories >= 5;
        progress = (uniqueCategories / 5) * 100;
        break;
      case "early_bird":
        earned = activities.some((act) => {
          const hour = new Date(act.startTime).getHours();
          return hour < 7;
        });
        break;
      case "night_owl":
        earned = activities.some((act) => {
          const hour = new Date(act.startTime).getHours();
          return hour >= 21;
        });
        break;
    }

    return { ...achievement, earned, progress };
  });

  const earnedAchievements = achievements.filter((a) => a.earned).length;

  // Chart configuration
  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(45, 90, 61, ${opacity})`, // forest color
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 1,
    propsForLabels: {
      fontSize: 10,
    },
  };

  // Prepare pie chart data for activity types
  const pieData = Object.entries(stats.activityTypes).map(
    ([type, count], index) => ({
      name: type,
      population: count,
      color: [
        theme.colors.forest,
        theme.colors.navy,
        theme.colors.burntOrange,
        "#9C27B0",
        "#00BCD4",
        "#8BC34A",
      ][index % 6],
      legendFontColor: "#7F7F7F",
      legendFontSize: 12,
    })
  );

  // Progress ring data
  const progressData = {
    labels: ["Streak", "Goals", "Achievements"],
    data: [
      Math.min(stats.streak / 30, 1), // 30 day goal
      stats.totalActivities >= 10 ? 1 : stats.totalActivities / 10,
      earnedAchievements / ACHIEVEMENTS.length,
    ],
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get the correct metric label based on user's units preference
  const getMetricLabel = () => {
    if (selectedMetric === "distance") {
      return `Distance (${getDistanceUnit() === "kilometers" ? "km" : "mi"})`;
    } else if (selectedMetric === "duration") {
      return "Duration (hrs)";
    } else {
      return "Activities";
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Stack.Screen
        options={{
          title: "Statistics",
          headerStyle: {
            backgroundColor: theme.colors.forest,
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />

      {/* Header Stats */}
      <View style={styles.headerStats}>
        <View style={styles.bigStatCard}>
          <Text style={styles.bigStatNumber}>{stats.streak}</Text>
          <Text style={styles.bigStatLabel}>Day Streak</Text>
          <Ionicons name="flame" size={24} color="#FF9800" />
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.smallStatCard}>
            <Ionicons name="fitness" size={20} color={theme.colors.forest} />
            <Text style={styles.smallStatNumber}>{stats.totalActivities}</Text>
            <Text style={styles.smallStatLabel}>Activities</Text>
          </View>
          <View style={styles.smallStatCard}>
            <Ionicons name="location" size={20} color={theme.colors.navy} />
            <Text style={styles.smallStatNumber}>{stats.totalLocations}</Text>
            <Text style={styles.smallStatLabel}>Places</Text>
          </View>
          <View style={styles.smallStatCard}>
            <Ionicons
              name="navigate"
              size={20}
              color={theme.colors.burntOrange}
            />
            <Text style={styles.smallStatNumber}>
              {formatDistance(stats.totalDistance, 0)}
            </Text>
            <Text style={styles.smallStatLabel}>Total</Text>
          </View>
          <View style={styles.smallStatCard}>
            <Ionicons name="time" size={20} color="#9C27B0" />
            <Text style={styles.smallStatNumber}>
              {formatDuration(stats.totalDuration)}
            </Text>
            <Text style={styles.smallStatLabel}>Duration</Text>
          </View>
        </View>
      </View>

      {/* Progress Rings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress Overview</Text>
        <View style={styles.progressContainer}>
          <ProgressChart
            data={progressData}
            width={width - 40}
            height={180}
            strokeWidth={12}
            radius={28}
            chartConfig={{
              ...chartConfig,
              color: (opacity: number = 1, index: number = 0) => {
                const colors = [
                  theme.colors.forest,
                  theme.colors.navy,
                  theme.colors.burntOrange,
                ];
                return colors[index] || theme.colors.gray;
              },
            }}
            hideLegend={false}
            style={styles.chart}
          />
        </View>
      </View>

      {/* Activity Trends */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Activity Trends</Text>
          <View style={styles.periodSelector}>
            {(["week", "month", "year"] as const).map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.periodButton,
                  selectedPeriod === period && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === period && styles.periodButtonTextActive,
                  ]}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.metricSelector}
        >
          {(["distance", "duration", "activities"] as const).map((metric) => (
            <TouchableOpacity
              key={metric}
              style={[
                styles.metricChip,
                selectedMetric === metric && styles.metricChipActive,
              ]}
              onPress={() => setSelectedMetric(metric)}
            >
              <Text
                style={[
                  styles.metricChipText,
                  selectedMetric === metric && styles.metricChipTextActive,
                ]}
              >
                {metric === "distance"
                  ? `Distance (${
                      getDistanceUnit() === "kilometers" ? "km" : "mi"
                    })`
                  : metric === "duration"
                  ? "Duration (hrs)"
                  : "Activities"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {stats.timeBasedData.data.length > 0 && (
          <LineChart
            data={{
              labels: stats.timeBasedData.labels,
              datasets: [
                {
                  data: stats.timeBasedData.data,
                },
              ],
            }}
            width={width - 20}
            height={200}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => theme.colors.forest,
              propsForDots: {
                r: "4",
                strokeWidth: "2",
                stroke: theme.colors.forest,
              },
            }}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={true}
          />
        )}
      </View>

      {/* Personal Records - Updated with formatters */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Records</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <PersonalRecordCard
            title="Longest Distance"
            value={
              formatDistance(
                stats.personalRecords.longestDistance.distance,
                1
              ).split(" ")[0]
            }
            unit={
              formatDistance(
                stats.personalRecords.longestDistance.distance,
                1
              ).split(" ")[1] || ""
            }
            icon="trending-up"
            date={new Date(
              stats.personalRecords.longestDistance.startTime
            ).toLocaleDateString()}
            color={theme.colors.forest}
          />
          <PersonalRecordCard
            title="Longest Duration"
            value={formatDuration(
              stats.personalRecords.longestDuration.duration
            )}
            unit=""
            icon="time"
            date={new Date(
              stats.personalRecords.longestDuration.startTime
            ).toLocaleDateString()}
            color={theme.colors.navy}
          />
          <PersonalRecordCard
            title="Fastest Speed"
            value={
              formatSpeed(stats.personalRecords.fastestSpeed.maxSpeed).split(
                " "
              )[0]
            }
            unit={getSpeedUnit()}
            icon="speedometer"
            date={new Date(
              stats.personalRecords.fastestSpeed.startTime
            ).toLocaleDateString()}
            color={theme.colors.burntOrange}
          />
          <PersonalRecordCard
            title="Most Active Day"
            value={stats.personalRecords.mostProductiveDay.count.toString()}
            unit="activities"
            icon="calendar"
            date={stats.personalRecords.mostProductiveDay.day}
            color="#9C27B0"
          />
        </ScrollView>
      </View>

      {/* Activity Type Distribution */}
      {pieData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Distribution</Text>
          <View style={styles.pieChartContainer}>
            <PieChart
              data={pieData}
              width={width - 40}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        </View>
      )}

      {/* Achievements */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <Text style={styles.achievementCount}>
            {earnedAchievements}/{ACHIEVEMENTS.length} Unlocked
          </Text>
        </View>
        <View style={styles.achievementsGrid}>
          {achievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              earned={achievement.earned}
              progress={achievement.progress}
            />
          ))}
        </View>
      </View>

      {/* Average Stats - Updated with formatters */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Averages</Text>
        <View style={styles.averageCards}>
          <View style={styles.averageCard}>
            <Ionicons name="analytics" size={24} color={theme.colors.forest} />
            <Text style={styles.averageValue}>
              {formatDistance(stats.avgDistance)}
            </Text>
            <Text style={styles.averageLabel}>per activity</Text>
          </View>
          <View style={styles.averageCard}>
            <Ionicons name="hourglass" size={24} color={theme.colors.navy} />
            <Text style={styles.averageValue}>
              {formatDuration(stats.avgDuration)}
            </Text>
            <Text style={styles.averageLabel}>per activity</Text>
          </View>
          <View style={styles.averageCard}>
            <Ionicons
              name="speedometer"
              size={24}
              color={theme.colors.burntOrange}
            />
            <Text style={styles.averageValue}>
              {formatSpeed(stats.avgSpeed)}
            </Text>
            <Text style={styles.averageLabel}>avg speed</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
  },
  headerStats: {
    flexDirection: "row",
    padding: 15,
    backgroundColor: theme.colors.white,
  },
  bigStatCard: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  bigStatNumber: {
    fontSize: 36,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  bigStatLabel: {
    fontSize: 14,
    color: theme.colors.gray,
    marginTop: 4,
  },
  statsGrid: {
    flex: 1.5,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  smallStatCard: {
    width: "48%",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    padding: 12,
    margin: "1%",
    alignItems: "center",
  },
  smallStatNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 4,
  },
  smallStatLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.colors.white,
    marginTop: 10,
    padding: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.navy,
    marginBottom: 15,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: theme.colors.offWhite,
    borderRadius: 8,
    padding: 2,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: theme.colors.white,
  },
  periodButtonText: {
    fontSize: 12,
    color: theme.colors.gray,
  },
  periodButtonTextActive: {
    color: theme.colors.forest,
    fontWeight: "600",
  },
  metricSelector: {
    marginBottom: 15,
    marginHorizontal: -15,
    paddingHorizontal: 15,
  },
  metricChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 20,
    marginRight: 8,
  },
  metricChipActive: {
    backgroundColor: theme.colors.forest,
  },
  metricChipText: {
    fontSize: 13,
    color: theme.colors.gray,
  },
  metricChipTextActive: {
    color: theme.colors.white,
  },
  chart: {
    marginLeft: -20,
    borderRadius: 8,
  },
  progressContainer: {
    alignItems: "center",
  },
  prCard: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    marginRight: 12,
    width: 140,
    borderLeftWidth: 4,
  },
  prHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  prTitle: {
    fontSize: 12,
    color: theme.colors.gray,
    marginLeft: 6,
  },
  prValue: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  prNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.colors.navy,
  },
  prUnit: {
    fontSize: 14,
    color: theme.colors.gray,
    marginLeft: 4,
  },
  prDate: {
    fontSize: 11,
    color: theme.colors.lightGray,
    marginTop: 4,
  },
  pieChartContainer: {
    alignItems: "center",
  },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  achievementBadge: {
    width: "30%",
    alignItems: "center",
    marginBottom: 20,
  },
  achievementLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  achievementName: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.navy,
    textAlign: "center",
  },
  achievementNameLocked: {
    color: theme.colors.gray,
  },
  progressBar: {
    width: "80%",
    height: 4,
    backgroundColor: theme.colors.borderGray,
    borderRadius: 2,
    marginTop: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  achievementCount: {
    fontSize: 14,
    color: theme.colors.forest,
    fontWeight: "600",
  },
  averageCards: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  averageCard: {
    flex: 1,
    backgroundColor: theme.colors.offWhite,
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginHorizontal: 5,
  },
  averageValue: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.navy,
    marginTop: 8,
  },
  averageLabel: {
    fontSize: 11,
    color: theme.colors.gray,
    marginTop: 4,
  },
});
