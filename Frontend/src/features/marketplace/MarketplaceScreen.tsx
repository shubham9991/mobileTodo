import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Pressable, TextInput, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { BottomNavbar } from '../../layout/BottomNavbar';

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = 'All' | 'Plugins' | 'Themes';
type SortOption = 'Featured' | 'Popular' | 'Newest' | 'Price';

interface MarketItem {
  id: string;
  type: 'plugin' | 'theme';
  name: string;
  author: string;
  description: string;
  price: number | 'Free';
  rating: number;
  reviews: number;
  downloads: number;
  icon: string;
  iconBg: string;
  accentColor: string;
  tags: string[];
  featured?: boolean;
  new?: boolean;
  owned?: boolean;
  previewColors?: string[]; // for themes
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────
const MARKET_ITEMS: MarketItem[] = [
  {
    id: 'habit-tracker', type: 'plugin',
    name: 'Habit Tracker Pro', author: 'ModularLabs',
    description: 'Build streaks, track daily habits, and visualize your progress with beautiful charts.',
    price: 2.99, rating: 4.8, reviews: 1243, downloads: 38200,
    icon: 'repeat', iconBg: '#7C3AED', accentColor: '#7C3AED',
    tags: ['Productivity', 'Health'], featured: true,
    owned: false,
  },
  {
    id: 'pomodoro', type: 'plugin',
    name: 'Pomodoro Focus', author: 'TimerCraft',
    description: 'Deep work sessions with Pomodoro timer, break reminders and session history.',
    price: 'Free', rating: 4.6, reviews: 895, downloads: 62100,
    icon: 'timer', iconBg: '#EF4444', accentColor: '#EF4444',
    tags: ['Focus', 'Productivity'], new: true,
  },
  {
    id: 'finance-tracker', type: 'plugin',
    name: 'Finance Tracker', author: 'ModularLabs',
    description: 'Budget, track expenses and visualize spending across your tasks and goals.',
    price: 4.99, rating: 4.9, reviews: 3102, downloads: 91500,
    icon: 'account-balance', iconBg: '#22C55E', accentColor: '#22C55E',
    tags: ['Finance', 'Analytics'], owned: true,
  },
  {
    id: 'kanban-board', type: 'plugin',
    name: 'Kanban Board', author: 'FlowApps',
    description: 'Visualize your tasks as a drag-and-drop Kanban board with swim lanes.',
    price: 3.49, rating: 4.5, reviews: 712, downloads: 24800,
    icon: 'view-kanban', iconBg: '#F97316', accentColor: '#F97316',
    tags: ['Organization', 'Visual'],
  },
  {
    id: 'ai-writer', type: 'plugin',
    name: 'AI Task Writer', author: 'AIForge',
    description: "Auto-generates task descriptions and subtasks from a single sentence using AI.",
    price: 5.99, rating: 4.7, reviews: 2314, downloads: 47600,
    icon: 'auto-awesome', iconBg: '#6366F1', accentColor: '#6366F1',
    tags: ['AI', 'Automation'], featured: true,
  },
  {
    id: 'calendar-sync', type: 'plugin',
    name: 'Calendar Sync+', author: 'CalApps',
    description: 'Two-way sync with Google Calendar, Outlook, and Apple Calendar.',
    price: 1.99, rating: 4.3, reviews: 541, downloads: 18300,
    icon: 'event-available', iconBg: '#0891B2', accentColor: '#0891B2',
    tags: ['Calendar', 'Sync'],
  },
  {
    id: 'dusk', type: 'theme',
    name: 'Dusk Purple', author: 'DesignForge',
    description: 'A rich twilight-inspired dark theme with deep purples and glowing accents.',
    price: 1.99, rating: 4.9, reviews: 4210, downloads: 128000,
    icon: 'palette', iconBg: '#7C3AED', accentColor: '#7C3AED',
    previewColors: ['#1C1C2E', '#7C3AED', '#9F67F8', '#FFFFFF'],
    tags: ['Dark', 'Purple'], featured: true, owned: true,
  },
  {
    id: 'forest-night', type: 'theme',
    name: 'Forest Night', author: 'NatureUI',
    description: 'Calming deep green aesthetic inspired by night-time forests and nature.',
    price: 'Free', rating: 4.4, reviews: 1890, downloads: 73400,
    icon: 'palette', iconBg: '#22C55E', accentColor: '#22C55E',
    previewColors: ['#0D1F0F', '#22C55E', '#4ADE80', '#FFFFFF'],
    tags: ['Dark', 'Green', 'Free'],
  },
  {
    id: 'ocean-breeze', type: 'theme',
    name: 'Ocean Breeze', author: 'WaveStudios',
    description: 'Fresh light theme with ocean-inspired blues, teals, and crisp whites.',
    price: 2.49, rating: 4.6, reviews: 2180, downloads: 56200,
    icon: 'palette', iconBg: '#0891B2', accentColor: '#0891B2',
    previewColors: ['#F0F9FF', '#0891B2', '#22D3EE', '#0F172A'],
    tags: ['Light', 'Blue'], new: true,
  },
  {
    id: 'rose-gold', type: 'theme',
    name: 'Rose Gold', author: 'LuxeUI',
    description: 'Premium warm rose gold tones for an elegant, minimal productivity aesthetic.',
    price: 3.99, rating: 4.8, reviews: 3412, downloads: 89100,
    icon: 'palette', iconBg: '#F43F5E', accentColor: '#F43F5E',
    previewColors: ['#FFF1F2', '#F43F5E', '#FB7185', '#1A1A1A'],
    tags: ['Light', 'Pink'],
  },
  {
    id: 'monochrome', type: 'theme',
    name: 'Monochrome', author: 'MinimalistCo',
    description: 'Pure black and white with surgical precision. Perfect for distraction-free work.',
    price: 'Free', rating: 4.2, reviews: 987, downloads: 44300,
    icon: 'palette', iconBg: '#18181B', accentColor: '#18181B',
    previewColors: ['#FFFFFF', '#18181B', '#71717A', '#09090B'],
    tags: ['Minimal', 'Free'],
  },
  {
    id: 'retro-wave', type: 'theme',
    name: 'Retro Wave', author: 'NeonLabs',
    description: '80s-inspired synthwave dark theme with electric pinks and cyan neons.',
    price: 2.99, rating: 4.7, reviews: 1653, downloads: 61800,
    icon: 'palette', iconBg: '#DB2777', accentColor: '#DB2777',
    previewColors: ['#0F0F1A', '#DB2777', '#06B6D4', '#FFFFFF'],
    tags: ['Dark', 'Neon'],
  },
];

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating = ({ rating, size = 12 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 1 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <MaterialIcons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-border'}
        size={size}
        color="#F59E0B"
      />
    ))}
  </View>
);

// ─── Format Count ─────────────────────────────────────────────────────────────
const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

// ─── Featured Banner ──────────────────────────────────────────────────────────
const FeaturedBanner = ({ item, onPress }: { item: MarketItem; onPress: () => void }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.featuredCard, { backgroundColor: item.accentColor }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.featuredInner}>
        <View style={styles.featuredLeft}>
          <View style={[styles.featuredBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.featuredBadgeText}>⭐ FEATURED</Text>
          </View>
          <Text style={styles.featuredName}>{item.name}</Text>
          <Text style={styles.featuredAuthor}>by {item.author}</Text>
          <Text style={styles.featuredDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.featuredFooter}>
            <View style={[styles.featuredPriceTag, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.featuredPrice}>
                {item.price === 'Free' ? 'Free' : `$${item.price}`}
              </Text>
            </View>
            <View style={styles.featuredStats}>
              <StarRating rating={item.rating} size={13} />
              <Text style={styles.featuredRatingText}>{item.rating}</Text>
            </View>
          </View>
        </View>
        <View style={styles.featuredIconWrap}>
          <MaterialIcons name={item.icon as any} size={52} color="rgba(255,255,255,0.9)" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Item Card ────────────────────────────────────────────────────────────────
const ItemCard = ({ item, onPress }: { item: MarketItem; onPress: () => void }) => {
  const { theme } = useTheme();
  const priceText = item.price === 'Free' ? 'Free' : `$${item.price}`;
  const priceColor = item.price === 'Free' ? '#22C55E' : theme.colors.text;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.cardIcon, { backgroundColor: `${item.iconBg}18` }]}>
        {item.type === 'theme' && item.previewColors ? (
          <View style={styles.themePreviewGrid}>
            {item.previewColors.slice(0, 4).map((c, i) => (
              <View key={i} style={[styles.previewCell, { backgroundColor: c }]} />
            ))}
          </View>
        ) : (
          <MaterialIcons name={item.icon as any} size={26} color={item.iconBg} />
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardName, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.cardBadges}>
            {item.new && (
              <View style={[styles.newBadge, { backgroundColor: '#22C55E' }]}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
            {item.owned && (
              <View style={[styles.ownedBadge, { backgroundColor: `${theme.colors.primary}18`, borderColor: `${theme.colors.primary}40` }]}>
                <MaterialIcons name="check-circle" size={10} color={theme.colors.primary} />
                <Text style={[styles.ownedText, { color: theme.colors.primary }]}>Owned</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.cardAuthor, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
          {item.author}
        </Text>

        <Text style={[styles.cardDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.cardRating}>
            <StarRating rating={item.rating} />
            <Text style={[styles.cardRatingText, { color: theme.colors.textSecondary }]}>
              {item.rating} ({formatCount(item.reviews)})
            </Text>
          </View>
          <Text style={[styles.cardPrice, { color: priceColor, fontFamily: 'Inter_700Bold' }]}>
            {priceText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const ItemDetailModal = ({ item, visible, onClose }: { item: MarketItem | null; visible: boolean; onClose: () => void }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const priceText = item.price === 'Free' ? 'Free' : `$${item.price}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={[styles.detailPanel, { backgroundColor: theme.colors.cardPrimary }]}>
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Hero Banner */}
          <View style={[styles.detailHero, { backgroundColor: `${item.accentColor}18` }]}>
            {item.type === 'theme' && item.previewColors ? (
              <View style={styles.themeHeroGrid}>
                {item.previewColors.map((c, i) => (
                  <View key={i} style={[styles.themeHeroCell, { backgroundColor: c }]} />
                ))}
              </View>
            ) : (
              <View style={[styles.detailIconWrap, { backgroundColor: `${item.accentColor}22` }]}>
                <MaterialIcons name={item.icon as any} size={56} color={item.accentColor} />
              </View>
            )}
          </View>

          <View style={styles.detailContent}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailName, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {item.name}
                </Text>
                <Text style={[styles.detailAuthor, { color: theme.colors.textSecondary }]}>
                  by {item.author}
                </Text>
              </View>
              <View style={styles.typeTag}>
                <MaterialCommunityIcons
                  name={item.type === 'plugin' ? 'puzzle' : 'palette'}
                  size={12}
                  color={item.accentColor}
                />
                <Text style={[styles.typeTagText, { color: item.accentColor }]}>
                  {item.type === 'plugin' ? 'Plugin' : 'Theme'}
                </Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={[styles.statsRow, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
              <View style={styles.statCell}>
                <StarRating rating={item.rating} size={14} />
                <Text style={[styles.statValue, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {item.rating}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Rating</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.statCell}>
                <MaterialIcons name="reviews" size={16} color={item.accentColor} />
                <Text style={[styles.statValue, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {formatCount(item.reviews)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Reviews</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.statCell}>
                <MaterialIcons name="download" size={16} color={item.accentColor} />
                <Text style={[styles.statValue, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                  {formatCount(item.downloads)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Downloads</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={[styles.detailDesc, { color: theme.colors.text }]}>
              {item.description}
            </Text>

            {/* Tags */}
            <View style={styles.tagsRow}>
              {item.tags.map(tag => (
                <View key={tag} style={[styles.tagBubble, { backgroundColor: `${item.accentColor}15`, borderColor: `${item.accentColor}30` }]}>
                  <Text style={[styles.tagText, { color: item.accentColor }]}>{tag}</Text>
                </View>
              ))}
            </View>

            {/* Features for plugin or Theme previews */}
            {item.type === 'plugin' && (
              <View style={[styles.whatsIncluded, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
                <Text style={[styles.includedTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  What's included
                </Text>
                {['Fully integrated with your task board', 'Real-time sync across devices', 'Export & analytics dashboard', 'Priority support from developer'].map((feat, i) => (
                  <View key={i} style={styles.featureRow}>
                    <MaterialIcons name="check-circle" size={16} color={item.accentColor} />
                    <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>{feat}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* CTA */}
            <View style={{ height: 24 }} />
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.detailCTA, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.cardPrimary, paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
          <View>
            <Text style={[styles.ctaPrice, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
              {item.price === 'Free' ? 'Free' : `$${item.price}`}
            </Text>
            {item.price !== 'Free' && (
              <Text style={[styles.ctaNote, { color: theme.colors.textSecondary }]}>One-time purchase</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.ctaButton, {
              backgroundColor: item.owned ? theme.colors.secondary : item.accentColor,
            }]}
          >
            <Text style={[styles.ctaButtonText, {
              color: item.owned ? theme.colors.text : '#FFFFFF',
              fontFamily: 'Inter_600SemiBold'
            }]}>
              {item.owned ? '✓  Installed' : item.price === 'Free' ? 'Install Free' : `Buy $${item.price}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const MarketplaceScreen = ({ onClose }: { onClose: () => void }) => {
  const { theme } = useTheme();
  const [category, setCategory] = useState<Category>('All');
  const [sort, setSort] = useState<SortOption>('Featured');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MarketItem | null>(null);

  const categories: Category[] = ['All', 'Plugins', 'Themes'];
  const sortOptions: SortOption[] = ['Featured', 'Popular', 'Newest', 'Price'];

  const filteredItems = MARKET_ITEMS.filter(item => {
    const matchesCategory =
      category === 'All' ||
      (category === 'Plugins' && item.type === 'plugin') ||
      (category === 'Themes' && item.type === 'theme');
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sort === 'Popular') return b.downloads - a.downloads;
    if (sort === 'Newest') return (a.new ? 0 : 1) - (b.new ? 0 : 1);
    if (sort === 'Price') {
      const ap = a.price === 'Free' ? 0 : a.price as number;
      const bp = b.price === 'Free' ? 0 : b.price as number;
      return ap - bp;
    }
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  const featuredItems = MARKET_ITEMS.filter(i => i.featured);
  const featuredItem = category === 'All' ? featuredItems[0] : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.cardPrimary }}>
        <View style={[styles.header, { backgroundColor: theme.colors.cardPrimary, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <MaterialIcons name="close" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
              Marketplace
            </Text>
            <View style={[styles.headerBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.headerBadgeText}>BETA</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn}>
            <MaterialIcons name="tune" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: theme.colors.cardPrimary, borderBottomColor: theme.colors.border }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
            <MaterialIcons name="search" size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
              placeholder="Search plugins and themes..."
              placeholderTextColor={theme.colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialIcons name="cancel" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Tabs */}
        <View style={[styles.tabsRow, { backgroundColor: theme.colors.cardPrimary, borderBottomColor: theme.colors.border }]}>
          {categories.map(cat => {
            const active = category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.tab, active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setCategory(cat)}
              >
                {cat === 'Plugins' && <MaterialCommunityIcons name="puzzle" size={14} color={active ? theme.colors.primary : theme.colors.textSecondary} />}
                {cat === 'Themes' && <MaterialIcons name="palette" size={14} color={active ? theme.colors.primary : theme.colors.textSecondary} />}
                {cat === 'All' && <MaterialIcons name="apps" size={14} color={active ? theme.colors.primary : theme.colors.textSecondary} />}
                <Text style={[styles.tabText, {
                  color: active ? theme.colors.primary : theme.colors.textSecondary,
                  fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sort chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll} contentContainerStyle={styles.sortContent}>
          {sortOptions.map(opt => {
            const active = sort === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.sortChip, {
                  backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                }]}
                onPress={() => setSort(opt)}
              >
                <Text style={[styles.sortChipText, {
                  color: active ? '#FFFFFF' : theme.colors.textSecondary,
                  fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Featured Banner (only when not searching and 'All' tab) */}
        {!search && featuredItem && (
          <View style={styles.featuredWrap}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              FEATURED
            </Text>
            <FeaturedBanner item={featuredItem} onPress={() => setSelectedItem(featuredItem)} />
          </View>
        )}

        {/* Items Grid */}
        <View style={styles.itemsSection}>
          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              {search ? `${filteredItems.length} RESULTS` : category === 'All' ? 'ALL ITEMS' : category.toUpperCase()}
            </Text>
            <Text style={[styles.sectionCount, { color: theme.colors.textSecondary }]}>
              {filteredItems.length} items
            </Text>
          </View>

          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={48} color={theme.colors.border} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
                No results for "{search}"
              </Text>
            </View>
          ) : (
            filteredItems.map(item => (
              <ItemCard key={item.id} item={item} onPress={() => setSelectedItem(item)} />
            ))
          )}
        </View>
      </ScrollView>

      <ItemDetailModal
        item={selectedItem}
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 18, letterSpacing: -0.4 },
  headerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  headerBadgeText: { color: '#FFF', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },

  // Category tabs
  tabsRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabText: { fontSize: 14 },

  // Sort chips
  sortScroll: { paddingVertical: 12 },
  sortContent: { paddingHorizontal: 16, gap: 8 },
  sortChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  sortChipText: { fontSize: 13 },

  // Featured
  featuredWrap: { paddingHorizontal: 16, paddingTop: 16 },
  featuredCard: { borderRadius: 20, padding: 20, marginTop: 8, overflow: 'hidden' },
  featuredInner: { flexDirection: 'row', alignItems: 'flex-start' },
  featuredLeft: { flex: 1, gap: 6 },
  featuredBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  featuredBadgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  featuredName: { color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, lineHeight: 28 },
  featuredAuthor: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  featuredDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  featuredPriceTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  featuredPrice: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  featuredStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  featuredRatingText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  featuredIconWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },

  // Items section
  itemsSection: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8 },
  sectionCount: { fontSize: 12 },

  // Card
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 14,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  cardBody: { flex: 1, gap: 3 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { flex: 1, fontSize: 15 },
  cardBadges: { flexDirection: 'row', gap: 4 },
  newBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { color: '#FFF', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  ownedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  ownedText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  cardAuthor: { fontSize: 12 },
  cardDesc: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardRatingText: { fontSize: 11 },
  cardPrice: { fontSize: 15 },

  // Theme preview grid in card
  themePreviewGrid: { width: '100%', height: '100%', flexDirection: 'row', flexWrap: 'wrap' },
  previewCell: { width: '50%', height: '50%' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },

  // Detail Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  detailPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 2 },
  detailHero: { height: 160, alignItems: 'center', justifyContent: 'center' },
  detailIconWrap: { width: 88, height: 88, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  themeHeroGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  themeHeroCell: { width: '50%', height: '50%' },
  detailContent: { paddingHorizontal: 20, paddingTop: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  detailName: { fontSize: 22, letterSpacing: -0.5 },
  detailAuthor: { fontSize: 13, marginTop: 2 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'transparent' },
  typeTagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  statsRow: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 8 },
  detailDesc: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagBubble: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  whatsIncluded: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  includedTitle: { fontSize: 14, marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20, flex: 1 },
  detailCTA: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  ctaPrice: { fontSize: 24 },
  ctaNote: { fontSize: 12 },
  ctaButton: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  ctaButtonText: { fontSize: 15 },
});
