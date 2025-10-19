import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Image } from "expo-image";

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";

const { height: H, width: W } = Dimensions.get("window");

const BOOKMARKS_KEY = "epoch_bookmarks";

// More interesting and globally relevant categories
const INTERESTING_CATEGORIES = [
  // Major Historical Events
  "World_War_II",
  "Ancient_Egypt",
  "Roman_Empire",
  "Renaissance",
  "Industrial_Revolution",
  "Space_exploration",
  "Cold_War",
  "Ancient_Greece",
  "Medieval_history",
  "Age_of_Discovery",

  // Science & Discovery
  "Scientific_discoveries",
  "Inventions",
  "Nobel_laureates",
  "Astronomers",
  "Physics",
  "Biology",
  "Chemistry",

  // Culture & Civilization
  "Ancient_civilizations",
  "World_Heritage_Sites",
  "Seven_Wonders_of_the_World",
  "Mythology",
  "Philosophy",
  "Art_movements",
  "Classical_music",

  // Geography & Nature
  "Natural_disasters",
  "Mountains",
  "Volcanoes",
  "Natural_history",
];

// Enhanced Wikipedia fetch with better filtering
const fetchWikipediaArticle = async () => {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/random/summary`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Epoch/1.0 (contact@epoch-app.com; Historical Learning App for Android/iOS)",
        "Api-User-Agent": "Epoch/1.0 (Historical Facts Educational App)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Wikipedia API error:", response.status);
      return null;
    }

    const data = await response.json();

    // Filter out unwanted boring articles
    const title = data.title.toLowerCase();
    const extract = (data.extract || "").toLowerCase();
    const fullText = title + " " + extract;

    // PHOBIA FILTERS - Skip spider and snake content
    const phobiaPatterns = [
      /\bspider\b/i,
      /\bspiders\b/i,
      /\barachnid\b/i,
      /\btarantula\b/i,
      /\bsnake\b/i,
      /\bsnakes\b/i,
      /\bserpent\b/i,
      /\bpython\b(?!.*programming)/i,
      /\bcobra\b/i,
      /\brattlesnake\b/i,
      /\bviper\b/i,
      /\bboa\b/i,
    ];

    // Check for phobia content first
    if (phobiaPatterns.some((pattern) => pattern.test(fullText))) {
      console.log("Skipping phobia content:", data.title);
      return null;
    }

    // Skip these types of boring articles
    const skipPatterns = [
      /\d{4}.*in\s+(sports|music|television|film)/i,
      /list of/i,
      /disambiguation/i,
      /^[\w\s]+ railway station$/i,
      /^[\w\s]+ (airport|bridge|dam|highway)$/i,
      /^[\w\s]+ (season|episode)$/i,
      /^\d{4}–\d{4}/,
    ];

    // Check if article should be skipped
    if (skipPatterns.some((pattern) => pattern.test(data.title))) {
      return null;
    }

    // Only accept articles with substantial content (150+ characters)
    if (!data.extract || data.extract.length < 150) {
      return null;
    }

    // Get the best available image
    let imageUrl = null;

    if (data.originalimage?.source) {
      imageUrl = data.originalimage.source;
    } else if (data.thumbnail?.source) {
      imageUrl = data.thumbnail.source.replace(/\/\d+px-/, "/800px-");
    } else {
      const category = determineCategory(data.title, data.extract);
      imageUrl = getFallbackImage(category);
    }

    return {
      id: data.pageid.toString(),
      title: data.title,
      desc: data.extract,
      date: "",
      cat: determineCategory(data.title, data.extract),
      img: imageUrl,
      url: data.content_urls?.desktop?.page || "",
    };
  } catch (error) {
    console.error("Fetch error:", error);
    return null;
  }
};

// Fallback images for different categories
const getFallbackImage = (category) => {
  const fallbackImages = {
    History:
      "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800",
    Science:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800",
    Technology:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
    Geography:
      "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800",
    Arts: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800",
    Space: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800",
    Notable:
      "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800",
  };

  return fallbackImages[category] || fallbackImages["Notable"];
};

// Helper function to categorize articles
const determineCategory = (title, extract) => {
  const text = (title + " " + extract).toLowerCase();

  if (text.match(/\b(war|battle|empire|ancient|medieval|century)\b/))
    return "History";
  if (text.match(/\b(scientist|discovery|physics|chemistry|biology)\b/))
    return "Science";
  if (text.match(/\b(computer|technology|invention|engineer)\b/))
    return "Technology";
  if (text.match(/\b(country|city|mountain|river|continent)\b/))
    return "Geography";
  if (text.match(/\b(artist|painter|composer|musician)\b/)) return "Arts";
  if (text.match(/\b(planet|space|star|galaxy|astronomy)\b/)) return "Space";

  return "Notable";
};

// Fetch multiple quality articles
const fetchMultipleArticles = async (count = 10) => {
  const results = [];
  let attempts = 0;
  const maxAttempts = count * 5;

  while (results.length < count && attempts < maxAttempts) {
    const article = await fetchWikipediaArticle();
    if (article) {
      results.push(article);
    }
    attempts++;
  }

  return results;
};

const InfoScreen = ({ onClose }) => {
  return (
    <View style={s.infoContainer}>
      {/* Back Button */}
      <TouchableOpacity
        style={s.infoBackButton}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#A78BFA" />
        <Text style={s.infoBackText}>Back</Text>
      </TouchableOpacity>

      <ScrollView style={s.infoScroll} showsVerticalScrollIndicator={false}>
        {/* App Section */}
        <View style={s.infoSection}>
          <Text style={s.infoTitle}>About Epoch</Text>
          <Text style={s.infoText}>
            Epoch is a beautiful, minimalist learning companion that brings you
            fascinating facts from Wikipedia every day. Swipe through
            captivating stories from history, groundbreaking scientific
            discoveries, geographical wonders, and more—all in an elegant,
            distraction-free experience.
          </Text>
          <Text style={s.infoText}>
            All content is randomly curated from Wikipedia's vast knowledge
            base, ensuring fresh and unexpected discoveries with every swipe. No
            two experiences are the same—just pure serendipitous learning.
          </Text>
          <Text style={s.infoText}>
            Epoch is completely free, open-source, and built with privacy at its
            core. All your bookmarks and preferences are stored locally on your
            device—no accounts, no tracking, no data collection. Your learning
            journey is yours alone.
          </Text>
        </View>

        {/* Developer Section */}
        <View style={s.infoSection}>
          <Text style={s.infoTitle}>About the Developer</Text>
          <Text style={s.infoText}>
            Epoch was born from my own love for random learning and mixing that
            with the swiping habit that we are already addicted to. I wanted to
            create something that captures that joy of discovery in a clean,
            modern interface—without the distractions of endless feeds and
            algorithms. So you spend the time learning something random and
            interesting instead of social media brainrot.
          </Text>
        </View>

        {/* Links Section */}
        <View style={s.infoSection}>
          <Text style={s.infoTitle}>Connect</Text>
          <View style={s.linksContainer}>
            <TouchableOpacity
              style={s.linkButton}
              onPress={() => Linking.openURL("https://github.com/AnuragC07")}
            >
              <Ionicons name="logo-github" size={24} color="#A78BFA" />
              <Text style={s.linkText}>GitHub</Text>
            </TouchableOpacity>
            {/* <TouchableOpacity 
              style={s.linkButton}
              onPress={() => Linking.openURL('https://linkedin.com/')}
            >
              <Ionicons name="logo-linkedin" size={24} color="#A78BFA" />
              <Text style={s.linkText}>LinkedIn</Text>
            </TouchableOpacity> */}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Made with 💜 for curious minds</Text>
          <Text style={s.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  const [bookmarks, setBookmarks] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewMode, setViewMode] = useState("all"); // 'all' or 'bookmarks'
  const [showInfo, setShowInfo] = useState(false);
  const [contentHeights, setContentHeights] = useState({});

  useEffect(() => {
    loadInitialData();
    loadBookmarks();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const data = await fetchMultipleArticles(10);
    setEvents(data);
    setLoading(false);
  };

  const loadMore = async () => {
    const moreData = await fetchMultipleArticles(5);
    setEvents((prev) => [...prev, ...moreData]);
  };

  // Load bookmarks from AsyncStorage
  const loadBookmarks = async () => {
    try {
      const stored = await AsyncStorage.getItem(BOOKMARKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setBookmarks(parsed);
        console.log("Loaded bookmarks:", parsed.length);
      }
    } catch (error) {
      console.error("Error loading bookmarks:", error);
    }
  };

  // Save bookmarks to AsyncStorage
  const saveBookmarksToStorage = async (newBookmarks) => {
    try {
      await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));
      console.log("Bookmarks saved:", newBookmarks.length);
    } catch (error) {
      console.error("Error saving bookmarks:", error);
    }
  };

  // Check if item is bookmarked
  const isBookmarked = (itemId) => {
    return bookmarks.some((bookmark) => bookmark.id === itemId);
  };

  // Toggle bookmark
  const toggleBookmark = (item) => {
    let newBookmarks;

    if (isBookmarked(item.id)) {
      // Remove bookmark
      newBookmarks = bookmarks.filter((bookmark) => bookmark.id !== item.id);
      Toast.show({
        type: "info",
        text1: "Bookmark Removed",
        text2: item.title.substring(0, 40) + "...",
        position: "top",
        topOffset: 60,
      });
    } else {
      // Add bookmark
      newBookmarks = [...bookmarks, item];
      Toast.show({
        type: "success",
        text1: "Bookmark Added ✓",
        text2: item.title.substring(0, 40) + "...",
        position: "top",
        topOffset: 60,
      });
    }

    setBookmarks(newBookmarks);
    saveBookmarksToStorage(newBookmarks);
  };

  // Update the toggleExpanded function to use LayoutAnimation
  const toggleExpanded = (id) => {
    // Custom animation configuration for Android
    LayoutAnimation.configureNext(
      Platform.OS === 'android' 
        ? LayoutAnimation.create(
            300, // duration
            LayoutAnimation.Types.easeInEaseOut,
            LayoutAnimation.Properties.scaleY
          )
        : {
            duration: 300,
            create: {
              type: LayoutAnimation.Types.easeInEaseOut,
              property: LayoutAnimation.Properties.opacity,
            },
            update: {
              type: LayoutAnimation.Types.easeInEaseOut,
              springDamping: 0.7,
            },
            delete: {
              type: LayoutAnimation.Types.easeInEaseOut,
              property: LayoutAnimation.Properties.opacity,
            },
          }
    );

    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const openWikiPage = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("Error opening URL:", error);
    }
  };

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={s.loadingText}>Loading Facts...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={s.container}>
        <StatusBar barStyle="light-content" />

        <FlatList
          data={viewMode === "bookmarks" ? bookmarks : events}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={H}
          decelerationRate="fast"
          disableIntervalMomentum={true}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <View style={s.card}>
              <Image
                source={{ uri: item.img }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={200}
              />
              <LinearGradient
                colors={[
                  "rgba(0,0,0,0.2)",
                  "rgba(0,0,0,0.7)",
                  "rgba(0,0,0,0.95)",
                ]}
                style={s.grad}
              >
                <View style={s.content}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{item.cat}</Text>
                  </View>

                  {/* Title with Bookmark Icon */}
                  <View style={s.titleRow}>
                    <TouchableOpacity
                      onPress={() => openWikiPage(item.url)}
                      activeOpacity={0.7}
                      style={s.titleContainer}
                    >
                      <Text style={s.title}>{item.title}</Text>
                      <Text style={s.titleHint}>
                        Tap to read more on Wikipedia
                      </Text>
                    </TouchableOpacity>

                    {/* Bookmark Button */}
                    <TouchableOpacity
                      onPress={() => toggleBookmark(item)}
                      activeOpacity={0.7}
                      style={s.bookmarkButton}
                    >
                      <Ionicons
                        name={
                          isBookmarked(item.id)
                            ? "bookmark"
                            : "bookmark-outline"
                        }
                        size={28}
                        color="#A78BFA"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={s.descContainer}>
                    <Animated.View
                      style={{
                        overflow: "hidden",
                        maxHeight: expandedItems[item.id]
                          ? contentHeights[item.id] || "auto"
                          : 100,
                      }}
                    >
                      {expandedItems[item.id] ? (
                        <ScrollView
                          style={s.descScrollView}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                          contentContainerStyle={{ maxHeight: H * 0.3 }} // Limit to 30% of screen height
                          onLayout={(event) => {
                            const { height } = event.nativeEvent.layout;
                            setContentHeights((prev) => ({
                              ...prev,
                              [item.id]: Math.min(height, H * 0.3),
                            }));
                          }}
                        >
                          <Text style={s.desc}>
                            {item.desc.length > 800 
                              ? item.desc.slice(0, 800) + '...' 
                              : item.desc}
                          </Text>
                        </ScrollView>
                      ) : (
                        <Text style={s.desc} numberOfLines={4}>
                          {item.desc.length > 200 
                            ? item.desc.slice(0, 200) + '...' 
                            : item.desc}
                        </Text>
                      )}
                    </Animated.View>

                    <TouchableOpacity
                      style={s.expandButton}
                      onPress={() => toggleExpanded(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.expandIcon}>
                        {expandedItems[item.id] ? "▼" : "▲"}
                      </Text>
                      <Text style={s.expandText}>
                        {expandedItems[item.id] ? "Show Less" : "Read More"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.swipe}>
                    <View style={s.line} />
                    <Text style={s.swipeText}>SWIPE UP</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}
        />

        {/* Logo with Dropdown */}
        <TouchableOpacity
          style={s.logo}
          onPress={() => setShowDropdown(!showDropdown)}
          activeOpacity={0.8}
        >
          <Text style={s.logoText}>EPOCH</Text>
        </TouchableOpacity>

        {/* Dropdown Menu */}
        {showDropdown && (
          <View style={s.dropdown}>
            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => {
                setViewMode("bookmarks");
                setShowDropdown(false);
                Toast.show({
                  type: "success",
                  text1: "Bookmarks",
                  text2: `Showing ${bookmarks.length} bookmarked items`,
                  position: "top",
                  topOffset: 60,
                });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="bookmark" size={20} color="#A78BFA" />
              <Text style={s.dropdownText}>Bookmarks</Text>
            </TouchableOpacity>

            <View style={s.dropdownDivider} />

            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => {
                setShowDropdown(false);
                setShowInfo(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="information-circle" size={20} color="#A78BFA" />
              <Text style={s.dropdownText}>Info</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bookmarks Header Bar (shows when in bookmarks mode) */}
        {viewMode === "bookmarks" && (
          <View style={s.bookmarksHeader}>
            <Ionicons
              name="bookmark"
              size={20}
              color="#8940C9"
              style={{ marginRight: 8 }}
            />
            <Text style={s.bookmarksHeaderText}>
              Bookmarks ({bookmarks.length})
            </Text>
            <TouchableOpacity
              onPress={() => {
                setViewMode("all");
                Toast.show({
                  type: "success",
                  text1: "Back to Home",
                  text2: "Showing all facts",
                  position: "top",
                  topOffset: 60,
                });
              }}
              style={s.closeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Info Screen (hidden by default) */}
        {showInfo && <InfoScreen onClose={() => setShowInfo(false)} />}
      </View>
      <Toast />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { justifyContent: "center", alignItems: "center" },
  card: { height: H, width: W, overflow: "hidden" },
  grad: { flex: 1, justifyContent: "flex-end" },
  content: { padding: 24, paddingBottom: 60 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#200E30",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: {
    color: "#8940C9",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 4,
    lineHeight: 38,
    // textDecorationLine: "underline",
  },
  titleHint: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 9,
    fontStyle: "italic",
  },
  bookmarkButton: {
    padding: 10,
    backgroundColor: "rgba(45, 45, 46, 0.4)",
    borderRadius: 12,
    marginTop: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  descContainer: {
    marginBottom: 16,
    overflow: "hidden",
    // borderWidth: 2,
    // borderColor: "red",
    height: "fit-content",
  },
  descScrollView: {
    flexGrow: 0, // This ensures the ScrollView only takes the space it needs
  },
  desc: {
    color: "#BABABA",
    fontSize: 14,
    lineHeight: 24,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(47, 47, 51, 0.3)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 8,
  },
  expandIcon: {
    color: "#A78BFA",
    fontSize: 14,
    marginRight: 8,
  },
  expandText: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "600",
  },
  swipe: { alignItems: "center", marginTop: 16 },
  line: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    marginBottom: 8,
  },
  swipeText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    letterSpacing: 1,
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginTop: 16,
  },
  logo: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  logoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 3,
  },
  dropdown: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 12,
    fontWeight: "500",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginVertical: 4,
  },
  bookmarksHeader: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    backgroundColor: "#200E30",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1000,
  },
  bookmarksHeaderText: {
    color: "#8940C9",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 12,
  },
  closeButton: {
    marginLeft: 8,
  },
  infoContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    padding: 24,
    zIndex: 2000,
  },
  infoBackButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 40,
  },
  infoScroll: {
    flex: 1,
    paddingTop: 40,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoText: {
    color: "#BABABA",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  linksContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    flexWrap: "wrap",
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 12,
    marginBottom: 12,
  },
  linkText: {
    color: "#A78BFA",
    fontSize: 14,
    marginLeft: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 16,
    paddingBottom: 48,
    alignItems: "center",
  },
  footerText: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 4,
  },
  versionText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
  },
});
