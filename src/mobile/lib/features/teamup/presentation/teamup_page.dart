import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/error_utils.dart';
import '../../../core/models/teamup_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/teamup_repository_impl.dart';
import '../state/teamup_notifier.dart';

Color _sportAccentColor(String sport) {
  const colors = {
    'football': Color(0xFF4CAF50),
    'basketball': Color(0xFFFF9800),
    'tennis': Color(0xFF9C27B0),
    'volleyball': Color(0xFF00BCD4),
    'running': Color(0xFFF44336),
    'cycling': Color(0xFF2196F3),
    'swimming': Color(0xFF0097A7),
    'cricket': Color(0xFF795548),
    'americanFootball': Color(0xFF607D8B),
    'iceHockey': Color(0xFF03A9F4),
    'baseball': Color(0xFFFF5722),
    'rugby': Color(0xFF8BC34A),
    'handball': Color(0xFFE91E63),
    'fieldHockey': Color(0xFF009688),
  };
  return colors[sport] ?? AppThemeTokens.primary500;
}

class TeamUpPage extends ConsumerStatefulWidget {
  const TeamUpPage({super.key});

  @override
  ConsumerState<TeamUpPage> createState() => _TeamUpPageState();
}

class _TeamUpPageState extends ConsumerState<TeamUpPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final divider =
        isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder;
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('TeamUp'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Container(
              decoration: BoxDecoration(
                color: isDark
                    ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
                    : AppThemeTokens.lightCard.withValues(alpha: 0.98),
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                border: Border.all(color: divider),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppThemeTokens.primary500
                      .withValues(alpha: isDark ? 0.2 : 0.12),
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
                ),
                indicatorPadding: const EdgeInsets.all(5),
                dividerColor: Colors.transparent,
                labelColor: AppThemeTokens.primary400,
                unselectedLabelColor: isDark
                    ? AppThemeTokens.darkTextSecondary
                    : AppThemeTokens.lightTextSecondary,
                labelStyle:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                unselectedLabelStyle:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                tabs: const [
                  Tab(text: 'Browse'),
                  Tab(text: 'My Posts'),
                  Tab(text: 'Applied'),
                  Tab(text: 'Post'),
                ],
              ),
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _BrowseTab(),
          _MyRequestsTab(),
          _MyApplicationsTab(),
          _SubmitRequestTab(),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Browse requests tab
// ---------------------------------------------------------------------------

class _BrowseTab extends ConsumerStatefulWidget {
  const _BrowseTab();

  @override
  ConsumerState<_BrowseTab> createState() => _BrowseTabState();
}

class _BrowseTabState extends ConsumerState<_BrowseTab> {
  String _sportFilter = '';
  String _typeFilter = '';
  String _skillFilter = '';

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(teamUpNotifierProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark
                    ? AppThemeTokens.darkBorder
                    : AppThemeTokens.lightBorder,
              ),
            ),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                _FilterChip(
                  label: 'Sport',
                  value: _sportFilter,
                  options: kSportTypes
                      .where((sport) => sport['value']!.isNotEmpty)
                      .map(
                          (sport) => MapEntry(sport['value']!, sport['label']!))
                      .toList(),
                  onSelected: (value) {
                    setState(() => _sportFilter = value);
                    ref.read(teamUpNotifierProvider.notifier).load(
                          sportType: value,
                          requestType: _typeFilter,
                          skillLevel: _skillFilter,
                        );
                  },
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Type',
                  value: _typeFilter,
                  options: const [
                    MapEntry('looking_for_play', 'Looking to play'),
                    MapEntry('need_players', 'Need players'),
                  ],
                  onSelected: (value) {
                    setState(() => _typeFilter = value);
                    ref.read(teamUpNotifierProvider.notifier).load(
                          sportType: _sportFilter,
                          requestType: value,
                          skillLevel: _skillFilter,
                        );
                  },
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Skill',
                  value: _skillFilter,
                  options: const [
                    MapEntry('beginner', 'Beginner'),
                    MapEntry('intermediate', 'Intermediate'),
                    MapEntry('advanced', 'Advanced'),
                    MapEntry('any', 'Any level'),
                  ],
                  onSelected: (value) {
                    setState(() => _skillFilter = value);
                    ref.read(teamUpNotifierProvider.notifier).load(
                          sportType: _sportFilter,
                          requestType: _typeFilter,
                          skillLevel: value,
                        );
                  },
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: requestsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => ErrorDisplay(
              message: extractErrorMessage(error),
              onRetry: () => ref
                  .read(teamUpNotifierProvider.notifier)
                  .load(sportType: _sportFilter, requestType: _typeFilter),
            ),
            data: (requests) {
              if (requests.isEmpty) {
                return const UiEmptyState(
                  icon: Icons.handshake_outlined,
                  title: 'No requests found',
                  message:
                      'Try adjusting your filters or be the first to post a TeamUp request.',
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref
                    .read(teamUpNotifierProvider.notifier)
                    .load(sportType: _sportFilter, requestType: _typeFilter),
                child: ListView.builder(
                  padding:
                      const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  itemCount: requests.length,
                  itemBuilder: (context, index) =>
                      _RequestTile(request: requests[index]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// My requests tab – with accept/decline controls per request
// ---------------------------------------------------------------------------

class _MyRequestsTab extends ConsumerStatefulWidget {
  const _MyRequestsTab();

  @override
  ConsumerState<_MyRequestsTab> createState() => _MyRequestsTabState();
}

class _MyRequestsTabState extends ConsumerState<_MyRequestsTab> {
  final Set<String> _expanded = {};
  final Map<String, bool> _loading = {};

  Future<void> _handleResponse(
      String requestId, String responseId, String action) async {
    final key = '$requestId:$responseId';
    setState(() => _loading[key] = true);
    try {
      await ref
          .read(teamUpRepositoryProvider)
          .handleResponse(requestId, responseId, action);
      ref.invalidate(myTeamUpRequestsProvider);
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(extractErrorMessage(e)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading.remove(key));
    }
  }

  @override
  Widget build(BuildContext context) {
    final myAsync = ref.watch(myTeamUpRequestsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return myAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: extractErrorMessage(e),
        onRetry: () => ref.invalidate(myTeamUpRequestsProvider),
      ),
      data: (requests) {
        if (requests.isEmpty) {
          return const UiEmptyState(
            icon: Icons.inbox_outlined,
            title: 'No requests yet',
            message: "You haven't posted any TeamUp requests yet.",
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(myTeamUpRequestsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            itemCount: requests.length,
            itemBuilder: (context, i) {
              final request = requests[i];
              final isExpanded = _expanded.contains(request.id);
              final responses = request.responses ?? [];
              final groupedResponses = <String, List<TeamUpResponseModel>>{};
              for (final response in responses) {
                final group = (response.requestPositionName == null ||
                        response.requestPositionName!.isEmpty)
                    ? 'General'
                    : response.requestPositionName!;
                groupedResponses.putIfAbsent(group, () => []).add(response);
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _RequestTile(
                    request: request,
                    trailing: IconButton(
                      icon: Icon(
                        isExpanded
                            ? Icons.expand_less
                            : Icons.expand_more,
                        size: 20,
                      ),
                      onPressed: () => setState(() {
                        if (isExpanded) {
                          _expanded.remove(request.id);
                        } else {
                          _expanded.add(request.id);
                        }
                      }),
                    ),
                  ),
                  if (isExpanded) ...[
                    Padding(
                      padding:
                          const EdgeInsets.only(left: 4, right: 4, bottom: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${request.responseCount} response${request.responseCount == 1 ? '' : 's'}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isDark
                                  ? AppThemeTokens.darkTextSecondary
                                  : AppThemeTokens.lightTextSecondary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          if (responses.isEmpty)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                'No responses yet.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDark
                                      ? AppThemeTokens.darkTextMuted
                                      : AppThemeTokens.lightTextMuted,
                                ),
                              ),
                            ),
                          ...groupedResponses.entries.expand((entry) sync* {
                            if (groupedResponses.length > 1) {
                              yield Padding(
                                padding:
                                    const EdgeInsets.only(top: 2, bottom: 6),
                                child: Text(
                                  entry.key,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: isDark
                                        ? AppThemeTokens.darkTextSecondary
                                        : AppThemeTokens.lightTextSecondary,
                                  ),
                                ),
                              );
                            }
                            for (final resp in entry.value) {
                            final key = '${request.id}:${resp.id}';
                            final busy = _loading[key] ?? false;
                            yield Container(
                              margin: const EdgeInsets.only(bottom: 6),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? AppThemeTokens.darkCardElevated
                                    : AppThemeTokens.lightCardElevated,
                                borderRadius: BorderRadius.circular(
                                    AppThemeTokens.radiusMd),
                                border: Border.all(
                                    color: isDark
                                        ? AppThemeTokens.darkBorder
                                        : AppThemeTokens.lightBorder),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  UserAvatar(
                                    name: resp.responderName,
                                    imageUrl: resp.responderPicture,
                                    radius: 14,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                resp.responderName,
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    fontWeight:
                                                        FontWeight.w600),
                                              ),
                                            ),
                                            UiStatusBadge(
                                              label: resp.status,
                                              status:
                                                  UiStatusBadge.fromString(
                                                      resp.status),
                                            ),
                                          ],
                                        ),
                                         if (resp.message.isNotEmpty) ...[
                                           const SizedBox(height: 4),
                                           Text(
                                             resp.message,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: isDark
                                                  ? AppThemeTokens
                                                      .darkTextSecondary
                                                  : AppThemeTokens
                                                      .lightTextSecondary,
                                             ),
                                           ),
                                         ],
                                         if (resp.requestPositionName != null &&
                                             resp.requestPositionName!.isNotEmpty) ...[
                                           const SizedBox(height: 4),
                                           _MetaChip(
                                             icon: Icons.sports_kabaddi_outlined,
                                             label: resp.requestPositionName!,
                                             color: AppThemeTokens.info,
                                           ),
                                         ],
                                         // Accept / Decline buttons (only for pending)
                                        if (resp.status == 'pending') ...[
                                          const SizedBox(height: 8),
                                          Row(
                                            children: [
                                              Expanded(
                                                child: OutlinedButton(
                                                  style:
                                                      OutlinedButton.styleFrom(
                                                    foregroundColor:
                                                        Theme.of(context)
                                                            .colorScheme
                                                            .error,
                                                    side: BorderSide(
                                                        color: Theme.of(context)
                                                            .colorScheme
                                                            .error),
                                                    padding: const EdgeInsets
                                                        .symmetric(vertical: 4),
                                                    textStyle: const TextStyle(
                                                        fontSize: 12),
                                                  ),
                                                  onPressed: busy
                                                      ? null
                                                      : () => _handleResponse(
                                                          request.id,
                                                          resp.id,
                                                          'decline'),
                                                  child: busy
                                                      ? const SizedBox(
                                                          width: 14,
                                                          height: 14,
                                                          child:
                                                              CircularProgressIndicator(
                                                                  strokeWidth:
                                                                      2))
                                                      : const Text('Decline'),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: ElevatedButton(
                                                  style:
                                                      ElevatedButton.styleFrom(
                                                    backgroundColor:
                                                        AppThemeTokens
                                                            .primary500,
                                                    foregroundColor:
                                                        Colors.white,
                                                    padding: const EdgeInsets
                                                        .symmetric(vertical: 4),
                                                    textStyle: const TextStyle(
                                                        fontSize: 12),
                                                  ),
                                                  onPressed: busy
                                                      ? null
                                                      : () => _handleResponse(
                                                          request.id,
                                                          resp.id,
                                                          'accept'),
                                                  child: busy
                                                      ? const SizedBox(
                                                          width: 14,
                                                          height: 14,
                                                          child:
                                                              CircularProgressIndicator(
                                                                  strokeWidth:
                                                                      2,
                                                                  color: Colors
                                                                      .white))
                                                      : const Text('Accept'),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                            }
                          }),
                        ],
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// My applications tab – responses I submitted to others' requests
// ---------------------------------------------------------------------------

class _MyApplicationsTab extends ConsumerWidget {
  const _MyApplicationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appsAsync = ref.watch(myTeamUpApplicationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final df = DateFormat('MMM d');

    return appsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: extractErrorMessage(e),
        onRetry: () => ref.invalidate(myTeamUpApplicationsProvider),
      ),
      data: (applications) {
        if (applications.isEmpty) {
          return const UiEmptyState(
            icon: Icons.send_outlined,
            title: 'No applications yet',
            message:
                "Browse requests and send a response to start applying.",
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(myTeamUpApplicationsProvider),
          child: ListView.builder(
            padding:
                const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            itemCount: applications.length,
            itemBuilder: (context, i) {
              final app = applications[i];
              final accent = _sportAccentColor(app.requestSportType);
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
                      : AppThemeTokens.lightCard.withValues(alpha: 0.98),
                  borderRadius:
                      BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(
                    color: isDark
                        ? AppThemeTokens.darkBorder
                        : AppThemeTokens.lightBorder,
                  ),
                ),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        width: 4,
                        decoration: BoxDecoration(
                          color: accent,
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(AppThemeTokens.radiusMd),
                            bottomLeft:
                                Radius.circular(AppThemeTokens.radiusMd),
                          ),
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      app.requestTitle,
                                      style: TextStyle(
                                        color: isDark
                                            ? AppThemeTokens.darkText
                                            : AppThemeTokens.lightText,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  UiStatusBadge(
                                    label: app.status,
                                    status: UiStatusBadge.fromString(app.status),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 10,
                                runSpacing: 4,
                                children: [
                                  _MetaChip(
                                    icon: Icons.sports_outlined,
                                    label: sportTypeLabel(app.requestSportType),
                                    color: accent,
                                  ),
                                  _MetaChip(
                                    icon: app.requestType == 'need_players'
                                        ? Icons.group_add_outlined
                                        : Icons.person_search_outlined,
                                    label: app.requestType == 'need_players'
                                        ? 'Need players'
                                        : 'Looking to play',
                                    color: AppThemeTokens.primary400,
                                  ),
                                  if (app.requestCity != null)
                                    _MetaChip(
                                      icon: Icons.place_outlined,
                                      label: app.requestCity!,
                                      color: isDark
                                          ? AppThemeTokens.darkTextSecondary
                                          : AppThemeTokens.lightTextSecondary,
                                    ),
                                  if (app.requestDateTime != null)
                                    _MetaChip(
                                      icon: Icons.calendar_today_outlined,
                                      label: df.format(
                                          app.requestDateTime!.toLocal()),
                                      color: isDark
                                          ? AppThemeTokens.darkTextSecondary
                                          : AppThemeTokens.lightTextSecondary,
                                    ),
                                  if (app.requestPositionName != null &&
                                      app.requestPositionName!.isNotEmpty)
                                    _MetaChip(
                                      icon: Icons.sports_kabaddi_outlined,
                                      label: app.requestPositionName!,
                                      color: AppThemeTokens.info,
                                    ),
                                ],
                              ),
                              if (app.message.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  '"${app.message}"',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontStyle: FontStyle.italic,
                                    color: isDark
                                        ? AppThemeTokens.darkTextSecondary
                                        : AppThemeTokens.lightTextSecondary,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                              if (app.applicantSkillLevel != null &&
                                  app.applicantSkillLevel!.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Your skill: ${app.applicantSkillLevel}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isDark
                                        ? AppThemeTokens.darkTextMuted
                                        : AppThemeTokens.lightTextMuted,
                                  ),
                                ),
                              ],
                              if (app.requestCreatorName != null) ...[
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    UserAvatar(
                                      name: app.requestCreatorName!,
                                      imageUrl: app.requestCreatorPicture,
                                      radius: 10,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      app.requestCreatorName!,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: isDark
                                            ? AppThemeTokens.darkTextMuted
                                            : AppThemeTokens.lightTextMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Submit request tab
// ---------------------------------------------------------------------------

class _PositionDraft {
  _PositionDraft({
    String name = '',
    String slots = '1',
    String skillLevel = '',
  })  : nameCtrl = TextEditingController(text: name),
        slotsCtrl = TextEditingController(text: slots),
        skillLevel = skillLevel;

  final TextEditingController nameCtrl;
  final TextEditingController slotsCtrl;
  String skillLevel;

  void dispose() {
    nameCtrl.dispose();
    slotsCtrl.dispose();
  }
}

class _SubmitRequestTab extends ConsumerStatefulWidget {
  const _SubmitRequestTab();

  @override
  ConsumerState<_SubmitRequestTab> createState() => _SubmitRequestTabState();
}

class _SubmitRequestTabState extends ConsumerState<_SubmitRequestTab> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _playersCtrl = TextEditingController();
  final List<_PositionDraft> _positions = [_PositionDraft()];

  String _sportType = '';
  String _requestType = 'looking_for_play';
  String _skillLevel = '';
  DateTime? _dateTime;
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _cityCtrl.dispose();
    _playersCtrl.dispose();
    for (final position in _positions) {
      position.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _dateTime ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(
          _dateTime ?? DateTime.now().add(const Duration(hours: 1))),
    );
    if (time == null || !mounted) return;
    setState(() {
      _dateTime = DateTime(
          date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // Validate: need_players requires a dateTime
    if (_requestType == 'need_players' && _dateTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Please select a session date and time.')),
      );
      return;
    }

    final positionPayload = _positions
        .map((position) => {
              'name': position.nameCtrl.text.trim(),
              'slotsNeeded':
                  int.tryParse(position.slotsCtrl.text.trim().isEmpty
                      ? '1'
                      : position.slotsCtrl.text.trim()) ??
                      1,
              if (position.skillLevel.isNotEmpty)
                'skillLevelRequired': position.skillLevel,
            })
        .where((position) => (position['name'] as String).isNotEmpty)
        .toList();

    if (_requestType == 'need_players') {
      if (positionPayload.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Add at least one required position.')),
        );
        return;
      }
      final normalizedNames = positionPayload
          .map((position) => (position['name'] as String).toLowerCase())
          .toList();
      final hasDuplicateNames =
          normalizedNames.toSet().length != normalizedNames.length;
      if (hasDuplicateNames) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content:
                  Text('Each position name must be unique for this request.')),
        );
        return;
      }
    }

    setState(() => _submitting = true);
    try {
      await ref.read(teamUpRepositoryProvider).createRequest({
        'title': _titleCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty)
          'description': _descCtrl.text.trim(),
        'requestType': _requestType,
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        if (_skillLevel.isNotEmpty) 'skillLevel': _skillLevel,
        if (_dateTime != null) 'dateTime': _dateTime!.toUtc().toIso8601String(),
        if (_locationCtrl.text.trim().isNotEmpty)
          'location': _locationCtrl.text.trim(),
        if (_cityCtrl.text.trim().isNotEmpty) 'city': _cityCtrl.text.trim(),
        if (_requestType == 'need_players') 'positions': positionPayload,
        if (_requestType != 'need_players' && _playersCtrl.text.trim().isNotEmpty)
          'playersNeeded': int.tryParse(_playersCtrl.text.trim()),
      });
      ref.invalidate(myTeamUpRequestsProvider);
      ref.read(teamUpNotifierProvider.notifier).refresh();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('TeamUp request posted!')),
        );
        _titleCtrl.clear();
        _descCtrl.clear();
        _locationCtrl.clear();
        _cityCtrl.clear();
        _playersCtrl.clear();
        setState(() {
          _sportType = '';
          _requestType = 'looking_for_play';
          _skillLevel = '';
          _dateTime = null;
          for (final position in _positions) {
            position.dispose();
          }
          _positions
            ..clear()
            ..add(_PositionDraft());
        });
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _addPosition() {
    setState(() => _positions.add(_PositionDraft()));
  }

  void _removePosition(int index) {
    if (_positions.length <= 1) return;
    setState(() {
      final removed = _positions.removeAt(index);
      removed.dispose();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final df = DateFormat('MMM d, yyyy · HH:mm');
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Title
          TextFormField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Title *',
              prefixIcon: Icon(Icons.title_outlined),
            ),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 16),

          // Request type
          DropdownButtonFormField<String>(
            initialValue: _requestType,
            decoration: const InputDecoration(
              labelText: 'Request type',
              prefixIcon: Icon(Icons.category_outlined),
            ),
            dropdownColor: isDark
                ? AppThemeTokens.darkCardElevated
                : AppThemeTokens.lightCardElevated,
            items: const [
              DropdownMenuItem(
                  value: 'looking_for_play', child: Text('Looking to play')),
              DropdownMenuItem(
                  value: 'need_players', child: Text('Need players')),
            ],
            onChanged: (v) =>
                setState(() => _requestType = v ?? 'looking_for_play'),
          ),
          const SizedBox(height: 16),

          // Date & time picker (required for need_players)
          InkWell(
            onTap: _pickDateTime,
            borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: _requestType == 'need_players'
                    ? 'Session date & time * (required)'
                    : 'Available from (optional)',
                prefixIcon: const Icon(Icons.calendar_today_outlined),
                helperText: _requestType == 'need_players' && _dateTime == null
                    ? 'A date and time is required for "Need players"'
                    : null,
                helperStyle: TextStyle(
                    color: Theme.of(context).colorScheme.error, fontSize: 11),
              ),
              child: Text(
                _dateTime != null
                    ? df.format(_dateTime!.toLocal())
                    : _requestType == 'need_players'
                        ? 'Tap to pick date and time (required)'
                        : 'Any time (tap to specify)',
                style: TextStyle(
                  color: _dateTime != null
                      ? null
                      : _requestType == 'need_players'
                          ? Theme.of(context).colorScheme.error
                          : isDark
                              ? AppThemeTokens.darkTextMuted
                              : AppThemeTokens.lightTextMuted,
                  fontSize: 14,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Sport type
          DropdownButtonFormField<String>(
            initialValue: _sportType,
            decoration: const InputDecoration(
              labelText: 'Sport type',
              prefixIcon: Icon(Icons.sports_outlined),
            ),
            dropdownColor: isDark
                ? AppThemeTokens.darkCardElevated
                : AppThemeTokens.lightCardElevated,
            items: kSportTypes
                .map(
                  (s) => DropdownMenuItem(
                    value: s['value'],
                    child: Text(s['label']!),
                  ),
                )
                .toList(),
            onChanged: (v) => setState(() => _sportType = v ?? ''),
          ),
          const SizedBox(height: 16),

          // Skill level
          DropdownButtonFormField<String>(
            value: _skillLevel.isEmpty ? null : _skillLevel,
            decoration: const InputDecoration(
              labelText: 'Skill level (optional)',
              prefixIcon: Icon(Icons.emoji_events_outlined),
            ),
            dropdownColor: isDark
                ? AppThemeTokens.darkCardElevated
                : AppThemeTokens.lightCardElevated,
            items: const [
              DropdownMenuItem(value: 'any', child: Text('Any level')),
              DropdownMenuItem(value: 'beginner', child: Text('Beginner')),
              DropdownMenuItem(
                  value: 'intermediate', child: Text('Intermediate')),
              DropdownMenuItem(value: 'advanced', child: Text('Advanced')),
            ],
            onChanged: (v) => setState(() => _skillLevel = v ?? ''),
          ),
          const SizedBox(height: 16),

          // Description
          TextFormField(
            controller: _descCtrl,
            decoration: const InputDecoration(
              labelText: 'Details (optional)',
              prefixIcon: Icon(Icons.notes_outlined),
              alignLabelWithHint: true,
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),

          if (_requestType == 'need_players') ...[
            Row(
              children: [
                const Icon(Icons.sports_kabaddi_outlined, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Positions needed',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _addPosition,
                  icon: const Icon(Icons.add),
                  label: const Text('Add'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...List.generate(_positions.length, (index) {
              final position = _positions[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                  border: Border.all(
                    color: isDark
                        ? AppThemeTokens.darkBorder
                        : AppThemeTokens.lightBorder,
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Position ${index + 1}',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        IconButton(
                          onPressed:
                              _positions.length > 1 ? () => _removePosition(index) : null,
                          icon: const Icon(Icons.close),
                          tooltip: 'Remove position',
                        ),
                      ],
                    ),
                    TextFormField(
                      controller: position.nameCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Position name *',
                        prefixIcon: Icon(Icons.badge_outlined),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: position.slotsCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Slots needed',
                        prefixIcon: Icon(Icons.group_outlined),
                      ),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: position.skillLevel.isEmpty ? null : position.skillLevel,
                      decoration: const InputDecoration(
                        labelText: 'Required skill level (optional)',
                        prefixIcon: Icon(Icons.emoji_events_outlined),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'any', child: Text('Any level')),
                        DropdownMenuItem(value: 'beginner', child: Text('Beginner')),
                        DropdownMenuItem(
                            value: 'intermediate', child: Text('Intermediate')),
                        DropdownMenuItem(value: 'advanced', child: Text('Advanced')),
                      ],
                      onChanged: (value) => setState(() {
                        position.skillLevel = value ?? '';
                      }),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 6),
          ] else ...[
            // Players needed (legacy/non-position requests)
            TextFormField(
              controller: _playersCtrl,
              decoration: const InputDecoration(
                labelText: 'Players needed (optional)',
                prefixIcon: Icon(Icons.group_outlined),
              ),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
          ],

          // City
          TextFormField(
            controller: _cityCtrl,
            decoration: const InputDecoration(
              labelText: 'City (optional)',
              prefixIcon: Icon(Icons.location_city_outlined),
            ),
          ),
          const SizedBox(height: 16),

          // Location
          TextFormField(
            controller: _locationCtrl,
            decoration: const InputDecoration(
              labelText: 'Specific location (optional)',
              prefixIcon: Icon(Icons.place_outlined),
            ),
          ),
          const SizedBox(height: 28),

          UiPrimaryButton(
            text: 'Post Request',
            icon: Icons.send_outlined,
            onPressed: _submitting ? null : _submit,
            loading: _submitting,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared: request tile
// ---------------------------------------------------------------------------

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request, this.trailing});

  final TeamUpRequestModel request;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('MMM d');
    final accent = _sportAccentColor(request.sportType);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Urgency: session within 24 hours
    final isUrgent = request.dateTime != null &&
        request.dateTime!.difference(DateTime.now()).inHours < 24 &&
        request.status == 'open';

    return GestureDetector(
      onTap: () => _showDetail(context, request),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: isDark
              ? AppThemeTokens.darkCard.withValues(alpha: 0.92)
              : AppThemeTokens.lightCard.withValues(alpha: 0.98),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
          border: Border.all(
            color: isUrgent
                ? AppThemeTokens.warning.withValues(alpha: 0.6)
                : isDark
                    ? AppThemeTokens.darkBorder
                    : AppThemeTokens.lightBorder,
          ),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left accent bar
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(AppThemeTokens.radiusMd),
                    bottomLeft: Radius.circular(AppThemeTokens.radiusMd),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top row: avatar + name + status badge + optional trailing
                      Row(
                        children: [
                          UserAvatar(
                            name: request.creatorName,
                            imageUrl: request.creatorPicture,
                            radius: 14,
                            borderColor: accent.withValues(alpha: 0.4),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              request.creatorName,
                              style: TextStyle(
                                color: isDark
                                    ? AppThemeTokens.darkTextSecondary
                                    : AppThemeTokens.lightTextSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isUrgent)
                            Container(
                              margin: const EdgeInsets.only(right: 6),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppThemeTokens.warning
                                    .withValues(alpha: 0.15),
                                borderRadius:
                                    BorderRadius.circular(AppThemeTokens.radiusSm),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.bolt,
                                      size: 10, color: AppThemeTokens.warning),
                                  const SizedBox(width: 2),
                                  Text(
                                    'Urgent',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: AppThemeTokens.warning,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          UiStatusBadge(
                            label: request.status == 'open' ? 'Open' : request.status,
                            status: request.status == 'open'
                                ? UiStatusType.success
                                : UiStatusType.defaultStatus,
                            dot: true,
                          ),
                          if (trailing != null) trailing!,
                        ],
                      ),
                      const SizedBox(height: 8),
                      // Title
                      Text(
                        request.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDark
                              ? AppThemeTokens.darkText
                              : AppThemeTokens.lightText,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Meta row
                      Wrap(
                        spacing: 10,
                        runSpacing: 4,
                        children: [
                          if (request.sportType.isNotEmpty)
                            _MetaChip(
                              icon: Icons.sports_outlined,
                              label: sportTypeLabel(request.sportType),
                              color: accent,
                            ),
                          _MetaChip(
                            icon: request.requestType == 'need_players'
                                ? Icons.group_add_outlined
                                : Icons.person_search_outlined,
                            label: request.requestType == 'need_players'
                                ? 'Need players'
                                : 'Looking to play',
                            color: AppThemeTokens.primary400,
                          ),
                          if (request.skillLevel != null &&
                              request.skillLevel!.isNotEmpty)
                            _MetaChip(
                              icon: Icons.emoji_events_outlined,
                              label: request.skillLevel!,
                              color: AppThemeTokens.info,
                            ),
                          if ((request.positions?.isNotEmpty ?? false))
                            _MetaChip(
                              icon: Icons.sports_kabaddi_outlined,
                              label:
                                  '${request.positions!.length} position${request.positions!.length == 1 ? '' : 's'}',
                              color: AppThemeTokens.info,
                            ),
                          if (request.city != null)
                            _MetaChip(
                              icon: Icons.place_outlined,
                              label: request.city!,
                              color: isDark
                                  ? AppThemeTokens.darkTextSecondary
                                  : AppThemeTokens.lightTextSecondary,
                            ),
                          if (request.dateTime != null)
                            _MetaChip(
                              icon: Icons.calendar_today_outlined,
                              label: df.format(request.dateTime!.toLocal()),
                              color: isUrgent
                                  ? AppThemeTokens.warning
                                  : isDark
                                      ? AppThemeTokens.darkTextSecondary
                                      : AppThemeTokens.lightTextSecondary,
                            ),
                          if (request.responseCount > 0)
                            _MetaChip(
                              icon: Icons.chat_bubble_outline,
                              label:
                                  '${request.responseCount} response${request.responseCount == 1 ? '' : 's'}',
                              color: AppThemeTokens.info,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context, TeamUpRequestModel request) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RequestDetailSheet(request: request),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip(
      {required this.icon, required this.label, required this.color});
  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: color.withValues(alpha: 0.8)),
        const SizedBox(width: 3),
        Text(
          label,
          style: TextStyle(
            color: color.withValues(alpha: 0.8),
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Request detail bottom sheet
// ---------------------------------------------------------------------------

class _RequestDetailSheet extends ConsumerStatefulWidget {
  const _RequestDetailSheet({required this.request});

  final TeamUpRequestModel request;

  @override
  ConsumerState<_RequestDetailSheet> createState() =>
      _RequestDetailSheetState();
}

class _RequestDetailSheetState extends ConsumerState<_RequestDetailSheet> {
  final _msgCtrl = TextEditingController();
  final _commentCtrl = TextEditingController();
  String? _selectedPositionId;
  String? _applicantSkillLevel;
  bool _sending = false;
  bool _sendingComment = false;

  @override
  void dispose() {
    _msgCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _respond() async {
    final msg = _msgCtrl.text.trim();
    if (msg.isEmpty) return;
    final positions = widget.request.positions ?? const <TeamUpRequestPositionModel>[];
    final openPositions = positions
        .where((position) =>
            (position.isOpen ?? true) &&
            ((position.slotsAvailable ?? position.slotsNeeded) > 0))
        .toList();
    if (openPositions.isNotEmpty && _selectedPositionId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a position before applying.')),
      );
      return;
    }
    setState(() => _sending = true);
    try {
      await ref
          .read(teamUpRepositoryProvider)
          .respondToRequest(
            widget.request.id,
            msg,
            requestPositionId: _selectedPositionId,
            applicantSkillLevel: _applicantSkillLevel,
          );
      _msgCtrl.clear();
      ref.invalidate(teamUpRequestResponsesProvider(widget.request.id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Response sent!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _addComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sendingComment = true);
    try {
      await ref
          .read(teamUpRepositoryProvider)
          .addComment(widget.request.id, text);
      _commentCtrl.clear();
      ref.invalidate(teamUpCommentsProvider(widget.request.id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Comment added!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(extractErrorMessage(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sendingComment = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final responsesAsync = ref.watch(teamUpRequestResponsesProvider(r.id));
    final commentsAsync = ref.watch(teamUpCommentsProvider(r.id));
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final accent = _sportAccentColor(r.sportType);

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, scrollCtrl) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppThemeTokens.darkBorder
                      : AppThemeTokens.lightBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              Expanded(
                child: ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    // Header card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppThemeTokens.darkCard.withValues(alpha: 0.94)
                            : AppThemeTokens.lightCard.withValues(alpha: 0.98),
                        borderRadius:
                            BorderRadius.circular(AppThemeTokens.radiusMd),
                        border: Border.all(
                          color: isDark
                              ? AppThemeTokens.darkBorder
                              : AppThemeTokens.lightBorder,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 4,
                                height: 40,
                                margin: const EdgeInsets.only(right: 12),
                                decoration: BoxDecoration(
                                  color: accent,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  r.title,
                                  style: theme.textTheme.titleLarge,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              if (r.sportType.isNotEmpty)
                                UiStatusBadge(
                                  label: sportTypeLabel(r.sportType),
                                  customColor: accent,
                                ),
                              UiStatusBadge(
                                label: r.requestType == 'need_players'
                                    ? 'Need players'
                                    : 'Looking to play',
                                status: UiStatusType.info,
                              ),
                              UiStatusBadge(
                                label: r.status == 'open' ? 'Open' : 'Closed',
                                status: r.status == 'open'
                                    ? UiStatusType.success
                                    : UiStatusType.defaultStatus,
                                dot: true,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Description
                    if (r.description != null) ...[
                      UiCard(
                        padding: const EdgeInsets.all(14),
                        child: Text(
                          r.description!,
                          style: TextStyle(
                            color: isDark
                                ? AppThemeTokens.darkTextSecondary
                                : AppThemeTokens.lightTextSecondary,
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Meta rows
                    UiCard(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      child: Column(
                        children: [
                          if (r.playersNeeded != null)
                            UiInfoRow(
                              icon: Icons.group_outlined,
                              label: 'Players needed',
                              value: '${r.playersNeeded}',
                              iconColor: AppThemeTokens.primary400,
                            ),
                          if (r.city != null)
                            UiInfoRow(
                              icon: Icons.place_outlined,
                              label: r.city!,
                              iconColor: AppThemeTokens.warning,
                            ),
                          if (r.dateTime != null)
                            UiInfoRow(
                              icon: Icons.calendar_today_outlined,
                              label: r.requestType == 'need_players'
                                  ? 'Session date'
                                  : 'Available from',
                              value: DateFormat.yMMMd()
                                  .add_Hm()
                                  .format(r.dateTime!.toLocal()),
                              iconColor: AppThemeTokens.info,
                            ),
                          if (r.skillLevel != null && r.skillLevel!.isNotEmpty)
                            UiInfoRow(
                              icon: Icons.emoji_events_outlined,
                              label: 'Skill level',
                              value: r.skillLevel!,
                              iconColor: AppThemeTokens.info,
                            ),
                          Row(
                            children: [
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: AppThemeTokens.primary500
                                      .withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(
                                      AppThemeTokens.radiusSm),
                                ),
                                child: const Icon(Icons.person_outline,
                                    size: 14, color: AppThemeTokens.primary400),
                              ),
                              const SizedBox(width: 10),
                              UserAvatar(
                                name: r.creatorName,
                                imageUrl: r.creatorPicture,
                                radius: 12,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                r.creatorName,
                                style: TextStyle(
                                  color: isDark
                                      ? AppThemeTokens.darkTextSecondary
                                      : AppThemeTokens.lightTextSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (r.positions != null && r.positions!.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      UiCard(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const UiSectionTitle('Needed positions'),
                            const SizedBox(height: 8),
                            ...r.positions!.map(
                              (position) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: UiInfoRow(
                                  icon: Icons.sports_kabaddi_outlined,
                                  label: position.name,
                                  value:
                                      '${position.acceptedCount}/${position.slotsNeeded} filled${position.skillLevelRequired != null && position.skillLevelRequired!.isNotEmpty ? ' · ${position.skillLevelRequired}' : ''}',
                                  iconColor: AppThemeTokens.info,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),

                    // Responses section
                    const UiSectionTitle('Responses'),
                    const SizedBox(height: 10),
                    responsesAsync.when(
                      loading: () => const Center(
                          child: CircularProgressIndicator(strokeWidth: 2)),
                      error: (e, _) => Text(
                        'Could not load responses: $e',
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                      data: (responses) {
                        if (responses.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? AppThemeTokens.darkCardElevated
                                  : AppThemeTokens.lightCardElevated,
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd),
                              border: Border.all(
                                color: isDark
                                    ? AppThemeTokens.darkBorder
                                    : AppThemeTokens.lightBorder,
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.chat_bubble_outline,
                                    size: 16,
                                    color: isDark
                                        ? AppThemeTokens.darkTextMuted
                                        : AppThemeTokens.lightTextMuted),
                                const SizedBox(width: 8),
                                Text(
                                  'No responses yet.',
                                  style: TextStyle(
                                      color: isDark
                                          ? AppThemeTokens.darkTextSecondary
                                          : AppThemeTokens.lightTextSecondary,
                                      fontSize: 13),
                                ),
                              ],
                            ),
                          );
                        }
                        return Column(
                          children: responses
                              .map(
                                (resp) => Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? AppThemeTokens.darkCardElevated
                                        : AppThemeTokens.lightCardElevated,
                                    borderRadius: BorderRadius.circular(
                                        AppThemeTokens.radiusMd),
                                    border: Border.all(
                                        color: isDark
                                            ? AppThemeTokens.darkBorder
                                            : AppThemeTokens.lightBorder),
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      UserAvatar(
                                        name: resp.responderName,
                                        imageUrl: resp.responderPicture,
                                        radius: 16,
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    resp.responderName,
                                                    style: TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      fontSize: 13,
                                                      color: isDark
                                                          ? AppThemeTokens
                                                              .darkText
                                                          : AppThemeTokens
                                                              .lightText,
                                                    ),
                                                  ),
                                                ),
                                                UiStatusBadge(
                                                  label: resp.status,
                                                  status:
                                                      UiStatusBadge.fromString(
                                                          resp.status),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              resp.message,
                                              style: TextStyle(
                                                color: isDark
                                                    ? AppThemeTokens
                                                        .darkTextSecondary
                                                    : AppThemeTokens
                                                        .lightTextSecondary,
                                                fontSize: 13,
                                                height: 1.4,
                                              ),
                                            ),
                                            if (resp.requestPositionName != null &&
                                                resp.requestPositionName!.isNotEmpty) ...[
                                              const SizedBox(height: 4),
                                              _MetaChip(
                                                icon: Icons.sports_kabaddi_outlined,
                                                label: resp.requestPositionName!,
                                                color: AppThemeTokens.info,
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                              .toList(),
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    // Respond form (only if open)
                    if (r.status == 'open') ...[
                      Builder(
                        builder: (context) {
                          final positions = r.positions ?? const <TeamUpRequestPositionModel>[];
                          final openPositions = positions
                              .where((position) =>
                                  (position.isOpen ?? true) &&
                                  ((position.slotsAvailable ?? position.slotsNeeded) > 0))
                              .toList();
                          final noOpenPositions =
                              positions.isNotEmpty && openPositions.isEmpty;
                          if (noOpenPositions) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Text(
                                'All positions are currently filled for this request.',
                                style: TextStyle(color: theme.colorScheme.error),
                              ),
                            );
                          }
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (openPositions.isNotEmpty) ...[
                                DropdownButtonFormField<String>(
                                  value: _selectedPositionId,
                                  decoration: const InputDecoration(
                                    labelText: 'Apply for position *',
                                    prefixIcon: Icon(Icons.sports_kabaddi_outlined),
                                  ),
                                  items: openPositions
                                      .map(
                                        (position) => DropdownMenuItem(
                                          value: position.id,
                                          child: Text(
                                              '${position.name} (${position.slotsAvailable ?? (position.slotsNeeded - position.acceptedCount)} spots left)'),
                                        ),
                                      )
                                      .toList(),
                                  onChanged: (value) =>
                                      setState(() => _selectedPositionId = value),
                                ),
                                const SizedBox(height: 10),
                                DropdownButtonFormField<String>(
                                  value: _applicantSkillLevel,
                                  decoration: const InputDecoration(
                                    labelText: 'Your skill level (optional)',
                                    prefixIcon: Icon(Icons.emoji_events_outlined),
                                  ),
                                  items: const [
                                    DropdownMenuItem(value: 'any', child: Text('Any')),
                                    DropdownMenuItem(
                                        value: 'beginner', child: Text('Beginner')),
                                    DropdownMenuItem(
                                        value: 'intermediate',
                                        child: Text('Intermediate')),
                                    DropdownMenuItem(
                                        value: 'advanced', child: Text('Advanced')),
                                  ],
                                  onChanged: (value) =>
                                      setState(() => _applicantSkillLevel = value),
                                ),
                                const SizedBox(height: 12),
                              ],
                            ],
                          );
                        },
                      ),
                      const UiSectionTitle('Send a response'),
                      const SizedBox(height: 10),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _msgCtrl,
                              decoration: const InputDecoration(
                                hintText: 'Your message…',
                              ),
                              maxLines: 2,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            decoration: BoxDecoration(
                              gradient: AppThemeTokens.primaryGradient,
                              borderRadius: BorderRadius.circular(
                                  AppThemeTokens.radiusMd),
                            ),
                            child: IconButton(
                              onPressed: _sending
                                  ? null
                                  : () {
                                      final positions = r.positions ??
                                          const <TeamUpRequestPositionModel>[];
                                      final openPositions = positions
                                          .where((position) =>
                                              (position.isOpen ?? true) &&
                                              ((position.slotsAvailable ??
                                                      position.slotsNeeded) >
                                                  0))
                                          .toList();
                                      if (openPositions.isNotEmpty &&
                                          _selectedPositionId == null) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                              content: Text(
                                                  'Select a position before applying.')),
                                        );
                                        return;
                                      }
                                      if (positions.isNotEmpty &&
                                          openPositions.isEmpty) {
                                        return;
                                      }
                                      _respond();
                                    },
                              icon: _sending
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(Icons.send_rounded,
                                      color: Colors.white),
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 20),

                    // Comments section
                    const UiSectionTitle('Comments'),
                    const SizedBox(height: 10),
                    commentsAsync.when(
                      loading: () => const Center(
                          child: CircularProgressIndicator(strokeWidth: 2)),
                      error: (e, _) => Text(
                        'Could not load comments: $e',
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                      data: (comments) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (comments.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Text(
                                  'No comments yet. Be the first to comment!',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: isDark
                                        ? AppThemeTokens.darkTextSecondary
                                        : AppThemeTokens.lightTextSecondary,
                                  ),
                                ),
                              ),
                            ...comments.map((c) => Container(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? AppThemeTokens.darkCardElevated
                                        : AppThemeTokens.lightCardElevated,
                                    borderRadius: BorderRadius.circular(
                                        AppThemeTokens.radiusMd),
                                    border: Border.all(
                                        color: isDark
                                            ? AppThemeTokens.darkBorder
                                            : AppThemeTokens.lightBorder),
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      UserAvatar(
                                        name: c.authorName,
                                        imageUrl: c.authorPicture,
                                        radius: 14,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              c.authorName,
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              c.content,
                                              style: TextStyle(
                                                fontSize: 13,
                                                color: isDark
                                                    ? AppThemeTokens
                                                        .darkTextSecondary
                                                    : AppThemeTokens
                                                        .lightTextSecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                )),
                            // Comment compose box
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _commentCtrl,
                                    decoration: const InputDecoration(
                                      hintText: 'Add a comment…',
                                    ),
                                    maxLines: 2,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                IconButton(
                                  onPressed:
                                      _sendingComment ? null : _addComment,
                                  icon: _sendingComment
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2))
                                      : const Icon(Icons.comment_outlined),
                                ),
                              ],
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Filter chip helper
// ---------------------------------------------------------------------------

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.value,
    required this.options,
    required this.onSelected,
  });

  final String label;
  final String value;
  final List<MapEntry<String, String>> options;
  final void Function(String) onSelected;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final selected = value.isNotEmpty;
    final displayLabel =
        selected ? options.firstWhere((e) => e.key == value).value : label;

    return GestureDetector(
      onTap: () async {
        final result = await showDialog<String>(
          context: context,
          builder: (ctx) => SimpleDialog(
            title: Text('Filter by $label'),
            children: [
              SimpleDialogOption(
                onPressed: () => Navigator.of(ctx).pop(''),
                child: const Text('All'),
              ),
              ...options.map(
                (e) => SimpleDialogOption(
                  onPressed: () => Navigator.of(ctx).pop(e.key),
                  child: Text(e.value),
                ),
              ),
            ],
          ),
        );
        if (result != null) onSelected(result);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? AppThemeTokens.primary500.withValues(alpha: 0.15)
              : (isDark
                  ? AppThemeTokens.darkCardElevated
                  : AppThemeTokens.lightCardElevated),
          borderRadius: BorderRadius.circular(AppThemeTokens.radiusSm),
          border: Border.all(
            color: selected
                ? AppThemeTokens.primary500
                : (isDark
                    ? AppThemeTokens.darkBorder
                    : AppThemeTokens.lightBorder),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected)
              const Padding(
                padding: EdgeInsets.only(right: 5),
                child: Icon(Icons.check_circle_rounded,
                    size: 13, color: AppThemeTokens.primary400),
              ),
            Text(
              displayLabel,
              style: TextStyle(
                color: selected
                    ? AppThemeTokens.primary400
                    : (isDark
                        ? AppThemeTokens.darkTextSecondary
                        : AppThemeTokens.lightTextSecondary),
                fontSize: 13,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 16,
              color: selected
                  ? AppThemeTokens.primary400
                  : (isDark
                      ? AppThemeTokens.darkTextMuted
                      : AppThemeTokens.lightTextMuted),
            ),
          ],
        ),
      ),
    );
  }
}
