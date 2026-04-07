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

  String _eventType = 'match';
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
    _selectedGroupId = widget.groupId;
    final e = widget.existingEvent;
    _titleCtrl = TextEditingController(text: e?.title ?? '');
    _descCtrl = TextEditingController(text: e?.description ?? '');
    _locationCtrl = TextEditingController(text: e?.locationName ?? e?.location ?? '');
    _cityCtrl = TextEditingController(text: e?.city ?? '');
    _maxPlayersCtrl = TextEditingController(
      text: e?.maxPlayers != null ? '${e!.maxPlayers}' : '',
    );
    _eventType = e?.eventType ?? 'match';
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
    if (_selectedGroupId.isEmpty) {
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
      } else {
        await repo.createEvent(data);
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
            // Group picker (shown when navigating from Events tab without a pre-selected group)
            if (widget.groupId.isEmpty) ...[
              _GroupPickerField(
                selectedGroupId: _selectedGroupId,
                onChanged: (id) => setState(() => _selectedGroupId = id),
              ),
              const SizedBox(height: 16),
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
            const SizedBox(height: 16),

            // Event type
            DropdownButtonFormField<String>(
              value: _eventType,
              decoration: const InputDecoration(
                labelText: 'Event type',
                prefixIcon: Icon(Icons.sports_outlined),
                
              ),
              items: kEventTypes
                  .map(
                    (t) => DropdownMenuItem(
                      value: t['value'],
                      child: Text(t['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _eventType = v ?? 'match'),
            ),
            const SizedBox(height: 16),

            // Start time
            InkWell(
              onTap: () => _pickDateTime(isStart: true),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Start time *',
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                  
                ),
                child: Text(df.format(_startTime.toLocal())),
              ),
            ),
            const SizedBox(height: 16),

            // End time
            InkWell(
              onTap: () => _pickDateTime(isStart: false),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'End time *',
                  prefixIcon: Icon(Icons.access_time),
                  
                ),
                child: Text(df.format(_endTime.toLocal())),
              ),
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                prefixIcon: Icon(Icons.description_outlined),
                
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 16),

            // Location
            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(
                labelText: 'Location (optional)',
                prefixIcon: Icon(Icons.place_outlined),
                
              ),
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
            const SizedBox(height: 16),

            // Public toggle
            _EventSwitchRow(
              title: 'Public event',
              subtitle: 'Anyone can see and join this event',
              value: _isPublic,
              onChanged: (v) => setState(() => _isPublic = v),
            ),

            const SizedBox(height: 24),

            UiPrimaryButton(
              text: _isEditing ? 'Update Event' : 'Create Event',
              onPressed: _saving ? null : _submit,
              loading: _saving,
            ),
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
