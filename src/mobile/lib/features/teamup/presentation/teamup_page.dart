import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
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
    _tabController = TabController(length: 3, vsync: this);
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
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                unselectedLabelStyle:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                tabs: const [
                  Tab(text: 'Browse'),
                  Tab(text: 'My Requests'),
                  Tab(text: 'Submit'),
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
                    ref
                        .read(teamUpNotifierProvider.notifier)
                        .load(sportType: value, requestType: _typeFilter);
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
                    ref
                        .read(teamUpNotifierProvider.notifier)
                        .load(sportType: _sportFilter, requestType: value);
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
              message: error.toString(),
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
// My requests tab
// ---------------------------------------------------------------------------

class _MyRequestsTab extends ConsumerWidget {
  const _MyRequestsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final myAsync = ref.watch(myTeamUpRequestsProvider);
    return myAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorDisplay(
        message: e.toString(),
        onRetry: () => ref.invalidate(myTeamUpRequestsProvider),
      ),
      data: (requests) {
        if (requests.isEmpty) {
          return const UiEmptyState(
            icon: Icons.inbox_outlined,
            title: 'No requests yet',
            message: "You haven't made any TeamUp requests yet.",
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(myTeamUpRequestsProvider),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            itemCount: requests.length,
            itemBuilder: (context, i) => _RequestTile(request: requests[i]),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Submit request tab
// ---------------------------------------------------------------------------

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

  String _sportType = '';
  String _requestType = 'looking_for_play';
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _cityCtrl.dispose();
    _playersCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      await ref.read(teamUpRepositoryProvider).createRequest({
        'title': _titleCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty)
          'description': _descCtrl.text.trim(),
        'requestType': _requestType,
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        if (_locationCtrl.text.trim().isNotEmpty)
          'location': _locationCtrl.text.trim(),
        if (_cityCtrl.text.trim().isNotEmpty) 'city': _cityCtrl.text.trim(),
        if (_playersCtrl.text.trim().isNotEmpty)
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
        });
      }
    } on Exception catch (e) {
      if (mounted) {
        final msg = e is AppException
            ? e.message
            : e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
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

          // Players needed
          TextFormField(
            controller: _playersCtrl,
            decoration: const InputDecoration(
              labelText: 'Players needed (optional)',
              prefixIcon: Icon(Icons.group_outlined),
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),

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
  const _RequestTile({required this.request});

  final TeamUpRequestModel request;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('MMM d');
    final accent = _sportAccentColor(request.sportType);
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
            color:
                isDark ? AppThemeTokens.darkBorder : AppThemeTokens.lightBorder,
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
                      // Top row: avatar + name + status badge
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
                          UiStatusBadge(
                            label: request.status == 'open' ? 'Open' : 'Closed',
                            status: request.status == 'open'
                                ? UiStatusType.success
                                : UiStatusType.defaultStatus,
                            dot: true,
                          ),
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
                          if (request.city != null)
                            _MetaChip(
                              icon: Icons.place_outlined,
                              label: request.city!,
                              color: isDark
                                  ? AppThemeTokens.darkTextSecondary
                                  : AppThemeTokens.lightTextSecondary,
                            ),
                          if (request.availableFrom != null)
                            _MetaChip(
                              icon: Icons.calendar_today_outlined,
                              label:
                                  df.format(request.availableFrom!.toLocal()),
                              color: isDark
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
  bool _sending = false;

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _respond() async {
    final msg = _msgCtrl.text.trim();
    if (msg.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(teamUpRepositoryProvider)
          .respondToRequest(widget.request.id, msg);
      _msgCtrl.clear();
      ref.invalidate(teamUpRequestResponsesProvider(widget.request.id));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Response sent!')),
        );
      }
    } on Exception catch (e) {
      if (mounted) {
        final msg2 = e is AppException
            ? e.message
            : e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg2),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final responsesAsync = ref.watch(teamUpRequestResponsesProvider(r.id));
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
                          if (r.availableFrom != null)
                            UiInfoRow(
                              icon: Icons.calendar_today_outlined,
                              label: 'Available from',
                              value: DateFormat.yMMMd()
                                  .format(r.availableFrom!.toLocal()),
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

                    // Respond form (only if open and not own request)
                    if (r.status == 'open') ...[
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
                              onPressed: _sending ? null : _respond,
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
