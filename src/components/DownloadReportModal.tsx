import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Sharing from 'expo-sharing';

import { useTheme } from '../context/ThemeContext';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import {
  ExpenseData,
  GroupData,
  SettlementData,
  UserProfile,
} from '../services/firestoreService';
import {
  ReportScope,
  ReportFormat,
  ReportDateRangeType,
  ReportConfig,
  buildPersonalReportData,
  buildGroupReportData,
  generatePersonalPdf,
  generateGroupPdf,
  generatePersonalCsv,
  generateGroupCsv,
  downloadReportToDevice,
  shareReportFile,
  resolveDateRangeInfo,
  sanitizeFilename,
} from '../services/reportService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface DownloadReportModalProps {
  visible: boolean;
  onClose: () => void;
  activeGroups: GroupData[];
  allExpenses: ExpenseData[];
  allSettlements: SettlementData[];
  allUsersMap: Map<string, UserProfile>;
  currentUid: string;
  currentUserName?: string;
  currentUserEmail?: string;
  defaultGroupId?: string;
  defaultDateFilter?: 'this_month' | 'last_month' | 'last_3_months' | 'all_time';
  lockGroup?: boolean;
}

const PREDEFINED_DATE_OPTIONS: { id: ReportDateRangeType; label: string; sublabel: string }[] = [
  { id: 'this_month', label: 'This Month', sublabel: 'Current billing period' },
  { id: 'last_month', label: 'Last Month', sublabel: 'Previous calendar month' },
  { id: 'last_3_months', label: 'Last 3 Months', sublabel: 'Quarterly view' },
  { id: 'last_6_months', label: 'Last 6 Months', sublabel: 'Half-year view' },
  { id: 'this_year', label: 'This Year', sublabel: 'Year-to-date' },
  { id: 'all_time', label: 'All Time', sublabel: 'Complete history' },
  { id: 'custom', label: 'Custom Range', sublabel: 'Choose dates' },
];

export default function DownloadReportModal({
  visible,
  onClose,
  activeGroups,
  allExpenses,
  allSettlements,
  allUsersMap,
  currentUid,
  currentUserName,
  currentUserEmail,
  defaultGroupId,
  defaultDateFilter = 'this_month',
  lockGroup = false,
}: DownloadReportModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // State
  const [scope, setScope] = useState<ReportScope>('personal');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [dateRangeType, setDateRangeType] = useState<ReportDateRangeType>(defaultDateFilter);
  const [format, setFormat] = useState<ReportFormat>('pdf');

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d;
  });
  const [customEndDate, setCustomEndDate] = useState<Date>(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false);

  // Generation status state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'download' | 'share'>('download');
  // Custom in-modal dialog state
  interface CustomDialogConfig {
    visible: boolean;
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
    cancelLabel?: string;
    confirmLabel?: string;
    confirmIcon?: keyof typeof MaterialIcons.glyphMap;
    onCancel?: () => void;
    onConfirm?: () => void;
  }

  const [dialogConfig, setDialogConfig] = useState<CustomDialogConfig>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const dialogFade = React.useRef(new Animated.Value(0)).current;
  const dialogScale = React.useRef(new Animated.Value(0.9)).current;

  const showCustomDialog = (cfg: Omit<CustomDialogConfig, 'visible'>) => {
    setDialogConfig({ ...cfg, visible: true });
    dialogFade.setValue(0);
    dialogScale.setValue(0.9);
    Animated.parallel([
      Animated.timing(dialogFade, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(dialogScale, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideCustomDialog = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(dialogFade, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(dialogScale, {
        toValue: 0.9,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDialogConfig((prev) => ({ ...prev, visible: false }));
      callback?.();
    });
  };

  const getDialogBadgeConfig = () => {
    if (dialogConfig.type === 'error') {
      return {
        icon: 'error-outline' as const,
        color: isDark ? '#F87171' : '#DC2626',
        bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
        border: isDark ? '#DC2626' : '#FECACA',
      };
    }
    if (dialogConfig.type === 'success') {
      return {
        icon: 'check-circle' as const,
        color: isDark ? '#34D399' : '#059669',
        bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#DCFCE7',
        border: isDark ? '#059669' : '#BBF7D0',
      };
    }
    if (dialogConfig.type === 'warning') {
      return {
        icon: 'warning' as const,
        color: isDark ? '#FBBF24' : '#D97706',
        bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
        border: isDark ? '#D97706' : '#FDE68A',
      };
    }
    return {
      icon: 'info-outline' as const,
      color: colors.primary,
      bg: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE',
      border: isDark ? colors.primary : '#BAE6FD',
    };
  };

  const dialogBadge = getDialogBadgeConfig();


  // Sync default group on open
  useEffect(() => {
    if (visible) {
      if (lockGroup || (defaultGroupId && defaultGroupId !== 'all')) {
        setScope('group');
        if (defaultGroupId) setSelectedGroupId(defaultGroupId);
        else if (activeGroups.length > 0) setSelectedGroupId(activeGroups[0].groupId);
      } else if (activeGroups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(activeGroups[0].groupId);
      }
      if (defaultDateFilter) {
        setDateRangeType(defaultDateFilter);
      }
    }
  }, [visible, defaultGroupId, defaultDateFilter, activeGroups, lockGroup]);

  // Selected group object
  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return activeGroups[0] || null;
    return activeGroups.find((g) => g.groupId === selectedGroupId) || activeGroups[0] || null;
  }, [activeGroups, selectedGroupId]);

  // Temporary config for date resolution
  const tempConfig: ReportConfig = useMemo(
    () => ({
      scope,
      format,
      groupId: scope === 'group' ? selectedGroup?.groupId : undefined,
      dateRangeType,
      customStartDate: dateRangeType === 'custom' ? customStartDate : undefined,
      customEndDate: dateRangeType === 'custom' ? customEndDate : undefined,
    }),
    [scope, format, selectedGroup, dateRangeType, customStartDate, customEndDate]
  );

  // Resolved date range label & dates
  const dateRangeInfo = useMemo(() => {
    return resolveDateRangeInfo(tempConfig);
  }, [tempConfig]);

  // Computed preview filename
  const previewFilename = useMemo(() => {
    const scopePart =
      scope === 'group'
        ? `${sanitizeFilename(selectedGroup?.name || 'Group')}_Group_Report`
        : 'Personal_Report';
    const datePart =
      dateRangeInfo.startDateStr && dateRangeInfo.endDateStr
        ? `${dateRangeInfo.startDateStr}_to_${dateRangeInfo.endDateStr}`
        : 'All_Time';
    return `SplitMate_${scopePart}_${datePart}.${format}`;
  }, [scope, selectedGroup, dateRangeInfo, format]);

  // Custom date formatting helper
  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleStartDateChange = (_: any, date?: Date) => {
    setShowStartPicker(false);
    if (!date) return;
    setCustomStartDate(date);
    if (date > customEndDate) {
      setCustomEndDate(date);
    }
  };

  const handleEndDateChange = (_: any, date?: Date) => {
    setShowEndPicker(false);
    if (!date) return;
    if (date < customStartDate) {
      showCustomDialog({
        type: 'warning',
        title: 'Invalid Range',
        message: 'End date cannot be earlier than start date.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
      return;
    }
    setCustomEndDate(date);
  };

  // Helper to compile report content
  const prepareReportContent = async (): Promise<string> => {
    const config: ReportConfig = {
      scope,
      format,
      groupId: scope === 'group' ? selectedGroup?.groupId : undefined,
      dateRangeType,
      customStartDate: dateRangeType === 'custom' ? customStartDate : undefined,
      customEndDate: dateRangeType === 'custom' ? customEndDate : undefined,
    };

    if (scope === 'personal') {
      const reportData = buildPersonalReportData(
        config,
        allExpenses,
        allSettlements,
        activeGroups,
        {
          uid: currentUid,
          displayName: currentUserName,
          email: currentUserEmail,
        },
        allUsersMap
      );

      if (format === 'pdf') {
        return await generatePersonalPdf(reportData);
      } else {
        return generatePersonalCsv(reportData);
      }
    } else {
      const groupMembers: UserProfile[] = (selectedGroup?.memberIds || []).map((uid) => {
        return (
          allUsersMap.get(uid) || {
            uid,
            name: selectedGroup?.memberProfiles?.[uid]?.name || 'Member',
            email: selectedGroup?.memberProfiles?.[uid]?.email || '',
          }
        );
      });

      const reportData = buildGroupReportData(
        config,
        allExpenses,
        allSettlements,
        selectedGroup!,
        groupMembers,
        allUsersMap
      );

      if (format === 'pdf') {
        return await generateGroupPdf(reportData);
      } else {
        return generateGroupCsv(reportData);
      }
    }
  };

  // 1. DOWNLOAD HANDLER (Saves directly to device storage / Downloads)
  const handleDownloadReport = async () => {
    if (scope === 'group' && !selectedGroup) {
      showCustomDialog({
        type: 'warning',
        title: 'Group Required',
        message: 'Please select a group for the group financial report.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
      return;
    }

    if (dateRangeType === 'custom' && customStartDate > customEndDate) {
      showCustomDialog({
        type: 'warning',
        title: 'Invalid Date Range',
        message: 'Start date must be before or equal to end date.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
      return;
    }

    setIsGenerating(true);
    setActionType('download');

    try {
      await new Promise((resolve) => setTimeout(resolve, 60));

      const content = await prepareReportContent();

      const result = await downloadReportToDevice(previewFilename, content, format);

      setIsGenerating(false);

      if (result.cancelled) {
        // User cancelled folder picker
        return;
      }

      if (result.success) {
        showCustomDialog({
          type: 'success',
          title: 'Report Downloaded',
          message: `Your ${format.toUpperCase()} report has been saved to your device's Downloads folder:\n\n${previewFilename}`,
          cancelLabel: 'Done',
          confirmLabel: 'Open File',
          confirmIcon: 'open-in-new',
          onCancel: () => {
            hideCustomDialog(() => {
              onClose();
            });
          },
          onConfirm: async () => {
            hideCustomDialog(async () => {
              onClose();
              if (result.filePath && (await Sharing.isAvailableAsync())) {
                try {
                  await Sharing.shareAsync(result.filePath, {
                    mimeType: format === 'pdf' ? 'application/pdf' : 'text/csv',
                    dialogTitle: `Open ${previewFilename}`,
                  });
                } catch (e) {
                  console.warn('[DownloadReportModal] Open file error:', e);
                }
              }
            });
          },
        });
      } else {
        throw new Error(result.error || 'Failed to download report');
      }
    } catch (err: any) {
      console.error('[DownloadReportModal] download error:', err);
      setIsGenerating(false);
      showCustomDialog({
        type: 'error',
        title: 'Download Failed',
        message: err?.message || 'An unexpected error occurred while saving the report. Please try again.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
    }
  };

  // 2. SHARE HANDLER (Opens system share sheet)
  const handleShareReport = async () => {
    if (scope === 'group' && !selectedGroup) {
      showCustomDialog({
        type: 'warning',
        title: 'Group Required',
        message: 'Please select a group for the group financial report.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
      return;
    }

    if (dateRangeType === 'custom' && customStartDate > customEndDate) {
      showCustomDialog({
        type: 'warning',
        title: 'Invalid Date Range',
        message: 'Start date must be before or equal to end date.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
      return;
    }

    setIsGenerating(true);
    setActionType('share');

    try {
      await new Promise((resolve) => setTimeout(resolve, 60));

      const content = await prepareReportContent();

      const result = await shareReportFile(previewFilename, content, format);

      setIsGenerating(false);

      if (result.success) {
        onClose();
      } else {
        throw new Error(result.error || 'Failed to share report');
      }
    } catch (err: any) {
      console.error('[DownloadReportModal] share error:', err);
      setIsGenerating(false);
      showCustomDialog({
        type: 'error',
        title: 'Share Failed',
        message: err?.message || 'An unexpected error occurred while preparing share. Please try again.',
        confirmLabel: 'OK',
        onConfirm: () => hideCustomDialog(),
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!isGenerating) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surfaceContainerLowest,
              maxHeight: SCREEN_HEIGHT * 0.9,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
                {lockGroup ? 'Download Group Report' : 'Download Financial Report'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}>
                {lockGroup && selectedGroup ? `Export PDF summary or spreadsheet CSV for ${selectedGroup.name}` : 'Export PDF summary or spreadsheet CSV'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={isGenerating}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceContainer }]}
              accessibilityRole="button"
              accessibilityLabel="Close report download modal"
            >
              <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Report Scope Segment */}
            {!lockGroup && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>1. Report Scope</Text>
              <View
                style={[
                  styles.segmentRow,
                  { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    scope === 'personal' && [
                      styles.segmentButtonActive,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ],
                  ]}
                  onPress={() => setScope('personal')}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="person"
                    size={18}
                    color={scope === 'personal' ? colors.primary : colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: scope === 'personal' ? colors.primary : colors.onSurfaceVariant },
                      scope === 'personal' && styles.segmentButtonTextActive,
                    ]}
                  >
                    Personal Report
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    scope === 'group' && [
                      styles.segmentButtonActive,
                      { backgroundColor: colors.surfaceContainerLowest },
                    ],
                  ]}
                  onPress={() => setScope('group')}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name="groups"
                    size={18}
                    color={scope === 'group' ? colors.primary : colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.segmentButtonText,
                      { color: scope === 'group' ? colors.primary : colors.onSurfaceVariant },
                      scope === 'group' && styles.segmentButtonTextActive,
                    ]}
                  >
                    Group Report
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.helperText, { color: colors.onSurfaceVariant }]}>
                {scope === 'personal'
                  ? 'Personal expenses, liabilities, and settlements across all your groups.'
                  : 'Complete group financial ledger with member-by-member breakdown.'}
              </Text>
            </View>
            )}

            {/* 2. Group Selector (Visible only when scope is group) */}
            {scope === 'group' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                  {lockGroup ? '1. Group' : '2. Select Group'}
                </Text>
                {activeGroups.length === 0 ? (
                  <View
                    style={[
                      styles.emptyGroupWarning,
                      { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                    ]}
                  >
                    <MaterialIcons name="info-outline" size={20} color={colors.warning} />
                    <Text style={[styles.emptyGroupText, { color: colors.onSurfaceVariant }]}>
                      No active groups found. Please create or join a group first.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groupChipList}
                  >
                    {activeGroups.map((g) => {
                      const isSelected = selectedGroupId === g.groupId;
                      const memberCount = g.memberIds?.length || 0;
                      return (
                        <TouchableOpacity
                          key={g.groupId}
                          style={[
                            styles.groupSelectorChip,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : colors.surfaceContainerLowest,
                              borderColor: isSelected ? colors.primary : colors.outlineVariant,
                            },
                          ]}
                          onPress={() => setSelectedGroupId(g.groupId)}
                          disabled={isGenerating}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons
                            name="group"
                            size={16}
                            color={isSelected ? colors.onPrimary : colors.onSurfaceVariant}
                          />
                          <View style={{ marginLeft: 6 }}>
                            <Text
                              style={[
                                styles.groupChipName,
                                { color: isSelected ? colors.onPrimary : colors.onSurface },
                              ]}
                              numberOfLines={1}
                            >
                              {g.name}
                            </Text>
                            <Text
                              style={[
                                styles.groupChipMeta,
                                {
                                  color: isSelected
                                    ? colors.onPrimary + 'CC'
                                    : colors.onSurfaceVariant,
                                },
                              ]}
                            >
                              {memberCount} {memberCount === 1 ? 'member' : 'members'}
                            </Text>
                          </View>
                          {isSelected && (
                            <MaterialIcons
                              name="check-circle"
                              size={16}
                              color={colors.onPrimary}
                              style={{ marginLeft: 8 }}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* 3. Date Range Selector */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                {lockGroup ? '2' : scope === 'group' ? '3' : '2'}. Date Range
              </Text>
              <View style={styles.dateChipsWrap}>
                {PREDEFINED_DATE_OPTIONS.map((opt) => {
                  const isSelected = dateRangeType === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: isSelected
                            ? colors.primary + '18'
                            : colors.surfaceContainerLowest,
                          borderColor: isSelected ? colors.primary : colors.outlineVariant,
                        },
                      ]}
                      onPress={() => setDateRangeType(opt.id)}
                      disabled={isGenerating}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dateChipText,
                          { color: isSelected ? colors.primary : colors.onSurface },
                          isSelected && styles.dateChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Date Pickers */}
              {dateRangeType === 'custom' && (
                <View
                  style={[
                    styles.customDateBox,
                    {
                      backgroundColor: colors.surfaceContainer,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.customDateRow}>
                    {/* From Date */}
                    <View style={styles.customDateCol}>
                      <Text style={[styles.customDateLabel, { color: colors.onSurfaceVariant }]}>
                        From (Start Date)
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.datePickerBtn,
                          {
                            backgroundColor: colors.surfaceContainerLowest,
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                        onPress={() => setShowStartPicker(true)}
                        disabled={isGenerating}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="event" size={18} color={colors.primary} />
                        <Text style={[styles.datePickerValue, { color: colors.onSurface }]}>
                          {formatDateDisplay(customStartDate)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* To Date */}
                    <View style={styles.customDateCol}>
                      <Text style={[styles.customDateLabel, { color: colors.onSurfaceVariant }]}>
                        To (End Date)
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.datePickerBtn,
                          {
                            backgroundColor: colors.surfaceContainerLowest,
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                        onPress={() => setShowEndPicker(true)}
                        disabled={isGenerating}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="event" size={18} color={colors.primary} />
                        <Text style={[styles.datePickerValue, { color: colors.onSurface }]}>
                          {formatDateDisplay(customEndDate)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Android / iOS native pickers */}
                  {showStartPicker && (
                    <DateTimePicker
                      value={customStartDate}
                      mode="date"
                      maximumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleStartDateChange}
                    />
                  )}
                  {showEndPicker && (
                    <DateTimePicker
                      value={customEndDate}
                      mode="date"
                      minimumDate={customStartDate}
                      maximumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleEndDateChange}
                    />
                  )}
                </View>
              )}
            </View>

            {/* 4. Format Selector */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
                {lockGroup ? '3' : scope === 'group' ? '4' : '3'}. Export Format
              </Text>
              <View style={styles.formatRow}>
                {/* PDF Option */}
                <TouchableOpacity
                  style={[
                    styles.formatCard,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: format === 'pdf' ? colors.primary : colors.outlineVariant,
                    },
                    format === 'pdf' && {
                      borderWidth: 2,
                      backgroundColor: colors.primary + '0A',
                    },
                  ]}
                  onPress={() => setFormat('pdf')}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  <View style={styles.formatCardTop}>
                    <View
                      style={[
                        styles.formatIconWrap,
                        {
                          backgroundColor:
                            format === 'pdf' ? colors.primary : colors.surfaceContainer,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="picture-as-pdf"
                        size={22}
                        color={format === 'pdf' ? colors.onPrimary : colors.onSurfaceVariant}
                      />
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: format === 'pdf' ? colors.primary : colors.outlineVariant,
                        },
                      ]}
                    >
                      {format === 'pdf' && (
                        <View
                          style={[styles.radioDot, { backgroundColor: colors.primary }]}
                        />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.formatTitle, { color: colors.onSurface }]}>
                    PDF Document
                  </Text>
                  <Text style={[styles.formatDesc, { color: colors.onSurfaceVariant }]}>
                    Executive visual layout with KPI summary cards, breakdown charts & formatted tables.
                  </Text>
                </TouchableOpacity>

                {/* CSV Option */}
                <TouchableOpacity
                  style={[
                    styles.formatCard,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                      borderColor: format === 'csv' ? colors.primary : colors.outlineVariant,
                    },
                    format === 'csv' && {
                      borderWidth: 2,
                      backgroundColor: colors.primary + '0A',
                    },
                  ]}
                  onPress={() => setFormat('csv')}
                  disabled={isGenerating}
                  activeOpacity={0.8}
                >
                  <View style={styles.formatCardTop}>
                    <View
                      style={[
                        styles.formatIconWrap,
                        {
                          backgroundColor:
                            format === 'csv' ? '#10B981' : colors.surfaceContainer,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="table-chart"
                        size={22}
                        color={format === 'csv' ? '#FFFFFF' : colors.onSurfaceVariant}
                      />
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: format === 'csv' ? '#10B981' : colors.outlineVariant,
                        },
                      ]}
                    >
                      {format === 'csv' && (
                        <View style={[styles.radioDot, { backgroundColor: '#10B981' }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.formatTitle, { color: colors.onSurface }]}>
                    CSV Spreadsheet
                  </Text>
                  <Text style={[styles.formatDesc, { color: colors.onSurfaceVariant }]}>
                    Structured Excel & Sheets data with UTF-8 BOM and formula injection protection.
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 5. Summary Preview Card */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.previewHeader}>
                <MaterialIcons name="preview" size={18} color={colors.primary} />
                <Text style={[styles.previewHeading, { color: colors.onSurface }]}>
                  Report Summary Preview
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.onSurfaceVariant }]}>Scope:</Text>
                <Text style={[styles.previewValue, { color: colors.onSurface }]}>
                  {scope === 'personal'
                    ? 'Personal Financial Report'
                    : `Group Report: ${selectedGroup?.name || 'Selected Group'}`}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.onSurfaceVariant }]}>Period:</Text>
                <Text style={[styles.previewValue, { color: colors.onSurface }]}>
                  {dateRangeInfo.label}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.onSurfaceVariant }]}>Format:</Text>
                <Text style={[styles.previewValue, { color: colors.onSurface }]}>
                  {format.toUpperCase()} ({format === 'pdf' ? 'Visual Document' : 'Raw Spreadsheet'})
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={[styles.previewLabel, { color: colors.onSurfaceVariant }]}>Filename:</Text>
                <Text
                  style={[styles.previewFilename, { color: colors.primary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {previewFilename}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer: Cancel, Share, Download */}
          <View style={[styles.footer, { borderTopColor: colors.divider }]}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={onClose}
              disabled={isGenerating}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.onSurface }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.shareBtn,
                {
                  backgroundColor: colors.surfaceContainer,
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={handleShareReport}
              disabled={isGenerating}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share financial report"
            >
              {isGenerating && actionType === 'share' ? (
                <View style={styles.loadingInnerRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[styles.shareBtnText, { color: colors.primary, marginLeft: 4 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Sharing...
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingInnerRow}>
                  <MaterialIcons name="share" size={18} color={colors.primary} />
                  <Text
                    style={[styles.shareBtnText, { color: colors.primary, marginLeft: 4 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Share
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.generateBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isGenerating ? 0.75 : 1,
                },
              ]}
              onPress={handleDownloadReport}
              disabled={isGenerating}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Download financial report to device"
            >
              {isGenerating && actionType === 'download' ? (
                <View style={styles.loadingInnerRow}>
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                  <Text
                    style={[styles.generateBtnText, { color: colors.onPrimary, marginLeft: 6 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Downloading...
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingInnerRow}>
                  <MaterialIcons name="file-download" size={19} color={colors.onPrimary} />
                  <Text
                    style={[styles.generateBtnText, { color: colors.onPrimary, marginLeft: 6 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Download
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Themed Dialog Overlay (M3 SplitMate Brand) */}
        {dialogConfig.visible && (
          <Animated.View
            style={[
              styles.customDialogBackdrop,
              {
                opacity: dialogFade,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.customDialogCard,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.divider,
                  transform: [{ scale: dialogScale }],
                },
              ]}
            >
              <View
                style={[
                  styles.customDialogIconBadge,
                  {
                    backgroundColor: dialogBadge.bg,
                    borderColor: dialogBadge.border,
                  },
                ]}
              >
                <MaterialIcons
                  name={dialogBadge.icon}
                  size={32}
                  color={dialogBadge.color}
                />
              </View>

              <Text style={[styles.customDialogTitle, { color: colors.onSurface }]}>
                {dialogConfig.title}
              </Text>

              <Text style={[styles.customDialogMessage, { color: colors.onSurfaceVariant }]}>
                {dialogConfig.message}
              </Text>

              <View style={styles.customDialogActions}>
                {dialogConfig.cancelLabel ? (
                  <TouchableOpacity
                    style={[
                      styles.customDialogBtn,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceContainerHigh
                          : colors.surfaceContainerLow,
                      },
                    ]}
                    onPress={dialogConfig.onCancel}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.customDialogBtnText, { color: colors.onSurface }]}>
                      {dialogConfig.cancelLabel}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {dialogConfig.confirmLabel ? (
                  <TouchableOpacity
                    style={[
                      styles.customDialogBtn,
                      {
                        backgroundColor:
                          dialogConfig.type === 'error'
                            ? colors.error
                            : colors.primary,
                        flex: dialogConfig.cancelLabel ? 1.4 : 0,
                        minWidth: dialogConfig.cancelLabel ? undefined : 140,
                      },
                    ]}
                    onPress={dialogConfig.onConfirm}
                    activeOpacity={0.8}
                  >
                    {dialogConfig.confirmIcon && (
                      <MaterialIcons
                        name={dialogConfig.confirmIcon}
                        size={18}
                        color={dialogConfig.type === 'error' ? colors.onError : colors.onPrimary}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.customDialogBtnText,
                        {
                          color:
                            dialogConfig.type === 'error'
                              ? colors.onError
                              : colors.onPrimary,
                        },
                      ]}
                    >
                      {dialogConfig.confirmLabel}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    ...Shadows.dialog,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    ...Typography.titleLg,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...Typography.bodySm,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
    marginBottom: 4,
  },
  helperText: {
    ...Typography.bodySm,
    marginTop: 4,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    gap: 8,
  },
  segmentButtonActive: {
    ...Shadows.card,
  },
  segmentButtonText: {
    ...Typography.bodyMd,
    fontWeight: '500',
  },
  segmentButtonTextActive: {
    fontWeight: '700',
  },
  emptyGroupWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  emptyGroupText: {
    ...Typography.bodySm,
    flex: 1,
  },
  groupChipList: {
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  groupSelectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: Spacing.xs,
    maxWidth: 200,
  },
  groupChipName: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  groupChipMeta: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 1,
  },
  dateChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dateChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateChipText: {
    ...Typography.bodySm,
    fontWeight: '500',
  },
  dateChipTextActive: {
    fontWeight: '700',
  },
  customDateBox: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  customDateCol: {
    flex: 1,
  },
  customDateLabel: {
    ...Typography.bodySm,
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '600',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  datePickerValue: {
    ...Typography.bodySm,
    fontWeight: '600',
  },
  formatRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  formatCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  formatCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  formatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  formatTitle: {
    ...Typography.titleSm,
    fontWeight: '700',
    marginTop: 4,
  },
  formatDesc: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  previewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  previewHeading: {
    ...Typography.bodySm,
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  previewValue: {
    ...Typography.bodySm,
    fontSize: 11,
    fontWeight: '600',
  },
  previewFilename: {
    ...Typography.bodySm,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: '65%',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 0.9,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...Typography.labelLg,
    fontWeight: '600',
  },
  shareBtn: {
    flex: 1.1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    ...Typography.labelLg,
    fontWeight: '600',
  },
  generateBtn: {
    flex: 2.2,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.card,
  },
  generateBtnText: {
    ...Typography.labelLg,
    fontSize: 13.5,
    fontWeight: '700',
  },
  loadingInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    flexShrink: 1,
  },
  customDialogBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  customDialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    ...Shadows.dialog,
  },
  customDialogIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  customDialogTitle: {
    ...Typography.titleLg,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  customDialogMessage: {
    ...Typography.bodyMd,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  customDialogActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  customDialogBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...Shadows.button,
  },
  customDialogBtnText: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
});