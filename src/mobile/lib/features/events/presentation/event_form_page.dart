import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/error/app_exception.dart';
import '../../../core/models/event_model.dart';
import '../data/event_repository_impl.dart';
import '../state/events_notifier.dart';

class EventFormPage extends ConsumerStatefulWidget {
  const EventFormPage({
    super.key,
    required this.groupId,
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
  DateTime _endTime =
      DateTime.now().add(const Duration(days: 1, hours: 2));
  bool _saving = false;

  bool get _isEditing => widget.existingEvent != null;

  @override
  void initState() {
    super.initState();
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
      'groupId': widget.groupId,
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
            // Title
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Title *',
                prefixIcon: Icon(Icons.event_outlined),
                border: OutlineInputBorder(),
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
                border: OutlineInputBorder(),
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
                  border: OutlineInputBorder(),
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
                  border: OutlineInputBorder(),
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
                border: OutlineInputBorder(),
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
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // City
            TextFormField(
              controller: _cityCtrl,
              decoration: const InputDecoration(
                labelText: 'City (optional)',
                prefixIcon: Icon(Icons.location_city_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Max players
            TextFormField(
              controller: _maxPlayersCtrl,
              decoration: const InputDecoration(
                labelText: 'Max players (optional)',
                prefixIcon: Icon(Icons.people_outline),
                border: OutlineInputBorder(),
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
            SwitchListTile(
              title: const Text('Public event'),
              subtitle: const Text('Anyone can see and join this event'),
              value: _isPublic,
              onChanged: (v) => setState(() => _isPublic = v),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 24),

            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                child: Text(_isEditing ? 'Update Event' : 'Create Event'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
