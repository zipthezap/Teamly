import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/event_model.dart';
import '../../../core/theme/app_theme.dart';
import '../../../features/groups/state/groups_notifier.dart';
import '../../../shared/widgets/ui_primitives.dart';
import '../data/event_repository_impl.dart';
import '../state/events_notifier.dart';

/// Sport types valid in the backend (excludes the empty "None/Mixed" option
/// that is only used for group filtering, since eventType is required).
final _kSportTypeItems =
    kSportTypes.where((s) => s['value']!.isNotEmpty).toList();

class EventFormPage extends ConsumerStatefulWidget {
  const EventFormPage({
    super.key,
    this.groupId = '',
    this.existingEvent,
  });

  final String groupId;
  final EventModel? existingEvent;

  @override
  ConsumerState<EventFormPage> createState() => _EventFormPageState();
}

class _EventFormPageState extends ConsumerState<EventFormPage> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _titleCtrl;
  late TextEditingController _descCtrl;
  late TextEditingController _locationCtrl;
  late TextEditingController _cityCtrl;
  late TextEditingController _maxPlayersCtrl;

  String _eventType = 'football';
  bool _isPublic = true;
  DateTime _startTime = DateTime.now().add(const Duration(days: 1));
  DateTime _endTime = DateTime.now().add(const Duration(days: 1, hours: 2));
  bool _saving = false;

  /// Resolved group id — may be picked by the user when widget.groupId is empty.
  late String _selectedGroupId;

  bool get _isEditing => widget.existingEvent != null;

  @override
  void initState() {
    super.initState();
    // When editing an event that was opened without an explicit groupId (e.g.
    // from EventDetailPage), fall back to the existing event's group so that
    // submit validation doesn't block with "Please select a group".
    _selectedGroupId = widget.groupId.isNotEmpty
        ? widget.groupId
        : (widget.existingEvent?.group.id ?? '');
    final e = widget.existingEvent;
    _titleCtrl = TextEditingController(text: e?.title ?? '');
    _descCtrl = TextEditingController(text: e?.description ?? '');
    _locationCtrl = TextEditingController(text: e?.locationName ?? e?.location ?? '');
    _cityCtrl = TextEditingController(text: e?.city ?? '');
    _maxPlayersCtrl = TextEditingController(
      text: e?.maxPlayers != null ? '${e!.maxPlayers}' : '',
    );
    _eventType = _validSportType(e?.eventType);
    _isPublic = e?.isPublic ?? true;
    if (e != null) {
      _startTime = e.startTime;
      _endTime = e.endTime;
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _cityCtrl.dispose();
    _maxPlayersCtrl.dispose();
    super.dispose();
  }

  /// Returns [value] if it is a valid sport type, otherwise falls back to
  /// 'football'. This guards against stale/unknown eventType values from the API.
  static String _validSportType(String? value) {
    if (value != null &&
        _kSportTypeItems.any((s) => s['value'] == value)) {
      return value;
    }
    return 'football';
  }

  String _extractMsg(Exception e) {
    if (e is AppException) return e.message;
    return e.toString().replaceFirst('Exception: ', '');
  }

  Future<void> _pickDateTime({required bool isStart}) async {
    final date = await showDatePicker(
      context: context,
      initialDate: isStart ? _startTime : _endTime,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
    );
    if (date == null || !mounted) return;

    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(isStart ? _startTime : _endTime),
    );
    if (time == null || !mounted) return;

    final dt = DateTime(
      date.year, date.month, date.day, time.hour, time.minute,
    );
    setState(() {
      if (isStart) {
        _startTime = dt;
        if (_endTime.isBefore(_startTime)) {
          _endTime = _startTime.add(const Duration(hours: 2));
        }
      } else {
        _endTime = dt;
      }
    });
  }

  Future<void> _submit() async {
    if (_selectedGroupId.isEmpty && !_isEditing) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a group for this event')),
      );
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_endTime.isBefore(_startTime)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End time must be after start time')),
      );
      return;
    }
    setState(() => _saving = true);

    final data = <String, dynamic>{
      'title': _titleCtrl.text.trim(),
      'groupId': _selectedGroupId,
      'startTime': _startTime.toUtc().toIso8601String(),
      'endTime': _endTime.toUtc().toIso8601String(),
      'isPublic': _isPublic,
      'eventType': _eventType,
      if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
      if (_locationCtrl.text.trim().isNotEmpty) 'location': _locationCtrl.text.trim(),
      if (_cityCtrl.text.trim().isNotEmpty) 'city': _cityCtrl.text.trim(),
      if (_maxPlayersCtrl.text.trim().isNotEmpty)
        'maxPlayers': int.tryParse(_maxPlayersCtrl.text.trim()),
    };

    try {
      final repo = ref.read(eventRepositoryProvider);
      if (_isEditing) {
        await repo.updateEvent(widget.existingEvent!.id, data);
        ref.invalidate(eventDetailProvider(widget.existingEvent!.id));
        ref.invalidate(groupEventsProvider(_selectedGroupId));
      } else {
        await repo.createEvent(data);
        ref.invalidate(groupEventsProvider(_selectedGroupId));
      }
      ref.read(eventsNotifierProvider.notifier).load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditing ? 'Event updated!' : 'Event created!'),
          ),
        );
        Navigator.of(context).pop(true);
      }
    } on Exception catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractMsg(e)),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('EEE, MMM d, y – h:mm a');
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Edit Event' : 'Create Event'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Form header ──────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: AppThemeTokens.heroGradient,
                borderRadius: BorderRadius.circular(AppThemeTokens.radiusLg),
                border: Border.all(color: AppThemeTokens.darkBorder),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppThemeTokens.primary500.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
                    ),
                    child: const Icon(Icons.sports_outlined,
                        color: AppThemeTokens.primary400, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isEditing ? 'Edit Event' : 'New Event',
                          style: const TextStyle(
                            color: AppThemeTokens.darkText,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          _isEditing
                              ? 'Update event details below'
                              : 'Fill in the details to create your event',
                          style: const TextStyle(
                            color: AppThemeTokens.darkTextSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Section: Basic Info ───────────────────────────────────
            const _FormSectionTitle(title: 'Basic Info', icon: Icons.info_outline_rounded),
            const SizedBox(height: 12),

            // Group picker (shown only when creating an event without a pre-selected group)
            if (widget.groupId.isEmpty && !_isEditing) ...[
              _GroupPickerField(
                selectedGroupId: _selectedGroupId,
                onChanged: (id) => setState(() => _selectedGroupId = id),
              ),
              const SizedBox(height: 14),
            ],

            // Title
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Title *',
                prefixIcon: Icon(Icons.event_outlined),
              ),
              textCapitalization: TextCapitalization.words,
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Title is required' : null,
            ),
            const SizedBox(height: 14),

            // Sport type
            DropdownButtonFormField<String>(
              value: _eventType,
              decoration: const InputDecoration(
                labelText: 'Sport',
                prefixIcon: Icon(Icons.sports_soccer_outlined),
              ),
              items: _kSportTypeItems
                  .map(
                    (t) => DropdownMenuItem(
                      value: t['value'],
                      child: Text(t['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _eventType = v ?? 'football'),
            ),
            const SizedBox(height: 24),

            // ── Section: Schedule ─────────────────────────────────────
            const _FormSectionTitle(title: 'Schedule', icon: Icons.calendar_month_outlined),
            const SizedBox(height: 12),

            // Start time
            InkWell(
              onTap: () => _pickDateTime(isStart: true),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Start time *',
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                ),
                child: Text(df.format(_startTime.toLocal())),
              ),
            ),
            const SizedBox(height: 14),

            // End time
            InkWell(
              onTap: () => _pickDateTime(isStart: false),
              borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'End time *',
                  prefixIcon: Icon(Icons.access_time),
                ),
                child: Text(df.format(_endTime.toLocal())),
              ),
            ),
            const SizedBox(height: 24),

            // ── Section: Details ──────────────────────────────────────
            const _FormSectionTitle(title: 'Details', icon: Icons.notes_rounded),
            const SizedBox(height: 12),

            // Description
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                prefixIcon: Icon(Icons.description_outlined),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 14),

            // Location
            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(
                labelText: 'Location (optional)',
                prefixIcon: Icon(Icons.place_outlined),
              ),
            ),
            const SizedBox(height: 14),

            // City
            TextFormField(
              controller: _cityCtrl,
              decoration: const InputDecoration(
                labelText: 'City (optional)',
                prefixIcon: Icon(Icons.location_city_outlined),
              ),
            ),
            const SizedBox(height: 14),

            // Max players
            TextFormField(
              controller: _maxPlayersCtrl,
              decoration: const InputDecoration(
                labelText: 'Max players (optional)',
                prefixIcon: Icon(Icons.people_outline),
              ),
              keyboardType: TextInputType.number,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return null;
                final n = int.tryParse(v.trim());
                if (n == null || n < 1) return 'Enter a valid number';
                return null;
              },
            ),
            const SizedBox(height: 24),

            // ── Section: Settings ─────────────────────────────────────
            const _FormSectionTitle(title: 'Settings', icon: Icons.tune_rounded),
            const SizedBox(height: 12),

            // Public toggle
            _EventSwitchRow(
              title: 'Public event',
              subtitle: 'Anyone can see and join this event',
              value: _isPublic,
              onChanged: (v) => setState(() => _isPublic = v),
            ),

            const SizedBox(height: 28),

            UiPrimaryButton(
              text: _isEditing ? 'Update Event' : 'Create Event',
              onPressed: _saving ? null : _submit,
              loading: _saving,
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Group picker for when event is created from the Events list (no groupId)
// ---------------------------------------------------------------------------

class _GroupPickerField extends ConsumerWidget {
  const _GroupPickerField({
    required this.selectedGroupId,
    required this.onChanged,
  });

  final String selectedGroupId;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(groupsNotifierProvider);

    return groupsAsync.when(
      loading: () => const InputDecorator(
        decoration: InputDecoration(
          labelText: 'Group *',
          
        ),
        child: Text('Loading groups…'),
      ),
      error: (_, __) => const InputDecorator(
        decoration: InputDecoration(
          labelText: 'Group *',
          
        ),
        child: Text('Could not load groups'),
      ),
      data: (groups) {
        if (groups.isEmpty) {
          return const InputDecorator(
            decoration: InputDecoration(
              labelText: 'Group *',
              
            ),
            child: Text('No groups — create a group first'),
          );
        }
        final selected = selectedGroupId.isNotEmpty &&
                groups.any((g) => g.id == selectedGroupId)
            ? selectedGroupId
            : '';
        return DropdownButtonFormField<String>(
          value: selected.isEmpty ? null : selected,
          decoration: const InputDecoration(
            labelText: 'Group *',
            prefixIcon: Icon(Icons.group_outlined),
            
          ),
          hint: const Text('Select a group'),
          items: groups
              .map((g) => DropdownMenuItem(value: g.id, child: Text(g.name)))
              .toList(),
          onChanged: (v) => onChanged(v ?? ''),
        );
      },
    );
  }
}

class _EventSwitchRow extends StatelessWidget {
  const _EventSwitchRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppThemeTokens.darkCard,
        borderRadius: BorderRadius.circular(AppThemeTokens.radiusMd),
        border: Border.all(color: AppThemeTokens.darkBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppThemeTokens.primary500.withValues(alpha: 0.15),
              borderRadius:
                  BorderRadius.circular(AppThemeTokens.radiusSm),
            ),
            child: const Icon(Icons.public_rounded,
                color: AppThemeTokens.primary500, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: AppThemeTokens.darkText)),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppThemeTokens.darkTextSecondary)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section title widget used to visually group form fields
// ---------------------------------------------------------------------------

class _FormSectionTitle extends StatelessWidget {
  const _FormSectionTitle({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppThemeTokens.primary400),
        const SizedBox(width: 7),
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppThemeTokens.darkTextSecondary,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Container(
            height: 1,
            color: AppThemeTokens.darkBorderSubtle,
          ),
        ),
      ],
    );
  }
}
