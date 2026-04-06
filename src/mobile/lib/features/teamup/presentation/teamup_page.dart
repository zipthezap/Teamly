import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/teamup_model.dart';
import '../../../shared/widgets/error_display.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../data/teamup_repository_impl.dart';
import '../state/teamup_notifier.dart';

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
    return Scaffold(
      appBar: AppBar(
        title: const Text('TeamUp'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Browse'),
            Tab(text: 'My Requests'),
            Tab(text: 'Submit'),
          ],
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
    final theme = Theme.of(context);

    return Column(
      children: [
        // Filters
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              _FilterChip(
                label: 'Sport',
                value: _sportFilter,
                options: kSportTypes
                    .where((s) => s['value']!.isNotEmpty)
                    .map((s) => MapEntry(s['value']!, s['label']!))
                    .toList(),
                onSelected: (v) {
                  setState(() => _sportFilter = v);
                  ref
                      .read(teamUpNotifierProvider.notifier)
                      .load(sportType: v, requestType: _typeFilter);
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
                onSelected: (v) {
                  setState(() => _typeFilter = v);
                  ref
                      .read(teamUpNotifierProvider.notifier)
                      .load(sportType: _sportFilter, requestType: v);
                },
              ),
            ],
          ),
        ),

        // List
        Expanded(
          child: requestsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => ErrorDisplay(
              message: e.toString(),
              onRetry: () => ref
                  .read(teamUpNotifierProvider.notifier)
                  .load(sportType: _sportFilter, requestType: _typeFilter),
            ),
            data: (requests) {
              if (requests.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.handshake_outlined,
                            size: 56, color: theme.colorScheme.outline),
                        const SizedBox(height: 12),
                        const Text(
                          'No TeamUp requests found.',
                          style: const TextStyle(color: AppThemeTokens.darkTextSecondary),
                        ),
                      ],
                    ),
                  ),
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref
                    .read(teamUpNotifierProvider.notifier)
                    .load(sportType: _sportFilter, requestType: _typeFilter),
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: requests.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, indent: 16),
                  itemBuilder: (context, i) =>
                      _RequestTile(request: requests[i]),
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
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.inbox_outlined, size: 56, color: AppThemeTokens.darkTextSecondary),
                  SizedBox(height: 12),
                  Text(
                    "You haven't made any TeamUp requests yet.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppThemeTokens.darkTextSecondary),
                  ),
                ],
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(myTeamUpRequestsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: requests.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 16),
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
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        'requestType': _requestType,
        if (_sportType.isNotEmpty) 'sportType': _sportType,
        if (_locationCtrl.text.trim().isNotEmpty) 'location': _locationCtrl.text.trim(),
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
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Title
          TextFormField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Title *',
              border: OutlineInputBorder(),
            ),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 16),

          // Request type
          DropdownButtonFormField<String>(
            value: _requestType,
            decoration: const InputDecoration(
              labelText: 'Request type',
              border: OutlineInputBorder(),
            ),
            items: const [
              DropdownMenuItem(
                  value: 'looking_for_play', child: Text('Looking to play')),
              DropdownMenuItem(
                  value: 'need_players', child: Text('Need players')),
            ],
            onChanged: (v) => setState(() => _requestType = v ?? 'looking_for_play'),
          ),
          const SizedBox(height: 16),

          // Sport type
          DropdownButtonFormField<String>(
            value: _sportType,
            decoration: const InputDecoration(
              labelText: 'Sport type',
              border: OutlineInputBorder(),
            ),
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
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          const SizedBox(height: 16),

          // Players needed
          TextFormField(
            controller: _playersCtrl,
            decoration: const InputDecoration(
              labelText: 'Players needed (optional)',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 16),

          // City
          TextFormField(
            controller: _cityCtrl,
            decoration: const InputDecoration(
              labelText: 'City (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),

          // Location
          TextFormField(
            controller: _locationCtrl,
            decoration: const InputDecoration(
              labelText: 'Specific location (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 24),

          SizedBox(
            height: 48,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Post Request'),
            ),
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
    final theme = Theme.of(context);
    final df = DateFormat('MMM d');
    return ListTile(
      leading: UserAvatar(name: request.creatorName, imageUrl: request.creatorPicture),
      title: Text(request.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        [
          if (request.sportType.isNotEmpty) sportTypeLabel(request.sportType),
          request.requestType == 'need_players' ? 'Need players' : 'Looking to play',
          if (request.city != null) request.city!,
          if (request.availableFrom != null)
            df.format(request.availableFrom!.toLocal()),
          if (request.responseCount > 0)
            '${request.responseCount} response${request.responseCount == 1 ? '' : 's'}',
        ].join(' · '),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontSize: 12),
      ),
      isThreeLine: true,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: request.status == 'open'
              ? theme.colorScheme.primaryContainer
              : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          request.status == 'open' ? 'Open' : 'Closed',
          style: TextStyle(
            fontSize: 11,
            color: request.status == 'open'
                ? theme.colorScheme.onPrimaryContainer
                : AppThemeTokens.darkTextSecondary,
          ),
        ),
      ),
      onTap: () => _showDetail(context, request),
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
    final responsesAsync =
        ref.watch(teamUpRequestResponsesProvider(r.id));
    final theme = Theme.of(context);

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
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppThemeTokens.darkTextSecondary.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              Expanded(
                child: ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    Text(r.title, style: theme.textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: [
                        Chip(label: Text(sportTypeLabel(r.sportType))),
                        Chip(
                          label: Text(
                            r.requestType == 'need_players'
                                ? 'Need players'
                                : 'Looking to play',
                          ),
                        ),
                        Chip(
                          label: Text(r.status == 'open' ? 'Open' : 'Closed'),
                          backgroundColor: r.status == 'open'
                              ? theme.colorScheme.primaryContainer
                              : null,
                        ),
                      ],
                    ),
                    if (r.description != null) ...[
                      const SizedBox(height: 12),
                      Text(r.description!),
                    ],
                    if (r.playersNeeded != null) ...[
                      const SizedBox(height: 8),
                      Text('Players needed: ${r.playersNeeded}'),
                    ],
                    if (r.city != null) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.place_outlined, size: 16),
                          const SizedBox(width: 4),
                          Text(r.city!),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        UserAvatar(
                            name: r.creatorName,
                            imageUrl: r.creatorPicture,
                            radius: 14),
                        const SizedBox(width: 8),
                        Text(r.creatorName,
                            style: theme.textTheme.bodySmall),
                      ],
                    ),
                    const Divider(height: 24),

                    // Responses
                    Text('Responses', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 8),
                    responsesAsync.when(
                      loading: () => const Center(
                          child: CircularProgressIndicator(strokeWidth: 2)),
                      error: (e, _) => Text(
                        'Could not load responses: $e',
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                      data: (responses) {
                        if (responses.isEmpty) {
                          return const Text('No responses yet.',
                              style: const TextStyle(color: AppThemeTokens.darkTextSecondary));
                        }
                        return Column(
                          children: responses
                              .map(
                                (resp) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: UserAvatar(
                                    name: resp.responderName,
                                    imageUrl: resp.responderPicture,
                                  ),
                                  title: Text(resp.responderName),
                                  subtitle: Text(resp.message),
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: resp.status == 'accepted'
                                          ? const Color(0xFF1B5E20)
                                          : resp.status == 'rejected'
                                              ? const Color(0xFFB71C1C)
                                              : AppThemeTokens.darkCardHover,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      resp.status,
                                      style: const TextStyle(fontSize: 11),
                                    ),
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
                      Text('Send a response',
                          style: theme.textTheme.titleSmall),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _msgCtrl,
                              decoration: const InputDecoration(
                                hintText: 'Your message…',
                                border: OutlineInputBorder(),
                              ),
                              maxLines: 2,
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
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
                                : const Icon(Icons.send),
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
    final selected = value.isNotEmpty;
    final displayLabel =
        selected ? options.firstWhere((e) => e.key == value).value : label;

    return FilterChip(
      label: Text(displayLabel),
      selected: selected,
      onSelected: (_) async {
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
    );
  }
}
